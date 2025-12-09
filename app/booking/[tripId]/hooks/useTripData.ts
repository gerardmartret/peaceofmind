import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { determineRole } from '@/app/results/[id]/utils/role-determination';

export function useTripData(tripId: string) {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  
  const [tripData, setTripData] = useState<any>(null);
  const [loadingTripData, setLoadingTripData] = useState(true);
  const [tripError, setTripError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [ownershipChecked, setOwnershipChecked] = useState<boolean>(false);

  useEffect(() => {
    const loadTripData = async () => {
      if (!tripId) {
        setTripError('Trip ID is required');
        setLoadingTripData(false);
        return;
      }

      // Wait for auth to finish loading before checking ownership
      if (authLoading) {
        return; // Exit early, will retry when authLoading becomes false
      }

      // If authenticated but user is null, wait a bit for it to load
      if (isAuthenticated && !user) {
        await new Promise(resolve => setTimeout(resolve, 200));
        // If still null after wait, proceed anyway (shouldn't happen if authLoading is working)
      }

      try {
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('id', tripId)
          .single();

        if (error) throw error;

        if (!data) {
          setTripError('Trip not found');
          setLoadingTripData(false);
          setOwnershipChecked(true);
          return;
        }

        // Check ownership - only owners can access booking page
        const tripUserId = data.user_id;
        const currentUserId = user?.id || null;
        const roleInfo = determineRole(tripUserId, currentUserId, isAuthenticated, tripId);
        
        setIsOwner(roleInfo.isOwner);
        setOwnershipChecked(true);

        // Redirect non-owners to results page
        if (!roleInfo.isOwner) {
          router.push(`/results/${tripId}`);
          return;
        }

        // Parse locations if stored as JSON string
        let locations = data.locations;
        if (typeof locations === 'string') {
          try {
            locations = JSON.parse(locations);
          } catch (e) {
            setTripError('Invalid trip data format');
            setLoadingTripData(false);
            return;
          }
        }

        setTripData({
          ...data,
          locations,
        });
        setLoadingTripData(false);
      } catch (err: any) {
        setTripError(err.message || 'Failed to load trip data');
        setLoadingTripData(false);
        setOwnershipChecked(true);
      }
    };

    loadTripData();
  }, [tripId, user, isAuthenticated, authLoading, router]);

  return {
    tripData,
    loadingTripData,
    tripError,
    isOwner,
    ownershipChecked,
    authLoading,
  };
}
