interface TrafficLeg {
  leg: string; // "A→B", "B→C", etc.
  origin: { lat: number; lng: number; name: string };
  destination: { lat: number; lng: number; name: string };
  departureTime: string; // ISO string
}

interface TrafficResult {
  leg: string;
  minutes: number; // Drive time with traffic
  minutesNoTraffic: number; // Drive time without traffic
  distance: string; // e.g., "5.2 km"
  distanceMeters: number;
  busyMinutes?: number; // Optional: busy time estimate
  originName: string;
  destinationName: string;
  departureTime: string;
}

interface TrafficPredictionResponse {
  success: boolean;
  data: TrafficResult[];
  totalDistance: string;
  totalMinutes: number;
  totalMinutesNoTraffic: number;
  warning?: string;
  error?: string;
}

/**
 * Get Place ID from coordinates using Google Places API
 */
async function getPlaceIdFromCoordinates(lat: number, lng: number, name: string): Promise<string | null> {
  try {
    const service = new google.maps.places.PlacesService(document.createElement('div'));
    
    return new Promise((resolve) => {
      service.findPlaceFromQuery(
        {
          query: name,
          fields: ['place_id'],
          locationBias: new google.maps.LatLng(lat, lng),
        },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results && results[0] && results[0].place_id) {
            console.log(`📍 Place ID found for ${name}: ${results[0].place_id}`);
            resolve(results[0].place_id);
          } else {
            console.log(`⚠️ Place ID not found for ${name}, will use coordinates`);
            resolve(null);
          }
        }
      );
    });
  } catch (error) {
    console.error('❌ Error getting Place ID:', error);
    return null;
  }
}

/**
 * Calculate traffic predictions for a single leg
 */
async function calculateLegTiming(
  origin: { lat: number; lng: number; name: string },
  destination: { lat: number; lng: number; name: string },
  departureTime: string,
  legLabel: string
): Promise<TrafficResult> {
  const directionsService = new google.maps.DirectionsService();
  
  // Convert departure time to Date object
  const departureDate = new Date(departureTime);
  
  console.log(`🚗 Calculating ${legLabel}: ${origin.name} → ${destination.name}`);
  console.log(`   Departure: ${departureDate.toLocaleString('en-GB', { timeZone: 'Europe/London' })}`);
  
  return new Promise((resolve) => {
    directionsService.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: departureDate,
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result && result.routes[0]) {
          const leg = result.routes[0].legs[0];
          const durationInTraffic = leg.duration_in_traffic?.value || leg.duration?.value || 0;
          const durationNoTraffic = leg.duration?.value || 0;
          const distance = leg.distance?.value || 0;
          
          const trafficDelay = Math.round((durationInTraffic - durationNoTraffic) / 60);
          
          console.log(`   ✅ ${legLabel}: ${Math.round(durationInTraffic / 60)} min (${(distance / 1000).toFixed(1)} km)`);
          if (trafficDelay > 0) {
            console.log(`   🚦 Traffic delay: +${trafficDelay} min`);
          }
          
          resolve({
            leg: legLabel,
            minutes: Math.round(durationInTraffic / 60),
            minutesNoTraffic: Math.round(durationNoTraffic / 60),
            distance: `${(distance / 1000).toFixed(1)} km`,
            distanceMeters: distance,
            busyMinutes: trafficDelay > 0 ? Math.round(durationInTraffic / 60) : undefined,
            originName: origin.name,
            destinationName: destination.name,
            departureTime: departureDate.toISOString(),
          });
        } else {
          console.error(`❌ Directions failed for ${legLabel}:`, status);
          resolve({
            leg: legLabel,
            minutes: 0,
            minutesNoTraffic: 0,
            distance: '0 km',
            distanceMeters: 0,
            originName: origin.name,
            destinationName: destination.name,
            departureTime: departureDate.toISOString(),
          });
        }
      }
    );
  });
}

/**
 * Convert trip locations to traffic legs with proper timing
 */
