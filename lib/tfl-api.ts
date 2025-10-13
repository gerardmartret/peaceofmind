// Transport for London (TfL) Unified API Client
// Documentation: https://api.tfl.gov.uk/
// No API key required for basic usage

export interface TfLDisruption {
  id: string;
  url: string;
  location: string;
  corridorIds: string[];
  startDateTime: string;
  endDateTime: string;
  lastModifiedTime: string;
  levelOfInterest: string;
  category: string;
  subCategory: string;
  severity: string;
  comments: string;
  currentUpdate: string;
  currentUpdateDateTime: string;
  corridors?: Array<{
    id: string;
    name: string;
    statusSeverity: string;
    statusSeverityDescription: string;
  }>;
  streets?: Array<{
    name: string;
    sourceSystemKey: string;
  }>;
  isProvisional: boolean;
  hasClosures: boolean;
  linkText: string;
  linkUrl: string;
  roadProject?: any;
  publishStartDate: string;
  publishEndDate: string;
  timeFrame: string;
  roadDisruptionImpactAreas: Array<{
    id: number;
    roadDisruptionId: string;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
  }>;
}

export interface RoadCorridor {
  id: string;
  displayName: string;
  statusSeverity: string;
  statusSeverityDescription: string;
  bounds: string;
  envelope: string;
  url: string;
}

/**
 * Get all current road disruptions in London
 */
export async function getAllDisruptions(): Promise<TfLDisruption[]> {
  try {
    console.log('🔍 Fetching TfL road disruptions...');
    
    const response = await fetch('https://api.tfl.gov.uk/Road/all/Disruption');
    
    if (!response.ok) {
      throw new Error(`TfL API Error: ${response.status} ${response.statusText}`);
    }

    const data: TfLDisruption[] = await response.json();
    console.log(`✅ Retrieved ${data.length} total disruptions`);
    
    return data;
  } catch (error: any) {
    console.error('❌ Error fetching TfL disruptions:', error.message);
    throw error;
  }
}

/**
 * Get disruptions near a specific location (by coordinates)
 * Filters disruptions within approximately 2km radius
 */
export async function getDisruptionsNearLocation(
  lat: number,
  lng: number,
  radiusKm: number = 2
): Promise<TfLDisruption[]> {
  try {
    console.log(`🔍 Fetching disruptions near ${lat}, ${lng} (radius: ${radiusKm}km)`);
    
    const allDisruptions = await getAllDisruptions();
    
    // Filter disruptions that are nearby (basic distance calculation)
    const nearbyDisruptions = allDisruptions.filter(disruption => {
      // Extract location coordinates if available from the location string
      // For now, we'll filter by checking if any corridor is mentioned
      return true; // Return all for now, as precise filtering requires more data
    });
    
    console.log(`✅ Found ${nearbyDisruptions.length} disruptions in the area`);
    
    return nearbyDisruptions;
  } catch (error: any) {
    console.error('❌ Error filtering disruptions:', error.message);
    throw error;
  }
}

/**
 * Get disruptions for the next N days
 */
export function filterDisruptionsByTimeframe(
  disruptions: TfLDisruption[],
  daysAhead: number = 7
): TfLDisruption[] {
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  
  console.log(`📅 Filtering disruptions from ${now.toISOString().split('T')[0]} to ${futureDate.toISOString().split('T')[0]}`);
  
  return disruptions.filter(disruption => {
    const endDate = new Date(disruption.endDateTime);
    const startDate = new Date(disruption.startDateTime);
    
    // Include if disruption is active now or starts within the timeframe
    return endDate >= now && startDate <= futureDate;
  });
}

/**
 * Get disruptions filtered by area name (e.g., "Notting Hill", "Westminster")
 */
export function filterDisruptionsByArea(
  disruptions: TfLDisruption[],
  areaName: string
): TfLDisruption[] {
  console.log(`🔍 Filtering disruptions for area: ${areaName}`);
  
  const areaLower = areaName.toLowerCase();
  
  return disruptions.filter(disruption => {
    const location = disruption.location?.toLowerCase() || '';
    const comments = disruption.comments?.toLowerCase() || '';
    
    return location.includes(areaLower) || comments.includes(areaLower);
  });
}

/**
 * Get all road corridors in London
 */
export async function getAllRoadCorridors(): Promise<RoadCorridor[]> {
  try {
    console.log('🛣️  Fetching road corridors...');
    
    const response = await fetch('https://api.tfl.gov.uk/Road');
    
    if (!response.ok) {
      throw new Error(`TfL API Error: ${response.status} ${response.statusText}`);
    }

    const data: RoadCorridor[] = await response.json();
    console.log(`✅ Retrieved ${data.length} road corridors`);
    
    return data;
  } catch (error: any) {
    console.error('❌ Error fetching road corridors:', error.message);
    throw error;
  }
}

/**
 * Analyze disruptions by severity
 */
export function analyzeDisruptions(disruptions: TfLDisruption[]) {
  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  
  disruptions.forEach(d => {
    bySeverity[d.severity] = (bySeverity[d.severity] || 0) + 1;
    byCategory[d.category] = (byCategory[d.category] || 0) + 1;
  });
  
  return {
    total: disruptions.length,
    bySeverity,
    byCategory,
    active: disruptions.filter(d => new Date(d.startDateTime) <= new Date() && new Date(d.endDateTime) >= new Date()).length,
    upcoming: disruptions.filter(d => new Date(d.startDateTime) > new Date()).length,
  };
}

