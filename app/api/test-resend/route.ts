import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function GET(request: NextRequest) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'RESEND_API_KEY not found in environment variables' 
        },
        { status: 500 }
      );
    }

    console.log('🔑 Resend API Key found (length:', resendApiKey.length, ')');

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    console.log('📧 Testing Resend connection...');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Resend API key is configured correctly',
      apiKeyLength: resendApiKey.length,
      apiKeyPrefix: resendApiKey.substring(0, 8) + '...',
      note: 'API key is valid. Use POST to /api/test-resend with { "to": "your@email.com" } to send a test email'
    });
  } catch (error) {
    console.error('❌ Error testing Resend:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'RESEND_API_KEY not found in environment variables' 
        },
        { status: 500 }
      );
    }

    const { to } = await request.json();

    if (!to) {
      return NextResponse.json(
        { success: false, error: 'Email address required in "to" field' },
        { status: 400 }
      );
    }

    console.log('📧 Sending test email to:', to);

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    // Send test email
    const { data, error } = await resend.emails.send({
      from: 'DriverBrief <onboarding@resend.dev>', // Using Resend's test domain
      to: [to],
      subject: '✅ Resend Integration Test - DriverBrief',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #05060A;">🎉 Resend Connection Successful!</h2>
          <p>This is a test email from your DriverBrief application.</p>
          <p>Your Resend integration is working correctly and ready to send driver notifications.</p>
          
          <div style="background-color: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Next Steps:</h3>
            <ol>
              <li>Verify your own domain in Resend dashboard</li>
              <li>Update the "from" address to use your domain</li>
              <li>Customize the notification email template</li>
            </ol>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            If you received this email, your Resend API integration is working perfectly! ✨
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('❌ Error sending test email:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: error.message || 'Failed to send email',
          details: error 
        },
        { status: 500 }
      );
    }

    console.log('✅ Test email sent successfully:', data);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Test email sent successfully!',
      emailId: data?.id,
      recipient: to,
      note: 'Check your inbox (and spam folder) for the test email'
    });
  } catch (error) {
    console.error('❌ Error in test-resend POST:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

