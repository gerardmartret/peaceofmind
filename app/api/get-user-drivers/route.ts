import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user authentication
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`👥 Fetching unique drivers for user: ${user.id}`);

    // Fetch all trips for this user that have a driver set
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('driver')
      .eq('user_id', user.id)
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

