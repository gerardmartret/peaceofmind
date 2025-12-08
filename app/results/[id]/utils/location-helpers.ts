import type { TripData } from '../types';

export const normalizeTripLocations = (
  rawLocations?: TripData['locations'] | string | null | unknown,
): TripData['locations'] => {
  if (!rawLocations) return [];

  if (Array.isArray(rawLocations)) return rawLocations;

  if (typeof rawLocations === 'string') {
    const tryParse = (value: string) => {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (error) {
        // swallow
      }
      return null;
    };

    const direct = tryParse(rawLocations);
    if (direct) return direct;

    const relaxed = rawLocations
      .replace(/'/g, '"')
      .replace(/,\s*}/g, '}')
      .replace(/,\s*\]/g, ']');

    const parsedRelaxed = tryParse(relaxed);
    if (parsedRelaxed) return parsedRelaxed;

    const jsonLike = `[${rawLocations
      .replace(/[\[\]]/g, '')
      .split(/[,;]+/)
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        try {
          const one = JSON.parse(part);
          return one;
        } catch {
          return part;
        }
      })
      .map(part => (typeof part === 'string' ? part : JSON.stringify(part)))
      .join(',')}]`;

    const fallback = tryParse(jsonLike);
    if (fallback) return fallback;

  }

  return [];
};

// Check if a location is an airport (pattern: "airport, country" or "city airport, country")
// Accepts locations that only contain airport name and country, without full street address
export const isAirportLocation = (locationText: string | null | undefined): boolean => {
  if (!locationText) return false;
  const text = locationText.trim().toLowerCase();
  // Pattern: contains "airport" followed by a comma and country name
  // Examples: "zurich airport, switzerland", "airport, france", "london airport, uk"
  // Should NOT match if it contains street addresses (numbers, street names like "street", "avenue", etc.)
  const hasStreetAddress = /\d+\s+(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|circle|ct)/i.test(text);
  if (hasStreetAddress) return false;
  
  // Check if it matches airport pattern: word(s) + "airport" + comma + country
  const airportPattern = /^[a-z\s]*airport\s*,?\s*[a-z\s]+$/i;
  return airportPattern.test(text) && text.includes('airport');
};

