import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { tripId, driverEmail, tripDate, leadPassengerName, tripDestination } = await request.json();

    console.log('📧 Notifying driver of unassignment for trip:', tripId);

    if (!tripId || !driverEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Send email notification
    try {
      const Resend = require('resend').Resend;
      const resendApiKey = process.env.RESEND_API_KEY;

      if (!resendApiKey) {
        console.warn('⚠️ RESEND_API_KEY not configured, skipping email');
        return NextResponse.json({
          success: true,
          message: 'Unassignment notification skipped (RESEND_API_KEY not configured)'
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
        to: [driverEmail],
        subject: `Trip assignment cancelled - ${formattedDate}`,
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
                        <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">Trip assignment cancelled</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 32px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                        <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #374151;">
                          Hi,
                        </p>
                        
                        <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #374151;">
                          You have been unassigned from a trip scheduled on <strong style="color: #05060A;">${formattedDate}</strong>.
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
                              <td style="padding: 8px 0; font-size: 14px; color: #9e201b; font-weight: 600; text-align: right; border-top: 1px solid #e5e7eb;">Unassigned</td>
                            </tr>
                          </table>
                        </div>
                        
                        <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 20px; color: #6b7280;">
                          The trip owner has assigned a different driver to this trip. If you have any questions, please reply to this email.
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

      console.log('✅ Driver unassignment email sent successfully');

      return NextResponse.json({
        success: true,
        message: 'Driver notified of unassignment successfully'
      });

    } catch (emailError) {
      console.error('❌ Failed to send driver unassignment email:', emailError);
      return NextResponse.json(
        { success: false, error: 'Failed to send notification email' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Error in notify-driver-unassignment API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

