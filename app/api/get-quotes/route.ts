import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { tripId, driverEmail } = await request.json();

    // Validate required fields
    if (!tripId) {
      return NextResponse.json(
        { success: false, error: 'Trip ID is required' },
        { status: 400 }
      );
    }

    console.log(`📊 Fetching quotes for trip: ${tripId}${driverEmail ? ` (driver: ${driverEmail})` : ''}`);

    // Build the query
    let query = supabase
      .from('quotes')
      .select('*')
      .eq('trip_id', tripId);

    // If driverEmail is provided, filter to only show that driver's quotes
    // This ensures drivers can only see their own quotes
    if (driverEmail) {
      query = query.eq('email', driverEmail.toLowerCase().trim());
    }

    // Fetch quotes for this trip
    const { data: quotes, error: quotesError } = await query.order('created_at', { ascending: false });

    if (quotesError) {
      console.error('❌ Error fetching quotes:', quotesError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch quotes', quotes: [] },
        { status: 500 }
      );
    }

    console.log(`✅ Fetched ${quotes?.length || 0} quotes`);
    return NextResponse.json({ 
      success: true, 
      quotes: quotes || []
    });
  } catch (error) {
    console.error('❌ Error in get-quotes API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', quotes: [] },
      { status: 500 }
    );
  }
}

