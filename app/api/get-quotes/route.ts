import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tripId, driverEmail } = body;

    // Validate required fields
    if (!tripId) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Missing tripId in request body');
      }
      return NextResponse.json(
        { success: false, error: 'Trip ID is required' },
        { status: 400 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Fetching quotes for trip: ${tripId}${driverEmail ? ` (driver: ${driverEmail})` : ''}`);
    }

    // Build the query (only needed fields)
    let query = supabase
      .from('quotes')
      .select('id, trip_id, email, driver_name, price, currency, created_at, updated_at')
      .eq('trip_id', tripId);

    // If driverEmail is provided, filter to only show that driver's quotes
    // This ensures drivers can only see their own quotes
    if (driverEmail) {
      query = query.eq('email', driverEmail.toLowerCase().trim());
    }

    // Fetch quotes for this trip
    const { data: quotes, error: quotesError } = await query.order('created_at', { ascending: false });

    if (quotesError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error fetching quotes from Supabase:', quotesError);
        console.error('   Error details:', JSON.stringify(quotesError, null, 2));
      }
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch quotes',
          quotes: [] 
        },
        { status: 500 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Fetched ${quotes?.length || 0} quotes`);
    }
    return NextResponse.json({ 
      success: true, 
      quotes: quotes || []
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error in get-quotes API:', error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('   Error stack:', errorStack);
    }
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        quotes: [] 
      },
      { status: 500 }
    );
  }
}

