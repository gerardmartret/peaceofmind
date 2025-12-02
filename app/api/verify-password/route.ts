import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { tripId, password } = await request.json();

    // Validate input
    if (!tripId || !password) {
      return NextResponse.json(
        { success: false, error: 'Trip ID and password are required' },
        { status: 400 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔐 Verifying password for trip: ${tripId}`);
    }

    // Fetch the trip from the database
    const { data: trip, error: fetchError } = await supabase
      .from('trips')
      .select('password')
      .eq('id', tripId)
      .single();

    if (fetchError || !trip) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error fetching trip:', fetchError);
      }
      return NextResponse.json(
        { success: false, error: 'Trip not found' },
        { status: 404 }
      );
    }

    // Check if the trip has a password
    if (!trip.password) {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Trip is not password protected');
      }
      return NextResponse.json({ success: true });
    }

    // Verify the password
    if (trip.password === password) {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Password verified successfully');
      }
      return NextResponse.json({ success: true });
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ Incorrect password');
      }
      return NextResponse.json(
        { success: false, error: 'Incorrect password' },
        { status: 401 }
      );
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error in verify-password API:', error);
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

