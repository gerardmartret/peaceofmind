'use client';

import { useEffect, useState, useCallback } from 'react';
import { GoogleMap, DirectionsRenderer, Marker, InfoWindow, TrafficLayer } from '@react-google-maps/api';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';

interface TripLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  time: string;
  safetyScore?: number;
}

interface GoogleTripMapProps {
  locations: TripLocation[];
}

const mapContainerStyle = {
  width: '100%',
  height: '384px', // h-96 = 24rem = 384px
};

const defaultCenter = {
  lat: 51.5074,
  lng: -0.1278,
};

export default function GoogleTripMap({ locations }: GoogleTripMapProps) {
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<number | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [showTraffic, setShowTraffic] = useState(true);

  const { isLoaded, loadError } = useGoogleMaps();

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    console.log('🗺️ Google Maps loaded successfully');
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Calculate route when locations change
  useEffect(() => {
    if (!isLoaded || locations.length === 0) return;

    const validLocations = locations.filter(loc => loc.lat !== 0 && loc.lng !== 0 && loc.name);
    
    if (validLocations.length === 0) {
      console.log('⏸️ No valid locations to map');
      return;
    }

    if (validLocations.length === 1) {
      console.log('📍 Single location, no route needed');
      setDirectionsResponse(null);
      return;
    }

    // Calculate route with Google Directions API
    const directionsService = new google.maps.DirectionsService();
    
    const origin = { lat: validLocations[0].lat, lng: validLocations[0].lng };
    const destination = { 
      lat: validLocations[validLocations.length - 1].lat, 
      lng: validLocations[validLocations.length - 1].lng 
    };
    
    const waypoints = validLocations.slice(1, -1).map(loc => ({
      location: { lat: loc.lat, lng: loc.lng },
      stopover: true,
    }));

    console.log(`🚗 Calculating route: ${validLocations.length} locations`);
    console.log(`   Origin: ${validLocations[0].name.split(',')[0]}`);
    console.log(`   Waypoints: ${waypoints.length}`);
    console.log(`   Destination: ${validLocations[validLocations.length - 1].name.split(',')[0]}`);

    directionsService.route(
      {
        origin,
        destination,
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(), // Current time for traffic data
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          console.log('✅ Route calculated successfully');
          
          setDirectionsResponse(result);

          // Calculate total distance and duration
          let totalDistance = 0;
          let totalDuration = 0;

          result.routes[0].legs.forEach(leg => {
            totalDistance += leg.distance?.value || 0;
            // Use duration_in_traffic if available, otherwise use duration
            totalDuration += leg.duration_in_traffic?.value || leg.duration?.value || 0;
          });

          const distanceKm = (totalDistance / 1000).toFixed(1);
          const durationMin = Math.round(totalDuration / 60);

          setRouteInfo({
            distance: `${distanceKm} km`,
            duration: `${durationMin} min`,
          });

          console.log(`   📏 Distance: ${distanceKm} km`);
          console.log(`   ⏱️  Duration (with traffic): ${durationMin} min`);

          // Log if traffic data affected the time
          const normalDuration = result.routes[0].legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);
          const trafficDuration = result.routes[0].legs.reduce((sum, leg) => sum + (leg.duration_in_traffic?.value || leg.duration?.value || 0), 0);
          const trafficDelay = Math.round((trafficDuration - normalDuration) / 60);
          
          if (trafficDelay > 0) {
            console.log(`   🚦 Traffic delay: +${trafficDelay} min`);
          }

        } else {
          console.error('❌ Directions request failed:', status);
          setDirectionsResponse(null);
        }
      }
    );
  }, [isLoaded, locations]);

  const getMarkerColor = (safetyScore?: number): string => {
    if (!safetyScore) return '#3B82F6'; // blue
    if (safetyScore >= 70) return '#10B981'; // green
    if (safetyScore >= 50) return '#F59E0B'; // yellow
    return '#EF4444'; // red
  };

  const getSafetyColor = (score: number): string => {
    if (score >= 70) return '#10B981';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  if (loadError) {
    return (
      <div className="w-full h-96 rounded-xl shadow-lg border-2 border-red-200 dark:border-red-600 bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-4xl mb-3">❌</div>
          <div className="font-bold text-red-800 dark:text-red-300">Failed to load Google Maps</div>
          <div className="text-sm text-red-600 dark:text-red-400 mt-2">
            Check your API key and internet connection
          </div>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-96 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-bounce">🗺️</div>
          <div className="font-bold text-gray-800 dark:text-gray-200">Loading Google Maps...</div>
        </div>
      </div>
    );
  }

  const validLocations = locations.filter(loc => loc.lat !== 0 && loc.lng !== 0 && loc.name);
  const center = validLocations.length > 0 
    ? { lat: validLocations[0].lat, lng: validLocations[0].lng }
    : defaultCenter;

  return (
    <div className="relative">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={13}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        }}
      >
        {/* Traffic Layer */}
        {showTraffic && <TrafficLayer />}

        {/* Show markers only if no route (single location) */}
        {validLocations.length === 1 && validLocations.map((location, index) => (
          <Marker
            key={location.id}
            position={{ lat: location.lat, lng: location.lng }}
            onClick={() => setSelectedMarker(index)}
            label={{
              text: (index + 1).toString(),
              color: 'white',
              fontWeight: 'bold',
            }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 18,
              fillColor: getMarkerColor(location.safetyScore),
              fillOpacity: 1,
              strokeColor: 'white',
              strokeWeight: 3,
            }}
          />
        ))}

        {/* Show InfoWindow for selected marker */}
        {selectedMarker !== null && validLocations[selectedMarker] && (
          <InfoWindow
            position={{
              lat: validLocations[selectedMarker].lat,
              lng: validLocations[selectedMarker].lng,
            }}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div className="p-2">
              <div className="font-bold text-gray-800">
                {selectedMarker + 1}. {validLocations[selectedMarker].name.split(',')[0]}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                🕐 {validLocations[selectedMarker].time}
              </div>
              {validLocations[selectedMarker].safetyScore && (
                <div 
                  className="text-sm font-bold mt-1"
                  style={{ color: getSafetyColor(validLocations[selectedMarker].safetyScore!) }}
                >
                  Safety: {validLocations[selectedMarker].safetyScore}/100
                </div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                {validLocations[selectedMarker].lat.toFixed(4)}, {validLocations[selectedMarker].lng.toFixed(4)}
              </div>
            </div>
          </InfoWindow>
        )}

        {/* Directions Renderer for multi-location routes */}
        {directionsResponse && (
          <DirectionsRenderer
            directions={directionsResponse}
            options={{
              suppressMarkers: false, // Show A, B markers
              polylineOptions: {
                strokeColor: '#3B82F6',
                strokeWeight: 5,
                strokeOpacity: 0.8,
              },
            }}
          />
        )}
      </GoogleMap>

      {/* Route Info Badge */}
      {routeInfo && (
        <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border-2 border-blue-500">
          <div className="flex items-center gap-3 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">📏</span>
              <span className="font-bold text-gray-800 dark:text-gray-200 ml-1">{routeInfo.distance}</span>
            </div>
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">⏱️</span>
              <span className="font-bold text-gray-800 dark:text-gray-200 ml-1">{routeInfo.duration}</span>
            </div>
          </div>
        </div>
      )}

      {/* Traffic Toggle */}
      <div className="absolute top-4 right-4">
        <button
          onClick={() => setShowTraffic(!showTraffic)}
          className={`px-3 py-2 rounded-lg shadow-lg text-sm font-medium transition-all ${
            showTraffic
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-2 border-gray-300 dark:border-gray-600 hover:border-green-500'
          }`}
          title="Toggle traffic layer"
        >
          🚦 Traffic {showTraffic ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Google Maps Indicator */}
      <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg px-3 py-1.5 border border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-blue-600">G</span>
          <span className="text-gray-600 dark:text-gray-400">Google Maps</span>
        </div>
      </div>
    </div>
  );
}

