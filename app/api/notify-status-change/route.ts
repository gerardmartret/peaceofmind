import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/emails/email-service';
import { statusChangeTemplate, StatusChangeVariant } from '@/lib/emails/templates/status-change';

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

    // Determine email variant based on context
    let variant: StatusChangeVariant;
    if (message === 'Trip cancelled') {
      variant = 'cancelled';
    } else if (requestAcceptance && newStatus === 'pending') {
      variant = 'acceptanceRequest';
    } else if (newStatus === 'confirmed') {
      variant = 'confirmed';
    } else {
      variant = 'generic';
    }

    // Generate email
    const email = statusChangeTemplate({
      variant,
      tripDate,
      tripLink,
      newStatus: variant === 'generic' ? newStatus : undefined,
    });

    // Send email
    const result = await sendEmail({
      to: driverEmail,
      subject: email.subject,
      html: email.html,
    });

    if (!result.success) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error sending status change notification email:', result.error);
      }
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to send notification email',
          details: result.error 
        },
        { status: 500 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Status change notification sent to ${driverEmail} for trip ${tripId}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Status change notification sent to ${driverEmail}`,
      emailId: result.emailId
    });
  } catch (error) {
    console.error('❌ Error in notify-status-change API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

