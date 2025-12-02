import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Simple email validation for driver assignment - allows personal emails (gmail, yahoo, etc.)
function validateDriverEmail(email: string): { isValid: boolean; error?: string } {
  const trimmedEmail = email.trim();
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(trimmedEmail)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address'
    };
  }
  
  return { isValid: true };
}

export async function POST(request: NextRequest) {
  try {
    const { tripId, driverEmail } = await request.json();

    // Validate required fields
    if (!tripId || !driverEmail) {
      return NextResponse.json(
        { success: false, error: 'Trip ID and driver email are required' },
        { status: 400 }
      );
    }

    // Validate email - allows personal emails for drivers
    const emailValidation = validateDriverEmail(driverEmail.trim());
    if (!emailValidation.isValid) {
      return NextResponse.json(
        { success: false, error: emailValidation.error || 'Invalid email address' },
        { status: 400 }
      );
    }

    const normalizedEmail = driverEmail.trim().toLowerCase();
    if (process.env.NODE_ENV === 'development') {
      console.log(`🚗 Setting driver for trip ${tripId}`);
    }

    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify trip exists and user is owner
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, user_id, user_email, status, driver, trip_date, lead_passenger_name, trip_destination')
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

    // Verify the user is the trip owner
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (trip.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to modify this trip' },
        { status: 403 }
      );
    }

    // Check if trip is cancelled (terminal status)
    if (trip.status === 'cancelled') {
      if (process.env.NODE_ENV === 'development') {
        console.log(`⚠️ Cannot assign driver to cancelled trip ${tripId}`);
      }
      return NextResponse.json(
        { success: false, error: 'This trip has been cancelled. Please create a new trip instead.' },
        { status: 400 }
      );
    }

    // Check if trip is confirmed and has a driver
    if (trip.status === 'confirmed' && trip.driver) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`⚠️ Cannot change driver for confirmed trip ${tripId}`);
      }
      return NextResponse.json(
        { success: false, error: 'Change status to not confirmed first' },
        { status: 400 }
      );
    }

    // IMPORTANT: Invalidate old driver tokens and notify previous driver if driver is being changed
    const currentDriver = trip.driver;
    const previousDriverEmail = currentDriver && currentDriver !== normalizedEmail ? currentDriver : null;
    
    if (previousDriverEmail) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 Driver being changed for trip ${tripId}`);
        console.log(`🗑️ Invalidating tokens for previous driver: ${previousDriverEmail}`);
      }
      
      // Invalidate old driver tokens
      const { error: invalidateError } = await supabase
        .from('driver_tokens')
        .update({
          invalidated_at: new Date().toISOString(),
          invalidation_reason: 'driver_changed'
        })
        .eq('trip_id', tripId)
        .eq('driver_email', previousDriverEmail)
        .eq('used', false)
        .is('invalidated_at', null);
      
      if (invalidateError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('⚠️ Failed to invalidate old driver tokens:', invalidateError);
        }
        // Don't fail the request, just log the error
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Previous driver tokens invalidated`);
        }
      }
      
      // Send unassignment email to previous driver if trip status is pending (driver hasn't accepted yet)
      if (trip.status === 'pending') {
        if (process.env.NODE_ENV === 'development') {
          console.log(`📧 Sending unassignment notification to previous driver: ${previousDriverEmail}`);
        }
        fetch(`${request.url.split('/api')[0]}/api/notify-driver-unassignment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId: tripId,
            driverEmail: previousDriverEmail,
            tripDate: trip.trip_date,
            leadPassengerName: trip.lead_passenger_name,
            tripDestination: trip.trip_destination,
          })
        }).then(res => res.json())
          .then(result => {
            if (process.env.NODE_ENV === 'development') {
              if (result.success) {
                console.log('✅ Driver unassignment notification sent');
              } else {
                console.log('⚠️ Failed to send unassignment notification:', result.error);
              }
            }
          })
          .catch(err => {
            if (process.env.NODE_ENV === 'development') {
              console.log('⚠️ Unassignment notification will be sent in background:', err.message);
            }
          });
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log(`ℹ️ Trip status is ${trip.status}, skipping unassignment email (driver may have already accepted/rejected)`);
        }
      }
    }

    // Update the driver field
    const { data: updatedTrip, error: updateError } = await supabase
      .from('trips')
      .update({
        driver: normalizedEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId)
      .select()
      .single();

    if (updateError || !updatedTrip) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error updating driver:', updateError);
      }
      return NextResponse.json(
        { success: false, error: 'Failed to set driver' },
        { status: 500 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Driver set successfully for trip ${tripId}`);
    }
    
    // Send notification email to driver (non-blocking - don't wait)
    fetch(`${request.url.split('/api')[0]}/api/notify-driver-assignment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId: tripId,
        driverEmail: normalizedEmail,
        tripDate: updatedTrip.trip_date,
        leadPassengerName: updatedTrip.lead_passenger_name,
        tripDestination: updatedTrip.trip_destination,
      })
    }).then(res => res.json())
      .then(result => {
        if (process.env.NODE_ENV === 'development') {
          if (result.success) {
            console.log('✅ Driver assignment notification sent');
          } else {
            console.log('⚠️ Failed to send driver notification:', result.error);
          }
        }
      })
      .catch(err => {
        if (process.env.NODE_ENV === 'development') {
          console.log('⚠️ Driver notification will be sent in background:', err.message);
        }
      });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Driver set successfully',
      driver: normalizedEmail
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error in set-driver API:', error);
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

