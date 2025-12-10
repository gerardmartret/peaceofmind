import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/emails/email-service';
import { driverUnassignmentTemplate } from '@/lib/emails/templates/driver-unassignment';
import { DRIVER_UNASSIGNMENT } from '@/lib/emails/content';

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
      const formattedDate = new Date(tripDate).toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Generate email HTML
      const html = driverUnassignmentTemplate({
        tripDate: formattedDate,
        tripDestination,
        leadPassengerName,
      });

      // Send email
      const result = await sendEmail({
        to: driverEmail,
        subject: DRIVER_UNASSIGNMENT.subject(formattedDate),
        html,
      });

      if (!result.success) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ RESEND_API_KEY not configured, skipping email');
        }
        return NextResponse.json({
          success: true,
          message: 'Unassignment notification skipped (RESEND_API_KEY not configured)'
        });
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Driver unassignment email sent successfully');
      }

      return NextResponse.json({
        success: true,
        message: 'Driver notified of unassignment successfully'
      });

    } catch (emailError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Failed to send driver unassignment email:', emailError);
      }
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

