import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
      const Resend = require('resend').Resend;
      const resendApiKey = process.env.RESEND_API_KEY;

      if (!resendApiKey) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ RESEND_API_KEY not configured, skipping email');
        }
        return NextResponse.json({
          success: true,
          message: 'Token created but email not sent (RESEND_API_KEY not configured)',
          magicLink // For testing purposes
        });
      }

      const resend = new Resend(resendApiKey);
      const formattedDate = new Date(tripDate).toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      await resend.emails.send({
        from: 'Chauffs <info@trips.chauffs.com>',
        to: [normalizedEmail],
        subject: `You've been assigned to a trip - ${formattedDate}`,
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
                        <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">You've been assigned to a trip</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 32px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                        <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #374151;">
                          Hi,
                        </p>
                        
                        <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #374151;">
                          You've been assigned to a trip and your confirmation is needed.
                        </p>
                        
                        <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
                          <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="padding: 8px 0; font-size: 14px; color: #6b7280;">Trip date:</td>
                              <td style="padding: 8px 0; font-size: 14px; color: #111827; font-weight: 500; text-align: right;">${formattedDate}</td>
                            </tr>
                            ${tripDestination ? `
                            <tr>
                              <td style="padding: 8px 0; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb;">Destination:</td>
                              <td style="padding: 8px 0; font-size: 14px; color: #111827; font-weight: 500; text-align: right; border-top: 1px solid #e5e7eb;">${tripDestination}</td>
                            </tr>
                            ` : ''}
                            ${leadPassengerName ? `
                            <tr>
                              <td style="padding: 8px 0; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb;">Passenger:</td>
                              <td style="padding: 8px 0; font-size: 14px; color: #111827; font-weight: 500; text-align: right; border-top: 1px solid #e5e7eb;">${leadPassengerName}</td>
                            </tr>
                            ` : ''}
                            <tr>
                              <td style="padding: 8px 0; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb;">Status:</td>
                              <td style="padding: 8px 0; font-size: 14px; color: #e77500; font-weight: 600; text-align: right; border-top: 1px solid #e5e7eb;">⏱️ Pending your confirmation</td>
                            </tr>
                          </table>
                        </div>
                        
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                          <tr>
                            <td align="center">
                              <a href="${magicLink}" style="display: inline-block; background-color: #3ea34b; color: #ffffff; font-size: 15px; font-weight: 500; text-decoration: none; padding: 14px 32px; border-radius: 6px; letter-spacing: -0.3px;">
                                View and confirm trip
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 20px; color: #6b7280;">
                          This link is valid for 3 days and can only be used once. If you have any questions about this trip, please reply to this email.
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

