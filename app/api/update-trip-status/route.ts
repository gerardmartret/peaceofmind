import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { tripId, status } = await request.json();

    // Validate input
    if (!tripId || !status) {
      return NextResponse.json(
        { success: false, error: 'Trip ID and status are required' },
        { status: 400 }
      );
    }

    // Validate status value
    if (status !== 'confirmed' && status !== 'not confirmed') {
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

    // Prepare update data
    const updateData: { status: string; driver?: null } = { status };

    // If changing from confirmed to not confirmed, clear the driver
    if (currentTrip.status === 'confirmed' && status === 'not confirmed') {
      updateData.driver = null;
      console.log(`🔄 Clearing driver assignment (was: ${currentTrip.driver})`);
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

