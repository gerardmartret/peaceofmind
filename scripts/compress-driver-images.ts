/**
 * One-time script to compress driver images and upload to Supabase Storage
 * 
 * Prerequisites:
 * 1. Add compressed_image_url column to drivers table in Supabase:
 *    ALTER TABLE drivers ADD COLUMN compressed_image_url TEXT;
 * 
 * 2. Ensure environment variables are set:
 *    - NEXT_PUBLIC_SUPABASE_URL
 *    - NEXT_SUPABASE_SERVICE_ROLE_KEY
 * 
 * Usage: npm run compress-images
 * 
 * This script:
 * 1. Creates 'driver-images' bucket in Supabase Storage (if it doesn't exist)
 * 2. Fetches all drivers with image_url from the database
 * 3. Downloads each image
 * 4. Compresses it to 48x48px WebP format (quality 75)
 * 5. Uploads to Supabase Storage bucket 'driver-images'
 * 6. Updates the database with compressed_image_url
 */

// Load environment variables first (before other imports)
import 'dotenv/config';

import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   NEXT_SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✅' : '❌');
  console.error('\n💡 Make sure these are set in your .env or .env.local file');
  process.exit(1);
}

// Create Supabase admin client with service role key
const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const BUCKET_NAME = 'driver-images';
const TARGET_SIZE = 48; // 48x48px
const QUALITY = 75;

async function ensureBucketExists() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    throw new Error(`Failed to list buckets: ${listError.message}`);
  }

  const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);
  
  if (!bucketExists) {
    console.log(`📦 Creating bucket: ${BUCKET_NAME}...`);
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      allowedMimeTypes: ['image/webp', 'image/jpeg', 'image/png'],
    });

    if (createError) {
      throw new Error(`Failed to create bucket: ${createError.message}`);
    }
    console.log(`✅ Bucket created: ${BUCKET_NAME}`);
  } else {
    console.log(`✅ Bucket exists: ${BUCKET_NAME}`);
  }
}

async function compressAndUploadImage(
  driverId: string,
  imageUrl: string
): Promise<string> {
  try {
    // Download the image
    console.log(`  📥 Downloading: ${imageUrl}`);
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(imageBuffer);

    // Compress image: resize to 48x48, convert to WebP, quality 75
    console.log(`  🔄 Compressing to ${TARGET_SIZE}x${TARGET_SIZE}px WebP...`);
    const compressedBuffer = await sharp(buffer)
      .resize(TARGET_SIZE, TARGET_SIZE, {
        fit: 'cover', // Crop to cover, maintaining aspect ratio
        position: 'center',
      })
      .webp({ quality: QUALITY })
      .toBuffer();

    const originalSize = buffer.length;
    const compressedSize = compressedBuffer.length;
    const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    console.log(`  📊 Size: ${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB (${reduction}% reduction)`);

    // Upload to Supabase Storage
    const fileName = `${driverId}.webp`;
    const filePath = fileName;

    console.log(`  ⬆️  Uploading to ${BUCKET_NAME}/${filePath}...`);
    const { data, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, compressedBuffer, {
        contentType: 'image/webp',
        upsert: true, // Overwrite if exists
      });

    if (uploadError) {
      throw new Error(`Failed to upload: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL');
    }

    console.log(`  ✅ Uploaded: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error: any) {
    console.error(`  ❌ Error processing image for driver ${driverId}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting driver image compression script...\n');

  try {
    // Ensure bucket exists
    await ensureBucketExists();
    console.log('');

    // Fetch all drivers with image_url
    console.log('📋 Fetching drivers with images...');
    const { data: drivers, error: fetchError } = await supabase
      .from('drivers')
      .select('id, first_name, image_url, compressed_image_url')
      .not('image_url', 'is', null);

    if (fetchError) {
      throw new Error(`Failed to fetch drivers: ${fetchError.message}`);
    }

    if (!drivers || drivers.length === 0) {
      console.log('ℹ️  No drivers with images found.');
      return;
    }

    console.log(`✅ Found ${drivers.length} drivers with images\n`);

    // Process each driver
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const driver of drivers) {
      // Skip if already compressed
      if (driver.compressed_image_url) {
        console.log(`⏭️  Skipping ${driver.first_name} (id: ${driver.id}) - already has compressed image`);
        skipCount++;
        continue;
      }

      if (!driver.image_url) {
        console.log(`⏭️  Skipping ${driver.first_name} (id: ${driver.id}) - no image_url`);
        skipCount++;
        continue;
      }

      console.log(`\n🔄 Processing: ${driver.first_name} (id: ${driver.id})`);

      try {
        const compressedUrl = await compressAndUploadImage(driver.id, driver.image_url);

        // Update database with compressed_image_url
        const { error: updateError } = await supabase
          .from('drivers')
          .update({ compressed_image_url: compressedUrl })
          .eq('id', driver.id);

        if (updateError) {
          throw new Error(`Failed to update database: ${updateError.message}`);
        }

        console.log(`  ✅ Database updated`);
        successCount++;
      } catch (error: any) {
        console.error(`  ❌ Failed: ${error.message}`);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`  ✅ Successfully processed: ${successCount}`);
    console.log(`  ⏭️  Skipped: ${skipCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`  📦 Total: ${drivers.length}`);
    console.log('='.repeat(50));

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

