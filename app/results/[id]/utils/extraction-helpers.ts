// Function to extract flight numbers from driver notes
export const extractFlightNumbers = (notes: string): { [locationName: string]: string[] } => {
  if (!notes) return {};

  const flightMap: { [locationName: string]: string[] } = {};

  // Common flight number patterns - more comprehensive
  const flightPatterns = [
    /\b([A-Z]{2,3}\s*\d{3,4})\b/g, // BA123, AA1234, etc.
    /\b(flight\s*([A-Z]{2,3}\s*\d{3,4}))/gi, // "flight BA123"
    /\b([A-Z]{2,3}\s*\d{3,4})\s*(?:arrives?|departs?|lands?|takes\s*off)/gi, // "BA123 arrives"
    /\b([A-Z]{2,3}\s*\d{3,4})\s*(?:at|from|to)\s*(?:heathrow|gatwick|stansted|luton|city|airport)/gi, // "BA123 at Heathrow"
    /\b(heathrow|gatwick|stansted|luton|city|airport).*?([A-Z]{2,3}\s*\d{3,4})/gi, // "Heathrow BA123"
  ];

  // Common airport keywords
  const airportKeywords = [
    'heathrow', 'gatwick', 'stansted', 'luton', 'city', 'airport',
    'terminal', 'arrivals', 'departures', 'lhr', 'lgw', 'stn', 'ltn'
  ];

  // Split notes into sentences and look for flight numbers near airport mentions
  const sentences = notes.split(/[.!?]+/);

  sentences.forEach(sentence => {
    const lowerSentence = sentence.toLowerCase();

    // Check if sentence mentions an airport
    const mentionedAirport = airportKeywords.find(keyword =>
      lowerSentence.includes(keyword)
    );

    if (mentionedAirport) {
      // Look for flight numbers in this sentence
      flightPatterns.forEach(pattern => {
        const matches = sentence.match(pattern);
        if (matches) {
          matches.forEach(match => {
            // Clean up the flight number
            const flightNumber = match.replace(/flight\s*/gi, '').trim();
            if (flightNumber) {
              // Determine airport name based on context
              let airportName = 'Airport';
              if (lowerSentence.includes('heathrow') || lowerSentence.includes('lhr')) {
                airportName = 'Heathrow Airport';
              } else if (lowerSentence.includes('gatwick') || lowerSentence.includes('lgw')) {
                airportName = 'Gatwick Airport';
              } else if (lowerSentence.includes('stansted') || lowerSentence.includes('stn')) {
                airportName = 'Stansted Airport';
              } else if (lowerSentence.includes('luton') || lowerSentence.includes('ltn')) {
                airportName = 'Luton Airport';
              } else if (lowerSentence.includes('city')) {
                airportName = 'London City Airport';
              }

              if (!flightMap[airportName]) {
                flightMap[airportName] = [];
              }
              if (!flightMap[airportName].includes(flightNumber)) {
                flightMap[airportName].push(flightNumber);
              }
            }
          });
        }
      });
    }
  });

  return flightMap;
};

// Function to extract service introduction from driver notes
export const extractServiceIntroduction = (notes: string): string => {
  if (!notes) {
    return 'Executive transportation service';
  }

  // Extract key operational details
  const serviceType = notes.toLowerCase().includes('full day') ? 'Full day hourly-based journey' :
    notes.toLowerCase().includes('hourly') ? 'Hourly-based journey' :
      notes.toLowerCase().includes('chauffeur') ? 'Chauffeur service' :
        'Executive transportation service';

  // Extract client name
  const nameMatch = notes.match(/\b(Mr\.|Mrs\.|Ms\.|Dr\.|Sir|Lady)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/);
  const clientName = nameMatch ? `${nameMatch[1]} ${nameMatch[2]}` : 'Client';

  // Extract location context
  const locationContext = notes.toLowerCase().includes('london') ? 'in London' : 'in the specified area';

  return `${serviceType} for ${clientName} ${locationContext}`;
};

