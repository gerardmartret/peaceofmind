// TfL Parking API Client
// Provides evergreen parking information (no time-specific data)

import { supabase } from './supabase';

export interface CarPark {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance: number; // meters from query location
  totalSpaces?: number;
  operatingHours?: string;
  facilities: string[];
  type: string; // "Station Car Park", "Public Car Park", etc.
  additionalProperties?: Record<string, any>;
}

export interface CPZInfo {
  inCPZ: boolean;
  zone?: string;
  zoneName?: string;
  borough?: string;
  operatingHours?: string;
  operatingDays?: string;
  restrictions?: string;
  chargeInfo?: string;
}

export interface ParkingData {
  location: string;
  coordinates: { lat: number; lng: number };
  carParks: CarPark[];
  cpzInfo: CPZInfo;
  parkingRiskScore: number; // 1-10 (10 = very challenging)
  summary: {
    totalNearby: number;
    averageDistance: number;
    hasStationParking: boolean;
    cpzWarning: boolean;
  };
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Check if location is within a CPZ (Controlled Parking Zone)
 */
export async function checkCPZStatus(
  lat: number,
  lng: number
): Promise<CPZInfo> {
  try {
    console.log(`🅿️  Checking CPZ status for ${lat}, ${lng}...`);

    // Query Supabase for nearby CPZ zones (within ~2km radius)
    const { data: zones, error } = await supabase
      .from('cpz_zones')
      .select('*')
      .gte('center_lat', lat - 0.018) // ~2km
      .lte('center_lat', lat + 0.018)
      .gte('center_lng', lng - 0.025) // ~2km (adjusted for London latitude)
      .lte('center_lng', lng + 0.025);

    if (error) {
      console.error('❌ Error querying CPZ zones:', error);
      return { inCPZ: false };
    }

    if (!zones || zones.length === 0) {
      console.log('✅ No CPZ zones found in area');
      return { inCPZ: false };
    }

    // Find the closest CPZ zone
    let closestZone = null;
    let minDistance = Infinity;

    for (const zone of zones) {
      const distance = calculateDistance(
        lat,
        lng,
        zone.center_lat,
        zone.center_lng
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestZone = zone;
      }
    }

    // If closest zone is within 500m, consider it as being in that CPZ
    if (closestZone && minDistance < 500) {
      console.log(`⚠️  Location is in CPZ: ${closestZone.zone_code}`);
      return {
        inCPZ: true,
        zone: closestZone.zone_code,
        zoneName: closestZone.zone_name,
        borough: closestZone.borough,
        operatingHours: closestZone.operating_hours,
        operatingDays: closestZone.operating_days,
        restrictions: closestZone.restrictions ?? undefined,
        chargeInfo: closestZone.charge_info ?? undefined,
      };
    }

    console.log('✅ No CPZ restrictions at this location');
    return { inCPZ: false };
  } catch (error: any) {
    console.error('❌ Error checking CPZ status:', error.message);
    return { inCPZ: false };
  }
}

/**
 * Get nearby car parks from TfL API
 */
export async function getNearbyCarParks(
  lat: number,
  lng: number,
  radiusMeters: number = 1000
): Promise<CarPark[]> {
  try {
    console.log(`🅿️  Fetching car parks within ${radiusMeters}m of ${lat}, ${lng}...`);

    // TfL API endpoint for searching places by location
    // Note: TfL API doesn't require API key for basic usage
    const url = `https://api.tfl.gov.uk/Place/Type/CarPark`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`TfL API Error: ${response.status} ${response.statusText}`);
    }

    const allCarParks = await response.json();
    console.log(`📊 Retrieved ${allCarParks.length} total TfL car parks`);

    // Filter by distance and extract relevant info
    const nearbyCarParks: CarPark[] = [];

    for (const place of allCarParks) {
      if (!place.lat || !place.lon) continue;

      const distance = calculateDistance(lat, lng, place.lat, place.lon);

      if (distance <= radiusMeters) {
        // Extract evergreen data only
        const carPark: CarPark = {
          id: place.id || '',
          name: place.commonName || place.name || 'Unknown Car Park',
          address: extractAddress(place),
          lat: place.lat,
          lng: place.lon,
          distance: Math.round(distance),
          totalSpaces: extractTotalSpaces(place),
          operatingHours: extractOperatingHours(place),
          facilities: extractFacilities(place),
          type: determineCarParkType(place),
          additionalProperties: place.additionalProperties || {},
        };

        nearbyCarParks.push(carPark);
      }
    }

    // Sort by distance (nearest first)
    nearbyCarParks.sort((a, b) => a.distance - b.distance);

    console.log(`✅ Found ${nearbyCarParks.length} car parks within ${radiusMeters}m`);

    return nearbyCarParks;
  } catch (error: any) {
    console.error('❌ Error fetching car parks:', error.message);
    return [];
  }
}

/**
 * Extract address from TfL place data
 */
function extractAddress(place: any): string {
  if (place.placeType === 'CarPark' && place.additionalProperties) {
    const addressProp = place.additionalProperties.find(
      (p: any) => p.key === 'Address' || p.key === 'address'
    );
    if (addressProp) return addressProp.value;
  }
  return place.address || place.commonName || 'Address not available';
}

/**
 * Extract total spaces (evergreen data)
 */
