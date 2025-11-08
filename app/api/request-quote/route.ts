import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  try {
    const { tripId, driverEmail } = await request.json();

    if (!tripId || !driverEmail) {
      return NextResponse.json(
        { success: false, error: 'Trip ID and driver email are required' },
        { status: 400 }
      );
    }

    // Basic email format validation (accept personal emails like Gmail)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(driverEmail.trim())) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user authentication
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`📧 Sending quote request for trip: ${tripId} to ${driverEmail}`);

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

    // Verify user is the trip owner
    if (trip.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to request quotes for this trip' },
        { status: 403 }
      );
    }

    // Initialize Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('❌ RESEND_API_KEY not configured');
      return NextResponse.json(
        { success: false, error: 'Email service not configured' },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);

    // Format trip date
    const tripDate = new Date(trip.trip_date).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create trip link using the current host or environment variable
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
    const tripLink = `${baseUrl}/results/${tripId}`;
    const password = trip.password;

    // Send email
    const { data, error } = await resend.emails.send({
      from: 'DriverBrief <info@trips.driverbrief.com>',
      to: [driverEmail.trim()],
      subject: `Quote Request - Trip on ${tripDate}`,
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
                      <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">Quote Request</h1>
                    </td>
                  </tr>
                  
                  <!-- Body -->
                  <tr>
                    <td style="background-color: #f5f5f5; padding: 32px 24px; border-radius: 0 0 8px 8px;">
                      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
                        Hello,
                      </p>
                      
                      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #333333;">
                        You have been invited to submit a quote for a trip scheduled on <strong style="color: #05060A;">${tripDate}</strong>.
                      </p>
                      
                      <!-- Password Box -->
                      <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 24px 0; border: 2px solid #05060A;">
                        <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #666666; text-transform: uppercase; letter-spacing: 0.5px;">
                          Access Password
                        </p>
                        <p style="margin: 0; font-size: 24px; font-weight: 700; color: #05060A; font-family: 'Courier New', monospace; letter-spacing: 2px;">
                          ${password}
                        </p>
                      </div>
                      
                      <div style="background-color: #ffffff; padding: 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #05060A;">
                        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #333333;">
                          <strong style="color: #05060A;">Instructions:</strong><br/>
                          1. Click the button below to view the trip details<br/>
                          2. Enter the password above when prompted<br/>
                          3. Review the complete trip information<br/>
                          4. Submit your quote at the bottom of the page
                        </p>
                      </div>
                      
                      <!-- Button -->
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                        <tr>
                          <td align="center">
                            <a href="${tripLink}" style="display: inline-block; background-color: #05060A; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600;">View Trip & Submit Quote</a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 24px 0 0 0; padding-top: 20px; border-top: 1px solid #d9d9d9; font-size: 13px; line-height: 1.5; color: #666666;">
                        Click the button above to access the trip details and submit your pricing quote. The trip owner will review all quotes received.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td align="center" style="padding: 20px 0;">
                      <p style="margin: 0; font-size: 12px; color: #999999;">This is an automated notification from DriverBrief</p>
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

    if (error) {
      console.error('❌ Error sending quote request email:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to send quote request email',
          details: error.message 
        },
        { status: 500 }
      );
    }

    console.log(`✅ Quote request sent to ${driverEmail} for trip ${tripId}`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Quote request sent to ${driverEmail}`,
      emailId: data?.id
    });
  } catch (error) {
    console.error('❌ Error in request-quote API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

