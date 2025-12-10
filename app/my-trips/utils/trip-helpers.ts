import { determineVehicleType, extractCarInfo } from '@/app/results/[id]/utils/vehicle-detection-helpers';
import { getDisplayVehicle } from '@/lib/vehicle-helpers';

export interface Trip {
  id: string;
  trip_date: string;
  created_at: string | null;
  locations: any;
  passenger_count: number | null;
  trip_destination: string | null;
  lead_passenger_name: string | null;
  vehicle: string | null;
  trip_notes: string | null;
  status: string;
  driver: string | null;
}

/**
 * Format date for display
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
}

/**
 * Get trip location count
 */
export function getLocationCount(locations: any): number {
  try {
    if (Array.isArray(locations)) {
      return locations.length;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Get vehicle image path (matching TripSummarySection logic)
 */
export function getVehicleImagePath(
  trip: Trip,
  theme: 'light' | 'dark' | undefined,
  mounted: boolean
): string {
  const vehicleInfo = trip.vehicle || '';
  const driverNotes = trip.trip_notes || '';
  const passengerCount = trip.passenger_count || 1;
  
  // Check if it's a Maybach S-Class - should use S-Class image instead of Phantom
  const vehicleText = (vehicleInfo || driverNotes || '').toLowerCase();
  const isMaybachSClass = 
    /(?:mercedes|merc)\s*maybach\s*s(?:[\s-]*class)?/i.test(vehicleText) ||
    /maybach\s*(?:mercedes|merc)\s*s(?:[\s-]*class)?/i.test(vehicleText);
  
  // Determine vehicle type (pass tripDestination for location-based logic)
  const vehicleType = determineVehicleType(vehicleInfo, driverNotes, passengerCount, trip.trip_destination);
  
  // If it's Maybach S-Class, use S-Class image
  if (isMaybachSClass) {
    return mounted && theme === 'light' ? "/Vehicles/light-brief-sclass-web.png" : "/Vehicles/dark-brief-sclass-web.png";
  }
  
  // Otherwise, use normal logic (default to dark if theme is undefined or not mounted)
  const isLight = mounted && theme === 'light';
  return vehicleType === 'van' 
    ? (isLight ? "/Vehicles/light-brief-vclass-web.png" : "/Vehicles/dark-brief-vclass-web.png")
    : vehicleType === 'minibus' 
      ? (isLight ? "/Vehicles/light-brief-sprinter-web.png" : "/Vehicles/dark-brief-sprinter-web.png")
      : vehicleType === 'luxury-suv'
        ? (isLight ? "/Vehicles/light-brief-range-web.png" : "/Vehicles/dark-brief-range-web.png")
        : vehicleType === 'suv' 
          ? (isLight ? "/Vehicles/light-brief-escalade-web.png" : "/Vehicles/dark-brief-escalade-web.png")
          : vehicleType === 'signature-sedan'
            ? (isLight ? "/Vehicles/light-brief-phantom-web.png" : "/Vehicles/dark-brief-phantom-web.png")
            : vehicleType === 'premium-sedan'
              ? (isLight ? "/Vehicles/light-brief-sclass-web.png" : "/Vehicles/dark-brief-sclass-web.png")
              : vehicleType === 'comfort-sedan'
                ? (isLight ? "/Vehicles/light-brief-camry-web.png" : "/Vehicles/dark-brief-camry-web.png")
                : (isLight ? "/Vehicles/light-brief-eclass-web.png" : "/Vehicles/dark-brief-eclass-web.png");
}

/**
 * Get status badge variant and text (matching TripStatusButton logic)
 */
export function getStatusBadge(trip: Trip) {
  const status = trip.status || 'not confirmed';
  
  // Determine variant based on status
  const getVariant = (): 'confirmed' | 'pending' | 'not-confirmed' | 'cancelled' | 'rejected' | 'request-quote-style' => {
    if (status === 'cancelled') {
      return 'cancelled';
    }
    if (status === 'not confirmed') {
      return 'request-quote-style';
    }
    if (status === 'rejected') {
      return 'rejected';
    }
    if (status === 'confirmed' || status === 'booked') {
      return 'confirmed';
    }
    if (status === 'pending') {
      return 'pending';
    }
    return 'request-quote-style';
  };

  // Get button text
  const getText = (): string => {
    if (status === 'cancelled') {
      return 'Cancelled';
    }
    if (status === 'rejected') {
      return 'Rejected';
    }
    if (status === 'confirmed') {
      return 'Confirmed';
    }
    if (status === 'booked') {
      return 'Booking Secured';
    }
    if (status === 'pending') {
      return 'Pending';
    }
    return 'Not confirmed';
  };

  return {
    variant: getVariant(),
    text: getText(),
  };
}

/**
 * Generate trip name matching the report format
 */
export function generateTripName(trip: Trip): string {
  // Calculate trip duration from locations (matching TripSummarySection logic)
  const calculateTripDuration = (): string => {
    if (trip.locations && Array.isArray(trip.locations) && trip.locations.length >= 2) {
      // If trip only has 2 locations (pickup and dropoff), return "Transfer"
      if (trip.locations.length === 2) {
        return 'Transfer';
      }
      
      const pickupTime = parseInt(trip.locations[0]?.time) || 0;
      const dropoffTime = parseInt(trip.locations[trip.locations.length - 1]?.time) || 0;
      const duration = dropoffTime - pickupTime;

      if (duration > 0) {
        const hours = Math.floor(duration);
        return `${hours}h`;
      }
      return '0h';
    }
    return '0h';
  };

  const tripDuration = calculateTripDuration();
  const passengerName = trip.lead_passenger_name || 'Passenger';
  const passengerCount = trip.passenger_count || 1;
  const tripDestination = trip.trip_destination || 'London';

  // Match the exact format from TripSummarySection: {leadPassengerName || 'Passenger'} (x{passengerCount || 1}) {tripDuration} in {tripDestination || 'London'}
  return `${passengerName} (x${passengerCount}) ${tripDuration} in ${tripDestination}`;
}

/**
 * Filter trips by tab, search text, and status (for other drivers tab)
 */
export function filterTripsByTabAndSearch(
  tripList: Trip[],
  tab: 'drivania' | 'other-drivers',
  searchText: string,
  statusFilter?: string | null
): Trip[] {
  // First filter by tab
  let filtered = tripList.filter((trip) => {
    if (tab === 'drivania') {
      return trip.status === 'booked';
    } else {
      return trip.status !== 'booked';
    }
  });

  // Filter by status if provided (for other drivers tab)
  if (tab === 'other-drivers' && statusFilter) {
    filtered = filtered.filter((trip) => (trip.status || 'not confirmed') === statusFilter);
  }

  // Then filter by search text if provided
  if (searchText.trim()) {
    const searchLower = searchText.toLowerCase();
    filtered = filtered.filter((trip) => {
      const passengerName = (trip.lead_passenger_name || '').toLowerCase();
      const tripDate = trip.trip_date ? new Date(trip.trip_date).toLocaleDateString('en-GB').toLowerCase() : '';
      const destination = (trip.trip_destination || '').toLowerCase();
      const tripName = generateTripName(trip).toLowerCase();
      
      // Check if search text matches any of these fields
      return passengerName.includes(searchLower) ||
             tripDate.includes(searchLower) ||
             destination.includes(searchLower) ||
             tripName.includes(searchLower);
    });
  }

  return filtered;
}

/**
 * Get unique statuses from other drivers trips (excluding 'booked')
 */
export function getOtherDriversStatuses(trips: Trip[]): string[] {
  const statuses = new Set<string>();
  trips.forEach((trip) => {
    if (trip.status !== 'booked') {
      statuses.add(trip.status || 'not confirmed');
    }
  });
  
  // Define the desired order
  const statusOrder: { [key: string]: number } = {
    'not confirmed': 0,
    'confirmed': 1,
    'pending': 2,
    'cancelled': 3,
    'rejected': 4,
  };
  
  return Array.from(statuses).sort((a, b) => {
    const orderA = statusOrder[a] ?? 999;
    const orderB = statusOrder[b] ?? 999;
    return orderA - orderB;
  });
}

/**
 * Get vehicle display name matching TripSummarySection logic
 */
export function getVehicleDisplayName(trip: Trip): string {
  const vehicleInfo = trip.vehicle || '';
  const driverNotes = trip.trip_notes || '';
  const passengerCount = trip.passenger_count || 1;
  const vehicleType = determineVehicleType(vehicleInfo, driverNotes, passengerCount, trip.trip_destination);
  
  // If signature sedan, check if specific brand/model was mentioned
  if (vehicleType === 'signature-sedan') {
    const requestedVehicle = vehicleInfo || extractCarInfo(driverNotes) || '';
    const vehicleText = (vehicleInfo || driverNotes || '').toLowerCase();
    
    // Check if specific luxury models are mentioned
    const hasSpecificModel = 
      /(?:mercedes|merc)\s*maybach\s*s/i.test(vehicleText) ||
      /rolls\s*royce\s*ghost/i.test(vehicleText) ||
      /rolls\s*royce\s*phantom/i.test(vehicleText);
    
    // If specific model mentioned, show it; otherwise show "Signature Sedan"
    if (hasSpecificModel && requestedVehicle) {
      return getDisplayVehicle(requestedVehicle, passengerCount);
    } else {
      return 'Signature Sedan';
    }
  }
  
  // First, try to get vehicle from vehicleInfo field or driverNotes
  const requestedVehicle = vehicleInfo || extractCarInfo(driverNotes);

  // Use the helper to determine what to display:
  // - If vehicle is empty or not in whitelist, show auto-selected vehicle
  // - If vehicle is in whitelist, show that vehicle
  return getDisplayVehicle(requestedVehicle, passengerCount);
}


