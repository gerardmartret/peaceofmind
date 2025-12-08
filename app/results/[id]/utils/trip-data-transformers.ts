/**
 * Trip Data Transformers
 * 
 * Pure utility functions for transforming database trip data into the format
 * expected by the application. These functions have no side effects.
 */

import { normalizeTripLocations } from './location-helpers';
import type { TripData } from '../types';

export interface DatabaseTrip {
  trip_date: string;
  user_email: string;
  locations: any;
  trip_results: any;
  traffic_predictions: any;
  executive_report: any;
  passenger_count?: number | null;
  trip_destination?: string | null;
  password?: string | null;
  status?: string | null;
  version?: number | null;
  trip_notes?: string | null;
  lead_passenger_name?: string | null;
  vehicle?: string | null;
  driver?: string | null;
  user_id?: string | null;
  [key: string]: any; // Allow additional properties from database
}

export interface TransformedTripData {
  tripData: TripData;
  locationDisplayNames: Record<string, string>;
}

/**
 * Transform traffic predictions from various formats to standardized format
 */
export function transformTrafficPredictions(raw: any): any | null {
  if (!raw) return null;

  let rawTrafficPredictions = raw;

  // Parse if stored as JSON string
  if (typeof rawTrafficPredictions === 'string') {
    try {
      rawTrafficPredictions = JSON.parse(rawTrafficPredictions);
    } catch (e) {
      return null;
    }
  }

  if (rawTrafficPredictions) {
    // Check if it already has the correct structure
    if (rawTrafficPredictions.success !== undefined && Array.isArray(rawTrafficPredictions.data)) {
      // Already in correct format
      return rawTrafficPredictions;
    } else if (Array.isArray(rawTrafficPredictions)) {
      // Legacy format - array of route data
      return {
        success: true,
        data: rawTrafficPredictions,
      };
    } else if (rawTrafficPredictions.data && Array.isArray(rawTrafficPredictions.data)) {
      // Has data array but missing success flag or other fields
      return {
        success: rawTrafficPredictions.success !== false, // Default to true if not explicitly false
        data: rawTrafficPredictions.data,
        totalDistance: rawTrafficPredictions.totalDistance || '0 km',
        totalMinutes: rawTrafficPredictions.totalMinutes || 0,
        totalMinutesNoTraffic: rawTrafficPredictions.totalMinutesNoTraffic || 0,
      };
    } else {
      // Invalid format - set to null to show "Calculating..."
      return null;
    }
  }

  return null;
}

/**
 * Fix invalid location IDs and ensure uniqueness
 */
export function fixLocationIds(locations: any[]): Array<any & { id: string }> {
  const usedIds = new Set<string>();

  return locations.map((loc: any, idx: number) => {
    // Check if ID is invalid (literal string from AI bug)
    if (!loc.id || loc.id === 'currentLocation.id' || loc.id === 'extractedLocation.id' || loc.id.includes('Location.id')) {
      const newId = `location-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      usedIds.add(newId);
      return {
        ...loc,
        id: newId
      };
    }

    // Check for duplicate IDs
    if (usedIds.has(loc.id)) {
      const newId = `location-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      usedIds.add(newId);
      return {
        ...loc,
        id: newId
      };
    }

    usedIds.add(loc.id);
    return loc;
  });
}

/**
 * Parse JSON fields if they're stored as strings
 */
export function parseJsonFields(
  tripResults: any,
  executiveReport: any
): {
  tripResults: any[];
  executiveReport: any;
} {
  // Parse trip_results
  let tripResultsParsed = tripResults;
  if (typeof tripResultsParsed === 'string') {
    try {
      tripResultsParsed = JSON.parse(tripResultsParsed);
    } catch (e) {
      tripResultsParsed = [];
    }
  }

  // Parse executive_report
  let executiveReportParsed = executiveReport;
  if (typeof executiveReportParsed === 'string') {
    try {
      executiveReportParsed = JSON.parse(executiveReportParsed);
    } catch (e) {
      executiveReportParsed = null;
    }
  }

  return {
    tripResults: tripResultsParsed || [],
    executiveReport: executiveReportParsed,
  };
}

/**
 * Extract location display names from trip data
 */
export function extractLocationDisplayNames(locations: any[]): Record<string, string> {
  const displayNames: Record<string, string> = {};
  locations.forEach((loc: any) => {
    // Use the location name (which is now the purpose) as the display name
    if (loc.name && loc.id) {
      displayNames[loc.id] = loc.name;
    }
  });
  return displayNames;
}

/**
 * Transform database trip data to application format
 */
export function transformDatabaseTripToTripData(data: DatabaseTrip): TransformedTripData {
  // Transform traffic predictions
  const trafficPredictionsFormatted = transformTrafficPredictions(data.traffic_predictions);

  // Normalize and fix location IDs
  const normalizedLocations = normalizeTripLocations(data.locations);
  
  if (normalizedLocations.length === 0 && data.locations) {
  }

  const locationsWithValidIds = fixLocationIds(normalizedLocations);

  // Parse JSON fields
  const { tripResults, executiveReport } = parseJsonFields(
    data.trip_results,
    data.executive_report
  );

  // Build trip data object
  const tripData: TripData = {
    tripDate: data.trip_date,
    userEmail: data.user_email,
    locations: locationsWithValidIds,
    tripResults: tripResults as any,
    trafficPredictions: trafficPredictionsFormatted,
    executiveReport: executiveReport as any,
    passengerCount: data.passenger_count || 1,
    tripDestination: data.trip_destination || '',
    passengerNames: [], // passenger_names column doesn't exist in DB
    password: data.password || null,
    status: data.status || 'not confirmed',
  };

  // Extract location display names
  const locationDisplayNames = extractLocationDisplayNames(locationsWithValidIds);

  return {
    tripData,
    locationDisplayNames,
  };
}

