import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    // Extract unique destinations (remove duplicates)
    const uniqueDestinations = [...new Set(
      data
        .map(row => row.trip_destination)
        .filter(dest => dest && dest.trim() !== '') // Filter out empty strings
    )].sort();

    console.log(`✅ Found ${uniqueDestinations.length} unique trip destinations`);
    console.log('📋 Destinations:', uniqueDestinations);

    return NextResponse.json({ destinations: uniqueDestinations });

  } catch (error: any) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

