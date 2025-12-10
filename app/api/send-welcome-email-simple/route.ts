import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/emails/email-service';
import { welcomeTemplate } from '@/lib/emails/templates/welcome';
import { WELCOME } from '@/lib/emails/content';

/**
 * SIMPLE welcome email endpoint - called directly during signup
 * No complex checks needed - just send the email
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log(`📧 [WELCOME-SIMPLE] Sending welcome email to ${email}`);

    // Get base URL for home page link
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
    const homePageUrl = baseUrl;

    // Generate email HTML
    const html = welcomeTemplate({ homePageUrl });

    // Send email
    const result = await sendEmail({
      to: email,
      subject: WELCOME.subject,
      html,
    });

    if (!result.success) {
      console.error('❌ [WELCOME-SIMPLE] Error sending:', result.error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to send welcome email',
          details: result.error 
        },
        { status: 500 }
      );
    }

    console.log(`✅ [WELCOME-SIMPLE] Sent successfully to ${email} (ID: ${result.emailId || 'N/A'})`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Welcome email sent to ${email}`,
      emailId: result.emailId
    });
  } catch (error) {
    console.error('❌ [WELCOME-SIMPLE] API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