function createTrafficLegs(locations: Array<{
  id: string;
  name: string;
  lat: number;
  lng: number;
  time: string;
}>, tripDate: string): { legs: TrafficLeg[]; warning?: string } {
  const legs: TrafficLeg[] = [];
  const now = new Date();
  let hasTimeAdjustment = false;
  
  for (let i = 0; i < locations.length - 1; i++) {
    const origin = locations[i];
    const destination = locations[i + 1];
    
    // Create departure time for this leg
    let legDepartureTime = `${tripDate}T${origin.time}:00`;
    const plannedDeparture = new Date(legDepartureTime);
    
    // If the planned departure is in the past, adjust it to be in the future
    if (plannedDeparture <= now) {
      hasTimeAdjustment = true;
      // Keep the same time but move it to tomorrow
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(parseInt(origin.time.split(':')[0]), parseInt(origin.time.split(':')[1]), 0, 0);
      legDepartureTime = tomorrow.toISOString();
      console.log(`⚠️ Planned departure ${plannedDeparture.toISOString()} is in the past. Using tomorrow at same time: ${tomorrow.toISOString()}`);
    }
    
    const legLabel = `${String.fromCharCode(65 + i)}→${String.fromCharCode(66 + i)}`;
    
    legs.push({
      leg: legLabel,
      origin: { lat: origin.lat, lng: origin.lng, name: origin.name },
      destination: { lat: destination.lat, lng: destination.lng, name: destination.name },
      departureTime: legDepartureTime,
    });
  }
  
  return {
    legs,
    warning: hasTimeAdjustment ? 'Some departure times were in the past and have been adjusted to tomorrow for traffic prediction purposes.' : undefined
  };
}

/**
 * Main function to get traffic predictions for entire trip
 */
export async function getTrafficPredictions(
  locations: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    time: string;
  }>,
  tripDate: string
): Promise<TrafficPredictionResponse> {
  try {
    console.log('\n🚦 TRAFFIC PREDICTION ANALYSIS');
    console.log('='.repeat(60));
    console.log(`📅 Trip Date: ${tripDate}`);
    console.log(`📍 Locations: ${locations.length}`);
    
    // Validate locations
    const validLocations = locations.filter(loc => loc.lat !== 0 && loc.lng !== 0 && loc.name);
    
    if (validLocations.length < 2) {
      return {
        success: false,
        data: [],
        totalDistance: '0 km',
        totalMinutes: 0,
        totalMinutesNoTraffic: 0,
        error: 'Need at least 2 valid locations for traffic prediction',
      };
    }
    
    // Create traffic legs
    const { legs: trafficLegs, warning } = createTrafficLegs(validLocations, tripDate);
    console.log(`🛣️  Analyzing ${trafficLegs.length} route leg(s)`);
    if (warning) {
      console.log(`⚠️ ${warning}`);
    }
    
    // Calculate traffic for each leg
    const trafficResults: TrafficResult[] = [];
    let totalMinutes = 0;
    let totalMinutesNoTraffic = 0;
    let totalDistanceMeters = 0;
    
    for (const leg of trafficLegs) {
      const result = await calculateLegTiming(
        leg.origin,
        leg.destination,
        leg.departureTime,
        leg.leg
      );
      
      trafficResults.push(result);
      totalMinutes += result.minutes;
      totalMinutesNoTraffic += result.minutesNoTraffic;
      totalDistanceMeters += result.distanceMeters;
    }
    
    const totalDistance = `${(totalDistanceMeters / 1000).toFixed(1)} km`;
    const totalTrafficDelay = totalMinutes - totalMinutesNoTraffic;
    
    console.log('\n📊 TRAFFIC PREDICTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`🛣️  Total Distance: ${totalDistance}`);
    console.log(`⏱️  Total Time (no traffic): ${totalMinutesNoTraffic} min`);
    console.log(`🚦 Total Time (with traffic): ${totalMinutes} min`);
    if (totalTrafficDelay > 0) {
      console.log(`⚠️  Total Traffic Delay: +${totalTrafficDelay} min`);
    }
    console.log('='.repeat(60));
    
    return {
      success: true,
      data: trafficResults,
      totalDistance,
      totalMinutes,
      totalMinutesNoTraffic,
      warning,
    };
    
  } catch (error) {
    console.error('❌ Traffic prediction error:', error);
    return {
      success: false,
      data: [],
      totalDistance: '0 km',
      totalMinutes: 0,
      totalMinutesNoTraffic: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
