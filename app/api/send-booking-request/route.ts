import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('❌ RESEND_API_KEY not configured');
      return NextResponse.json(
        { success: false, error: 'Email service not configured' },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);

    // Format the payload as a readable JSON string
    const formattedPayload = JSON.stringify(payload, null, 2);

    // Send email to info@drivania.com
    const { data, error } = await resend.emails.send({
      from: 'Chauffs <info@trips.chauffs.com>',
      to: ['info@drivania.com'],
      subject: 'New Booking Request',
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
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #05060A; padding: 24px; border-radius: 8px 8px 0 0;">
                      <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">New Booking Request</h1>
                    </td>
                  </tr>
                  
                  <!-- Body -->
                  <tr>
                    <td style="background-color: #f5f5f5; padding: 32px 24px; border-radius: 0 0 8px 8px;">
                      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
                        A new booking request has been submitted.
                      </p>
                      
                      <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 16px 0; border: 1px solid #d9d9d9;">
                        <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #05060A;">Booking Details:</h3>
                        <pre style="margin: 0; font-family: 'Courier New', monospace; font-size: 13px; color: #333333; white-space: pre-wrap; word-wrap: break-word; background-color: #f9f9f9; padding: 16px; border-radius: 4px; overflow-x: auto;">${formattedPayload}</pre>
                      </div>
                      
                      <p style="margin: 24px 0 0 0; padding-top: 20px; border-top: 1px solid #d9d9d9; font-size: 13px; line-height: 1.5; color: #666666;">
                        Please process this booking request accordingly.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td align="center" style="padding: 20px 0;">
                      <p style="margin: 0; font-size: 12px; color: #999999;">This is an automated notification from Chauffs</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `New Booking Request\n\nBooking Details:\n${formattedPayload}`,
    });

    if (error) {
      console.error('❌ Error sending booking request email:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to send booking request email',
          details: error.message 
        },
        { status: 500 }
      );
    }

    console.log(`✅ Booking request sent to info@drivania.com`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Booking request sent successfully',
      emailId: data?.id
    });
  } catch (error) {
    console.error('❌ Error in send-booking-request API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

