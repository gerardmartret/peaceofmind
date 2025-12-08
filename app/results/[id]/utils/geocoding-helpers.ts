/**
 * Geocoding Helpers
 * 
 * Utilities for geocoding locations using Google Maps API.
 */

import { getCityConfig } from '@/lib/city-helpers';

/**
 * Checks if a location needs geocoding
 * A location needs geocoding if:
 * 1. It has no coordinates (lat === 0 && lng === 0), OR
 * 2. It has coordinates but missing/incomplete address
 */
export const needsGeocoding = (loc: any): boolean => {
  // No coordinates = definitely needs geocoding
  if (loc.lat === 0 && loc.lng === 0) return true;

  // Has coordinates but missing/incomplete address = needs geocoding
  const fullAddr = loc.fullAddress || '';
  const hasIncompleteAddress = fullAddr.length < 20 || !fullAddr.includes(',');

  if (hasIncompleteAddress) {
  }

  return hasIncompleteAddress;
};

/**
 * Geocodes a single location using Google Maps API
 */
export const geocodeLocation = async (
  loc: any,
  tripDestination: string
): Promise<any> => {
  try {

    // Use Google Maps Geocoding API
    const geocoder = new google.maps.Geocoder();
    const query = loc.fullAddress || loc.address || loc.name || '';

    // Diagnostic: Check if query is just city name
    if (query && query.toLowerCase() === (tripDestination || '').toLowerCase()) {
    }

    // Get city configuration for geocoding
    const cityConfig = getCityConfig(tripDestination);

    return new Promise<typeof loc>((resolve) => {
      const geocodeQuery = `${query}, ${cityConfig.geocodingBias}`;
      geocoder.geocode(
        { address: geocodeQuery, region: cityConfig.geocodingRegion },
        (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
            const result = results[0];
            const beforeFullAddress = loc.fullAddress;
            const geocodedLoc = {
              ...loc,
              lat: result.geometry.location.lat(),
              lng: result.geometry.location.lng(),
              fullAddress: result.formatted_address || loc.fullAddress || loc.address || loc.name,
            };
            if (geocodedLoc.fullAddress !== beforeFullAddress) {
              // Check if result is just city center
              if (geocodedLoc.fullAddress && geocodedLoc.fullAddress.toLowerCase().includes((tripDestination || '').toLowerCase()) && !geocodedLoc.fullAddress.includes(',')) {
              }
            }
            resolve(geocodedLoc);
          } else {
            // Keep original location even if geocoding fails
            resolve(loc);
          }
        }
      );
    });
  } catch (geocodeError) {
    // Keep original location if geocoding fails
    return loc;
  }
};

/**
 * Geocodes multiple locations in parallel
 */
export const geocodeLocations = async (
  locations: any[],
  tripDestination: string
): Promise<any[]> => {
  if (locations.length === 0) {
    return [];
  }

  const cityConfig = getCityConfig(tripDestination);

  const geocodedLocations = await Promise.all(
    locations.map(loc => geocodeLocation(loc, tripDestination))
  );

  return geocodedLocations;
};

