import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { token, tripId } = await request.json();

    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Validating driver token for trip:', tripId);
    }

    if (!token || !tripId) {
      return NextResponse.json(
        { success: false, error: 'Token and trip ID are required' },
        { status: 400 }
      );
    }

    // Fetch token from database (only needed fields)
    const { data: tokenData, error: tokenError } = await supabase
      .from('driver_tokens')
      .select('id, used, invalidated_at, invalidation_reason, expires_at, driver_email')
      .eq('token', token)
      .eq('trip_id', tripId)
      .single();

    if (tokenError || !tokenData) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Token not found:', tokenError);
      }
      return NextResponse.json(
        { success: false, error: 'Invalid or expired link' },
        { status: 404 }
      );
    }

    // Check if token has been used (allow viewing but flag as used)
    const tokenAlreadyUsed = tokenData.used === true;
    if (tokenAlreadyUsed && process.env.NODE_ENV === 'development') {
      console.log('ℹ️ Token already used - allowing view but disabling actions');
    }

    // Check if token has been invalidated
    if (tokenData.invalidated_at) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Token invalidated - reason:', tokenData.invalidation_reason);
      }
      return NextResponse.json(
        { 
          success: false, 
          error: tokenData.invalidation_reason === 'driver_changed' 
            ? 'A different driver has been assigned to this trip'
            : 'This link is no longer valid'
        },
        { status: 400 }
      );
    }

    // Check if token has expired (3 days)
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    
    if (now > expiresAt) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Token expired');
      }
      return NextResponse.json(
        { success: false, error: 'This link has expired (valid for 3 days)' },
        { status: 400 }
      );
    }

    // Verify driver email matches trip
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('driver, status')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Trip not found:', tripError);
      }
      return NextResponse.json(
        { success: false, error: 'Trip not found' },
        { status: 404 }
      );
    }

    // Verify the token's driver email matches the trip's assigned driver
    if (trip.driver?.toLowerCase() !== tokenData.driver_email.toLowerCase()) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Driver mismatch detected');
      }
      return NextResponse.json(
        { success: false, error: 'This link is not valid for the currently assigned driver' },
        { status: 403 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Token validated successfully');
    }

    // Check if trip status is still pending (determines if actions are allowed)
    const canTakeAction = trip.status === 'pending' && !tokenAlreadyUsed;
    
    // Return success with driver email and flags
    return NextResponse.json({
      success: true,
      driverEmail: tokenData.driver_email,
      tripStatus: trip.status,
      tokenUsed: tokenAlreadyUsed,
      canTakeAction: canTakeAction,
      message: tokenAlreadyUsed 
        ? 'You have already responded to this trip'
        : trip.status !== 'pending'
        ? `This trip is ${trip.status}`
        : null
    });

  } catch (error) {
    console.error('❌ Error in validate-driver-token API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

