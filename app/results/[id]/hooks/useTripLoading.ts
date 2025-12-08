/**
 * useTripLoading Hook
 * 
 * Handles initial trip loading from database:
 * - Fetches trip data from Supabase
 * - Determines user role (owner, guest creator, etc.)
 * - Transforms database data to application format
 * - Initializes all trip-related state
 * - Handles errors and loading states
 */

import { useEffect, RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { determineRole } from '../utils/role-determination';
import { transformDatabaseTripToTripData } from '../utils/trip-data-transformers';
import type { TripData } from '../types';

export interface UseTripLoadingParams {
  tripId: string | undefined;
  user: { id: string } | null | undefined;
  isAuthenticated: boolean;
  authLoading?: boolean; // Optional: if auth is still loading, wait for it
  onTripDataLoaded: (tripData: TripData) => void;
  onLocationDisplayNamesLoaded: (names: Record<string, string>) => void;
  onRoleDetermined: (role: { isOwner: boolean; isGuestCreator: boolean; isGuestCreatedTrip: boolean }) => void;
  onMetadataLoaded: (metadata: {
    driverNotes: string;
    editedDriverNotes: string;
    leadPassengerName: string;
    vehicleInfo: string;
    passengerCount: number;
    tripDestination: string;
    passengerNames: string[];
    currentVersion: number;
    tripStatus: string;
    driverEmail: string | null;
  }) => void;
  onValidatedDriverEmailSet: (email: string | null) => void;
  onOriginalDriverEmailSet: (email: string | null) => void;
  onOwnershipChecked: () => void;
  onLoadingChange: (loading: boolean) => void;
  onError: (error: string) => void;
  originalDriverEmailRef: RefObject<string | null>;
}

/**
 * Hook to load trip from database and initialize state
 */
export function useTripLoading({
  tripId,
  user,
  isAuthenticated,
  authLoading = false,
  onTripDataLoaded,
  onLocationDisplayNamesLoaded,
  onRoleDetermined,
  onMetadataLoaded,
  onValidatedDriverEmailSet,
  onOriginalDriverEmailSet,
  onOwnershipChecked,
  onLoadingChange,
  onError,
  originalDriverEmailRef,
}: UseTripLoadingParams) {
  const router = useRouter();

  useEffect(() => {
    async function loadTripFromDatabase() {
      if (!tripId) {
        router.push('/');
        return;
      }

      // Wait for auth to finish loading before determining role
      // This prevents race conditions where trip loads before user is available
      if (authLoading) {
        return; // Exit early, will retry when authLoading becomes false
      }

      // If authenticated but user is null, wait a bit for it to load
      if (isAuthenticated && !user) {
        await new Promise(resolve => setTimeout(resolve, 200));
        // If still null after wait, proceed anyway (shouldn't happen if authLoading is working)
      }

      try {

        const { data, error: fetchError } = await supabase
          .from('trips')
          .select('*')
          .eq('id', tripId)
          .single();

        if (fetchError) {
          onError('Trip not found');
          onLoadingChange(false);
          return;
        }

        if (!data) {
          onError('Trip not found');
          onLoadingChange(false);
          return;
        }


        // Determine user role using utility function
        const tripUserId = data.user_id;
        const currentUserId = user?.id;
        const roleInfo = determineRole(tripUserId, currentUserId || null, isAuthenticated, tripId || '');

        onRoleDetermined(roleInfo);

        if (roleInfo.isOwner) {
        } else {
        }

        if (roleInfo.isGuestCreatedTrip) {
        }

        if (roleInfo.isGuestCreator) {
        }

        // Transform database data to match expected TripData format using utility
        const { tripData, locationDisplayNames } = transformDatabaseTripToTripData(data);

        onTripDataLoaded(tripData);
        onLocationDisplayNamesLoaded(locationDisplayNames);

        // Set trip metadata
        const status = data.status || 'not confirmed';
        onMetadataLoaded({
          driverNotes: data.trip_notes || '',
          editedDriverNotes: data.trip_notes || '',
          leadPassengerName: data.lead_passenger_name || '',
          vehicleInfo: data.vehicle || '',
          passengerCount: data.passenger_count || 1,
          tripDestination: data.trip_destination || '',
          passengerNames: [], // passenger_names column doesn't exist in DB
          currentVersion: data.version || 1,
          tripStatus: status,
          driverEmail: data.driver || null,
        });

        // Set validated driver email for display
        const driverEmail = data.driver || null;
        onValidatedDriverEmailSet(driverEmail);
        
        // Store original driver email for activity check
        if (originalDriverEmailRef && originalDriverEmailRef.current !== undefined) {
          originalDriverEmailRef.current = driverEmail;
        }
        onOriginalDriverEmailSet(driverEmail);

        // Initialize driver response status if trip is already confirmed/rejected and driver is assigned
        // This will be updated when driver token is validated or when driver confirms/rejects
        if (data.driver && (status === 'confirmed' || status === 'rejected')) {
          // We'll set this properly after token validation or when driver actions are taken
          // For now, leave it null and let the handlers set it
        }

        // Password protection removed - all users can access reports

        // Mark ownership as checked and loading complete - MUST be last to prevent UI glitches
        onOwnershipChecked();
        onLoadingChange(false);
      } catch (err) {
        onError('Failed to load trip');
        onLoadingChange(false);
      }
    }

    loadTripFromDatabase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, user?.id, isAuthenticated, authLoading]);
}

