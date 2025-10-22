'use client';

import { useEffect, useState, useCallback } from 'react';
import { GoogleMap, DirectionsRenderer, Marker, InfoWindow, TrafficLayer } from '@react-google-maps/api';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';

// Helper function to convert numbers to letters (1 -> A, 2 -> B, etc.)
const numberToLetter = (num: number): string => {
  return String.fromCharCode(64 + num); // 65 is 'A' in ASCII
};

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
  height?: string;
  compact?: boolean;
}

const getMapContainerStyle = (height: string) => ({
  width: '100%',
  height: height,
  minHeight: '300px', // Ensure minimum height
  borderRadius: '8px', // Add some styling
  display: 'block',
});

const defaultCenter = {
  lat: 51.5074,
  lng: -0.1278,
};

// Corporate monochrome map style matching your brand colors
const corporateMapStyle = [
  {
    featureType: "all",
    elementType: "geometry.fill",
    stylers: [{ color: "#FBFAF9" }] // Your light background color
  },
  {
    featureType: "water",
    elementType: "geometry.fill",
    stylers: [{ color: "#E5E7EF" }] // Your secondary color
  },
  {
    featureType: "landscape",
    elementType: "geometry.fill",
    stylers: [{ color: "#FBFAF9" }] // Your light background
  },
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#E5E7EF" }] // Your secondary color
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#05060A" }] // Your dark foreground
  },
  {
    featureType: "road.highway",
    elementType: "geometry.fill",
    stylers: [{ color: "#E5E7EF" }] // Your secondary color
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#05060A", weight: 2 }] // Your dark foreground
  },
  {
    featureType: "poi",
    elementType: "geometry.fill",
    stylers: [{ color: "#E5E7EF" }] // Your secondary color
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#05060A" }] // Your dark foreground
  },
  {
    featureType: "poi",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#FBFAF9" }] // Your light background
  },
  {
    featureType: "transit",
    elementType: "geometry.fill",
    stylers: [{ color: "#E5E7EF" }] // Your secondary color
  },
  {
    featureType: "administrative",
    elementType: "geometry.fill",
    stylers: [{ color: "#FBFAF9" }] // Your light background
  },
  {
    featureType: "administrative",
    elementType: "labels.text.fill",
    stylers: [{ color: "#05060A" }] // Your dark foreground
  },
  {
    featureType: "administrative",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#FBFAF9" }] // Your light background
  }
];

