import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  try {
    const { tripId } = await request.json();

    if (!tripId) {
      return NextResponse.json(
        { success: false, error: 'Trip ID is required' },
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

    console.log(`📧 Notifying driver for trip: ${tripId}`);

    // Fetch trip details including version and latest_changes
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

    console.log(`📦 Trip version: ${trip.version || 1}`);
    console.log(`📝 Latest changes:`, (trip as any).latest_changes ? 'Yes' : 'No');

    // Verify user is the trip owner
    if (trip.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to notify driver for this trip' },
        { status: 403 }
      );
    }

    // Check if driver is set
    if (!trip.driver) {
      return NextResponse.json(
        { success: false, error: 'No driver assigned to this trip' },
        { status: 400 }
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

    // Get trip version and status
    const tripVersion = trip.version || 1;
    const tripStatus = trip.status || 'pending';
    const statusDisplay = tripStatus === 'confirmed' ? 'Confirmed' : 'Pending Confirmation';
    const statusColor = tripStatus === 'confirmed' ? '#3ea34b' : '#999999';

    // Format latest changes for email (if version > 1)
    const formatLatestChanges = () => {
      const latestChanges = (trip as any).latest_changes;
      if (tripVersion === 1 || !latestChanges) return '';

      const changes = latestChanges;
      let changesHtml = '';

      // Trip detail changes
      const detailChanges = [];
      if (changes.tripDateChanged) detailChanges.push(`<li style="margin: 4px 0; color: #333333;">Trip date updated to: <strong>${tripDate}</strong></li>`);
      if (changes.passengerInfoChanged) detailChanges.push(`<li style="margin: 4px 0; color: #333333;">Passenger information updated</li>`);
      if (changes.vehicleInfoChanged) detailChanges.push(`<li style="margin: 4px 0; color: #333333;">Vehicle information updated</li>`);
      if (changes.notesChanged) detailChanges.push(`<li style="margin: 4px 0; color: #333333;">Trip notes updated</li>`);

      if (detailChanges.length > 0) {
        changesHtml += `<div style="margin-bottom: 16px;"><p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #05060A;">Trip Details Updated:</p><ul style="margin: 0; padding-left: 20px; list-style-type: disc;">${detailChanges.join('')}</ul></div>`;
      }

      // Location changes - DETAILED VIEW with before/after values
      if (changes.locations && changes.locations.length > 0) {
        const locationChanges = changes.locations.filter((loc: any) => loc.type !== 'unchanged');
        if (locationChanges.length > 0) {
          const locationItems = locationChanges.map((loc: any, index: number) => {
            // Determine the location name to display
            const locationName = loc.type === 'added' 
              ? loc.newAddress 
              : (loc.type === 'removed' ? loc.oldAddress : (loc.newAddress || loc.oldAddress));
            
            if (loc.type === 'added') {
              return `
                <div style="margin: 12px 0; padding: 12px; background-color: #f0fdf4; border-left: 3px solid #3ea34b; border-radius: 4px;">
                  <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #05060A;">${locationName || `Location ${loc.index || index + 1}`}</p>
                  <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #3ea34b;">✓ Added</p>
                  <p style="margin: 4px 0; font-size: 13px; color: #333333;"><strong>Time:</strong> ${loc.newTime || 'N/A'}</p>
                  ${loc.newPurpose ? `<p style="margin: 4px 0; font-size: 13px; color: #333333;"><strong>Purpose:</strong> ${loc.newPurpose}</p>` : ''}
                </div>
              `;
            } else if (loc.type === 'removed') {
              return `
                <div style="margin: 12px 0; padding: 12px; background-color: #fef2f2; border-left: 3px solid #9e201b; border-radius: 4px;">
                  <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #05060A;">${locationName || `Location ${loc.index || index + 1}`}</p>
                  <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #9e201b;">✗ Removed</p>
                  <p style="margin: 4px 0; font-size: 13px; color: #333333;"><strong>Time:</strong> ${loc.oldTime || 'N/A'}</p>
                  ${loc.oldPurpose ? `<p style="margin: 4px 0; font-size: 13px; color: #333333;"><strong>Purpose:</strong> ${loc.oldPurpose}</p>` : ''}
                </div>
              `;
            } else if (loc.type === 'modified') {
              let modifiedFields = '';
              
              if (loc.addressChanged) {
                modifiedFields += `
                  <p style="margin: 8px 0 4px 0; font-size: 12px; font-weight: 600; color: #666666;">Address:</p>
                  <p style="margin: 0 0 2px 8px; font-size: 12px; text-decoration: line-through; color: #999999;">${loc.oldAddress || 'N/A'}</p>
                  <p style="margin: 0 0 2px 8px; font-size: 13px; color: #db7304;">→</p>
                  <p style="margin: 0 0 4px 8px; font-size: 13px; font-weight: 600; color: #333333;">${loc.newAddress || 'N/A'}</p>
                `;
              }
              
              if (loc.timeChanged) {
                modifiedFields += `
                  <p style="margin: 8px 0 4px 0; font-size: 12px; font-weight: 600; color: #666666;">Time:</p>
                  <p style="margin: 0 0 0 8px; font-size: 13px; color: #333333;">
                    <span style="text-decoration: line-through; color: #999999;">${loc.oldTime || 'N/A'}</span>
                    <span style="color: #db7304;"> → </span>
                    <span style="font-weight: 600;">${loc.newTime || 'N/A'}</span>
                  </p>
                `;
              }
              
              if (loc.purposeChanged) {
                modifiedFields += `
                  <p style="margin: 8px 0 4px 0; font-size: 12px; font-weight: 600; color: #666666;">Purpose:</p>
                  <p style="margin: 0 0 2px 8px; font-size: 12px; text-decoration: line-through; color: #999999;">${loc.oldPurpose || 'N/A'}</p>
                  <p style="margin: 0 0 2px 8px; font-size: 13px; color: #db7304;">→</p>
                  <p style="margin: 0 0 4px 8px; font-size: 13px; font-weight: 600; color: #333333;">${loc.newPurpose || 'N/A'}</p>
                `;
              }
              
              return `
                <div style="margin: 12px 0; padding: 12px; background-color: #fffbeb; border-left: 3px solid #db7304; border-radius: 4px;">
                  <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #05060A;">${locationName || `Location ${loc.index || index + 1}`}</p>
                  <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #db7304;">⟳ Modified</p>
                  ${modifiedFields}
                </div>
              `;
            }
            return '';
          }).filter(Boolean).join('');

          changesHtml += `<div style="margin-bottom: 16px;"><p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #05060A;">Location Changes:</p>${locationItems}</div>`;
        }
      }

      // Add merged notes preview if available
      if (trip.trip_notes && tripVersion > 1) {
        changesHtml += `
          <div style="margin-bottom: 16px;">
            <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #05060A;">Current Trip Notes:</p>
            <div style="background-color: #eff6ff; padding: 12px; border-radius: 4px; border-left: 3px solid #3b82f6;">
              <pre style="margin: 0; font-family: inherit; font-size: 13px; color: #333333; white-space: pre-wrap; word-wrap: break-word;">${trip.trip_notes}</pre>
            </div>
          </div>
        `;
      }

      if (changesHtml) {
        return `
          <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 20px 0; border: 1px solid #d9d9d9;">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #05060A;">What Changed:</h3>
            ${changesHtml}
          </div>
        `;
      }

      return '';
    };

    // Send email
    const emailSubject = tripVersion === 1 
      ? `New Trip Assignment - ${tripDate}` 
      : `Trip Update - ${tripDate}`;

    const { data, error } = await resend.emails.send({
      from: 'DriverBrief <info@trips.driverbrief.com>',
      to: [trip.driver],
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
                      <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">${tripVersion === 1 ? 'New Trip Assignment' : 'Trip Updated'}</h1>
                    </td>
                  </tr>
                  
                  <!-- Body -->
                  <tr>
                    <td style="background-color: #f5f5f5; padding: 32px 24px; border-radius: 0 0 8px 8px;">
                      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
                        Hello,
                      </p>
                      
                      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
                        Your trip scheduled for <strong style="color: #05060A;">${tripDate}</strong> has been ${tripVersion === 1 ? 'created' : 'updated'}.
                      </p>
                      
                      <!-- Status -->
                      <div style="background-color: #ffffff; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid ${statusColor};">
                        <p style="margin: 0; font-size: 14px; color: #666666;">
                          <strong style="color: #05060A;">Status:</strong> 
                          <span style="color: ${statusColor}; font-weight: 600; margin-left: 8px;">${statusDisplay}</span>
                        </p>
                      </div>
                      
                      ${formatLatestChanges()}
                      
                      <!-- Button -->
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                        <tr>
                          <td align="center">
                            <a href="${tripLink}" style="display: inline-block; background-color: #05060A; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600;">View Trip Details</a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 24px 0 0 0; padding-top: 20px; border-top: 1px solid #d9d9d9; font-size: 13px; line-height: 1.5; color: #666666;">
                        Click the button above to view the complete trip information and itinerary.
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
      console.error('❌ Error sending notification email:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to send notification email',
          details: error.message 
        },
        { status: 500 }
      );
    }

    console.log(`✅ Notification sent to ${trip.driver} for trip ${tripId}`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Notification sent to ${trip.driver}`,
      emailId: data?.id
    });
  } catch (error) {
    console.error('❌ Error in notify-driver API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

