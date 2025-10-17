/**
 * Google Places API integration for finding nearby emergency services
 * Finds closest police station and hospital
 */

export interface EmergencyService {
  id: string;
  name: string;
  address: string;
  distance: number; // meters from search location
  lat: number;
  lng: number;
  type: 'police' | 'hospital';
}

export interface EmergencyServicesResult {
  location: string;
  coordinates: { lat: number; lng: number };
  policeStation?: EmergencyService;
  hospital?: EmergencyService;
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
  const R = 6371e3; // Earth radius in meters
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
 * Search for nearby emergency services using Google Places API
 */
export async function searchEmergencyServices(
  lat: number,
  lng: number,
  locationName: string
): Promise<EmergencyServicesResult> {
  try {
    console.log(`\n🚨 SEARCHING FOR EMERGENCY SERVICES`);
    console.log('='.repeat(60));
    console.log(`📍 Location: ${locationName}`);
    console.log(`🎯 Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);

    const result: EmergencyServicesResult = {
      location: locationName,
      coordinates: { lat, lng },
    };

    // Search for police station
    const policeStation = await searchNearbyPlace(lat, lng, 'police', locationName);
    if (policeStation) {
      result.policeStation = policeStation;
    }

    // Search for hospital
    const hospital = await searchNearbyPlace(lat, lng, 'hospital', locationName);
    if (hospital) {
      result.hospital = hospital;
    }

    return result;
  } catch (error) {
    console.error('❌ Error searching for emergency services:', error);
    return {
      location: locationName,
      coordinates: { lat, lng },
    };
  }
}

/**
 * Search for a specific type of place
 */
function searchNearbyPlace(
  lat: number,
  lng: number,
  type: 'police' | 'hospital',
  locationName: string
): Promise<EmergencyService | null> {
  return new Promise((resolve) => {
    const service = new google.maps.places.PlacesService(
      document.createElement('div')
    );

    const request: google.maps.places.PlaceSearchRequest = {
      location: new google.maps.LatLng(lat, lng),
      rankBy: google.maps.places.RankBy.DISTANCE, // Sort by distance (closest first)
      type: type,
    };

    service.nearbySearch(request, (results, status) => {
      if (
        status === google.maps.places.PlacesServiceStatus.OK &&
        results &&
        results.length > 0
      ) {
        // Get the closest one
        const place = results[0];
        
        const distance = place.geometry?.location
          ? calculateDistance(
              lat,
              lng,
              place.geometry.location.lat(),
              place.geometry.location.lng()
            )
          : 0;

        const emergencyService: EmergencyService = {
          id: place.place_id || '',
          name: place.name || `Unknown ${type}`,
          address: place.vicinity || '',
          distance: Math.round(distance),
          lat: place.geometry?.location?.lat() || 0,
          lng: place.geometry?.location?.lng() || 0,
          type: type,
        };

        console.log(`✅ Found ${type}: ${emergencyService.name} - ${Math.round(distance)}m away`);
        resolve(emergencyService);
      } else {
        console.log(`⚠️  No ${type} found or search failed: ${status}`);
        resolve(null);
      }
    });
  });
}

