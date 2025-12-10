import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendEmail, isEmailServiceConfigured } from '@/lib/emails/email-service';
import { guestTripCreatedTemplate } from '@/lib/emails/templates/guest-trip-created';
import { GUEST_TRIP_CREATED } from '@/lib/emails/content';

export async function POST(request: NextRequest) {
  try {
    console.log('📧 [CREATE-GUEST-TRIP] Received request to create guest trip');
    const body = await request.json();
    const { tripData, email } = body;

    if (!tripData || !email) {
      console.error('❌ [CREATE-GUEST-TRIP] Missing required fields:', { 
        hasTripData: !!tripData, 
        hasEmail: !!email 
      });
      return NextResponse.json(
        { success: false, error: 'Trip data and email are required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      console.error('❌ [CREATE-GUEST-TRIP] Invalid email format:', email);
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    console.log('💾 [CREATE-GUEST-TRIP] Saving user to database...');
    // Save user to database (guest - no auth_user_id)
    const { error: userError } = await supabase
      .from('users')
      .upsert({
        email: email.trim(),
        marketing_consent: true
      }, { onConflict: 'email' });

    if (userError) {
      console.error('❌ [CREATE-GUEST-TRIP] Error saving user:', userError);
      // Don't fail the request if user save fails - continue with trip creation
    }

    console.log('💾 [CREATE-GUEST-TRIP] Saving trip to database...');
    // Save trip to database
    const { data: tripDataResult, error: tripError } = await supabase
      .from('trips')
      .insert({
        ...tripData,
        user_email: email.trim(),
      })
      .select()
      .single();

    if (tripError || !tripDataResult) {
      console.error('❌ [CREATE-GUEST-TRIP] Error saving trip:', tripError);
      return NextResponse.json(
        { success: false, error: 'Failed to save trip', details: tripError?.message },
        { status: 500 }
      );
    }

    console.log('✅ [CREATE-GUEST-TRIP] Trip saved successfully:', tripDataResult.id);

    // Send email notification - MANDATORY for guest trips
    let emailSent = false;
    let emailError: string | null = null;
    
    try {
      // Check if email service is configured
      if (!isEmailServiceConfigured()) {
        emailError = 'Email service not configured (RESEND_API_KEY missing)';
        console.error('❌ [CREATE-GUEST-TRIP] RESEND_API_KEY not configured');
      } else {
        console.log(`📧 [CREATE-GUEST-TRIP] Sending guest trip email to ${email}`);

        // Get base URL for signup link
        const host = request.headers.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
        const signupUrl = `${baseUrl}/signup?email=${encodeURIComponent(email.trim())}`;

        // Get destination from trip data
        const destination = tripData.trip_destination || 'your destination';

        console.log(`📧 [CREATE-GUEST-TRIP] Email details:`, {
          to: email.trim(),
          destination,
          signupUrl: signupUrl.substring(0, 50) + '...',
        });

        // Generate email HTML
        const html = guestTripCreatedTemplate({
          destination,
          signupUrl,
        });

        console.log(`📧 [CREATE-GUEST-TRIP] Email HTML generated (${html.length} chars)`);

        // Send email (await to ensure it's sent before response)
        const result = await sendEmail({
          to: email.trim(),
          subject: GUEST_TRIP_CREATED.subject,
          html,
        });

        console.log(`📧 [CREATE-GUEST-TRIP] Email send result:`, {
          success: result.success,
          emailId: result.emailId,
          error: result.error,
        });

        if (!result.success) {
          emailError = result.error || 'Unknown error';
          console.error('❌ [CREATE-GUEST-TRIP] Error sending guest trip email:', emailError);
        } else {
          emailSent = true;
          console.log(`✅ [CREATE-GUEST-TRIP] Guest trip email sent successfully to ${email} (ID: ${result.emailId || 'N/A'})`);
        }
      }
    } catch (emailErrorCaught) {
      emailError = emailErrorCaught instanceof Error ? emailErrorCaught.message : String(emailErrorCaught);
      console.error('❌ [CREATE-GUEST-TRIP] Exception in email sending:', emailErrorCaught);
      console.error('❌ [CREATE-GUEST-TRIP] Stack trace:', emailErrorCaught instanceof Error ? emailErrorCaught.stack : 'No stack');
    }

    // Return with trip data (email status included for debugging)
    return NextResponse.json({
      success: true,
      trip: tripDataResult,
      message: 'Guest trip created successfully',
      emailSent,
      ...(emailError && { emailError }),
    });
  } catch (error) {
    console.error('❌ [CREATE-GUEST-TRIP] Error in create-guest-trip API:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
