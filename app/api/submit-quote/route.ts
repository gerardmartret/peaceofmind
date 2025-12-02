import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { tripId, email, price, currency } = await request.json();

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

    // Verify trip exists and get driver info
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, driver, status, trip_date, lead_passenger_name')
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

    // Check if quote already exists for this email and trip
    const normalizedEmail = email.trim().toLowerCase();
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

