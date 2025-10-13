// UK Police Open Data API Client
// Documentation: https://data.police.uk/docs/
// 100% Free, No API Key Required

export interface StreetLevelCrime {
  category: string;
  location_type: string;
  location: {
    latitude: string;
    longitude: string;
    street: {
      id: number;
      name: string;
    };
  };
  context: string;
  outcome_status: {
    category: string;
    date: string;
  } | null;
  persistent_id: string;
  id: number;
  location_subtype: string;
  month: string;
}

export interface CrimeSummary {
  totalCrimes: number;
  byCategory: Record<string, number>;
  topCategories: Array<{ category: string; count: number; percentage: number }>;
  byOutcome: Record<string, number>;
  month: string;
}

/**
 * Fetch street-level crimes for a specific location
 * @param lat Latitude
 * @param lng Longitude
 * @param date Optional date in YYYY-MM format (defaults to latest available)
 */
export async function getStreetLevelCrimes(
  lat: number,
  lng: number,
  date?: string
): Promise<StreetLevelCrime[]> {
  try {
    console.log(`🔍 Fetching UK Police data for coordinates: ${lat}, ${lng}`);
    
    let url = `https://data.police.uk/api/crimes-street/all-crime?lat=${lat}&lng=${lng}`;
    if (date) {
      url += `&date=${date}`;
    }
    
    console.log(`📡 Calling: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PeaceOfMind/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: StreetLevelCrime[] = await response.json();
    console.log(`✅ Retrieved ${data.length} crime records`);
    
    return data;
  } catch (error: any) {
    console.error('❌ Error fetching UK Police data:', error.message);
    throw error;
  }
}

/**
 * Analyze and summarize crime data
 */
export function analyzeCrimeData(crimes: StreetLevelCrime[]): CrimeSummary {
  const byCategory: Record<string, number> = {};
  const byOutcome: Record<string, number> = {};
  
  crimes.forEach((crime) => {
    // Count by category
    byCategory[crime.category] = (byCategory[crime.category] || 0) + 1;
    
    // Count by outcome
    if (crime.outcome_status) {
      const outcome = crime.outcome_status.category;
      byOutcome[outcome] = (byOutcome[outcome] || 0) + 1;
    } else {
      byOutcome['Under investigation'] = (byOutcome['Under investigation'] || 0) + 1;
    }
  });

  // Get top categories
  const topCategories = Object.entries(byCategory)
    .map(([category, count]) => ({
      category: formatCategory(category),
      count,
      percentage: Math.round((count / crimes.length) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalCrimes: crimes.length,
    byCategory,
    topCategories,
    byOutcome,
    month: crimes.length > 0 ? crimes[0].month : 'N/A',
  };
}

/**
 * Format crime category for display
 */
function formatCategory(category: string): string {
  return category
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Calculate safety score based on crime data
 * Returns a score from 0-100 (higher is safer)
 */
export function calculateSafetyScore(crimes: StreetLevelCrime[], populationDensity: number = 1000): number {
  // Base score starts at 100
  let score = 100;
  
  // Deduct points based on crime count relative to area density
  const crimeRate = crimes.length / populationDensity;
  score -= Math.min(50, crimeRate * 1000);
  
  // Deduct extra points for violent crimes
  const violentCrimes = crimes.filter(c => 
    c.category.includes('violent') || 
    c.category.includes('robbery') ||
    c.category === 'possession-of-weapons'
  ).length;
  
  score -= Math.min(30, (violentCrimes / crimes.length) * 30);
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Get available forces (police departments)
 */
export async function getForces(): Promise<Array<{ id: string; name: string }>> {
  try {
    const response = await fetch('https://data.police.uk/api/forces');
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    return await response.json();
  } catch (error: any) {
    console.error('Error fetching forces:', error.message);
    throw error;
  }
}

// London Districts/Boroughs with Coordinates
export const LONDON_DISTRICTS = {
  'westminster': { name: 'Westminster', lat: 51.4975, lng: -0.1357 },
  'camden': { name: 'Camden', lat: 51.5290, lng: -0.1255 },
  'islington': { name: 'Islington', lat: 51.5416, lng: -0.1022 },
  'hackney': { name: 'Hackney', lat: 51.5450, lng: -0.0553 },
  'tower-hamlets': { name: 'Tower Hamlets', lat: 51.5099, lng: -0.0059 },
  'greenwich': { name: 'Greenwich', lat: 51.4892, lng: 0.0648 },
  'lewisham': { name: 'Lewisham', lat: 51.4535, lng: -0.0180 },
  'southwark': { name: 'Southwark', lat: 51.5035, lng: -0.0804 },
  'lambeth': { name: 'Lambeth', lat: 51.4607, lng: -0.1163 },
  'wandsworth': { name: 'Wandsworth', lat: 51.4571, lng: -0.1819 },
  'hammersmith-fulham': { name: 'Hammersmith & Fulham', lat: 51.4927, lng: -0.2339 },
  'kensington-chelsea': { name: 'Kensington & Chelsea', lat: 51.4991, lng: -0.1938 },
  'city-of-london': { name: 'City of London', lat: 51.5155, lng: -0.0922 },
  'soho': { name: 'Soho', lat: 51.5136, lng: -0.1359 },
  'covent-garden': { name: 'Covent Garden', lat: 51.5117, lng: -0.1234 },
  'shoreditch': { name: 'Shoreditch', lat: 51.5254, lng: -0.0778 },
  'notting-hill': { name: 'Notting Hill', lat: 51.5098, lng: -0.2057 },
  'brixton': { name: 'Brixton', lat: 51.4613, lng: -0.1157 },
  'clapham': { name: 'Clapham', lat: 51.4618, lng: -0.1382 },
  'chelsea': { name: 'Chelsea', lat: 51.4875, lng: -0.1687 },
  'mayfair': { name: 'Mayfair', lat: 51.5085, lng: -0.1475 },
  'canary-wharf': { name: 'Canary Wharf', lat: 51.5054, lng: -0.0235 },
  'stratford': { name: 'Stratford', lat: 51.5416, lng: -0.0034 },
  'wimbledon': { name: 'Wimbledon', lat: 51.4214, lng: -0.2064 },
};

