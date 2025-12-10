import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/emails/email-service';
import { bookingRequestTemplate } from '@/lib/emails/templates/booking-request';
import { BOOKING_REQUEST } from '@/lib/emails/content';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Format the payload as a readable JSON string
    const formattedPayload = JSON.stringify(payload, null, 2);

    // Generate email HTML
    const html = bookingRequestTemplate({ formattedPayload });

    // Send email to info@drivania.com
    const result = await sendEmail({
      to: 'info@drivania.com',
      subject: BOOKING_REQUEST.subject,
      html,
      text: `New Booking Request\n\nBooking Details:\n${formattedPayload}`,
    });

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to send booking request email',
          details: result.error 
        },
        { status: 500 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Booking request sent to info@drivania.com`);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Booking request sent successfully',
      emailId: result.emailId
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error in send-booking-request API:', error);
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

