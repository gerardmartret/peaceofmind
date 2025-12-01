import { NextRequest, NextResponse } from 'next/server';
import { requestQuote } from '@/lib/drivania-api';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/**
 * Calculate route distance using Google Maps Directions API (REST)
 * Server-side compatible version
 */
async function calculateRouteDistance(
  locations: Array<{ lat: number; lng: number; name: string }>
): Promise<{ totalDistanceKm: number; totalDurationMinutes: number } | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('⚠️ Google Maps API key not available for route calculation');
    return null;
  }

  if (locations.length < 2) {
    return null;
  }

  try {
    // Build waypoints string (all locations except first and last)
    const waypoints = locations.slice(1, -1).map(loc => `${loc.lat},${loc.lng}`).join('|');
    
    // Origin and destination
    const origin = `${locations[0].lat},${locations[0].lng}`;
    const destination = `${locations[locations.length - 1].lat},${locations[locations.length - 1].lng}`;

    // Build URL
    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.append('origin', origin);
    url.searchParams.append('destination', destination);
    if (waypoints) {
      url.searchParams.append('waypoints', waypoints);
    }
    url.searchParams.append('key', GOOGLE_MAPS_API_KEY);
    url.searchParams.append('departure_time', Math.floor(Date.now() / 1000).toString()); // Current time

    console.log('🗺️ Calculating route distance via Google Maps Directions API...');

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === 'OK' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      let totalDistanceMeters = 0;
      let totalDurationSeconds = 0;

      route.legs.forEach((leg: any) => {
        totalDistanceMeters += leg.distance?.value || 0;
        // Use duration_in_traffic if available, otherwise duration
        totalDurationSeconds += leg.duration_in_traffic?.value || leg.duration?.value || 0;
      });

      const totalDistanceKm = totalDistanceMeters / 1000;
      const totalDurationMinutes = Math.round(totalDurationSeconds / 60);

      console.log(`✅ Route calculated: ${totalDistanceKm.toFixed(2)} km, ${totalDurationMinutes} min`);

      return {
        totalDistanceKm,
        totalDurationMinutes,
      };
    } else {
      console.error(`❌ Google Directions API error: ${data.status}`, data.error_message);
      return null;
    }
  } catch (error) {
    console.error('❌ Error calculating route distance:', error);
    return null;
  }
}

/**
 * Detect location type based on location name
 */
function detectLocationType(locationName: string): 'airport' | 'hotel' | 'train-station' | 'other' {
  if (!locationName) return 'other';
  
  const lowerName = locationName.toLowerCase();
  
  // Airport keywords
  const airportKeywords = [
    'airport', 'aeropuerto', 'aeroport', 'lhr', 'lgw', 'stn', 'ltn', 'jfk', 'lga', 'ewr',
    'heathrow', 'gatwick', 'stansted', 'luton', 'city airport', 'barcelona el prat', 'bcn lebl',
    'madrid barajas', 'cdg', 'ory', 'fco', 'mxp', 'ams', 'schiphol'
  ];
  
  // Hotel keywords
  const hotelKeywords = [
    'hotel', 'hôtel', 'resort', 'inn', 'lodge', 'motel', 'hostel', 'marriott', 'hilton',
    'hyatt', 'sheraton', 'ritz', 'four seasons', 'mandarin', 'peninsula', 'langham'
  ];
  
  // Train station keywords
  const trainKeywords = [
    'station', 'gare', 'estación', 'stazione', 'bahnhof', 'train station', 'railway station',
    'euston', 'paddington', 'kings cross', 'victoria', 'waterloo', 'liverpool street',
    'grand central', 'penn station', 'union station'
  ];
  
  // Check for airport
  if (airportKeywords.some(keyword => lowerName.includes(keyword))) {
    return 'airport';
  }
  
  // Check for hotel
  if (hotelKeywords.some(keyword => lowerName.includes(keyword))) {
    return 'hotel';
  }
  
  // Check for train station
  if (trainKeywords.some(keyword => lowerName.includes(keyword))) {
    return 'train-station';
  }
  
  return 'other';
}

/**
 * Format date and time for Drivania API
 * Combines trip date with location time: "YYYY-MM-DD HH:MM:SS"
 */
