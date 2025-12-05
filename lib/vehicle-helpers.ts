/**
 * Vehicle validation and selection helpers
 */

// List of allowed vehicle models (case-insensitive matching)
const ALLOWED_VEHICLES = [
  // Mercedes
  'Mercedes S-Class',
  'Mercedes E-Class',
  'Mercedes C-Class',
  'Mercedes A-Class',
  'Mercedes GLS',
  'Mercedes GLE',
  'Mercedes GL',
  'Mercedes GLC',
  'Mercedes G-Class',
  'Mercedes GLS-Class',
  'Mercedes GLE-Class',
  'Mercedes GLC-Class',
  'Mercedes Maybach S-Class',
  'Merc S-Class',
  'Merc E-Class',
  'Merc C-Class',
  // BMW
  'BMW 7 Series',
  'BMW 5 Series',
  'BMW X1',
  'BMW X3',
  'BMW X5',
  'BMW X7',
  'BMW XM',
  // Audi
  'Audi A8',
  'Audi A6',
  'Audi A4',
  'Audi Q3',
  'Audi Q5',
  'Audi Q7',
  'Audi Q8',
  // Lexus
  'Lexus LS',
  'Lexus ES',
  'Lexus GS',
  'Lexus RX',
  'Lexus GX',
  'Lexus LX',
  'Lexus NX',
  'Lexus LS 500',
  'Lexus E350',
  // Other luxury brands
  'Rolls-Royce Ghost',
  'Rolls-Royce Phantom',
  'Bentley Continental',
  'Bentley Flying Spur',
  'Jaguar',
  'Tesla Model S',
  'Tesla Model X',
  'Porsche 911',
  'Porsche Cayenne',
  'Porsche Macan',
  'Lincoln Continental',
  'Lincoln Navigator',
  'Lincoln Aviator',
  'Cadillac Escalade',
  'Cadillac XTS',
  'Range Rover',
  'Volvo S90',
  'Volvo XC90',
  // Vehicle types
  'Business Sedan',
  'Business SUV',
];

/**
 * Check if a vehicle is in the allowed list
 */
export function isAllowedVehicle(vehicle: string | null | undefined): boolean {
  if (!vehicle || !vehicle.trim()) {
    return false;
  }

  const normalizedVehicle = vehicle.trim();
  
  // Check for exact match (case-insensitive)
  const normalizedAllowed = ALLOWED_VEHICLES.map(v => v.toLowerCase());
  if (normalizedAllowed.includes(normalizedVehicle.toLowerCase())) {
    return true;
  }

  // Check if vehicle contains any allowed vehicle name
  const vehicleLower = normalizedVehicle.toLowerCase();
  for (const allowed of ALLOWED_VEHICLES) {
    if (vehicleLower.includes(allowed.toLowerCase()) || allowed.toLowerCase().includes(vehicleLower)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the appropriate vehicle type based on passenger count
 */
export function getVehicleByPassengerCount(passengerCount: number | null | undefined): string {
  const count = passengerCount || 1;
  
  if (count > 3 && count <= 7) {
    return 'Business SUV';
  } else if (count <= 3) {
    return 'Business Sedan';
  } else {
    // For more than 7 passengers, still use SUV (or could be a van/minibus)
    return 'Business SUV';
  }
}

/**
 * Get the vehicle to display:
 * - If vehicle is empty, return auto-selected vehicle based on passenger count
 * - If vehicle is provided, return that vehicle
 */
export function getDisplayVehicle(
  requestedVehicle: string | null | undefined,
  passengerCount: number | null | undefined
): string {
  // If vehicle is empty, use auto-selected vehicle
  if (!requestedVehicle || !requestedVehicle.trim()) {
    return getVehicleByPassengerCount(passengerCount);
  }

  // Return the user-provided vehicle
  return requestedVehicle.trim();
}

