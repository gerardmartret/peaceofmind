// City Detection and Configuration Helpers
// Provides consistent city detection and configuration across the application

export const LONDON_IDENTIFIER = 'London';

/**
 * Whitelist of allowed trip destinations
 * Only destinations in this list can be saved to the database
 */
export const ALLOWED_TRIP_DESTINATIONS = [
  'Amsterdam',
  'Athens',
  'Atlanta',
  'Austin',
  'Barcelona',
  'Boston',
  'Brussels',
  'Buenos Aires',
  'Cancun',
  'Chicago',
  'Copenhagen',
  'Dallas',
  'Denver',
  'Dublin',
  'Florence',
  'Frankfurt',
  'Geneva',
  'Glasgow',
  'Hamburg',
  'Houston',
  'Jacksonville',
  'Lisbon',
  'London',
  'Los Angeles',
  'Lyon',
  'Madrid',
  'Malaga',
  'Manchester',
  'Marseille',
  'Mexico City',
  'Miami',
  'Milan',
  'Montreal',
  'Munich',
  'New Haven',
  'New York',
  'Nice',
  'Orlando',
  'Palm Springs',
  'Paris',
  'Phoenix',
  'Rome',
  'San Diego',
  'San Francisco',
  'San Jose',
  'Santiago de Chile',
  'Sao Paulo',
  'Seattle',
  'Singapore',
  'Tampa',
  'Tokyo',
  'Toronto',
  'Vienna',
  'Washington',
  'West Palm Beach',
  'Zurich',
] as const;

export type AllowedDestination = typeof ALLOWED_TRIP_DESTINATIONS[number];

/**
 * Validates if a trip destination is in the allowed whitelist
 * @param destination - The trip destination to validate
 * @returns true if destination is allowed, false otherwise
 */
export function isValidTripDestination(destination: string | null | undefined): boolean {
  if (!destination) return true; // null/undefined is allowed (defaults to London)
  // Use explicit array check to avoid TypeScript readonly tuple issues
  return (ALLOWED_TRIP_DESTINATIONS as readonly string[]).includes(destination);
}

/**
 * Gets the normalized destination (validates and returns allowed value or null)
 * @param destination - The trip destination to normalize
 * @returns Valid destination or null if invalid
 */
export function normalizeTripDestination(destination: string | null | undefined): string | null {
  if (!destination) return null;
  return isValidTripDestination(destination) ? destination : null;
}

/**
 * Determines if the trip is for London
 * @param tripDestination - The trip destination city
 * @returns true if London or undefined/null (default to London for backward compatibility)
 */
export function isLondonTrip(tripDestination?: string | null): boolean {
  return tripDestination === LONDON_IDENTIFIER || !tripDestination;
}

/**
 * Gets the timezone for a trip destination
 * @param tripDestination - The trip destination city
 * @returns IANA timezone string (e.g., 'Europe/London', 'America/New_York')
 */