function extractTotalSpaces(place: any): number | undefined {
  if (place.additionalProperties) {
    const spacesProp = place.additionalProperties.find(
      (p: any) => p.key === 'Spaces' || p.key === 'TotalSpaces' || p.key === 'Capacity'
    );
    if (spacesProp) {
      const spaces = parseInt(spacesProp.value, 10);
      return isNaN(spaces) ? undefined : spaces;
    }
  }
  return undefined;
}

/**
 * Extract operating hours (evergreen data)
 */
function extractOperatingHours(place: any): string {
  if (place.additionalProperties) {
    const hoursProp = place.additionalProperties.find(
      (p: any) => p.key === 'OpeningHours' || p.key === 'Hours' || p.key === 'OperatingHours'
    );
    if (hoursProp) return hoursProp.value;
  }
  // Default to 24 hours if not specified for station car parks
  return '24 hours (check on-site for exact hours)';
}

/**
 * Extract facilities (evergreen data)
 */
function extractFacilities(place: any): string[] {
  const facilities: string[] = [];
  
  if (place.additionalProperties) {
    for (const prop of place.additionalProperties) {
      const key = prop.key?.toLowerCase() || '';
      const value = prop.value?.toLowerCase() || '';
      
      if (key.includes('covered') || value.includes('covered')) {
        facilities.push('Covered');
      }
      if (key.includes('secure') || value.includes('secure')) {
        facilities.push('Secure');
      }
      if (key.includes('accessible') || value.includes('accessible') || key.includes('disabled')) {
        facilities.push('Accessible');
      }
      if (key.includes('cctv') || value.includes('cctv')) {
        facilities.push('CCTV');
      }
      if (key.includes('ev') || key.includes('electric') || value.includes('charging')) {
        facilities.push('EV Charging');
      }
      if (key.includes('lighting') || value.includes('lighting')) {
        facilities.push('Well Lit');
      }
    }
  }

  return facilities.length > 0 ? facilities : ['Standard parking'];
}

/**
 * Determine car park type
 */
function determineCarParkType(place: any): string {
  const name = place.commonName?.toLowerCase() || '';
  
  if (name.includes('underground') || name.includes('tube')) {
    return 'London Underground Station Car Park';
  }
  if (name.includes('station') || name.includes('rail')) {
    return 'Station Car Park';
  }
  if (name.includes('ncp') || name.includes('q-park')) {
    return 'Commercial Car Park';
  }
  
  return 'Public Car Park';
}

/**
 * Calculate parking risk score (1-10, where 10 is most challenging)
 */
export function calculateParkingRiskScore(
  carParks: CarPark[],
  cpzInfo: CPZInfo,
  averageDistance: number
): number {
  let riskScore = 0;

  // Factor 1: Number of nearby car parks (40% weight)
  if (carParks.length === 0) {
    riskScore += 4.0;
  } else if (carParks.length === 1) {
    riskScore += 3.0;
  } else if (carParks.length === 2) {
    riskScore += 2.0;
  } else {
    riskScore += 1.0;
  }

  // Factor 2: Distance to nearest parking (30% weight)
  if (carParks.length > 0) {
    const nearestDistance = carParks[0].distance;
    if (nearestDistance > 800) {
      riskScore += 3.0;
    } else if (nearestDistance > 500) {
      riskScore += 2.0;
    } else if (nearestDistance > 300) {
      riskScore += 1.0;
    } else {
      riskScore += 0.5;
    }
  }

  // Factor 3: CPZ restrictions (30% weight)
  if (cpzInfo.inCPZ) {
    riskScore += 3.0;
  }

  // Cap at 10
  return Math.min(Math.round(riskScore), 10);
}

/**
 * Get complete parking information for a location
 */
export async function getParkingInfo(
  lat: number,
  lng: number,
  locationName: string
): Promise<ParkingData> {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🅿️  FETCHING PARKING INFORMATION FOR: ${locationName}`);
    console.log('='.repeat(80));

    // Get nearby car parks
    const carParks = await getNearbyCarParks(lat, lng, 1000);

    // Check CPZ status
    const cpzInfo = await checkCPZStatus(lat, lng);

    // Calculate summary statistics
    const totalNearby = carParks.length;
    const averageDistance =
      totalNearby > 0
        ? Math.round(carParks.reduce((sum, cp) => sum + cp.distance, 0) / totalNearby)
        : 0;
    const hasStationParking = carParks.some((cp) =>
      cp.type.toLowerCase().includes('station')
    );
    const cpzWarning = cpzInfo.inCPZ;

    // Calculate parking risk score
    const parkingRiskScore = calculateParkingRiskScore(
      carParks,
      cpzInfo,
      averageDistance
    );

    const parkingData: ParkingData = {
      location: locationName,
      coordinates: { lat, lng },
      carParks,
      cpzInfo,
      parkingRiskScore,
      summary: {
        totalNearby,
        averageDistance,
        hasStationParking,
        cpzWarning,
      },
    };

    console.log(`\n📊 PARKING SUMMARY:`);
    console.log(`   Car Parks Found: ${totalNearby}`);
    console.log(`   Average Distance: ${averageDistance}m`);
    console.log(`   CPZ Restrictions: ${cpzWarning ? 'YES' : 'NO'}`);
    console.log(`   Parking Risk Score: ${parkingRiskScore}/10`);
    console.log('='.repeat(80) + '\n');

    return parkingData;
  } catch (error: any) {
    console.error('❌ Error getting parking info:', error.message);
    throw error;
  }
}

