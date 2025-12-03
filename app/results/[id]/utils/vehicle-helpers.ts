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

  const vehicleMatches =
    normalizedDriver.includes(normalizedVehicle) || normalizedVehicle.includes(normalizedDriver);

  const levelMatches = normalizedVehicleLevel
    ? normalizedDriverLevel.includes(normalizedVehicleLevel)
    : true;

  return vehicleMatches && levelMatches;
};

export const vehicleKey = (vehicle: any) =>
  vehicle.vehicle_id ||
  `${vehicle.vehicle_type}-${vehicle.level_of_service || 'unknown'}-${vehicle.sale_price?.price || '0'}`;

