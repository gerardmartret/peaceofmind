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
    console.log(`   ⚠️ Location "${loc.name}" has incomplete address: "${fullAddr}" (needs geocoding)`);
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
    console.log(`   Geocoding: ${loc.name || loc.fullAddress || loc.address || 'Unknown location'}`);

    // Use Google Maps Geocoding API
    const geocoder = new google.maps.Geocoder();
    const query = loc.fullAddress || loc.address || loc.name || '';

    // Diagnostic: Check if query is just city name
    if (query && query.toLowerCase() === (tripDestination || '').toLowerCase()) {
      console.warn(`⚠️ [GEOCODE-DIAG] WARNING: Geocoding query is just city name "${query}" - this might cause address replacement!`);
      console.warn(`   - loc.fullAddress: "${loc.fullAddress}"`);
      console.warn(`   - loc.address: "${loc.address}"`);
      console.warn(`   - loc.name: "${loc.name}"`);
    }

    // Get city configuration for geocoding
    const cityConfig = getCityConfig(tripDestination);
    console.log(`🌍 [GEOCODING] Using city context: ${cityConfig.cityName} (bias: ${cityConfig.geocodingBias})`);

    return new Promise<typeof loc>((resolve) => {
      const geocodeQuery = `${query}, ${cityConfig.geocodingBias}`;
      console.log(`🔍 [GEOCODE-DIAG] Geocoding query: "${geocodeQuery}"`);
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
            console.log(`   ✅ [GEOCODE-DIAG] Geocoded: ${geocodedLoc.name} → (${geocodedLoc.lat}, ${geocodedLoc.lng})`);
            if (geocodedLoc.fullAddress !== beforeFullAddress) {
              console.log(`   - fullAddress changed: "${beforeFullAddress}" → "${geocodedLoc.fullAddress}"`);
              // Check if result is just city center
              if (geocodedLoc.fullAddress && geocodedLoc.fullAddress.toLowerCase().includes((tripDestination || '').toLowerCase()) && !geocodedLoc.fullAddress.includes(',')) {
                console.warn(`   ⚠️ [GEOCODE-DIAG] WARNING: Geocoded address appears to be just city name: "${geocodedLoc.fullAddress}"`);
              }
            }
            resolve(geocodedLoc);
          } else {
            console.warn(`   ⚠️ [GEOCODE-DIAG] Geocoding failed for: ${query} (status: ${status})`);
            console.warn(`   - Keeping original location data`);
            // Keep original location even if geocoding fails
            resolve(loc);
          }
        }
      );
    });
  } catch (geocodeError) {
    console.error(`   ❌ Error geocoding ${loc.name}:`, geocodeError);
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
    console.log('⚡️ [OPTIMIZATION] No geocoding needed - all locations have valid coordinates!');
    return [];
  }

  console.log('🗺️ [DEBUG] Geocoding locations without valid coordinates...');
  const cityConfig = getCityConfig(tripDestination);
  console.log(`🌍 [GEOCODING] Using city context: ${cityConfig.cityName} (bias: ${cityConfig.geocodingBias})`);

  const geocodedLocations = await Promise.all(
    locations.map(loc => geocodeLocation(loc, tripDestination))
  );

  console.log(`✅ [DEBUG] Geocoding complete for ${geocodedLocations.length} locations`);
  return geocodedLocations;
};

