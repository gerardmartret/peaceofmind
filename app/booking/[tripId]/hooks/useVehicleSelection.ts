import { useState } from 'react';

export type VehicleSelection = {
  isVehicleSelected: boolean;
  selectedDriverIds: string[];
};

export function useVehicleSelection() {
  const [vehicleSelections, setVehicleSelections] = useState<Record<string, VehicleSelection>>({});
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

  const calculatePrice = (
    basePrice: number,
    driverCount: number
  ): { extraFare: number; totalPrice: number } => {
    let extraFare = 0;

    if (driverCount === 1) {
      extraFare = basePrice * 0.2;
    } else if (driverCount === 2) {
      extraFare = basePrice * 0.15;
    } else if (driverCount === 3) {
      extraFare = basePrice * 0.1;
    } else if (driverCount === 4) {
      extraFare = basePrice * 0.05;
    } else if (driverCount >= 5) {
      extraFare = 0;
    }

    const totalPrice = basePrice + extraFare;
    return { extraFare, totalPrice };
  };

  return {
    vehicleSelections,
    setVehicleSelections,
    selectedVehicle,
    setSelectedVehicle,
    calculatePrice,
  };
}
