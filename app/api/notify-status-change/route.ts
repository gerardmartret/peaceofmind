import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  try {
    const { tripId, newStatus, requestAcceptance, message, driverEmail: requestDriverEmail } = await request.json();

    if (!tripId || !newStatus) {
      return NextResponse.json(
        { success: false, error: 'Trip ID and new status are required' },
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

    console.log(`📧 Notifying driver of status change for trip: ${tripId} to ${newStatus}`);

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
        { success: false, error: 'You are not authorized to notify driver for this trip' },
        { status: 403 }
      );
    }

    // Get driver email from request or trip data
    const driverEmail = requestDriverEmail || trip.driver;
    
    if (!driverEmail) {
      return NextResponse.json(
        { success: false, error: 'No driver email provided' },
        { status: 400 }
      );
    }
    
    console.log(`📧 Sending notification to driver: ${driverEmail}`);

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

    // Determine email content based on context
    let emailSubject: string;
    let emailTitle: string;
    let emailBody: string;
    let statusDisplay: string;
    let statusColor: string;
    
    if (message === 'Trip cancelled') {
      // Cancellation email
      emailSubject = `Trip Cancelled - ${tripDate}`;
      emailTitle = 'Trip Cancelled';
      statusDisplay = 'Cancelled';
      statusColor = '#999999';
      emailBody = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          Hello,
        </p>
        
        <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          The trip scheduled on <strong style="color: #05060A;">${tripDate}</strong> has been cancelled.
        </p>
        
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          No further action is required.
        </p>
      `;
    } else if (requestAcceptance && newStatus === 'pending') {
      // Flow B: Acceptance request email
      emailSubject = `Trip Assignment - Please Accept - ${tripDate}`;
      emailTitle = 'Service Confirmed - Please Accept Trip';
      statusDisplay = 'Awaiting Your Response';
      statusColor = '#e77500';
      emailBody = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          Hello,
        </p>
        
        <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          You have been assigned to a trip scheduled on <strong style="color: #05060A;">${tripDate}</strong>. The service has been confirmed by the client, and we need your acceptance to proceed.
        </p>
        
        <div style="background-color: #fff7ed; padding: 20px; border-radius: 6px; margin: 24px 0; border-left: 4px solid ${statusColor};">
          <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #666666; text-transform: uppercase; letter-spacing: 0.5px;">
            Action Required
          </p>
          <p style="margin: 0; font-size: 16px; font-weight: 600; color: #05060A;">
            Please accept or reject this trip
          </p>
        </div>
      `;
    } else if (newStatus === 'confirmed') {
      // Flow A: Confirmation email (from quotes)
      emailSubject = `Trip Confirmed - ${tripDate}`;
      emailTitle = 'Service Confirmed';
      statusDisplay = 'Confirmed';
      statusColor = '#3ea34b';
      emailBody = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          Hello,
        </p>
        
        <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          Great news! Your quote has been accepted and the service for <strong style="color: #05060A;">${tripDate}</strong> is now confirmed.
        </p>
        
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          Please review the trip details and contact the client if you have any questions.
        </p>
      `;
    } else {
      // Default: Generic status change
      statusDisplay = newStatus === 'confirmed' ? 'Confirmed' : 'Not Confirmed';
      statusColor = newStatus === 'confirmed' ? '#3ea34b' : '#999999';
      emailSubject = `Trip Status Changed - ${tripDate}`;
      emailTitle = 'Trip Status Changed';
      emailBody = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          Hello,
        </p>
        
        <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          The status for your trip scheduled on <strong style="color: #05060A;">${tripDate}</strong> has been changed.
        </p>
      `;
    }

    // Send email
    const { data, error } = await resend.emails.send({
      from: 'DriverBrief <info@trips.chauffs.com>',
      to: [driverEmail],
      subject: emailSubject,
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
                      <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">${emailTitle}</h1>
                    </td>
                  </tr>
                  
                  <!-- Body -->
                  <tr>
                    <td style="background-color: #f5f5f5; padding: 32px 24px; border-radius: 0 0 8px 8px;">
                      ${emailBody}
                      
                      <!-- Status Box -->
                      <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 24px 0; border-left: 4px solid ${statusColor};">
                        <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #666666; text-transform: uppercase; letter-spacing: 0.5px;">
                          New Status
                        </p>
                        <p style="margin: 0; font-size: 24px; font-weight: 700; color: ${statusColor};">
                          ${statusDisplay}
                        </p>
                      </div>
                      
                      <!-- Button -->
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                        <tr>
                          <td align="center">
                            <a href="${tripLink}" style="display: inline-block; background-color: #05060A; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600;">View Trip Details</a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 24px 0 0 0; padding-top: 20px; border-top: 1px solid #d9d9d9; font-size: 13px; line-height: 1.5; color: #666666;">
                        Click the button above to view the complete trip information and any updates.
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
      console.error('❌ Error sending status change notification email:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to send notification email',
          details: error.message 
        },
        { status: 500 }
      );
    }

    console.log(`✅ Status change notification sent to ${driverEmail} for trip ${tripId}`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Status change notification sent to ${driverEmail}`,
      emailId: data?.id
    });
  } catch (error) {
    console.error('❌ Error in notify-status-change API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

