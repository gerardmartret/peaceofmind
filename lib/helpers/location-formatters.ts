/**
 * Helper function to extract business/place name and format address display
 * @param fullAddress - The full address string
 * @returns An object with businessName and restOfAddress
 */
export const formatLocationDisplay = (fullAddress: string): { businessName: string; restOfAddress: string } => {
  if (!fullAddress) return { businessName: '', restOfAddress: '' };

  const parts = fullAddress.split(',').map(p => p.trim());

  if (parts.length === 0) return { businessName: fullAddress, restOfAddress: '' };
  if (parts.length === 1) return { businessName: parts[0], restOfAddress: '' };

  // Special handling for airports - look for airport name in the address
  const lowerAddress = fullAddress.toLowerCase();
  const airportKeywords = [
    { keyword: 'heathrow', fullName: 'Heathrow Airport' },
    { keyword: 'gatwick', fullName: 'Gatwick Airport' },
    { keyword: 'stansted', fullName: 'Stansted Airport' },
    { keyword: 'luton', fullName: 'Luton Airport' },
    { keyword: 'london city airport', fullName: 'London City Airport' },
    { keyword: 'changi', fullName: 'Changi Airport' },
    { keyword: 'frankfurt airport', fullName: 'Frankfurt Airport' },
    { keyword: 'frankfurt am main airport', fullName: 'Frankfurt Airport' },
    { keyword: 'charles de gaulle', fullName: 'Charles de Gaulle Airport' },
    { keyword: 'cdg', fullName: 'Charles de Gaulle Airport' },
    { keyword: 'orly', fullName: 'Orly Airport' },
    { keyword: 'orly airport', fullName: 'Orly Airport' },
    { keyword: 'narita', fullName: 'Narita Airport' },
    { keyword: 'narita airport', fullName: 'Narita Airport' },
    { keyword: 'haneda', fullName: 'Haneda Airport' },
    { keyword: 'haneda airport', fullName: 'Haneda Airport' },
    { keyword: 'logan', fullName: 'Logan International Airport' },
    { keyword: 'logan international', fullName: 'Logan International Airport' },
    { keyword: 'zurich airport', fullName: 'Zurich Airport' },
  ];

  for (const airport of airportKeywords) {
    if (lowerAddress.includes(airport.keyword)) {
      // If it's a terminal, show "Airport Name - Terminal X"
      const terminalMatch = parts[0].match(/terminal\s+\d+/i);
      if (terminalMatch) {
        const businessName = `${airport.fullName} - ${terminalMatch[0]}`;
        const restOfAddress = parts.slice(1).join(', ');
        return { businessName, restOfAddress };
      }
      // Otherwise, use the airport name
      const businessName = airport.fullName;
      const restOfAddress = parts.join(', ');
      return { businessName, restOfAddress };
    }
  }

  // For non-airports, first part is typically the business/place name
  const businessName = parts[0];
  // Rest is the detailed address
  const restOfAddress = parts.slice(1).join(', ');

  return { businessName, restOfAddress };
};

