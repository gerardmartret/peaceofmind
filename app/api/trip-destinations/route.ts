import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ALLOWED_TRIP_DESTINATIONS } from '@/lib/city-helpers';

export async function GET(request: NextRequest) {
  try {
    console.log('📍 Fetching unique trip destinations from database...');

    // Query to get distinct trip_destination values where they are not null
    const { data, error } = await supabase
      .from('trips')
      .select('trip_destination')
      .not('trip_destination', 'is', null)
      .order('trip_destination', { ascending: true });

    if (error) {
      console.error('❌ Error fetching trip destinations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch trip destinations', details: error.message },
        { status: 500 }
      );
    }

    // Extract unique destinations and filter by whitelist
    const uniqueDestinations = [...new Set(
      data
        .map(row => row.trip_destination)
        .filter(dest => dest && dest.trim() !== '') // Filter out empty strings
        .filter(dest => ALLOWED_TRIP_DESTINATIONS.includes(dest as any)) // Only whitelisted destinations
    )].sort();

    // Always include all allowed destinations even if not in database yet
    const allDestinations = [...new Set([
      ...ALLOWED_TRIP_DESTINATIONS,
      ...uniqueDestinations
    ])].sort();

    console.log(`✅ Found ${uniqueDestinations.length} unique whitelisted trip destinations`);
    console.log(`📋 Returning ${allDestinations.length} total destinations (including defaults)`);
    console.log('📋 Destinations:', allDestinations);

    return NextResponse.json({ destinations: allDestinations });

  } catch (error: any) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

