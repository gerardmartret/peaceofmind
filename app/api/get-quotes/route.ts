import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';

export async function POST(request: NextRequest) {
  try {
    const { tripId } = await request.json();

    // Validate required fields
    if (!tripId) {
      return NextResponse.json(
        { success: false, error: 'Trip ID is required' },
        { status: 400 }
      );
    }

    console.log(`📊 Fetching quotes for trip: ${tripId}`);

    // Get auth token from request headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', quotes: [] },
        { status: 401 }
      );
    }

    // Create authenticated Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('❌ Authentication failed');
      return NextResponse.json(
        { success: false, error: 'Unauthorized', quotes: [] },
        { status: 401 }
      );
    }

    // Fetch quotes for this trip - RLS will automatically filter to only show quotes
    // for trips owned by the authenticated user
    const { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

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