export function getDestinationTimezone(tripDestination?: string | null): string {
  if (!tripDestination) return 'Europe/London';
  
  // US cities (Eastern Time)
  if (['New York', 'Boston', 'Atlanta', 'Miami', 'Orlando', 'Tampa', 'Washington', 'Jacksonville', 'West Palm Beach'].includes(tripDestination)) {
    return 'America/New_York';
  }
  // US cities (Central Time)
  if (['Chicago', 'Dallas', 'Houston'].includes(tripDestination)) {
    return 'America/Chicago';
  }
  // US cities (Mountain Time)
  if (['Denver', 'Phoenix'].includes(tripDestination)) {
    return 'America/Denver';
  }
  // US cities (Pacific Time)
  if (['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Seattle', 'Palm Springs'].includes(tripDestination)) {
    return 'America/Los_Angeles';
  }
  // US cities (Eastern Time - Connecticut)
  if (tripDestination === 'New Haven') {
    return 'America/New_York';
  }
  // Canada
  if (['Montreal', 'Toronto'].includes(tripDestination)) {
    return 'America/Toronto';
  }
  // Europe - UK
  if (['London', 'Glasgow', 'Manchester'].includes(tripDestination)) {
    return 'Europe/London';
  }
  // Europe - Central European Time
  if (['Amsterdam', 'Brussels', 'Paris', 'Frankfurt', 'Hamburg', 'Munich', 'Vienna', 'Zurich', 'Geneva', 'Milan', 'Rome', 'Florence', 'Barcelona', 'Madrid', 'Malaga', 'Lyon', 'Marseille', 'Nice'].includes(tripDestination)) {
    return tripDestination === 'Amsterdam' ? 'Europe/Amsterdam' :
           tripDestination === 'Brussels' ? 'Europe/Brussels' :
           tripDestination === 'Paris' ? 'Europe/Paris' :
           tripDestination === 'Frankfurt' || tripDestination === 'Hamburg' || tripDestination === 'Munich' ? 'Europe/Berlin' :
           tripDestination === 'Vienna' ? 'Europe/Vienna' :
           tripDestination === 'Zurich' || tripDestination === 'Geneva' ? 'Europe/Zurich' :
           tripDestination === 'Milan' || tripDestination === 'Rome' || tripDestination === 'Florence' ? 'Europe/Rome' :
           tripDestination === 'Barcelona' || tripDestination === 'Madrid' || tripDestination === 'Malaga' ? 'Europe/Madrid' :
           tripDestination === 'Lyon' || tripDestination === 'Marseille' || tripDestination === 'Nice' ? 'Europe/Paris' :
           'Europe/Paris';
  }
  // Europe - Other
  if (tripDestination === 'Dublin') {
    return 'Europe/Dublin';
  }
  if (tripDestination === 'Lisbon') {
    return 'Europe/Lisbon';
  }
  if (tripDestination === 'Athens') {
    return 'Europe/Athens';
  }
  if (tripDestination === 'Copenhagen') {
    return 'Europe/Copenhagen';
  }
  // Asia
  if (tripDestination === 'Singapore') {
    return 'Asia/Singapore';
  }
  if (tripDestination === 'Tokyo') {
    return 'Asia/Tokyo';
  }
  // Latin America
  if (tripDestination === 'Mexico City') {
    return 'America/Mexico_City';
  }
  if (tripDestination === 'Cancun') {
    return 'America/Cancun';
  }
  if (tripDestination === 'Buenos Aires') {
    return 'America/Argentina/Buenos_Aires';
  }
  if (tripDestination === 'Santiago de Chile') {
    return 'America/Santiago';
  }
  if (tripDestination === 'Sao Paulo') {
    return 'America/Sao_Paulo';
  }
  // Default to London timezone (also handles null/undefined for backward compatibility)
  return 'Europe/London';
}

/**
 * Determines if a trip destination is in the US, Puerto Rico, or Canada
 * @param tripDestination - The trip destination city
 * @returns true if destination is in US, Puerto Rico, or Canada
 */
export function isUSCanadaPuertoRicoTrip(tripDestination?: string | null): boolean {
  if (!tripDestination) return false;
  
  // US cities
  const usCities = [
    'New York', 'Boston', 'Atlanta', 'Austin', 'Chicago', 'Dallas', 'Denver',
    'Houston', 'Jacksonville', 'Los Angeles', 'Miami', 'New Haven', 'Orlando',
    'Palm Springs', 'Phoenix', 'San Diego', 'San Francisco', 'San Jose',
    'Seattle', 'Tampa', 'Washington', 'West Palm Beach'
  ];
  // Canada cities
  const canadaCities = ['Montreal', 'Toronto'];
  // Puerto Rico cities (add as needed)
  const puertoRicoCities: string[] = [];
  
  const normalizedDestination = tripDestination.trim();
  return usCities.includes(normalizedDestination) || 
         canadaCities.includes(normalizedDestination) || 
         puertoRicoCities.includes(normalizedDestination);
}

/**
 * Determines if a trip destination is in the Middle East
 * @param tripDestination - The trip destination city
 * @returns true if destination is in Middle East
 */
export function isMiddleEastTrip(tripDestination?: string | null): boolean {
  if (!tripDestination) return false;
  
  // Middle East cities (add as needed - currently none in ALLOWED_TRIP_DESTINATIONS)
  // Examples: Dubai, Abu Dhabi, Riyadh, Doha, Kuwait City, Manama, Muscat, etc.
  const middleEastCities: string[] = [];
  
  const normalizedDestination = tripDestination.trim();
  return middleEastCities.includes(normalizedDestination);
}

/**
 * Determines if a trip destination is in Europe
 * @param tripDestination - The trip destination city
 * @returns true if destination is in Europe
 */
