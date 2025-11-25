import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { tripId, token } = await request.json();

    console.log('🔄 Driver rejection request for trip:', tripId);

    if (!tripId || !token) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate token first
    const { data: tokenData, error: tokenError } = await supabase
      .from('driver_tokens')
      .select('*')
      .eq('token', token)
      .eq('trip_id', tripId)
      .single();

    if (tokenError || !tokenData) {
      console.error('❌ Invalid token:', tokenError);
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

    // Fetch trip details
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      console.error('❌ Trip not found:', tripError);
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
      console.error('❌ Failed to update trip status:', updateError);
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

    console.log('✅ Trip rejected by driver successfully');

    // Send notification email to trip owner
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
          from: 'Chauffs <info@trips.chauffs.com>',
          to: [trip.user_email],
          subject: `Driver declined trip - ${tripDate}`,
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
                          <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">Driver declined trip</h1>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 32px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                          <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #374151;">
                            The driver (${tokenData.driver_email}) has declined your trip assignment.
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
                                <td style="padding: 8px 0; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb;">Status:</td>
                                <td style="padding: 8px 0; font-size: 14px; color: #dc2626; font-weight: 600; text-align: right; border-top: 1px solid #e5e7eb;">Rejected</td>
                              </tr>
                            </table>
                          </div>
                          
                          <p style="margin: 24px 0; font-size: 15px; line-height: 24px; color: #374151;">
                            You can now assign a different driver to this trip.
                          </p>
                          
                          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                            <tr>
                              <td align="center">
                                <a href="${tripLink}" style="display: inline-block; background-color: #3ea34b; color: #ffffff; font-size: 15px; font-weight: 500; text-decoration: none; padding: 14px 32px; border-radius: 6px; letter-spacing: -0.3px;">
                                  View trip and assign driver
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

        console.log('✅ Rejection notification email sent to trip owner');
      }
    } catch (emailError) {
      console.error('❌ Failed to send rejection notification email:', emailError);
      // Don't fail the operation if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Trip rejected successfully'
    });

  } catch (error) {
    console.error('❌ Error in driver-reject-trip API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

