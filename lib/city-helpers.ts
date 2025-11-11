// City Detection and Configuration Helpers
// Provides consistent city detection and configuration across the application

export const LONDON_IDENTIFIER = 'London';

/**
 * Determines if the trip is for London
 * @param tripDestination - The trip destination city
 * @returns true if London or undefined/null (default to London for backward compatibility)
 */
export function isLondonTrip(tripDestination?: string | null): boolean {
  return tripDestination === LONDON_IDENTIFIER || !tripDestination;
}

/**
 * Gets city-specific configuration for API calls, geocoding, and analysis
 * @param tripDestination - The trip destination city
 * @returns Configuration object with city-specific settings
 */
export function getCityConfig(tripDestination?: string | null) {
  const isLondon = isLondonTrip(tripDestination);
  
  // Geocoding bias includes metro area for better coverage
  // For NYC: includes Yonkers, Jersey City, Newark, Long Island, etc.
  // For London: includes Greater London area
  let geocodingBias = 'London, UK';
  if (!isLondon) {
    if (tripDestination === 'New York') {
      geocodingBias = 'New York, NY, USA'; // Will match NYC metro area broadly
    } else {
      geocodingBias = `${tripDestination}, USA`;
    }
  }
  
  return {
    isLondon,
    geocodingBias,
    geocodingRegion: isLondon ? 'uk' : 'us',
    cityName: tripDestination || 'London',
    enableCrimeAPI: isLondon,
    enableTflAPI: isLondon,
    enableParkingAPI: isLondon,
  };
}

/**
 * Creates a mock Response object for non-London cities
 * Used to maintain consistent data structure when London-specific APIs are not available
 */
export function createMockResponse(type: string, data: any): Promise<Response> {
  return Promise.resolve({
    json: async () => ({ success: true, data }),
    ok: true,
    status: 200,
  } as Response);
}

/**
 * Default mock data structures for non-London cities
 * Note: Coordinates are set to (0, 0) to indicate no data - weather API provides actual coordinates
 */
export const MOCK_DATA = {
  crime: {
    district: 'N/A',
    coordinates: { lat: 0, lng: 0 }, // Set to 0,0 to indicate unavailable - use weather.coordinates instead
    crimes: [],
    summary: {
      totalCrimes: 0,
      topCategories: [],
      byOutcome: {},
      month: 'N/A',
    },
    safetyScore: 0,
  },
  disruptions: {
    district: 'N/A',
    timeframe: 'N/A',
    isAreaFiltered: false,
    disruptions: [],
    analysis: {
      total: 0,
      bySeverity: {},
      byCategory: {},
      active: 0,
      upcoming: 0,
    },
  },
  parking: {
    location: 'N/A',
    coordinates: { lat: 0, lng: 0 }, // Set to 0,0 to indicate unavailable - use weather.coordinates instead
    carParks: [],
    cpzInfo: {
      inCPZ: false,
    },
    parkingRiskScore: 0,
    summary: {
      totalNearby: 0,
      averageDistance: 0,
      hasStationParking: false,
      cpzWarning: false,
    },
  },
};

