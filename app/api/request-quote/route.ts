import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/emails/email-service';
import { quoteRequestTemplate } from '@/lib/emails/templates/quote-request';
import { QUOTE_REQUEST } from '@/lib/emails/content';

export async function POST(request: NextRequest) {
  try {
    const { tripId, driverEmail } = await request.json();

    if (!tripId || !driverEmail) {
      return NextResponse.json(
        { success: false, error: 'Trip ID and driver email are required' },
        { status: 400 }
      );
    }

    // Basic email format validation (accept personal emails like Gmail)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(driverEmail.trim())) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    console.log(`📧 Sending quote request for trip: ${tripId}`);

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
    // Add quote parameter and driver email to highlight quote form and pre-fill email
    const encodedEmail = encodeURIComponent(driverEmail.trim());
    const tripLink = `${baseUrl}/results/${tripId}?quote=true&email=${encodedEmail}`;

    // Generate email HTML
    const html = quoteRequestTemplate({ tripDate, tripLink });

    // Send email
    const result = await sendEmail({
      to: driverEmail.trim(),
      subject: QUOTE_REQUEST.subject(tripDate),
      html,
    });

    if (!result.success) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error sending quote request email:', result.error);
      }
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to send quote request email',
          details: result.error 
        },
        { status: 500 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Quote request sent successfully for trip ${tripId}`);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Quote request sent to ${driverEmail}`,
      emailId: result.emailId
    });
  } catch (error) {
    console.error('❌ Error in request-quote API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

