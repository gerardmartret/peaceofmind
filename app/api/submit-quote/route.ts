import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/emails/email-service';
import { quoteSubmittedTemplate } from '@/lib/emails/templates/quote-submitted';
import { QUOTE_SUBMITTED } from '@/lib/emails/content';

export async function POST(request: NextRequest) {
  try {
    const { tripId, email, driverName, price, currency } = await request.json();

    // Validate required fields
    if (!tripId || !email || !price || !currency) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Basic email format validation (accept personal emails like Gmail)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Validate price
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return NextResponse.json(
        { success: false, error: 'Price must be a positive number' },
        { status: 400 }
      );
    }

    // Validate currency
    const allowedCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF'];
    if (!allowedCurrencies.includes(currency)) {
      return NextResponse.json(
        { success: false, error: 'Invalid currency' },
        { status: 400 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`💰 Submitting quote for trip: ${tripId}`);
    }

    // Verify trip exists and get trip owner info
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, driver, status, trip_date, lead_passenger_name, trip_destination, user_id, user_email')
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

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();
    
    // Check if quote already exists for this email and trip
    const { data: existingQuote } = await supabase
      .from('quotes')
      .select('id')
      .eq('trip_id', tripId)
      .eq('email', normalizedEmail)
      .single();

    let quote;
    let isUpdate = false;

    if (existingQuote) {
      // Update existing quote
      if (process.env.NODE_ENV === 'development') {
        console.log(`📝 Updating existing quote: ${existingQuote.id}`);
      }
      const { data: updatedQuote, error: updateError } = await supabase
        .from('quotes')
        .update({
          price: priceNum,
          currency: currency,
          driver_name: driverName?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingQuote.id)
        .select()
        .single();

      if (updateError || !updatedQuote) {
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Error updating quote:', updateError);
        }
        return NextResponse.json(
          { success: false, error: 'Failed to update quote' },
          { status: 500 }
        );
      }

      quote = updatedQuote;
      isUpdate = true;
    } else {
      // Insert new quote
      if (process.env.NODE_ENV === 'development') {
        console.log('✨ Creating new quote');
      }
      const { data: newQuote, error: insertError } = await supabase
        .from('quotes')
        .insert({
          trip_id: tripId,
          email: normalizedEmail,
          driver_name: driverName?.trim() || null,
          price: priceNum,
          currency: currency,
        })
        .select()
        .single();

      if (insertError || !newQuote) {
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Error inserting quote:', insertError);
        }
        return NextResponse.json(
          { success: false, error: 'Failed to submit quote' },
          { status: 500 }
        );
      }

      quote = newQuote;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Quote ${isUpdate ? 'updated' : 'submitted'} successfully: ${quote.id}`);
    }
    
    // Send notification to trip owner (only for new quotes, not updates)
    if (!isUpdate && trip.user_email && trip.trip_destination) {
      try {
        const host = request.headers.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
        // Link to results page with quote modal open
        const tripLink = `${baseUrl}/results/${tripId}`;

        // Generate email HTML
        const html = quoteSubmittedTemplate({
          destination: trip.trip_destination,
          driverEmail: normalizedEmail,
          price: priceNum,
          currency: currency,
          tripLink,
        });

        // Send email (don't fail if email fails)
        const emailResult = await sendEmail({
          to: trip.user_email,
          subject: QUOTE_SUBMITTED.subject(trip.trip_destination),
          html,
        });

        if (emailResult.success && process.env.NODE_ENV === 'development') {
          console.log(`✅ Quote notification sent to trip owner: ${trip.user_email}`);
        } else if (process.env.NODE_ENV === 'development') {
          console.log(`⚠️ Failed to send quote notification: ${emailResult.error}`);
        }
      } catch (emailError) {
        // Don't fail quote submission if email fails
        if (process.env.NODE_ENV === 'development') {
          console.log('⚠️ Error sending quote notification:', emailError);
        }
      }
    }
    
    // NOTE: Removed auto-confirmation logic. Drivers must manually confirm trips via the confirmation button.
    
    return NextResponse.json({ 
      success: true, 
      message: isUpdate ? 'Quote updated successfully' : 'Quote submitted successfully',
      quoteId: quote.id,
      isUpdate: isUpdate
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error in submit-quote API:', error);
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

