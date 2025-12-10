import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/emails/email-service';
import { guestTripCreatedTemplate } from '@/lib/emails/templates/guest-trip-created';
import { GUEST_TRIP_CREATED } from '@/lib/emails/content';

export async function POST(request: NextRequest) {
  try {
    const { email, destination } = await request.json();

    if (!email || !destination) {
      return NextResponse.json(
        { success: false, error: 'Email and destination are required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`📧 Sending guest trip email to ${email} for destination: ${destination}`);
    }

    // Get base URL for signup link
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
    const signupUrl = `${baseUrl}/signup?email=${encodeURIComponent(email.trim())}`;

    // Generate email HTML
    const html = guestTripCreatedTemplate({
      destination,
      signupUrl,
    });

    // Send email
    const result = await sendEmail({
      to: email.trim(),
      subject: GUEST_TRIP_CREATED.subject,
      html,
    });

    if (!result.success) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error sending guest trip email:', result.error);
      }
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to send email',
          details: result.error 
        },
        { status: 500 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Guest trip email sent to ${email}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Guest trip email sent to ${email}`,
      emailId: result.emailId
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error in send-guest-trip-email API:', error);
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
