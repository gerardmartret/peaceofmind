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

    // Create trip link
    const tripLink = `http://driverbrief.com/results/${tripId}`;

    // Send email
    const { data, error } = await resend.emails.send({
      from: 'DriverBrief <info@trips.driverbrief.com>',
      to: [trip.driver],
      subject: `Trip Update - ${tripDate}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #05060A; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">🚗 Trip Updated</h1>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
              Hello,
            </p>
            
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
              Your trip scheduled for <strong>${tripDate}</strong> has been updated.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${tripLink}" 
                 style="background-color: #05060A; 
                        color: white; 
                        padding: 14px 32px; 
                        text-decoration: none; 
                        border-radius: 6px; 
                        font-size: 16px;
                        font-weight: 600;
                        display: inline-block;">
                View Trip Details
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              Click the button above to view the complete trip information and itinerary.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>This is an automated notification from DriverBrief</p>
          </div>
        </div>
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

