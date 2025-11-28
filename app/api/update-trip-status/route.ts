import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { tripId, status, driver } = await request.json();

    // Validate input
    if (!tripId || !status) {
      return NextResponse.json(
        { success: false, error: 'Trip ID and status are required' },
        { status: 400 }
      );
    }

    // Validate status value
    const validStatuses = ['confirmed', 'not confirmed', 'pending', 'rejected', 'cancelled', 'booked'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status value' },
        { status: 400 }
      );
    }

    console.log(`📝 Updating trip status: ${tripId} -> ${status}`);

    // First, get the current trip to check the current status
    const { data: currentTrip, error: fetchError } = await supabase
      .from('trips')
      .select('status, driver')
      .eq('id', tripId)
      .single();

    if (fetchError || !currentTrip) {
      console.error('❌ Error fetching trip:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Trip not found' },
        { status: 404 }
      );
    }

    // Validate state transitions
    const VALID_TRANSITIONS: Record<string, string[]> = {
      'not confirmed': ['pending', 'confirmed', 'booked'],
      'pending': ['confirmed', 'rejected', 'cancelled', 'booked'], // Can cancel to cancelled
      'confirmed': ['cancelled'], // Can cancel to cancelled
      'booked': ['cancelled'], // Can cancel booked trips
      'rejected': ['pending', 'not confirmed'], // Can retry after rejection
      'cancelled': [], // TERMINAL STATUS - no transitions allowed, must create new trip
    };

    const currentStatus = currentTrip.status || 'not confirmed';
    const validNextStates = VALID_TRANSITIONS[currentStatus] || [];
    
    if (!validNextStates.includes(status)) {
      console.error(`❌ Invalid state transition: ${currentStatus} -> ${status}`);
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot transition from "${currentStatus}" to "${status}". Valid transitions: ${validNextStates.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: { status: string; driver?: string | null } = { status };

    // Set driver when booking with Drivania
    if (status === 'booked' && driver) {
      updateData.driver = driver;
      console.log(`🚗 Setting driver to: ${driver}`);
    }

    // Clear driver when cancelling (setting status to cancelled)
    if (status === 'cancelled') {
      updateData.driver = null;
      console.log(`🔄 Cancelling trip - clearing driver assignment`);
      
      // Invalidate driver tokens if driver was assigned
      if (currentTrip.driver) {
        console.log(`🗑️ Invalidating driver tokens`);
        const { error: invalidateError } = await supabase
          .from('driver_tokens')
          .update({
            invalidated_at: new Date().toISOString(),
            invalidation_reason: 'trip_cancelled'
          })
          .eq('trip_id', tripId)
          .eq('driver_email', currentTrip.driver)
          .eq('used', false)
          .is('invalidated_at', null);
        
        if (invalidateError) {
          console.error('⚠️ Failed to invalidate driver tokens:', invalidateError);
        } else {
          console.log(`✅ Driver tokens invalidated successfully`);
        }
      }
    }

    // Also clear driver when going back to not confirmed (legacy behavior)
    if ((currentTrip.status === 'confirmed' || currentTrip.status === 'pending') && status === 'not confirmed') {
      updateData.driver = null;
      console.log(`🔄 Resetting trip - clearing driver assignment`);
    }

    // Update the trip status (and driver if needed) in the database
    const { data, error: updateError } = await supabase
      .from('trips')
      .update(updateData)
      .eq('id', tripId)
      .select()
      .single();

    if (updateError || !data) {
      console.error('❌ Error updating trip status:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update trip status' },
        { status: 500 }
      );
    }

    console.log(`✅ Trip status updated successfully to: ${status}`);
    if (updateData.driver === null) {
      console.log(`✅ Driver assignment cleared`);
    }
    return NextResponse.json({ success: true, status: data.status });
  } catch (error) {
    console.error('❌ Error in update-trip-status API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

