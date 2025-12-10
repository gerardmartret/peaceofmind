import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendEmail, isEmailServiceConfigured } from '@/lib/emails/email-service';
import { driverConfirmDriverTemplate } from '@/lib/emails/templates/driver-confirm';
import { driverResponseTemplate } from '@/lib/emails/templates/driver-response';
import { DRIVER_CONFIRM, DRIVER_RESPONSE } from '@/lib/emails/content';

export async function POST(request: NextRequest) {
  try {
    const { tripId, driverEmail, token } = await request.json();

    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Driver confirmation request for trip:', tripId, '- Token auth:', !!token);
    }

    if (!tripId || (!driverEmail && !token)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    let normalizedDriverEmail: string;
    let tokenData: any = null;

    // If token provided, validate it (new magic link flow)
    if (token) {
      const { data: validToken, error: tokenError } = await supabase
        .from('driver_tokens')
        .select('id, used, invalidated_at, expires_at, driver_email')
        .eq('token', token)
        .eq('trip_id', tripId)
        .single();

      if (tokenError || !validToken) {
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Invalid token:', tokenError);
        }
        return NextResponse.json(
          { success: false, error: 'Invalid or expired link' },
          { status: 404 }
        );
      }

      // Check if token has been used
      if (validToken.used) {
        return NextResponse.json(
          { success: false, error: 'This link has already been used' },
          { status: 400 }
        );
      }

      // Check if token has been invalidated
      if (validToken.invalidated_at) {
        return NextResponse.json(
          { success: false, error: 'This link is no longer valid' },
          { status: 400 }
        );
      }

      // Check if token has expired
      const expiresAt = new Date(validToken.expires_at);
      if (new Date() > expiresAt) {
        return NextResponse.json(
          { success: false, error: 'This link has expired' },
          { status: 400 }
        );
      }

      normalizedDriverEmail = validToken.driver_email.toLowerCase().trim();
      tokenData = validToken;
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Token validated successfully');
      }
    } else {
      // Old flow: email-based confirmation
      normalizedDriverEmail = driverEmail!.toLowerCase().trim();
    }

    // Fetch the trip to verify driver and status
    const { data: trip, error: fetchError } = await supabase
      .from('trips')
      .select('id, status, driver, trip_date, trip_destination, lead_passenger_name, user_id, user_email')
      .eq('id', tripId)
      .single();

    if (fetchError || !trip) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Trip not found:', fetchError);
      }
      return NextResponse.json(
        { success: false, error: 'Trip not found' },
        { status: 404 }
      );
    }

    // Verify the driver email matches
    const assignedDriver = trip.driver?.toLowerCase().trim();

    if (!assignedDriver || assignedDriver !== normalizedDriverEmail) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Driver email mismatch detected');
      }
      return NextResponse.json(
        { success: false, error: 'You are not the assigned driver for this trip' },
        { status: 403 }
      );
    }

    // Verify trip is in pending status
    if (trip.status !== 'pending') {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Trip is not in pending status:', trip.status);
      }
      return NextResponse.json(
        { success: false, error: `Trip status is "${trip.status}", not "pending"` },
        { status: 400 }
      );
    }

    // Update trip status to confirmed
    const { error: updateError } = await supabase
      .from('trips')
      .update({ status: 'confirmed' })
      .eq('id', tripId);

    if (updateError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Failed to update trip status:', updateError);
      }
      return NextResponse.json(
        { success: false, error: 'Failed to confirm trip' },
        { status: 500 }
      );
    }

    // If token was used, mark it as used
    if (tokenData) {
      await supabase
        .from('driver_tokens')
        .update({
          used: true,
          used_at: new Date().toISOString()
        })
        .eq('id', tokenData.id);
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Token marked as used');
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Confirmed by driver:', tripId);
    }

    // Send confirmation email to driver
    try {
      if (isEmailServiceConfigured()) {
        const tripDate = new Date(trip.trip_date).toLocaleDateString('en-GB', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        const host = request.headers.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
        const tripLink = `${baseUrl}/results/${tripId}`;

        // Send confirmation to driver
        const driverHtml = driverConfirmDriverTemplate({
          tripDate,
          tripLink,
          tripDestination: trip.trip_destination || undefined,
          leadPassengerName: trip.lead_passenger_name || undefined,
        });

        await sendEmail({
          to: normalizedDriverEmail,
          subject: DRIVER_CONFIRM.driver.subject(tripDate),
          html: driverHtml,
        });

        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Confirmation email sent successfully');
        }

        // Also send notification to trip owner
        if (trip.user_email && trip.trip_destination) {
          const ownerHtml = driverResponseTemplate({
            type: 'confirmed',
            destination: trip.trip_destination,
            driverEmail: normalizedDriverEmail,
            tripLink,
          });

          await sendEmail({
            to: trip.user_email,
            subject: DRIVER_RESPONSE.confirmed.subject(trip.trip_destination),
            html: ownerHtml,
          });

          if (process.env.NODE_ENV === 'development') {
            console.log('✅ Confirmation notification sent to trip owner');
          }
        }
      }
    } catch (emailError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Failed to send confirmation email:', emailError);
      }
      // Don't fail the operation if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Confirmed successfully'
    });

  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error in driver-confirm-trip API:', error);
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