export function isEuropeTrip(tripDestination?: string | null): boolean {
  if (!tripDestination) return false;
  
  // European cities
  const europeanCities = [
    'Amsterdam', 'Athens', 'Barcelona', 'Brussels', 'Copenhagen', 'Dublin',
    'Florence', 'Frankfurt', 'Geneva', 'Glasgow', 'Hamburg', 'Lisbon',
    'London', 'Lyon', 'Madrid', 'Malaga', 'Manchester',
    'Marseille', 'Milan', 'Munich', 'Nice', 'Paris', 'Rome',
    'Vienna', 'Zurich'
  ];
  
  const normalizedDestination = tripDestination.trim();
  return europeanCities.includes(normalizedDestination);
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
  // For Singapore: includes Singapore island and surrounding areas
  // For other cities: includes city and surrounding areas for day trips
  let geocodingBias = 'London, UK';
  let geocodingRegion = 'uk';
  if (!isLondon) {
    // US cities
    if (['New York', 'Boston', 'Atlanta', 'Austin', 'Chicago', 'Dallas', 'Denver', 'Houston', 'Jacksonville', 'Los Angeles', 'Miami', 'New Haven', 'Orlando', 'Palm Springs', 'Phoenix', 'San Diego', 'San Francisco', 'San Jose', 'Seattle', 'Tampa', 'Washington', 'West Palm Beach'].includes(tripDestination || '')) {
      if (tripDestination === 'New York') {
        geocodingBias = 'New York, NY, USA';
      } else if (tripDestination === 'Boston') {
        geocodingBias = 'Boston, MA, USA';
      } else if (tripDestination === 'Atlanta') {
        geocodingBias = 'Atlanta, GA, USA';
      } else if (tripDestination === 'Austin') {
        geocodingBias = 'Austin, TX, USA';
      } else if (tripDestination === 'Chicago') {
        geocodingBias = 'Chicago, IL, USA';
      } else if (tripDestination === 'Dallas') {
        geocodingBias = 'Dallas, TX, USA';
      } else if (tripDestination === 'Denver') {
        geocodingBias = 'Denver, CO, USA';
      } else if (tripDestination === 'Houston') {
        geocodingBias = 'Houston, TX, USA';
      } else if (tripDestination === 'Jacksonville') {
        geocodingBias = 'Jacksonville, FL, USA';
      } else if (tripDestination === 'Los Angeles') {
        geocodingBias = 'Los Angeles, CA, USA';
      } else if (tripDestination === 'Miami') {
        geocodingBias = 'Miami, FL, USA';
      } else if (tripDestination === 'New Haven') {
        geocodingBias = 'New Haven, CT, USA';
      } else if (tripDestination === 'Orlando') {
        geocodingBias = 'Orlando, FL, USA';
      } else if (tripDestination === 'Palm Springs') {
        geocodingBias = 'Palm Springs, CA, USA';
      } else if (tripDestination === 'Phoenix') {
        geocodingBias = 'Phoenix, AZ, USA';
      } else if (tripDestination === 'San Diego') {
        geocodingBias = 'San Diego, CA, USA';
      } else if (tripDestination === 'San Francisco') {
        geocodingBias = 'San Francisco, CA, USA';
      } else if (tripDestination === 'San Jose') {
        geocodingBias = 'San Jose, CA, USA';
      } else if (tripDestination === 'Seattle') {
        geocodingBias = 'Seattle, WA, USA';
      } else if (tripDestination === 'Tampa') {
        geocodingBias = 'Tampa, FL, USA';
      } else if (tripDestination === 'Washington') {
        geocodingBias = 'Washington, DC, USA';
      } else if (tripDestination === 'West Palm Beach') {
        geocodingBias = 'West Palm Beach, FL, USA';
      } else {
        geocodingBias = `${tripDestination}, USA`;
      }
      geocodingRegion = 'us';
    }
    // Canada
    else if (tripDestination === 'Montreal') {
      geocodingBias = 'Montreal, QC, Canada';
      geocodingRegion = 'ca';
    } else if (tripDestination === 'Toronto') {
      geocodingBias = 'Toronto, ON, Canada';
      geocodingRegion = 'ca';
    }
    // Europe
    else if (tripDestination === 'Amsterdam') {
      geocodingBias = 'Amsterdam, Netherlands';
      geocodingRegion = 'nl';
    } else if (tripDestination === 'Athens') {
      geocodingBias = 'Athens, Greece';
      geocodingRegion = 'gr';
    } else if (tripDestination === 'Barcelona') {
      geocodingBias = 'Barcelona, Spain';
      geocodingRegion = 'es';
    } else if (tripDestination === 'Brussels') {
      geocodingBias = 'Brussels, Belgium';
      geocodingRegion = 'be';
    } else if (tripDestination === 'Copenhagen') {
      geocodingBias = 'Copenhagen, Denmark';
      geocodingRegion = 'dk';
    } else if (tripDestination === 'Dublin') {
      geocodingBias = 'Dublin, Ireland';
      geocodingRegion = 'ie';
    } else if (tripDestination === 'Florence') {
      geocodingBias = 'Florence, Italy';
      geocodingRegion = 'it';
    } else if (tripDestination === 'Frankfurt') {
      geocodingBias = 'Frankfurt, Germany';
      geocodingRegion = 'de';
    } else if (tripDestination === 'Geneva') {
      geocodingBias = 'Geneva, Switzerland';
      geocodingRegion = 'ch';
    } else if (tripDestination === 'Glasgow') {
      geocodingBias = 'Glasgow, UK';
      geocodingRegion = 'gb';
    } else if (tripDestination === 'Hamburg') {
      geocodingBias = 'Hamburg, Germany';
      geocodingRegion = 'de';
    } else if (tripDestination === 'Lisbon') {
      geocodingBias = 'Lisbon, Portugal';
      geocodingRegion = 'pt';
    } else if (tripDestination === 'Lyon') {
      geocodingBias = 'Lyon, France';
      geocodingRegion = 'fr';
    } else if (tripDestination === 'Madrid') {
      geocodingBias = 'Madrid, Spain';
      geocodingRegion = 'es';
    } else if (tripDestination === 'Malaga') {
      geocodingBias = 'Malaga, Spain';
      geocodingRegion = 'es';
    } else if (tripDestination === 'Manchester') {
      geocodingBias = 'Manchester, UK';
      geocodingRegion = 'gb';
    } else if (tripDestination === 'Marseille') {
      geocodingBias = 'Marseille, France';
      geocodingRegion = 'fr';
    } else if (tripDestination === 'Milan') {
      geocodingBias = 'Milan, Italy';
      geocodingRegion = 'it';
    } else if (tripDestination === 'Munich') {
      geocodingBias = 'Munich, Germany';
      geocodingRegion = 'de';
    } else if (tripDestination === 'Nice') {
      geocodingBias = 'Nice, France';
      geocodingRegion = 'fr';
    } else if (tripDestination === 'Paris') {
      geocodingBias = 'Paris, France';
      geocodingRegion = 'fr';
    } else if (tripDestination === 'Rome') {
      geocodingBias = 'Rome, Italy';
      geocodingRegion = 'it';
    } else if (tripDestination === 'Vienna') {
      geocodingBias = 'Vienna, Austria';
      geocodingRegion = 'at';
    } else if (tripDestination === 'Zurich') {
      geocodingBias = 'Zurich, Switzerland';
      geocodingRegion = 'ch';
    }
    // Asia
    else if (tripDestination === 'Singapore') {
      geocodingBias = 'Singapore, Singapore';
      geocodingRegion = 'sg';
    } else if (tripDestination === 'Tokyo') {
      geocodingBias = 'Tokyo, Japan';
      geocodingRegion = 'jp';
    }
    // Latin America
    else if (tripDestination === 'Buenos Aires') {
      geocodingBias = 'Buenos Aires, Argentina';
      geocodingRegion = 'ar';
    } else if (tripDestination === 'Cancun') {
      geocodingBias = 'Cancun, Mexico';
      geocodingRegion = 'mx';
    } else if (tripDestination === 'Mexico City') {
      geocodingBias = 'Mexico City, Mexico';
      geocodingRegion = 'mx';
    } else if (tripDestination === 'Santiago de Chile') {
      geocodingBias = 'Santiago, Chile';
      geocodingRegion = 'cl';
    } else if (tripDestination === 'Sao Paulo') {
      geocodingBias = 'Sao Paulo, Brazil';
      geocodingRegion = 'br';
    } else {
      // Default fallback
      geocodingBias = `${tripDestination}, USA`;
      geocodingRegion = 'us';
    }
  }
  
  return {
    isLondon,
    geocodingBias,
    geocodingRegion,
    cityName: tripDestination || 'London',
    enableCrimeAPI: isLondon,
    enableTflAPI: isLondon,
    enableParkingAPI: isLondon,
    timezone: getDestinationTimezone(tripDestination),
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

