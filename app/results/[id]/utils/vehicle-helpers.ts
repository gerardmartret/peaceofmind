export const normalizeVehicleText = (text?: string): string =>
  (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const normalizeMatchKey = (value?: string | null): string =>
  (value || '').trim().toLowerCase();

export const matchesDriverToVehicle = (
  driverType: string | null | undefined,
  driverLevel: string | null | undefined,
  vehicleType: string | null | undefined,
  vehicleLevel: string | null | undefined,
) => {
  const normalizedDriver = normalizeMatchKey(driverType);
  const normalizedVehicle = normalizeMatchKey(vehicleType);
  const normalizedDriverLevel = normalizeMatchKey(driverLevel);
  const normalizedVehicleLevel = normalizeMatchKey(vehicleLevel);

  if (!normalizedDriver || !normalizedVehicle) return false;

  // Vehicle type matching: be strict about exact matches
  let vehicleMatches = false;
  
  // Exact match
  if (normalizedDriver === normalizedVehicle) {
    vehicleMatches = true;
  }
  // Handle "sedan eco" vs "Sedan Eco" - both have spaces, allow if one contains the other
  else if (normalizedDriver.includes(' ') && normalizedVehicle.includes(' ')) {
    // Both have spaces - allow if one fully contains the other (e.g., "sedan eco" contains "sedan eco")
    vehicleMatches = normalizedDriver.includes(normalizedVehicle) || normalizedVehicle.includes(normalizedDriver);
  }
  // Handle "sedan" vs "Sedan" - neither has spaces, allow if they're the same
  else if (!normalizedDriver.includes(' ') && !normalizedVehicle.includes(' ')) {
    vehicleMatches = normalizedDriver === normalizedVehicle;
  }
  // Mixed case: one has space, one doesn't - only match if they're the same base word
  // e.g., "sedan eco" should NOT match "sedan" (different vehicle types)
  else {
    // Extract base word (first word before space)
    const driverBase = normalizedDriver.split(' ')[0];
    const vehicleBase = normalizedVehicle.split(' ')[0];
    // Only match if base words are the same AND the one with space is a variation
    // This allows "sedan eco" to potentially match "sedan" if we want, but for now be strict
    vehicleMatches = false; // Don't match mixed cases - be strict
  }

  if (!vehicleMatches) return false;

  // Service level matching: exact match required only
  // No upgrades or downgrades allowed - strict matching
  if (normalizedDriverLevel === normalizedVehicleLevel) {
    return true;
  }

  // If vehicle has a service level, driver must match exactly
  if (normalizedVehicleLevel) {
    // If driver has no level specified, don't match vehicles with specific levels
    if (!normalizedDriverLevel) {
      return false;
    }
    // Only exact matches allowed - no upgrades or downgrades
    return false;
  }

  // If vehicle has no service level specified, match any driver
  return true;
};

export const vehicleKey = (vehicle: any) =>
  vehicle.vehicle_id ||
  `${vehicle.vehicle_type}-${vehicle.level_of_service || 'unknown'}-${vehicle.sale_price?.price || '0'}`;

