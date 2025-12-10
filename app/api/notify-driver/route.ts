import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/emails/email-service';
import { driverNotificationTemplate } from '@/lib/emails/templates/driver-notification';
import type { TripChanges } from '@/lib/emails/templates/driver-notification';

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

    if (process.env.NODE_ENV === 'development') {
      console.log(`📧 Notifying driver for trip: ${tripId}`);
    }

    // Fetch trip details including version and latest_changes (only needed fields)
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, user_id, driver, trip_date, status, version, trip_notes, latest_changes, trip_destination')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Trip not found:', tripError);
      }
      return NextResponse.json(
        { success: false, error: 'Trip not found' },
        { status: 404 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`📦 Trip version: ${trip.version || 1}`);
      console.log(`📝 Latest changes:`, (trip as any).latest_changes ? 'Yes' : 'No');
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

    // Generate email
    const email = driverNotificationTemplate({
      tripVersion,
      tripDate,
      tripLink,
      status: tripStatus,
      latestChanges: (trip as any).latest_changes as TripChanges | undefined,
      tripNotes: trip.trip_notes || undefined,
    });

    // Send email
    const result = await sendEmail({
      to: trip.driver,
      subject: email.subject,
      html: email.html,
    });

    if (!result.success) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error sending notification email:', result.error);
      }
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to send notification email'
        },
        { status: 500 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Notification sent to ${trip.driver} for trip ${tripId}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Notification sent to ${trip.driver}`,
      emailId: result.emailId
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error in notify-driver API:', error);
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

