/**
 * Script to compress driver images and upload to Supabase Storage
 * 
 * Prerequisites:
 * 1. Add compressed_image_url column to drivers table in Supabase:
 *    ALTER TABLE drivers ADD COLUMN compressed_image_url TEXT;
 *    (Already done via migration)
 * 
 * 2. Ensure environment variables are set in .env or .env.local:
 *    - NEXT_PUBLIC_SUPABASE_URL
 *    - NEXT_SUPABASE_SERVICE_ROLE_KEY
 * 
 * Usage: npm run compress-images
 * 
 * This script:
 * 1. Creates 'driver-images' bucket in Supabase Storage (if it doesn't exist)
 * 2. Fetches all drivers with image_url from the database
 * 3. For each driver:
 *    - Checks if compressed_image_url already exists → skips if yes
 *    - Downloads the original image
 *    - Compresses it to 48x48px WebP format (quality 75)
 *    - Uploads to Supabase Storage bucket 'driver-images'
 *    - Updates the database with compressed_image_url
 */

// Load environment variables first (before other imports)
import 'dotenv/config';

import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';

// Load environment variables
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

async function downloadImageWithRetry(
  imageUrl: string,
  maxRetries = 2,
  timeoutMs = 30000
): Promise<Buffer> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(imageUrl, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (response.status === 404) {
        throw new Error('Image not found (404)');
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const imageBuffer = await response.arrayBuffer();
      return Buffer.from(imageBuffer);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Download timeout');
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw new Error('Download failed after retries');
}

async function compressAndUploadImage(
  driverId: string,
  imageUrl: string
): Promise<string> {
  try {
    // Download the image with retry logic
    console.log(`  📥 Downloading: ${imageUrl}`);
    let buffer: Buffer;
    
    try {
      buffer = await downloadImageWithRetry(imageUrl);
    } catch (error: any) {
      if (error.message.includes('404') || error.message.includes('not found')) {
        throw new Error('IMAGE_NOT_FOUND');
      }
      throw new Error(`Download failed: ${error.message}`);
    }

    // Validate buffer is not empty
    if (!buffer || buffer.length === 0) {
      throw new Error('Downloaded image is empty');
    }

    // Compress image: resize to 48x48, convert to WebP, quality 75
    // Use failOnError: false to handle corrupted images gracefully
    console.log(`  🔄 Compressing to ${TARGET_SIZE}x${TARGET_SIZE}px WebP...`);
    let compressedBuffer: Buffer;
    
    try {
      compressedBuffer = await sharp(buffer, {
        failOnError: false, // Don't fail on corrupt images, try to process anyway
        limitInputPixels: false, // Allow very large images
      })
        .resize(TARGET_SIZE, TARGET_SIZE, {
          fit: 'cover', // Crop to cover, maintaining aspect ratio
          position: 'center',
        })
        .webp({ quality: QUALITY, effort: 4 }) // effort 4 for faster processing
        .toBuffer();
    } catch (error: any) {
      // If sharp can't process it, try to convert to a simpler format first
      if (error.message.includes('Invalid') || error.message.includes('corrupt') || error.message.includes('SOS')) {
        console.log(`  ⚠️  Image may be corrupted, attempting recovery...`);
        try {
          // Try to extract any valid image data
          compressedBuffer = await sharp(buffer, {
            failOnError: false,
            limitInputPixels: false,
          })
            .jpeg({ quality: 80 }) // Convert to JPEG first
            .resize(TARGET_SIZE, TARGET_SIZE, {
              fit: 'cover',
              position: 'center',
            })
            .webp({ quality: QUALITY })
            .toBuffer();
        } catch (recoveryError: any) {
          throw new Error('CORRUPTED_IMAGE');
        }
      } else {
        throw error;
      }
    }

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
      throw new Error(`Upload failed: ${uploadError.message}`);
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
    // Re-throw with original error message for better categorization
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

    // Separate drivers into those that need compression and those that are already compressed
    const driversToCompress = drivers.filter(driver => !driver.compressed_image_url);
    const alreadyCompressed = drivers.filter(driver => driver.compressed_image_url);

    console.log(`📊 Breakdown:`);
    console.log(`   • Already compressed: ${alreadyCompressed.length}`);
    console.log(`   • Needs compression: ${driversToCompress.length}\n`);

    if (driversToCompress.length === 0) {
      console.log('✅ All drivers already have compressed images. Nothing to do!');
      return;
    }

    // Process each driver that needs compression
    let successCount = 0;
    let errorCount = 0;
    const errorCategories: Record<string, number> = {};

    for (let i = 0; i < driversToCompress.length; i++) {
      const driver = driversToCompress[i];
      
      // Add a small delay between requests to avoid overwhelming the server
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!driver.image_url) {
        console.log(`⏭️  Skipping ${driver.first_name} (id: ${driver.id}) - no image_url`);
        continue;
      }

      console.log(`\n🔄 Processing [${i + 1}/${driversToCompress.length}]: ${driver.first_name} (id: ${driver.id})`);

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
        errorCount++;
        const errorMsg = error.message;
        
        // Categorize errors
        let category = 'Unknown';
        if (errorMsg.includes('IMAGE_NOT_FOUND') || errorMsg.includes('404') || errorMsg.includes('not found')) {
          category = 'Image not found (404)';
        } else if (errorMsg.includes('CORRUPTED_IMAGE') || errorMsg.includes('Invalid SOS') || errorMsg.includes('corrupt')) {
          category = 'Corrupted/invalid image';
        } else if (errorMsg.includes('timeout')) {
          category = 'Download timeout';
        } else if (errorMsg.includes('HEIF') || errorMsg.includes('format')) {
          category = 'Unsupported format';
        } else if (errorMsg.includes('Upload')) {
          category = 'Upload failed';
        } else {
          category = 'Other';
        }
        
        errorCategories[category] = (errorCategories[category] || 0) + 1;
        console.error(`  ❌ Failed (${category}): ${errorMsg}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`  ✅ Successfully processed: ${successCount}`);
    console.log(`  ⏭️  Already compressed (skipped): ${alreadyCompressed.length}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`  📦 Total drivers: ${drivers.length}`);
    
    if (errorCount > 0 && Object.keys(errorCategories).length > 0) {
      console.log('\n📋 Error breakdown:');
      for (const [category, count] of Object.entries(errorCategories)) {
        console.log(`   • ${category}: ${count}`);
      }
    }
    
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

