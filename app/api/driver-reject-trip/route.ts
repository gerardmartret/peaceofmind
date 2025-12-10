import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendEmail, isEmailServiceConfigured } from '@/lib/emails/email-service';
import { driverResponseTemplate } from '@/lib/emails/templates/driver-response';
import { DRIVER_RESPONSE } from '@/lib/emails/content';

export async function POST(request: NextRequest) {
  try {
    const { tripId, token } = await request.json();

    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Driver rejection request for trip:', tripId);
    }

    if (!tripId || !token) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate token first (only needed fields)
    const { data: tokenData, error: tokenError } = await supabase
      .from('driver_tokens')
      .select('id, used, invalidated_at, expires_at, driver_email')
      .eq('token', token)
      .eq('trip_id', tripId)
      .single();

    if (tokenError || !tokenData) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Invalid token:', tokenError);
      }
      return NextResponse.json(
        { success: false, error: 'Invalid or expired link' },
        { status: 404 }
      );
    }

    // Check if token has been used
    if (tokenData.used) {
      return NextResponse.json(
        { success: false, error: 'This link has already been used' },
        { status: 400 }
      );
    }

    // Check if token has been invalidated
    if (tokenData.invalidated_at) {
      return NextResponse.json(
        { success: false, error: 'This link is no longer valid' },
        { status: 400 }
      );
    }

    // Check if token has expired
    const expiresAt = new Date(tokenData.expires_at);
    if (new Date() > expiresAt) {
      return NextResponse.json(
        { success: false, error: 'This link has expired' },
        { status: 400 }
      );
    }

    // Fetch trip details (only needed fields)
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, driver, status, trip_date, user_email, trip_destination')
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

    // Verify driver email matches
    if (trip.driver?.toLowerCase() !== tokenData.driver_email.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to modify this trip' },
        { status: 403 }
      );
    }

    // Verify trip is in pending status
    if (trip.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Trip status is "${trip.status}", not "pending"` },
        { status: 400 }
      );
    }

    // Update trip status to rejected and clear driver
    const { error: updateError } = await supabase
      .from('trips')
      .update({ 
        status: 'rejected',
        driver: null,  // Clear driver assignment
        updated_at: new Date().toISOString()
      })
      .eq('id', tripId);

    if (updateError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Failed to update trip status:', updateError);
      }
      return NextResponse.json(
        { success: false, error: 'Failed to reject trip' },
        { status: 500 }
      );
    }

    // Mark token as used
    await supabase
      .from('driver_tokens')
      .update({
        used: true,
        used_at: new Date().toISOString()
      })
      .eq('id', tokenData.id);

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Trip rejected by driver successfully');
    }

    // Send notification email to trip owner
    try {
      if (isEmailServiceConfigured() && trip.trip_destination) {
        const host = request.headers.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
        const tripLink = `${baseUrl}/results/${tripId}`;

        // Generate email HTML
        const html = driverResponseTemplate({
          type: 'rejected',
          destination: trip.trip_destination,
          driverEmail: tokenData.driver_email,
          tripLink,
        });

        // Send email
        await sendEmail({
          to: trip.user_email,
          subject: DRIVER_RESPONSE.rejected.subject(trip.trip_destination),
          html,
        });

        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Rejection notification email sent to trip owner');
        }
      }
    } catch (emailError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Failed to send rejection notification email:', emailError);
      }
      // Don't fail the operation if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Trip rejected successfully'
    });

  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error in driver-reject-trip API:', error);
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

