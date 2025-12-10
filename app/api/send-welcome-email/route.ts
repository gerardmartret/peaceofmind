import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/emails/email-service';
import { welcomeTemplate } from '@/lib/emails/templates/welcome';
import { WELCOME } from '@/lib/emails/content';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
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

    // Verify the user ID matches the authenticated user
    if (user.id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Check if email is confirmed
    if (!user.email_confirmed_at) {
      return NextResponse.json(
        { success: false, error: 'Email not confirmed yet' },
        { status: 400 }
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { success: false, error: 'User email not found' },
        { status: 400 }
      );
    }

    // Check if welcome email was already sent
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('welcome_email_sent')
      .eq('email', user.email)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      // PGRST116 is "not found" - that's okay, we'll create the record
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error checking user record:', userError);
      }
    }

    // If welcome email was already sent, return early
    if (userRecord?.welcome_email_sent) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`⚠️ Welcome email already sent to ${user.email}`);
      }
      return NextResponse.json({ 
        success: true, 
        message: 'Welcome email was already sent',
        alreadySent: true
      });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`📧 Sending welcome email to ${user.email}`);
    }

    // Get base URL for home page link
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
    const homePageUrl = baseUrl;

    // Generate email HTML
    const html = welcomeTemplate({ homePageUrl });

    // Send email
    const result = await sendEmail({
      to: user.email,
      subject: WELCOME.subject,
      html,
    });

    if (!result.success) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error sending welcome email:', result.error);
      }
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to send welcome email',
          details: result.error 
        },
        { status: 500 }
      );
    }

    // Mark welcome email as sent in the database
    const { error: updateError } = await supabase
      .from('users')
      .upsert({
        email: user.email,
        welcome_email_sent: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'email'
      });

    if (updateError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error updating welcome_email_sent flag:', updateError);
      }
      // Don't fail the request if we can't update the flag - email was sent successfully
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Welcome email sent to ${user.email}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Welcome email sent to ${user.email}`,
      emailId: result.emailId
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error in send-welcome-email API:', error);
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
