// Flight Number Parser
// Extracts and matches flight numbers with airport locations

export interface FlightNumber {
  code: string; // e.g., "BA177"
  airline?: string; // e.g., "BA" or "British Airways"
  number?: string; // e.g., "177"
  direction?: 'arrival' | 'departure';
  fullText?: string; // Original text from driver notes
}

/**
 * Extract flight numbers from text
 * Supports formats like: BA177, BA 177, Flight BA177, BA-177, etc.
 */
export function extractFlightNumbers(text: string): FlightNumber[] {
  if (!text) return [];

  const flights: FlightNumber[] = [];
  
  // Common airline code patterns (2-3 letters followed by 1-4 digits)
  // Matches: BA177, BA 177, Flight BA177, BA-177, flight BA177, etc.
  const flightPatterns = [
    /\b([A-Z]{2})\s*-?\s*(\d{1,4})\b/gi,  // BA177, BA 177, BA-177
    /\bflight\s+([A-Z]{2})\s*-?\s*(\d{1,4})\b/gi,  // Flight BA177
    /\b([A-Z]{2})(\d{1,4})\b/g,  // BA177 (compact)
  ];

  const foundCodes = new Set<string>(); // Avoid duplicates

  for (const pattern of flightPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const airlineCode = match[1];
      const flightNum = match[2];
      const fullCode = `${airlineCode}${flightNum}`;
      
      // Avoid duplicates
      if (foundCodes.has(fullCode)) continue;
      foundCodes.add(fullCode);

      // Determine direction from context
      const matchStart = match.index;
      const context = text.substring(Math.max(0, matchStart - 50), Math.min(text.length, matchStart + 100));
      const direction = determineFlightDirection(context);

      flights.push({
        code: fullCode,
        airline: airlineCode,
        number: flightNum,
        direction,
        fullText: match[0],
      });
    }
  }

  return flights;
}

/**
 * Determine if a flight is an arrival or departure based on context
 */
function determineFlightDirection(context: string): 'arrival' | 'departure' | undefined {
  const lowerContext = context.toLowerCase();
  
  // Arrival keywords
  const arrivalKeywords = ['arriving', 'arrival', 'from', 'pick up', 'pickup', 'landing', 'lands', 'incoming'];
  // Departure keywords
  const departureKeywords = ['departing', 'departure', 'to', 'drop off', 'dropoff', 'drop-off', 'outgoing', 'leaving'];
  
  const hasArrival = arrivalKeywords.some(keyword => lowerContext.includes(keyword));
  const hasDeparture = departureKeywords.some(keyword => lowerContext.includes(keyword));
  
  // If both or neither, return undefined (ambiguous)
  if (hasArrival && !hasDeparture) return 'arrival';
  if (hasDeparture && !hasArrival) return 'departure';
  
  return undefined;
}

/**
 * Check if a location name indicates an airport
 */
export function isAirport(locationName: string): boolean {
  if (!locationName) return false;
  
  const lowerName = locationName.toLowerCase();
  
  // Airport keywords
  const airportKeywords = [
    'airport',
    'terminal',
    'heathrow',
    'gatwick',
    'stansted',
    'luton',
    'city airport',
    'lhr', 'lgw', 'stn', 'ltn', 'lcy', // UK airport codes
    'arrivals',
    'departures',
  ];
  
  return airportKeywords.some(keyword => lowerName.includes(keyword));
}

/**
 * Match flight numbers to airport locations
 * Returns the most likely flight for each airport location
 */
export function matchFlightsToLocations(
  flights: FlightNumber[],
  locations: Array<{ location: string; purpose?: string; time?: string }>,
  driverNotes?: string
): Map<number, FlightNumber> {
  const matches = new Map<number, FlightNumber>();

  locations.forEach((loc, index) => {
    if (!isAirport(loc.location)) return;

    // Try to find matching flight for this airport location
    const matchingFlight = findMatchingFlight(loc, flights, driverNotes);
    if (matchingFlight) {
      matches.set(index, matchingFlight);
    }
  });

  return matches;
}

/**
 * Find the best matching flight for an airport location
 */
function findMatchingFlight(
  location: { location: string; purpose?: string; time?: string },
  flights: FlightNumber[],
  driverNotes?: string
): FlightNumber | null {
  if (flights.length === 0) return null;

  // Strategy 1: Look for flight mentioned in location purpose
  if (location.purpose) {
    const purposeFlights = extractFlightNumbers(location.purpose);
    if (purposeFlights.length > 0) {
      return purposeFlights[0]; // Use the first one found in purpose
    }
  }

  // Strategy 2: Match by direction (pickup = arrival, drop-off = departure)
  const locationLower = (location.location + ' ' + (location.purpose || '')).toLowerCase();
  const isPickup = locationLower.includes('pick up') || locationLower.includes('pickup') || locationLower.includes('arriving');
  const isDropoff = locationLower.includes('drop off') || locationLower.includes('dropoff') || locationLower.includes('drop-off') || locationLower.includes('departing');

  if (isPickup) {
    const arrivalFlight = flights.find(f => f.direction === 'arrival');
    if (arrivalFlight) return arrivalFlight;
  }

  if (isDropoff) {
    const departureFlight = flights.find(f => f.direction === 'departure');
    if (departureFlight) return departureFlight;
  }

  // Strategy 3: If only one flight and one airport, match them
  if (flights.length === 1) {
    return flights[0];
  }

  // Strategy 4: Match by proximity in text (flight mentioned near airport name)
  if (driverNotes) {
    const airportIndex = driverNotes.toLowerCase().indexOf(location.location.toLowerCase());
    if (airportIndex !== -1) {
      // Find flight mentioned closest to this airport in the notes
      let closestFlight: FlightNumber | null = null;
      let minDistance = Infinity;

      flights.forEach(flight => {
        const flightIndex = driverNotes.indexOf(flight.fullText || flight.code);
        if (flightIndex !== -1) {
          const distance = Math.abs(flightIndex - airportIndex);
          if (distance < minDistance) {
            minDistance = distance;
            closestFlight = flight;
          }
        }
      });

      if (closestFlight && minDistance < 200) { // Within 200 characters
        return closestFlight;
      }
    }
  }

  return null;
}

/**
 * Remove flight numbers from driver notes (to avoid redundancy)
 * Keeps the context but removes the flight code itself
 */
export function removeFlightNumbersFromNotes(notes: string, flights: FlightNumber[]): string {
  if (!notes || flights.length === 0) return notes;

  let cleanedNotes = notes;

  flights.forEach(flight => {
    // Remove patterns like "Flight BA177" but keep rest of sentence
    const patterns = [
      new RegExp(`\\bflight\\s+${flight.code}\\b`, 'gi'),
      new RegExp(`\\b${flight.code}\\b`, 'g'),
    ];

    patterns.forEach(pattern => {
      cleanedNotes = cleanedNotes.replace(pattern, '').trim();
    });
  });

  // Clean up multiple spaces and empty bullet points
  cleanedNotes = cleanedNotes.replace(/\s+/g, ' ');
  cleanedNotes = cleanedNotes.replace(/^-\s*$/gm, ''); // Remove empty bullets
  cleanedNotes = cleanedNotes.replace(/\n\s*\n/g, '\n'); // Remove empty lines

  return cleanedNotes.trim();
}

