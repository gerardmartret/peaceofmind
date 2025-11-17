import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ALLOWED_TRIP_DESTINATIONS } from '@/lib/city-helpers';

/**
 * Cleanup API endpoint to fix invalid trip destinations
 * This endpoint:
 * 1. Finds all trips with invalid destinations
 * 2. Updates them to a valid destination or null
 * 
 * Usage: POST /api/cleanup-destinations
 * Body: { 
 *   invalidDestination: "Portobello Market",
 *   replacementDestination: "London" // or null to set to null
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invalidDestination, replacementDestination } = body;

    if (!invalidDestination) {
      return NextResponse.json(
        { success: false, error: 'invalidDestination is required' },
        { status: 400 }
      );
    }

    // Validate replacement destination if provided
    if (replacementDestination && !ALLOWED_TRIP_DESTINATIONS.includes(replacementDestination as any)) {
      return NextResponse.json(
        { success: false, error: `replacementDestination "${replacementDestination}" is not in the allowed list` },
        { status: 400 }
      );
    }

    console.log(`🧹 Starting cleanup: "${invalidDestination}" → "${replacementDestination || 'null'}"`);

    // First, find all trips with this invalid destination
    const { data: tripsToUpdate, error: findError } = await supabase
      .from('trips')
      .select('id, trip_destination')
      .eq('trip_destination', invalidDestination);

    if (findError) {
      console.error('❌ Error finding trips:', findError);
      return NextResponse.json(
        { success: false, error: 'Failed to find trips', details: findError.message },
        { status: 500 }
      );
    }

    const tripCount = tripsToUpdate?.length || 0;
    console.log(`📊 Found ${tripCount} trip(s) with destination "${invalidDestination}"`);

    if (tripCount === 0) {
      return NextResponse.json({
        success: true,
        message: `No trips found with destination "${invalidDestination}"`,
        updatedCount: 0
      });
    }

    // Update all trips with the invalid destination
    const { data: updatedTrips, error: updateError } = await supabase
      .from('trips')
      .update({ trip_destination: replacementDestination || null })
      .eq('trip_destination', invalidDestination)
      .select('id');

    if (updateError) {
      console.error('❌ Error updating trips:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update trips', details: updateError.message },
        { status: 500 }
      );
    }

    const updatedCount = updatedTrips?.length || 0;
    console.log(`✅ Successfully updated ${updatedCount} trip(s)`);

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} trip(s) from "${invalidDestination}" to "${replacementDestination || 'null'}"`,
      updatedCount,
      tripIds: updatedTrips?.map(t => t.id) || []
    });

  } catch (error: any) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to list all invalid destinations in the database
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Finding all invalid trip destinations...');

    // Get all unique destinations from database
    const { data, error } = await supabase
      .from('trips')
      .select('trip_destination')
      .not('trip_destination', 'is', null)
      .order('trip_destination', { ascending: true });

    if (error) {
      console.error('❌ Error fetching destinations:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch destinations', details: error.message },
        { status: 500 }
      );
    }

    // Find invalid destinations (not in whitelist)
    const uniqueDestinations = [...new Set(
      data
        .map(row => row.trip_destination)
        .filter((dest): dest is string => dest !== null && dest.trim() !== '')
    )];

    const invalidDestinations = uniqueDestinations.filter(
      dest => !ALLOWED_TRIP_DESTINATIONS.includes(dest as any)
    );

    // Count trips for each invalid destination
    const invalidWithCounts = await Promise.all(
      invalidDestinations.map(async (dest) => {
        const { count } = await supabase
          .from('trips')
          .select('id', { count: 'exact', head: true })
          .eq('trip_destination', dest);
        
        return {
          destination: dest,
          tripCount: count || 0
        };
      })
    );

    console.log(`📊 Found ${invalidDestinations.length} invalid destination(s)`);

    return NextResponse.json({
      success: true,
      invalidDestinations: invalidWithCounts,
      allowedDestinations: ALLOWED_TRIP_DESTINATIONS
    });

  } catch (error: any) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

