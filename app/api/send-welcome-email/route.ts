import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/emails/email-service';
import { welcomeTemplate } from '@/lib/emails/templates/welcome';
import { WELCOME } from '@/lib/emails/content';

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const body = await request.json();
  const { userId } = body;
  console.log(`🔵 [WELCOME-EMAIL-${requestId}] Request received for userId: ${userId}`);
  
  try {

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

    // SIMPLEST POSSIBLE APPROACH:
    // 1. Check if already sent - if yes, return immediately
    // 2. Try to update from null/false to true
    // 3. If update succeeded, we're the first - send email
    // 4. If update failed (no rows), check again - if true now, someone else sent it

    console.log(`🔵 [WELCOME-EMAIL-${requestId}] Checking status for ${user.email}`);
    const { data: checkBefore } = await supabase
      .from('users')
      .select('welcome_email_sent')
      .eq('email', user.email)
      .maybeSingle();

    console.log(`🔵 [WELCOME-EMAIL-${requestId}] Current status: ${checkBefore?.welcome_email_sent ?? 'null'}`);

    if (checkBefore?.welcome_email_sent === true) {
      console.log(`⚠️ [WELCOME-EMAIL-${requestId}] Already sent to ${user.email}`);
      return NextResponse.json({ 
        success: true, 
        message: 'Welcome email was already sent',
        alreadySent: true
      });
    }

    // Try to update: only succeeds if welcome_email_sent is null or false
    // This is as atomic as we can get with Supabase client
    const wasNull = checkBefore?.welcome_email_sent === null;
    const wasFalse = checkBefore?.welcome_email_sent === false;

    let updateSucceeded = false;

    if (wasNull) {
      console.log(`🔵 [WELCOME-EMAIL-${requestId}] Attempting to update from null`);
      const { data: updated, error: updateError } = await supabase
        .from('users')
        .update({ welcome_email_sent: true, updated_at: new Date().toISOString() })
        .eq('email', user.email)
        .is('welcome_email_sent', null)
        .select('welcome_email_sent')
        .maybeSingle();
      
      console.log(`🔵 [WELCOME-EMAIL-${requestId}] Update result: ${updated ? 'SUCCESS' : 'FAILED'}`, updateError ? `Error: ${updateError.message}` : '');
      updateSucceeded = !!updated;
    } else if (wasFalse) {
      console.log(`🔵 [WELCOME-EMAIL-${requestId}] Attempting to update from false`);
      const { data: updated, error: updateError } = await supabase
        .from('users')
        .update({ welcome_email_sent: true, updated_at: new Date().toISOString() })
        .eq('email', user.email)
        .eq('welcome_email_sent', false)
        .select('welcome_email_sent')
        .maybeSingle();
      
      console.log(`🔵 [WELCOME-EMAIL-${requestId}] Update result: ${updated ? 'SUCCESS' : 'FAILED'}`, updateError ? `Error: ${updateError.message}` : '');
      updateSucceeded = !!updated;
    } else if (!checkBefore) {
      // User doesn't exist - create with flag set
      const { error: createError } = await supabase
        .from('users')
        .upsert({
          email: user.email,
          welcome_email_sent: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'email' });
      
      updateSucceeded = !createError;
    }

    // If update didn't succeed, check if another request set it
    if (!updateSucceeded) {
      const { data: checkAfter } = await supabase
        .from('users')
        .select('welcome_email_sent')
        .eq('email', user.email)
        .maybeSingle();

      if (checkAfter?.welcome_email_sent === true) {
        console.log(`⚠️ [WELCOME-EMAIL-${requestId}] Another request sent it first for ${user.email}`);
        return NextResponse.json({ 
          success: true, 
          message: 'Welcome email was already sent',
          alreadySent: true
        });
      }

      console.error(`❌ [WELCOME-EMAIL] Failed to set flag for ${user.email}`);
      return NextResponse.json(
        { success: false, error: 'Failed to update user record' },
        { status: 500 }
      );
    }

    console.log(`✅ [WELCOME-EMAIL-${requestId}] Successfully claimed send right for ${user.email}`);

    console.log(`📧 [WELCOME-EMAIL-${requestId}] Sending welcome email to ${user.email}`);

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
      console.error('❌ [WELCOME-EMAIL] Error sending:', result.error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to send welcome email',
          details: result.error 
        },
        { status: 500 }
      );
    }


    console.log(`✅ [WELCOME-EMAIL-${requestId}] Sent successfully to ${user.email} (ID: ${result.emailId || 'N/A'})`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Welcome email sent to ${user.email}`,
      emailId: result.emailId
    });
  } catch (error) {
    console.error('❌ [WELCOME-EMAIL] API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
