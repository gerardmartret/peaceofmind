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
        console.error(`❌ [VALIDATION] Location ${i} has AIRPORT address but CENTRAL LONDON coords!`);
        console.error(`   Address: ${loc.fullAddress}`);
        console.error(`   Coords: ${loc.lat}, ${loc.lng}`);
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
          console.error(`❌ [VALIDATION] Gatwick address but coords are ${distanceFromGatwick.toFixed(1)}km away!`);
          console.error(`   Address: ${loc.fullAddress}`);
          console.error(`   Coords: ${loc.lat}, ${loc.lng}`);
          inconsistentLocations.push({ loc, index: i, reason: 'gatwick-distance-mismatch' });
        }
      }

      // Check 3: Generic "London, UK" address (likely geocoding fallback)
      if (loc.fullAddress === 'London, UK' || loc.fullAddress.length < 15) {
        console.warn(`⚠️ [VALIDATION] Location ${i} has generic address: "${loc.fullAddress}"`);
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
    console.log('✅ [VALIDATION] All locations passed consistency checks');
    return;
  }

  console.log(`🔧 [FIX] Re-geocoding ${inconsistentLocations.length} inconsistent locations...`);
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
        console.log(`✅ [FIX] Corrected location ${inconsistent.index}: ${result.formatted_address} (${result.geometry.location.lat()}, ${result.geometry.location.lng()})`);
      }
    } catch (err) {
      console.error(`❌ Failed to re-geocode location ${inconsistent.index}:`, err);
    }
  }
};