export default function GoogleTripMap({ locations, height = '384px', compact = false }: GoogleTripMapProps) {
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<number | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [showTraffic, setShowTraffic] = useState(false);

  const { isLoaded, loadError } = useGoogleMaps();

  // Calculate valid locations at the top level
  const validLocations = locations.filter(loc => loc.lat !== 0 && loc.lng !== 0 && loc.name);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    console.log('🗺️ Google Maps loaded successfully');
    
    // Ensure the map is properly sized and visible
    setTimeout(() => {
      if (map) {
        google.maps.event.trigger(map, 'resize');
        console.log('🗺️ Map resized and ready');
      }
    }, 100);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Calculate route when locations change
  useEffect(() => {
    if (!isLoaded || locations.length === 0) {
      console.log('⏸️ Google Maps not loaded or no locations');
      return;
    }

    const validLocations = locations.filter(loc => loc.lat !== 0 && loc.lng !== 0 && loc.name);
    
    if (validLocations.length === 0) {
      console.log('⏸️ No valid locations to map');
      setDirectionsResponse(null);
      setRouteInfo(null);
      return;
    }

    if (validLocations.length === 1) {
      console.log('📍 Single location, no route needed');
      setDirectionsResponse(null);
      setRouteInfo(null);
      return;
    }

    // Add a small delay to ensure the map is fully loaded
    const calculateRoute = () => {
      if (!window.google || !window.google.maps) {
        console.error('❌ Google Maps API not available');
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
      console.log(`   Origin (${numberToLetter(1)}): ${validLocations[0].name.split(',')[0]}`);
      console.log(`   Waypoints: ${waypoints.length}`);
      console.log(`   Destination (${numberToLetter(validLocations.length)}): ${validLocations[validLocations.length - 1].name.split(',')[0]}`);

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
            setRouteInfo(null);
          }
        }
      );
    };

    // Add a small delay to ensure the map is fully rendered
    const timeoutId = setTimeout(calculateRoute, 500);
    
    return () => clearTimeout(timeoutId);
  }, [isLoaded, locations]);

  // Fit map bounds when directions are calculated
  useEffect(() => {
    if (directionsResponse && map && validLocations.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      validLocations.forEach(location => {
        bounds.extend(new google.maps.LatLng(location.lat, location.lng));
      });
      map.fitBounds(bounds, { 
        top: 50, 
        right: 50, 
        bottom: 50, 
        left: 50 
      });
      console.log('🗺️ Map bounds fitted to show all locations');
    }
  }, [directionsResponse, map, validLocations]);

  // Also fit bounds when map loads with valid locations
  useEffect(() => {
    if (map && validLocations.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      validLocations.forEach(location => {
        bounds.extend(new google.maps.LatLng(location.lat, location.lng));
      });
      map.fitBounds(bounds, { 
        top: 50, 
        right: 50, 
        bottom: 50, 
        left: 50 
      });
      console.log('🗺️ Map bounds fitted to show all locations on load');
    }
  }, [map, validLocations]);

  const getMarkerColor = (safetyScore?: number): string => {
    return '#05060A'; // Custom dark color for all markers
  };

  const getSafetyColor = (score: number): string => {
    return '#05060A'; // Custom dark color for all safety scores
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

  // Calculate center point to show all locations
  const calculateCenter = () => {
    if (validLocations.length === 0) return defaultCenter;
    if (validLocations.length === 1) {
      return { lat: validLocations[0].lat, lng: validLocations[0].lng };
    }
    
    // Calculate center of all locations
    const avgLat = validLocations.reduce((sum, loc) => sum + loc.lat, 0) / validLocations.length;
    const avgLng = validLocations.reduce((sum, loc) => sum + loc.lng, 0) / validLocations.length;
    return { lat: avgLat, lng: avgLng };
  };
  
  const center = calculateCenter();

  return (
    <div className="relative w-full h-full" style={{ width: '100%', height: '100%' }}>
      <GoogleMap
        mapContainerStyle={getMapContainerStyle(height)}
        center={center}
        zoom={compact ? 10 : 13}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          zoomControl: !compact,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: !compact,
          styles: corporateMapStyle, // Apply corporate monochrome styling
        }}
      >
        {/* Traffic Layer */}
        {showTraffic && <TrafficLayer />}

        {/* Show markers for all locations */}
        {validLocations.map((location, index) => (
          <Marker
            key={location.id}
            position={{ lat: location.lat, lng: location.lng }}
            onClick={() => setSelectedMarker(index)}
            label={{
              text: numberToLetter(index + 1),
              color: 'white',
              fontWeight: 'bold',
            }}
            icon={{
              path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
              scale: 1.5,
              fillColor: getMarkerColor(location.safetyScore),
              fillOpacity: 1,
              strokeColor: 'white',
              strokeWeight: 2,
              anchor: new google.maps.Point(12, 22),
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
                {numberToLetter(selectedMarker + 1)}. {validLocations[selectedMarker].name.split(',')[0]}
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
                strokeColor: '#18815A', // Your success/ring color
                strokeWeight: 5,
                strokeOpacity: 0.8,
              },
            }}
          />
        )}
      </GoogleMap>

      {/* Route Info Badge */}
      {routeInfo && !compact && (
        <div className="absolute top-4 left-4 bg-card border border-border rounded-lg shadow-lg p-3">
          <div className="flex items-center gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">📏</span>
              <span className="font-bold text-card-foreground ml-1">{routeInfo.distance}</span>
            </div>
            <div className="w-px h-4 bg-border"></div>
            <div>
              <span className="text-muted-foreground">⏱️</span>
              <span className="font-bold text-card-foreground ml-1">{routeInfo.duration}</span>
            </div>
          </div>
        </div>
      )}

      {/* Google Maps Indicator */}
      {!compact && (
        <div className="absolute bottom-4 left-4 bg-card border border-border rounded-lg shadow-lg px-3 py-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-primary">G</span>
            <span className="text-muted-foreground">Google Maps</span>
          </div>
        </div>
      )}
    </div>
  );
}

