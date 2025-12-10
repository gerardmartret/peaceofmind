import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendEmail, isEmailServiceConfigured } from '@/lib/emails/email-service';
import { driverAssignmentTemplate } from '@/lib/emails/templates/driver-assignment';
import { DRIVER_ASSIGNMENT } from '@/lib/emails/content';

export async function POST(request: NextRequest) {
  try {
    const { tripId, driverEmail, tripDate, leadPassengerName, tripDestination } = await request.json();

    if (process.env.NODE_ENV === 'development') {
      console.log('📧 Notifying driver of assignment for trip:', tripId);
    }

    if (!tripId || !driverEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const normalizedEmail = driverEmail.toLowerCase().trim();

    // Check if a valid token already exists for this driver/trip (only needed fields)
    const { data: existingTokens, error: checkError } = await supabase
      .from('driver_tokens')
      .select('id, token, expires_at')
      .eq('trip_id', tripId)
      .eq('driver_email', normalizedEmail)
      .is('invalidated_at', null)
      .eq('used', false);

    if (checkError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error checking for existing tokens:', checkError);
      }
      // Continue with token creation if check fails
    }

    let token: string;
    let expiresAt: Date;

    // If valid token exists and not expired, reuse it
    if (existingTokens && existingTokens.length > 0) {
      const validToken = existingTokens.find(t => {
        const tokenExpiresAt = new Date(t.expires_at);
        return new Date() < tokenExpiresAt;
      });

      if (validToken) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Reusing existing valid token for driver ${normalizedEmail}`);
        }
        token = validToken.token;
        expiresAt = new Date(validToken.expires_at);
      } else {
        // All existing tokens are expired, invalidate them and create new one
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚠️ Existing tokens expired, invalidating and creating new token`);
        }
        await supabase
          .from('driver_tokens')
          .update({
            invalidated_at: new Date().toISOString(),
            invalidation_reason: 'replaced_by_new_token'
          })
          .eq('trip_id', tripId)
          .eq('driver_email', normalizedEmail)
          .is('invalidated_at', null);

        token = crypto.randomUUID();
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 3);

        const { error: tokenError } = await supabase
          .from('driver_tokens')
          .insert({
            trip_id: tripId,
            driver_email: normalizedEmail,
            token: token,
            expires_at: expiresAt.toISOString()
          });

        if (tokenError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ Failed to create driver token:', tokenError);
          }
          return NextResponse.json(
            { success: false, error: 'Failed to create authentication token' },
            { status: 500 }
          );
        }

        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ New driver token created, expires at: ${expiresAt.toISOString()}`);
        }
      }
    } else {
      // No existing tokens, create new one
      token = crypto.randomUUID();
      expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 3);

    const { error: tokenError } = await supabase
      .from('driver_tokens')
      .insert({
        trip_id: tripId,
          driver_email: normalizedEmail,
        token: token,
        expires_at: expiresAt.toISOString()
      });

    if (tokenError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Failed to create driver token:', tokenError);
      }
      return NextResponse.json(
        { success: false, error: 'Failed to create authentication token' },
        { status: 500 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Driver token created, expires at: ${expiresAt.toISOString()}`);
    }
    }

    // Build magic link
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
    const magicLink = `${baseUrl}/results/${tripId}?driver_token=${token}`;

    // Send email notification
    try {
      if (!isEmailServiceConfigured()) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ RESEND_API_KEY not configured, skipping email');
        }
        return NextResponse.json({
          success: true,
          message: 'Token created but email not sent (RESEND_API_KEY not configured)',
          magicLink // For testing purposes
        });
      }

      const formattedDate = new Date(tripDate).toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Generate email HTML
      const html = driverAssignmentTemplate({
        tripDate: formattedDate,
        magicLink,
        tripDestination,
        leadPassengerName,
      });

      // Send email
      const result = await sendEmail({
        to: normalizedEmail,
        subject: DRIVER_ASSIGNMENT.subject(formattedDate),
        html,
      });

      if (!result.success) {
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Failed to send driver assignment email:', result.error);
        }
        return NextResponse.json(
          { success: false, error: 'Failed to send notification email' },
          { status: 500 }
        );
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Driver assignment email sent successfully');
      }

      return NextResponse.json({
        success: true,
        message: 'Driver notified successfully'
      });

    } catch (emailError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Failed to send driver assignment email:', emailError);
      }
      return NextResponse.json(
        { success: false, error: 'Failed to send notification email' },
        { status: 500 }
      );
    }

  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error in notify-driver-assignment API:', error);
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

