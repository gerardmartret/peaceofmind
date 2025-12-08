// State transition validation
export const isValidTransition = (from: string, to: string): boolean => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    'not confirmed': ['pending', 'confirmed'],
    'pending': ['confirmed', 'rejected', 'cancelled'], // Can cancel to cancelled
    'confirmed': ['cancelled'], // Can cancel to cancelled
    'rejected': ['pending', 'not confirmed'], // Can retry after rejection
    'cancelled': [], // TERMINAL STATUS - no transitions allowed, must create new trip
  };

  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
};

/**
 * Location Coordinate Validation Helpers
 * 
 * Utilities for validating location coordinates and detecting mismatches.
 */

import { getCityConfig } from '@/lib/city-helpers';

/**
 * Validates if a location has valid coordinates
 */
export const validateLocationCoordinates = (loc: any): boolean => {
  return loc.lat !== 0 || loc.lng !== 0;
};

/**
 * Detects coordinate/address mismatches in locations
 * Returns array of inconsistent locations with their index and reason
 */
export const detectCoordinateMismatches = (
  locations: any[],
  tripDestination: string
): Array<{ loc: any; index: number; reason: string }> => {
  const inconsistentLocations: Array<{ loc: any; index: number; reason: string }> = [];

  locations.forEach((loc: any, i: number) => {
    if (loc.lat && loc.lng && loc.lat !== 0 && loc.lng !== 0 && loc.fullAddress) {
      const addressLower = loc.fullAddress.toLowerCase();

      // Check 1: Airport address but central London coordinates
      const isAirportAddress = addressLower.includes('airport') ||
        addressLower.includes('gatwick') ||
        addressLower.includes('heathrow') ||
        addressLower.includes('stansted') ||
        addressLower.includes('luton');

      // Central London bounds: ~51.49-51.53 lat, -0.14 to -0.07 lng
      const inCentralLondon = (loc.lat > 51.49 && loc.lat < 51.53) &&
        (loc.lng > -0.14 && loc.lng < -0.07);

      if (isAirportAddress && inCentralLondon) {
        inconsistentLocations.push({ loc, index: i, reason: 'airport-central-mismatch' });
      }

      // Check 2: Gatwick address but coords far from Gatwick
      if (addressLower.includes('gatwick')) {
        // Gatwick coords: ~51.1537, -0.1821
        const distanceFromGatwick = Math.sqrt(
          Math.pow((loc.lat - 51.1537) * 111, 2) + // rough km conversion
          Math.pow((loc.lng - (-0.1821)) * 111 * Math.cos(loc.lat * Math.PI / 180), 2)
        );

        if (distanceFromGatwick > 5) {
          inconsistentLocations.push({ loc, index: i, reason: 'gatwick-distance-mismatch' });
        }
      }

      // Check 3: Generic "London, UK" address (likely geocoding fallback)
      if (loc.fullAddress === 'London, UK' || loc.fullAddress.length < 15) {
        inconsistentLocations.push({ loc, index: i, reason: 'generic-address' });
      }
    }
  });

  return inconsistentLocations;
};

/**
 * Re-geocodes inconsistent locations to fix coordinate/address mismatches
 */
export const regeocodeInconsistentLocations = async (
  inconsistentLocations: Array<{ loc: any; index: number; reason: string }>,
  validLocations: any[],
  tripDestination: string
): Promise<void> => {
  if (inconsistentLocations.length === 0) {
    return;
  }

  const cityConfig = getCityConfig(tripDestination);

  for (const inconsistent of inconsistentLocations) {
    try {
      const geocoder = new google.maps.Geocoder();
      const query = inconsistent.loc.fullAddress;

      const result = await new Promise<any>((resolve) => {
        geocoder.geocode(
          { address: query, region: cityConfig.geocodingRegion },
          (results, status) => {
            if (status === google.maps.GeocoderStatus.OK && results?.[0]) {
              resolve(results[0]);
            } else {
              resolve(null);
            }
          }
        );
      });

      if (result) {
        validLocations[inconsistent.index].lat = result.geometry.location.lat();
        validLocations[inconsistent.index].lng = result.geometry.location.lng();
        validLocations[inconsistent.index].fullAddress = result.formatted_address;
      }
    } catch (err) {
    }
  }
};

