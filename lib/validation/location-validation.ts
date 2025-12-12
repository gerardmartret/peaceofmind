/**
 * Location validation utilities
 * Checks if a location is non-specific (e.g., just a city name without detailed address)
 */

export interface LocationForValidation {
  location?: string;
  formattedAddress?: string;
  [key: string]: any; // Allow additional properties
}

/**
 * Checks if a location is non-specific (just city name or matches tripDestination)
 * Google Maps always provides coordinates, even for vague locations (returns city center coordinates)
 * So we check if the location text matches only the city name pattern
 * 
 * @param location - The location object with location/formattedAddress properties
 * @param tripDestination - The trip destination city name
 * @returns true if location is non-specific (vague), false if it's a specific address
 */
export function isNonSpecificLocation(
  location: LocationForValidation,
  tripDestination?: string | null
): boolean {
  if (!tripDestination) return false;

  // If location is verified and has coordinates, it's specific (not non-specific)
  // This handles cases where Google Maps has verified the location
  if ((location as any).verified && (location as any).lat && (location as any).lng && 
      (location as any).lat !== 0 && (location as any).lng !== 0) {
    // Double-check: if it has a formattedAddress with street detail or postcode, it's definitely specific
    const locationText = (location.formattedAddress || location.location || '').toLowerCase().trim();
    const hasStreetDetail = /\b(\d+\s*(rue|avenue|boulevard|bd|street|st|avenue|ave|road|rd|lane|ln|drive|dr|way|path|close|plaza|place|pl|square|sq|row|court|ct|terrace|ter|gardens|gdn|park|crescent|cr|circle|cir|view|rise|heights|hill|manor|villas|walk|villa|mews|gate|quay|wharf|dock|bridge|passage|alley|mews|yards|grove|wood|green|mount|maunt|rise|down|dene|vale|end|side|corner|cross|crossing|intersection|pg\.|passatge|carrer|calle|avenida|plaza|pl\.|passeig))\b/i.test(locationText);
    const hasPostcode = /\b\d{4,5}\b/.test(locationText); // Generic postcode pattern (4-5 digits)
    if (hasStreetDetail || hasPostcode) {
      return false; // It's specific
    }
  }

  const locationText = (location.formattedAddress || location.location || '').toLowerCase().trim();
  const destinationText = tripDestination.toLowerCase().trim();

  // Check if location matches trip destination exactly (city name only)
  if (locationText === destinationText) return true;

  // Check if location is just the city name with optional country suffix
  // Handles formats like: "London UK", "London, UK", "london uk", "London, United Kingdom", etc.
  // Pattern: city name + optional space/comma + optional country code/name
  // When location is vague, Google Maps returns city center coordinates, so we detect by text pattern
  const cityOnlyPattern = new RegExp(`^${destinationText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s*,\\s*|\\s+)?(uk|usa|us|united\\s+kingdom|united\\s+states|france|deutschland|germany|singapore|japan|switzerland)?$`, 'i');

  if (cityOnlyPattern.test(locationText)) {
    return true;
  }

  // Check for non-specific addresses: place name + city + country WITHOUT postcode or detailed street address
  // This handles cases like "Some Place, Paris, France" where there's no postcode or street address

  // Define postcode patterns for different cities
  const postcodePatterns: { [key: string]: RegExp } = {
    'paris': /\b\d{5}\b/, // French postcodes: 5 digits (e.g., 75001, 75002)
    'lyon': /\b\d{5}\b/, // French postcodes: 5 digits
    'marseille': /\b\d{5}\b/, // French postcodes: 5 digits
    'nice': /\b\d{5}\b/, // French postcodes: 5 digits
    'london': /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}|\b(?:EC|WC|SW|SE|NW|N|E|W|W1|SW1|EC1|WC1)[0-9]{1,2}[A-Z]{0,2}\b)/i, // UK postcodes
    'glasgow': /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}|\b(?:EC|WC|SW|SE|NW|N|E|W|W1|SW1|EC1|WC1)[0-9]{1,2}[A-Z]{0,2}\b)/i, // UK postcodes
    'liverpool': /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}|\b(?:EC|WC|SW|SE|NW|N|E|W|W1|SW1|EC1|WC1)[0-9]{1,2}[A-Z]{0,2}\b)/i, // UK postcodes
    'manchester': /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}|\b(?:EC|WC|SW|SE|NW|N|E|W|W1|SW1|EC1|WC1)[0-9]{1,2}[A-Z]{0,2}\b)/i, // UK postcodes
    'new york': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes: 5 or 9 digits
    'boston': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'atlanta': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'austin': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'chicago': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'dallas': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'denver': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'houston': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'jacksonville': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'los angeles': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'miami': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'new haven': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'orlando': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'palm springs': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'phoenix': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'san diego': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'san francisco': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'san jose': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'seattle': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'tampa': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'washington': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'west palm beach': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
    'singapore': /\b\d{6}\b/, // Singapore postcodes: 6 digits
    'frankfurt': /\b\d{5}\b/, // German postcodes: 5 digits
    'hamburg': /\b\d{5}\b/, // German postcodes: 5 digits
    'munich': /\b\d{5}\b/, // German postcodes: 5 digits
    'tokyo': /\b\d{3}-?\d{4}\b/, // Japanese postcodes: 3-4 digits with optional hyphen
    'zurich': /\b\d{4}\b/, // Swiss postcodes: 4 digits
    'geneva': /\b\d{4}\b/, // Swiss postcodes: 4 digits
    'barcelona': /\b\d{5}\b/, // Spanish postcodes: 5 digits (e.g., 08007)
    'madrid': /\b\d{5}\b/, // Spanish postcodes: 5 digits
    'malaga': /\b\d{5}\b/, // Spanish postcodes: 5 digits
    'milan': /\b\d{5}\b/, // Italian postcodes: 5 digits
    'rome': /\b\d{5}\b/, // Italian postcodes: 5 digits
    'florence': /\b\d{5}\b/, // Italian postcodes: 5 digits
    'palermo': /\b\d{5}\b/, // Italian postcodes: 5 digits
    'amsterdam': /\b\d{4}\s?[A-Z]{2}\b/i, // Dutch postcodes: 4 digits + 2 letters
    'brussels': /\b\d{4}\b/, // Belgian postcodes: 4 digits
    'copenhagen': /\b\d{4}\b/, // Danish postcodes: 4 digits
    'dublin': /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}|\b(?:Dublin|D)[0-9]{1,2}\b)/i, // Irish postcodes
    'lisbon': /\b\d{4}-?\d{3}\b/, // Portuguese postcodes: 4 digits + 3 digits
    'athens': /\b\d{3}\s?\d{2}\b/, // Greek postcodes: 3 digits + 2 digits
    'vienna': /\b\d{4}\b/, // Austrian postcodes: 4 digits
    'montreal': /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i, // Canadian postcodes: A1A 1A1 format
    'toronto': /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i, // Canadian postcodes: A1A 1A1 format
    'mexico city': /\b\d{5}\b/, // Mexican postcodes: 5 digits
    'cancun': /\b\d{5}\b/, // Mexican postcodes: 5 digits
    'buenos aires': /\b[A-Z]?\d{4}[A-Z]{0,3}\b/i, // Argentine postcodes: 4 digits with optional letters
    'santiago de chile': /\b\d{7}\b/, // Chilean postcodes: 7 digits
    'sao paulo': /\b\d{5}-?\d{3}\b/, // Brazilian postcodes: 5 digits + 3 digits
  };

  const cityKey = destinationText.toLowerCase();
  const postcodePattern = postcodePatterns[cityKey];

  // Check if address contains a postcode
  const hasPostcode = postcodePattern ? postcodePattern.test(locationText) : false;

  // Check if address has street-level detail (numbers, street names like "rue", "avenue", "street", "st", "ave", etc.)
  // Includes patterns for multiple languages: English, French, Spanish, Italian, German, etc.
  const hasStreetDetail = /\b(\d+\s*(rue|avenue|boulevard|bd|street|st|avenue|ave|road|rd|lane|ln|drive|dr|way|path|close|plaza|place|pl|square|sq|row|court|ct|terrace|ter|gardens|gdn|park|crescent|cr|circle|cir|view|rise|heights|hill|manor|villas|walk|villa|mews|gate|quay|wharf|dock|bridge|passage|alley|mews|yards|grove|wood|green|mount|maunt|rise|down|dene|vale|end|side|corner|cross|crossing|intersection|pg\.|passeig|passatge|carrer|calle|avenida|via|vía|plaza|pl\.|straße|strasse|straße|via|viale|vicolo|strada|rue|avenue|boulevard|straat|weg|gasse|ulica|ul\.|улица|улиц|проспект|просп|набережная|наб\.))\b/i.test(locationText);

  // Check if address contains the city name but appears to be incomplete
  // This handles cases like "Some Place, Paris, France" or "Goldman Sachs - New York, NY, USA"
  // where we have a place name + city but no specific street address
  const escapedDestination = destinationText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Check if the location text contains the city name
  const containsCity = new RegExp(escapedDestination, 'i').test(locationText);
  
  if (!containsCity) {
    return false;
  }
  
  // If it contains the city AND lacks postcode AND lacks street detail, 
  // AND it's not just the city name alone (already checked above),
  // then it's likely a non-specific location (place name + city without details)
  // This catches formats like:
  // - "Place Name, City, Country"
  // - "Place Name - City, State, Country"  
  // - "Place Name, City, State, Country"
  if (!hasPostcode && !hasStreetDetail) {
    // Additional check: make sure it's not just the city name (we already checked that above)
    // If it contains the city but has more text (place name), and lacks details, it's incomplete
    const hasPlaceName = locationText.length > destinationText.length + 5; // Rough check: has more than just city name
    if (hasPlaceName) {
      return true;
    }
  }

  return false;
}

