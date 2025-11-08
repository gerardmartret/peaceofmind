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
    console.log(`🚗 Setting driver for trip ${tripId} to ${normalizedEmail}`);

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
      .select('id, user_id, user_email, status, driver')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      console.error('❌ Trip not found:', tripError);
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

    // Check if trip is confirmed and has a driver
    if (trip.status === 'confirmed' && trip.driver) {
      console.log(`⚠️ Cannot change driver for confirmed trip ${tripId}`);
      return NextResponse.json(
        { success: false, error: 'Change status to not confirmed first' },
        { status: 400 }
      );
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
      console.error('❌ Error updating driver:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to set driver' },
        { status: 500 }
      );
    }

    console.log(`✅ Driver set successfully for trip ${tripId}`);
    return NextResponse.json({ 
      success: true, 
      message: 'Driver set successfully',
      driver: normalizedEmail
    });
  } catch (error) {
    console.error('❌ Error in set-driver API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