function formatDateTime(tripDate: string, time: string | null): string | null {
  if (!tripDate || !time) return null;
  
  // Parse trip date (format: YYYY-MM-DD)
  const date = new Date(tripDate);
  if (isNaN(date.getTime())) return null;
  
  // Parse time (format: HH:MM or HH:MM:SS)
  const timeParts = time.split(':');
  if (timeParts.length < 2) return null;
  
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  
  if (isNaN(hours) || isNaN(minutes)) return null;
  
  // Set time on date
  date.setHours(hours, minutes, 0, 0);
  
  // Format as "YYYY-MM-DD HH:MM:SS"
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const formattedHours = String(hours).padStart(2, '0');
  const formattedMinutes = String(minutes).padStart(2, '0');
  
  return `${year}-${month}-${day} ${formattedHours}:${formattedMinutes}:00`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { locations, tripDate, passengerCount, serviceType } = body;

    // Validate required fields
    if (!locations || !Array.isArray(locations) || locations.length < 2) {
      return NextResponse.json(
        { success: false, error: 'At least 2 locations (pickup and dropoff) are required' },
        { status: 400 }
      );
    }

    if (!tripDate) {
      return NextResponse.json(
        { success: false, error: 'Trip date is required' },
        { status: 400 }
      );
    }

    // Determine service type if not provided
    const finalServiceType: 'one-way' | 'hourly' = serviceType || 
      (locations.length > 2 ? 'hourly' : 'one-way');

    // Extract pickup (first location)
    const pickupLocation = locations[0];
    if (!pickupLocation.name || pickupLocation.lat === undefined || pickupLocation.lng === undefined) {
      return NextResponse.json(
        { success: false, error: 'Pickup location must have name, lat, and lng' },
        { status: 400 }
      );
    }

    // Extract dropoff (last location)
    const dropoffLocation = locations[locations.length - 1];
    if (!dropoffLocation.name || dropoffLocation.lat === undefined || dropoffLocation.lng === undefined) {
      return NextResponse.json(
        { success: false, error: 'Dropoff location must have name, lat, and lng' },
        { status: 400 }
      );
    }

    // For hourly services with intermediate stops, calculate total distance and duration
    let totalRouteDistance: number | null = null;
    let totalRouteDuration: number | null = null;
    let intermediateStopsInfo: string = '';

    if (finalServiceType === 'hourly' && locations.length > 2) {
      console.log('🔄 Calculating route distance and duration including intermediate stops...');
      
      try {
        // Prepare locations for route calculation
        const locationsForRoute = locations.map((loc) => ({
          lat: loc.lat,
          lng: loc.lng,
          name: loc.name,
        }));

        // Calculate route distance using Google Maps Directions API (REST)
        const routeData = await calculateRouteDistance(locationsForRoute);
        
        if (routeData) {
          totalRouteDistance = routeData.totalDistanceKm;
          totalRouteDuration = routeData.totalDurationMinutes;
          
          // Build intermediate stops info string
          const intermediateStops = locations.slice(1, -1);
          if (intermediateStops.length > 0) {
            intermediateStopsInfo = `Intermediate stops (${intermediateStops.length}): ${intermediateStops.map((loc, idx) => `${idx + 1}. ${loc.name}${loc.time ? ` at ${loc.time}` : ''}`).join('; ')}. `;
          }
          
          console.log('✅ Route calculation complete:', {
            totalDistance: `${totalRouteDistance.toFixed(2)} km`,
            totalDuration: `${totalRouteDuration} min`,
            intermediateStops: intermediateStops.length,
          });
        } else {
          console.warn('⚠️ Route calculation returned null - validation will be skipped');
        }
      } catch (error) {
        console.error('⚠️ Error calculating route with intermediate stops:', error);
        // Continue without route calculation - Drivania will calculate based on pickup/dropoff
      }
    }

    // Build quote request - use exact coordinates from database (no rounding)
    const quoteRequest = {
      service_type: finalServiceType,
      pickup: {
        name: pickupLocation.name,
        latitude: Number(pickupLocation.lat), // Ensure it's a number, preserve full precision
        longitude: Number(pickupLocation.lng), // Ensure it's a number, preserve full precision
        location_type: detectLocationType(pickupLocation.name),
        datetime: formatDateTime(tripDate, pickupLocation.time || null),
      },
      dropoff: {
        name: dropoffLocation.name,
        latitude: Number(dropoffLocation.lat), // Ensure it's a number, preserve full precision
        longitude: Number(dropoffLocation.lng), // Ensure it's a number, preserve full precision
        location_type: detectLocationType(dropoffLocation.name),
        datetime: finalServiceType === 'hourly' 
          ? formatDateTime(tripDate, dropoffLocation.time || null)
          : null,
      },
      passengers_number: passengerCount || 1,
    };

    // Log coordinate precision for debugging
    console.log('🔍 Coordinate precision check:', {
      pickup: {
        lat: quoteRequest.pickup.latitude,
        lng: quoteRequest.pickup.longitude,
        latPrecision: quoteRequest.pickup.latitude.toString().split('.')[1]?.length || 0,
        lngPrecision: quoteRequest.pickup.longitude.toString().split('.')[1]?.length || 0,
      },
      dropoff: {
        lat: quoteRequest.dropoff.latitude,
        lng: quoteRequest.dropoff.longitude,
        latPrecision: quoteRequest.dropoff.latitude.toString().split('.')[1]?.length || 0,
        lngPrecision: quoteRequest.dropoff.longitude.toString().split('.')[1]?.length || 0,
      },
    });

    console.log('📋 Requesting Drivania quote with full details:', {
      serviceType: finalServiceType,
      pickup: {
        name: quoteRequest.pickup.name,
        lat: quoteRequest.pickup.latitude,
        lng: quoteRequest.pickup.longitude,
        location_type: quoteRequest.pickup.location_type,
        datetime: quoteRequest.pickup.datetime,
      },
      dropoff: {
        name: quoteRequest.dropoff.name,
        lat: quoteRequest.dropoff.latitude,
        lng: quoteRequest.dropoff.longitude,
        location_type: quoteRequest.dropoff.location_type,
        datetime: quoteRequest.dropoff.datetime,
      },
      passengers: quoteRequest.passengers_number,
      totalRouteDistance: totalRouteDistance ? `${totalRouteDistance} km` : 'N/A (direct route)',
      totalRouteDuration: totalRouteDuration ? `${totalRouteDuration} min` : 'N/A',
      intermediateStops: locations.length > 2 ? locations.length - 2 : 0,
      timestamp: new Date().toISOString(),
      fullRequest: quoteRequest,
    });

    // Log intermediate stops information
    if (intermediateStopsInfo) {
      console.log('📍 Intermediate stops info:', intermediateStopsInfo.trim());
      console.log(`📏 Total route distance (including intermediate stops): ${totalRouteDistance} km`);
      console.log(`⏱️ Total route duration (including intermediate stops): ${totalRouteDuration} min`);
      console.log('💡 Note: Drivania will calculate distance from pickup to dropoff coordinates. The dropoff datetime represents the total service duration.');
    }

    // Call Drivania API
    const quoteResponse = await requestQuote(quoteRequest);

    console.log('✅ Drivania quote received:', {
      serviceId: quoteResponse.service_id,
      vehicleCount: quoteResponse.quotes?.vehicles?.length || 0,
      currency: quoteResponse.currency_code,
      distance: quoteResponse.distance,
      driveTime: quoteResponse.drive_time,
      createdAt: quoteResponse.created_at,
      expiration: quoteResponse.expiration,
      timestamp: new Date().toISOString(),
    });

    // Log a hash of the request to help identify if same request is being sent
    const requestHash = JSON.stringify({
      pickup: `${quoteRequest.pickup.latitude.toFixed(6)},${quoteRequest.pickup.longitude.toFixed(6)}`,
      dropoff: `${quoteRequest.dropoff.latitude.toFixed(6)},${quoteRequest.dropoff.longitude.toFixed(6)}`,
      datetime: quoteRequest.pickup.datetime,
      serviceType: quoteRequest.service_type,
      passengers: quoteRequest.passengers_number,
    });
    console.log('🔑 Request hash (for cache detection):', requestHash.substring(0, 100) + '...');

    return NextResponse.json({
      success: true,
      data: quoteResponse,
      serviceType: finalServiceType,
    });
  } catch (error) {
    console.error('❌ Error requesting Drivania quote:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to request quote from Drivania API';
    
    // Determine appropriate HTTP status code
    let statusCode = 500;
    if (errorMessage.includes('503') || errorMessage.includes('temporarily unavailable')) {
      statusCode = 503;
    } else if (errorMessage.includes('429') || errorMessage.includes('Too many requests')) {
      statusCode = 429;
    } else if (errorMessage.includes('401') || errorMessage.includes('credentials')) {
      statusCode = 401;
    } else if (errorMessage.includes('400') || errorMessage.includes('Invalid request')) {
      statusCode = 400;
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: statusCode }
    );
  }
}

