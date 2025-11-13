import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log(`👥 Fetching unique drivers for user: ${userId}`);

    // Fetch all trips for this user that have a driver set
    // Note: RLS policies will ensure users can only see their own trips
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('driver')
      .eq('user_id', userId)
      .not('driver', 'is', null)
      .order('updated_at', { ascending: false });

    if (tripsError) {
      console.error('❌ Error fetching trips:', tripsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch driver history' },
        { status: 500 }
      );
    }

    // Extract unique driver emails
    const uniqueDrivers = [...new Set(
      trips
        .map(trip => trip.driver)
        .filter(driver => driver && driver.trim().length > 0)
    )];

    console.log(`✅ Found ${uniqueDrivers.length} unique drivers`);
    
    return NextResponse.json({ 
      success: true, 
      drivers: uniqueDrivers
    });
  } catch (error) {
    console.error('❌ Error in get-user-drivers API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

