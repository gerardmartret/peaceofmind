/**
 * Trip validation utilities
 * Validates trip data for completeness and correctness
 */

import { isNonSpecificLocation, type LocationForValidation } from './location-validation';

export interface ExtractedLocation {
  location: string;
  time: string;
  confidence?: string;
  purpose?: string;
  verified: boolean;
  formattedAddress: string;
  lat: number;
  lng: number;
  placeId?: string | null;
  [key: string]: any; // Allow additional properties
}

/**
 * Checks if the trip form has any unknown or missing values that prevent creating the brief
 * 
 * @param extractedDate - The trip date string (YYYY-MM-DD format) or null
 * @param extractedLocations - Array of extracted locations
 * @param tripDestination - The trip destination city name
 * @returns true if there are missing/unknown values, false if all required data is present
 */
export function hasUnknownOrMissingValues(
  extractedDate: string | null | undefined,
  extractedLocations: ExtractedLocation[] | null | undefined,
  tripDestination?: string | null | undefined
): boolean {
  // Check if date is missing
  if (!extractedDate) {
    return true;
  }

  // Check if there are any locations with unknown status or missing/invalid data
  if (!extractedLocations || extractedLocations.length === 0) {
    return true;
  }

  // Check each location for unknown status or missing/invalid time
  for (const location of extractedLocations) {
    // Check if location is unknown (non-specific)
    if (isNonSpecificLocation(location, tripDestination)) {
      return true;
    }

    // Check if time is missing or invalid
    if (!location.time || location.time === 'null' || location.time === 'undefined' || (typeof location.time === 'string' && location.time.trim() === '')) {
      return true;
    }
  }

  return false;
}

