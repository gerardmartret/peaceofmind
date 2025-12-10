/**
 * Report Data Transformers
 * 
 * Utilities to transform trip results into the format expected by the executive report API.
 * This ensures consistent data transformation across all report generation points.
 */

export interface TripResultForReport {
  locationName: string;
  time: string;
  crime: any;
  disruptions: any;
  weather: any;
  events: any;
  parking: any;
  cafes: any;
}

export interface TripResult {
  locationName?: string;
  locationId?: string;
  time: string;
  data?: {
    crime?: any;
    disruptions?: any;
    weather?: any;
    events?: any;
    parking?: any;
    cafes?: any;
  };
  crime?: any;
  disruptions?: any;
  weather?: any;
  events?: any;
  parking?: any;
  cafes?: any;
}

/**
 * Transforms trip results into the format expected by the executive report API.
 * Handles both formats: results with nested `data` property and flat results.
 */
export function transformResultsForReport(
  results: TripResult[]
): TripResultForReport[] {
  return results.map((r) => {
    // Handle nested data structure (from API calls)
    if (r.data) {
      return {
        locationName: r.locationName || r.locationId || '',
        time: r.time,
        crime: r.data.crime,
        disruptions: r.data.disruptions,
        weather: r.data.weather,
        events: r.data.events,
        parking: r.data.parking,
        cafes: r.data.cafes,
      };
    }
    
    // Handle flat structure (already transformed)
    return {
      locationName: r.locationName || r.locationId || '',
      time: r.time,
      crime: r.crime,
      disruptions: r.disruptions,
      weather: r.weather,
      events: r.events,
      parking: r.parking,
      cafes: r.cafes,
    };
  });
}

/**
 * Calculates route distance from traffic predictions data.
 * Handles different traffic data formats.
 */
export function calculateRouteDistance(
  trafficData: any
): string {
  if (!trafficData) {
    return '0 km';
  }

  // Handle format with totalDistance string
  if (trafficData.totalDistance) {
    return trafficData.totalDistance;
  }

  // Handle format with data array
  if (trafficData.data && Array.isArray(trafficData.data)) {
    const totalMeters = trafficData.data.reduce(
      (sum: number, leg: any) => sum + (leg.distanceMeters || 0),
      0
    );
    if (totalMeters > 0) {
      return `${(totalMeters / 1000).toFixed(2)} km`;
    }
  }

  return '0 km';
}

/**
 * Calculates route duration from traffic predictions data.
 * Handles different traffic data formats.
 */
export function calculateRouteDuration(
  trafficData: any
): number {
  if (!trafficData) {
    return 0;
  }

  // Handle format with totalMinutes
  if (typeof trafficData.totalMinutes === 'number') {
    return trafficData.totalMinutes;
  }

  // Handle format with data array
  if (trafficData.data && Array.isArray(trafficData.data)) {
    return trafficData.data.reduce(
      (sum: number, leg: any) => sum + (leg.minutes || 0),
      0
    );
  }

  return 0;
}

