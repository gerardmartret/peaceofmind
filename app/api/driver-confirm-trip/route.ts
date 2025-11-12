import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { tripId, driverEmail } = await request.json();

    console.log('🔄 Driver confirmation request:', { tripId, driverEmail });

    if (!tripId || !driverEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Fetch the trip to verify driver and status
    const { data: trip, error: fetchError } = await supabase
      .from('trips')
      .select('id, status, driver, trip_date, trip_destination, lead_passenger_name, user_id')
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
    const normalizedDriverEmail = driverEmail.toLowerCase().trim();
    const assignedDriver = trip.driver?.toLowerCase().trim();

    if (!assignedDriver || assignedDriver !== normalizedDriverEmail) {
      console.error('❌ Driver email mismatch:', { provided: normalizedDriverEmail, assigned: assignedDriver });
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

        console.log('✅ Confirmation email sent to driver');
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

