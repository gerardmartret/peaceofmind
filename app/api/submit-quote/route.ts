import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { validateBusinessEmail } from '@/lib/email-validation';

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

    // Validate email
    const emailValidation = validateBusinessEmail(email.trim());
    if (!emailValidation.isValid) {
      return NextResponse.json(
        { success: false, error: emailValidation.error || 'Invalid email address' },
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

    console.log(`💰 Submitting quote for trip: ${tripId}`);

    // Verify trip exists
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      console.error('❌ Trip not found:', tripError);
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
      console.log(`📝 Updating existing quote: ${existingQuote.id}`);
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
        console.error('❌ Error updating quote:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update quote' },
          { status: 500 }
        );
      }

      quote = updatedQuote;
      isUpdate = true;
    } else {
      // Insert new quote
      console.log('✨ Creating new quote');
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
        console.error('❌ Error inserting quote:', insertError);
        return NextResponse.json(
          { success: false, error: 'Failed to submit quote' },
          { status: 500 }
        );
      }

      quote = newQuote;
    }

    console.log(`✅ Quote ${isUpdate ? 'updated' : 'submitted'} successfully: ${quote.id}`);
    return NextResponse.json({ 
      success: true, 
      message: isUpdate ? 'Quote updated successfully' : 'Quote submitted successfully',
      quoteId: quote.id,
      isUpdate: isUpdate
    });
  } catch (error) {
    console.error('❌ Error in submit-quote API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

