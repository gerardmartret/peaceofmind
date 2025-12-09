import { useMemo, useState, useEffect } from 'react';
import { normalizeMatchKey, vehicleKey } from '@/app/results/[id]/utils/vehicle-helpers';

export function useVehicleFiltering(
  drivaniaQuotes: any,
  preferredVehicleHint: string | null | undefined
) {
  const [showOtherVehicles, setShowOtherVehicles] = useState<boolean>(false);

  const matchesPreferredVehicle = useMemo(() => {
    if (!preferredVehicleHint) return () => false;
    const normalizedHint = normalizeMatchKey(preferredVehicleHint);
    return (vehicle: any) => {
      const normalizedType = normalizeMatchKey(vehicle.vehicle_type);
      const normalizedLevel = normalizeMatchKey(vehicle.level_of_service);
      return (
        normalizedType.includes(normalizedHint) ||
        normalizedHint.includes(normalizedType) ||
        normalizedLevel.includes(normalizedHint) ||
        normalizedHint.includes(normalizedLevel)
      );
    };
  }, [preferredVehicleHint]);

  const preferredVehicles = useMemo(() => {
    if (!drivaniaQuotes?.quotes?.vehicles || !preferredVehicleHint) {
      return [];
    }
    return drivaniaQuotes.quotes.vehicles.filter(matchesPreferredVehicle);
  }, [drivaniaQuotes, preferredVehicleHint, matchesPreferredVehicle]);

  const displayVehicles = useMemo(() => {
    if (preferredVehicles.length > 0) {
      return preferredVehicles;
    }
    return drivaniaQuotes?.quotes?.vehicles || [];
  }, [preferredVehicles, drivaniaQuotes]);

  const otherVehicles = useMemo(() => {
    if (!drivaniaQuotes?.quotes?.vehicles || preferredVehicles.length === 0) {
      return [];
    }
    const preferredKeys = new Set(preferredVehicles.map((vehicle: any) => vehicleKey(vehicle)));
    return drivaniaQuotes.quotes.vehicles.filter(
      (vehicle: any) => !preferredKeys.has(vehicleKey(vehicle))
    );
  }, [drivaniaQuotes, preferredVehicles]);

  useEffect(() => {
    setShowOtherVehicles(false);
  }, [preferredVehicles]);

  return {
    preferredVehicles,
    displayVehicles,
    otherVehicles,
    showOtherVehicles,
    setShowOtherVehicles,
  };
}
