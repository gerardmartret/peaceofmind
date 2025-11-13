import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { tripId, driverEmail, token } = await request.json();

    console.log('🔄 Driver confirmation request for trip:', tripId, '- Token auth:', !!token);

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
        .select('*')
        .eq('token', token)
        .eq('trip_id', tripId)
        .single();

      if (tokenError || !validToken) {
        console.error('❌ Invalid token:', tokenError);
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
      console.log('✅ Token validated successfully');
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
      console.error('❌ Trip not found:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Trip not found' },
        { status: 404 }
      );
    }

    // Verify the driver email matches
    const assignedDriver = trip.driver?.toLowerCase().trim();

    if (!assignedDriver || assignedDriver !== normalizedDriverEmail) {
      console.error('❌ Driver email mismatch detected');
      return NextResponse.json(
        { success: false, error: 'You are not the assigned driver for this trip' },
        { status: 403 }
      );
    }

    // Verify trip is in pending status
    if (trip.status !== 'pending') {
      console.error('❌ Trip is not in pending status:', trip.status);
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
      console.error('❌ Failed to update trip status:', updateError);
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
      console.log('✅ Token marked as used');
    }

    console.log('✅ Trip confirmed by driver:', tripId);

    // Send confirmation email to driver
    try {
      const Resend = require('resend').Resend;
      const resendApiKey = process.env.RESEND_API_KEY;

      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
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

        await resend.emails.send({
          from: 'DriverBrief <info@trips.driverbrief.com>',
          to: [normalizedDriverEmail],
          subject: `Trip confirmed - ${tripDate}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff;">
                <tr>
                  <td align="center" style="padding: 40px 20px;">
                    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff;">
                      <tr>
                        <td style="background-color: #05060A; padding: 24px; border-radius: 8px 8px 0 0;">
                          <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">Trip confirmed</h1>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 32px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                          <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #374151;">
                            Thank you for confirming your availability for this trip.
                          </p>
                          
                          <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td style="padding: 8px 0; font-size: 14px; color: #6b7280;">Trip date:</td>
                                <td style="padding: 8px 0; font-size: 14px; color: #111827; font-weight: 500; text-align: right;">${tripDate}</td>
                              </tr>
                              ${trip.trip_destination ? `
                              <tr>
                                <td style="padding: 8px 0; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb;">Destination:</td>
                                <td style="padding: 8px 0; font-size: 14px; color: #111827; font-weight: 500; text-align: right; border-top: 1px solid #e5e7eb;">${trip.trip_destination}</td>
                              </tr>
                              ` : ''}
                              ${trip.lead_passenger_name ? `
                              <tr>
                                <td style="padding: 8px 0; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb;">Passenger:</td>
                                <td style="padding: 8px 0; font-size: 14px; color: #111827; font-weight: 500; text-align: right; border-top: 1px solid #e5e7eb;">${trip.lead_passenger_name}</td>
                              </tr>
                              ` : ''}
                            </table>
                          </div>
                          
                          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                            <tr>
                              <td align="center">
                                <a href="${tripLink}" style="display: inline-block; background-color: #3ea34b; color: #ffffff; font-size: 15px; font-weight: 500; text-decoration: none; padding: 12px 32px; border-radius: 6px; letter-spacing: -0.3px;">
                                  View trip details
                                </a>
                              </td>
                            </tr>
                          </table>
                          
                          <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                            If you have any questions about this trip, please reply to this email.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
        });

        console.log('✅ Confirmation email sent successfully');

        // Also send notification to trip owner
        if (trip.user_email) {
          await resend.emails.send({
            from: 'DriverBrief <info@trips.driverbrief.com>',
            to: [trip.user_email],
            subject: `Driver confirmed trip - ${tripDate}`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #ffffff;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff;">
                  <tr>
                    <td align="center" style="padding: 40px 20px;">
                      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff;">
                        <tr>
                          <td style="background-color: #05060A; padding: 24px; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">Driver confirmed trip</h1>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 32px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #374151;">
                              Good news! ${normalizedDriverEmail} has confirmed their availability for your trip.
                            </p>
                            
                            <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
                              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                  <td style="padding: 8px 0; font-size: 14px; color: #6b7280;">Trip date:</td>
                                  <td style="padding: 8px 0; font-size: 14px; color: #111827; font-weight: 500; text-align: right;">${tripDate}</td>
                                </tr>
                                ${trip.trip_destination ? `
                                <tr>
                                  <td style="padding: 8px 0; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb;">Destination:</td>
                                  <td style="padding: 8px 0; font-size: 14px; color: #111827; font-weight: 500; text-align: right; border-top: 1px solid #e5e7eb;">${trip.trip_destination}</td>
                                </tr>
                                ` : ''}
                                <tr>
                                  <td style="padding: 8px 0; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb;">Driver:</td>
                                  <td style="padding: 8px 0; font-size: 14px; color: #111827; font-weight: 500; text-align: right; border-top: 1px solid #e5e7eb;">${normalizedDriverEmail}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb;">Status:</td>
                                  <td style="padding: 8px 0; font-size: 14px; color: #3ea34b; font-weight: 600; text-align: right; border-top: 1px solid #e5e7eb;">✓ Confirmed</td>
                                </tr>
                              </table>
                            </div>
                            
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                              <tr>
                                <td align="center">
                                  <a href="${tripLink}" style="display: inline-block; background-color: #3ea34b; color: #ffffff; font-size: 15px; font-weight: 500; text-decoration: none; padding: 14px 32px; border-radius: 6px; letter-spacing: -0.3px;">
                                    View trip details
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
              </html>
            `,
          });

          console.log('✅ Confirmation notification sent to trip owner');
        }
      }
    } catch (emailError) {
      console.error('❌ Failed to send confirmation email:', emailError);
      // Don't fail the operation if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Trip confirmed successfully'
    });

  } catch (error) {
    console.error('❌ Error in driver-confirm-trip API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

