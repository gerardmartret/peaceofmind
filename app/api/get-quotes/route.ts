import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tripId, driverEmail } = body;

    // Validate required fields
    if (!tripId) {
      console.error('❌ Missing tripId in request body');
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
      console.error('❌ Error fetching quotes from Supabase:', quotesError);
      console.error('   Error details:', JSON.stringify(quotesError, null, 2));
      return NextResponse.json(
        { 
          success: false, 
          error: quotesError.message || 'Failed to fetch quotes',
          details: quotesError.details || null,
          quotes: [] 
        },
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('   Error stack:', errorStack);
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage || 'Internal server error',
        quotes: [] 
      },
      { status: 500 }
    );
  }
}

