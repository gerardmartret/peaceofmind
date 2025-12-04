/**
 * useRealtimeTripUpdates Hook
 * 
 * Subscribes to real-time updates for trip status and driver assignment.
 * Only active for trip owners to keep UI in sync with database changes.
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface UseRealtimeTripUpdatesParams {
  tripId: string | undefined;
  isOwner: boolean;
  tripStatus: string;
  driverEmail: string | null;
  onStatusUpdate: (newStatus: string) => void;
  onDriverUpdate: (newDriver: string | null) => void;
}

/**
 * Hook to subscribe to real-time trip updates
 * 
 * @param tripId - The trip ID to subscribe to
 * @param isOwner - Whether the current user is the trip owner
 * @param tripStatus - Current trip status (for comparison)
 * @param driverEmail - Current driver email (for comparison)
 * @param onStatusUpdate - Callback when status changes
 * @param onDriverUpdate - Callback when driver changes
 */
export function useRealtimeTripUpdates({
  tripId,
  isOwner,
  tripStatus,
  driverEmail,
  onStatusUpdate,
  onDriverUpdate,
}: UseRealtimeTripUpdatesParams) {
  // Use refs to store current values without causing re-subscriptions
  const tripStatusRef = useRef(tripStatus);
  const driverEmailRef = useRef(driverEmail);

  // Update refs when values change
  useEffect(() => {
    tripStatusRef.current = tripStatus;
    driverEmailRef.current = driverEmail;
  }, [tripStatus, driverEmail]);

  useEffect(() => {
    if (!tripId || !isOwner) return;

    console.log('🔄 Setting up realtime subscription for trip status updates');

    const channel = supabase
      .channel(`trip-status-${tripId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trips',
          filter: `id=eq.${tripId}`,
        },
        (payload) => {
          console.log('🔄 Realtime trip update received');
          const currentStatus = tripStatusRef.current;
          const currentDriver = driverEmailRef.current;
          console.log('📊 Current UI state - Status:', currentStatus, 'Has driver:', !!currentDriver);

          if (payload.new) {
            const newStatus = payload.new.status;
            const newDriver = payload.new.driver;

            console.log('📊 Database update - New status:', newStatus, 'New driver:', newDriver);

            // Update status if changed
            if (newStatus && newStatus !== currentStatus) {
              console.log(`✅ Trip status updated via realtime: ${currentStatus} → ${newStatus}`);
              onStatusUpdate(newStatus);

              // Special case: Auto-confirmation from driver quote submission
              if (currentStatus === 'pending' && newStatus === 'confirmed') {
                console.log('🎯 Detected Pending → Confirmed transition (likely from driver quote submission)');
              }
            }

            // Update driver if changed
            if (newDriver !== undefined && newDriver !== currentDriver) {
              console.log(`✅ Driver updated via realtime: ${currentDriver ? 'assigned' : 'unassigned'} → ${newDriver ? 'assigned' : 'unassigned'}`);
              onDriverUpdate(newDriver);
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔄 Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [tripId, isOwner, onStatusUpdate, onDriverUpdate]);
}

