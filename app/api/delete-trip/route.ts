import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';

// Create service role client for admin operations (bypasses RLS)
function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;
  
  if (serviceRoleKey) {
    return createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  
  // Fallback to regular client if service role key not available
  console.warn('⚠️ NEXT_SUPABASE_SERVICE_ROLE_KEY not set, using regular client (may be subject to RLS)');
  return supabase;
}

/**
 * DELETE endpoint to delete a trip
 * Verifies the user owns the trip before deletion
 */
export async function DELETE(request: NextRequest) {
  try {
    const { tripId, userId } = await request.json();

    // Validate input
    if (!tripId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Trip ID and user ID are required' },
        { status: 400 }
      );
    }

    // Verify the trip exists and belongs to the user
    const { data: trip, error: fetchError } = await supabase
      .from('trips')
      .select('id, user_id')
      .eq('id', tripId)
      .single();

    if (fetchError || !trip) {
      console.error('❌ Trip not found:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Trip not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (trip.user_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to delete this trip' },
        { status: 403 }
      );
    }

    // Use service role client for deletion (bypasses RLS)
    const adminClient = getServiceRoleClient();

    // Delete related records first (quotes, driver_tokens, etc.)
    // Delete quotes
    const { error: quotesError } = await adminClient
      .from('quotes')
      .delete()
      .eq('trip_id', tripId);

    if (quotesError) {
      console.error('⚠️ Error deleting quotes:', quotesError);
      // Continue with trip deletion even if quotes deletion fails
    }

    // Delete driver tokens
    const { error: tokensError } = await adminClient
      .from('driver_tokens')
      .delete()
      .eq('trip_id', tripId);

    if (tokensError) {
      console.error('⚠️ Error deleting driver tokens:', tokensError);
      // Continue with trip deletion even if tokens deletion fails
    }

    // Delete the trip using service role client
    const { data: deletedTrip, error: deleteError } = await adminClient
      .from('trips')
      .delete()
      .eq('id', tripId)
      .select();

    if (deleteError) {
      console.error('❌ Error deleting trip:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete trip', details: deleteError.message },
        { status: 500 }
      );
    }

    // Verify the trip was actually deleted
    const { data: verifyTrip, error: verifyError } = await adminClient
      .from('trips')
      .select('id')
      .eq('id', tripId)
      .single();

    if (verifyError && verifyError.code === 'PGRST116') {
      // PGRST116 means no rows found, which is what we want
      console.log(`✅ Trip ${tripId} deleted successfully`);
      return NextResponse.json({ success: true });
    } else if (verifyTrip) {
      // Trip still exists - deletion failed
      console.error('❌ Trip still exists after deletion attempt');
      return NextResponse.json(
        { success: false, error: 'Trip deletion failed - trip still exists' },
        { status: 500 }
      );
    } else {
      // Some other error occurred during verification
      console.error('⚠️ Error verifying deletion:', verifyError);
      // Still return success if we got a delete response, but log the warning
      console.log(`✅ Trip ${tripId} deletion completed (verification had issues)`);
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('❌ Error in delete-trip API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
