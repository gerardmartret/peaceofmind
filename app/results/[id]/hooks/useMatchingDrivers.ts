import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { DriverRecord } from '../types';

interface UseMatchingDriversParams {
  driverDestination: string;
}

interface UseMatchingDriversReturn {
  matchingDrivers: DriverRecord[];
  loadingMatchingDrivers: boolean;
  matchingDriversError: string | null;
}

/**
 * Hook to fetch matching drivers based on trip destination
 */
export function useMatchingDrivers({ driverDestination }: UseMatchingDriversParams): UseMatchingDriversReturn {
  const [matchingDrivers, setMatchingDrivers] = useState<DriverRecord[]>([]);
  const [loadingMatchingDrivers, setLoadingMatchingDrivers] = useState<boolean>(false);
  const [matchingDriversError, setMatchingDriversError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!driverDestination) {
      setMatchingDrivers([]);
      setMatchingDriversError(null);
      setLoadingMatchingDrivers(false);
      return;
    }

    const sanitizedDestination = driverDestination.replace(/[%_]/g, '').trim();
    const destinationPattern = `%${sanitizedDestination}%`;

    const fetchDrivers = async () => {
      setLoadingMatchingDrivers(true);
      setMatchingDriversError(null);

      try {
        const { data, error } = await supabase
          .from('drivers')
          .select('*')
          .ilike('destination', destinationPattern);

        if (!active) return;

        if (error) {
          throw error;
        }

        setMatchingDrivers(data || []);
      } catch (err) {
        console.error('❌ Error fetching matching drivers:', err);
        if (active) {
          setMatchingDrivers([]);
          setMatchingDriversError('Unable to load available drivers.');
        }
      } finally {
        if (active) {
          setLoadingMatchingDrivers(false);
        }
      }
    };

    fetchDrivers();

    return () => {
      active = false;
    };
  }, [driverDestination]);

  return {
    matchingDrivers,
    loadingMatchingDrivers,
    matchingDriversError,
  };
}
