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

    console.log(`💰 Submitting quote for trip: ${tripId}`);

    // Verify trip exists and get driver info
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, driver, status, trip_date, lead_passenger_name')
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
    
    // Check if the quote is from the assigned driver
    const isAssignedDriver = trip.driver && trip.driver.toLowerCase() === normalizedEmail;
    
    console.log(`📊 Quote submission check:
      - Submitted by: ${normalizedEmail}
      - Assigned driver: ${trip.driver}
      - Current status: ${trip.status}
      - Is assigned driver: ${isAssignedDriver}
      - Will auto-confirm: ${isAssignedDriver && trip.status === 'pending'}`);
    
    if (isAssignedDriver && trip.status === 'pending') {
      console.log('🎯 Quote submitted by assigned driver - auto-confirming trip');
      
      // Update trip status to confirmed in DATABASE
      const { data: updatedTrip, error: statusError } = await supabase
        .from('trips')
        .update({ status: 'confirmed' })
        .eq('id', tripId)
        .select('status')
        .single();
      
      if (statusError) {
        console.error('❌ Failed to auto-confirm trip:', statusError);
      } else {
        console.log('✅ Trip auto-confirmed in DATABASE after driver quote submission');
        console.log(`📊 Database now shows status: ${updatedTrip.status}`);
        
        // Send confirmation email to driver
        try {
          const Resend = require('resend').Resend;
          const resendApiKey = process.env.RESEND_API_KEY;
          
          if (resendApiKey) {
            const resend = new Resend(resendApiKey);
            const tripDate = new Date(trip.trip_date).toLocaleDateString('en-GB', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
            
            const host = request.headers.get('host') || 'localhost:3000';
            const protocol = host.includes('localhost') ? 'http' : 'https';
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
            const tripLink = `${baseUrl}/results/${tripId}`;
            
            await resend.emails.send({
              from: 'DriverBrief <info@trips.driverbrief.com>',
              to: [normalizedEmail],
              subject: `Trip Confirmed - ${tripDate}`,
              html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #ffffff;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff;">
                    <tr>
                      <td align="center" style="padding: 40px 20px;">
                        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff;">
                          <tr>
                            <td style="background-color: #05060A; padding: 24px; border-radius: 8px 8px 0 0;">
                              <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">Service Confirmed</h1>
                            </td>
                          </tr>
                          <tr>
                            <td style="background-color: #f5f5f5; padding: 32px 24px; border-radius: 0 0 8px 8px;">
                              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
                                Hello,
                              </p>
                              
                              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #333333;">
                                Thank you for submitting your quote! The service for <strong style="color: #05060A;">${tripDate}</strong> is now confirmed.
                              </p>
                              
                              <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 24px 0; border-left: 4px solid #3ea34b;">
                                <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #666666; text-transform: uppercase; letter-spacing: 0.5px;">
                                  Status
                                </p>
                                <p style="margin: 0; font-size: 24px; font-weight: 700; color: #3ea34b;">
                                  Confirmed
                                </p>
                              </div>
                              
                              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                                <tr>
                                  <td align="center">
                                    <a href="${tripLink}" style="display: inline-block; background-color: #05060A; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600;">View Trip Details</a>
                                  </td>
                                </tr>
                              </table>
                              
                              <p style="margin: 24px 0 0 0; padding-top: 20px; border-top: 1px solid #d9d9d9; font-size: 13px; line-height: 1.5; color: #666666;">
                                Click the button above to view the complete trip information and any updates.
                              </p>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding: 20px 0;">
                              <p style="margin: 0; font-size: 12px; color: #999999;">This is an automated notification from DriverBrief</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
              `,
            });
            
            console.log('✅ Confirmation email sent to driver after quote submission');
          }
        } catch (emailError) {
          console.error('❌ Failed to send confirmation email:', emailError);
          // Don't fail the request if email fails
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: isUpdate ? 'Quote updated successfully' : 'Quote submitted successfully',
      quoteId: quote.id,
      isUpdate: isUpdate,
      autoConfirmed: isAssignedDriver && trip.status === 'pending'
    });
  } catch (error) {
    console.error('❌ Error in submit-quote API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

