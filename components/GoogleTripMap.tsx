'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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
  flightNumber?: string;
  flightDirection?: 'arrival' | 'departure';
}

interface GoogleTripMapProps {
  locations: TripLocation[];
  height?: string;
  compact?: boolean;
  tripDestination?: string; // Add trip destination for dynamic center
}

const getMapContainerStyle = (height: string) => {
  const baseStyle = {
    width: '100%',
    borderRadius: '8px',
    display: 'block' as const,
  };

  if (height === '100%') {
    return {
      ...baseStyle,
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      height: '100%',
    };
  }

  return {
    ...baseStyle,
    position: 'relative' as const,
    height: height,
    minHeight: '300px',
  };
};

// City-specific default centers
const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  'London': { lat: 51.5074, lng: -0.1278 },
  'New York': { lat: 40.7128, lng: -74.0060 },
  'Paris': { lat: 48.8566, lng: 2.3522 },
  'Tokyo': { lat: 35.6762, lng: 139.6503 },
  'Dubai': { lat: 25.2048, lng: 55.2708 },
};

const getDefaultCenter = (tripDestination?: string) => {
  return CITY_CENTERS[tripDestination || 'London'] || CITY_CENTERS['London'];
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

export default function GoogleTripMap({ locations, height = '384px', compact = false, tripDestination }: GoogleTripMapProps) {
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<number | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [showTraffic, setShowTraffic] = useState(false);

  const { isLoaded, loadError } = useGoogleMaps();

  // Memoize valid locations to prevent unnecessary recalculations
  const validLocations = useMemo(() =>
    locations.filter(loc => loc.lat !== 0 && loc.lng !== 0 && loc.name),
    [locations]
  );

  // Get city-specific default center
  const defaultCenter = getDefaultCenter(tripDestination);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);

    // Ensure the map is properly sized and visible
    setTimeout(() => {
      if (map) {
        google.maps.event.trigger(map, 'resize');
      }
    }, 100);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Calculate route when locations change
  useEffect(() => {
    if (!isLoaded || locations.length === 0) {
      return;
    }

    const validLocations = locations.filter(loc => loc.lat !== 0 && loc.lng !== 0 && loc.name);

    if (validLocations.length === 0) {
      setDirectionsResponse(null);
      setRouteInfo(null);
      return;
    }

    if (validLocations.length === 1) {
      setDirectionsResponse(null);
      setRouteInfo(null);
      return;
    }

    // Add a small delay to ensure the map is fully loaded
    const calculateRoute = () => {
      if (!window.google || !window.google.maps) {
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


            // Log if traffic data affected the time
            const normalDuration = result.routes[0].legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);
            const trafficDuration = result.routes[0].legs.reduce((sum, leg) => sum + (leg.duration_in_traffic?.value || leg.duration?.value || 0), 0);
            const trafficDelay = Math.round((trafficDuration - normalDuration) / 60);

            if (trafficDelay > 0) {
            }

          } else {
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
    if (validLocations.length === 0) {
      return defaultCenter;
    }
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
    <div className={height === '100%' ? 'relative w-full h-full' : 'relative w-full'} style={height !== '100%' ? { height } : undefined}>
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
            icon={{
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 2C12.26 2 6 8.26 6 16c0 10 14 24 14 24s14-14 14-24c0-7.74-6.26-14-14-14z" 
                        fill="#05060A" 
                        stroke="white" 
                        stroke-width="2"/>
                  <text x="20" y="22" 
                        text-anchor="middle" 
                        font-family="Arial, sans-serif" 
                        font-size="12" 
                        font-weight="bold" 
                        fill="white">${numberToLetter(index + 1)}</text>
                </svg>
              `)}`,
              scaledSize: new google.maps.Size(40, 50),
              anchor: new google.maps.Point(20, 50),
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
              {validLocations[selectedMarker].flightNumber && (
                <div className="text-sm text-blue-600 mt-1 flex items-center gap-1">
                  ✈️ {validLocations[selectedMarker].flightNumber}
                  {validLocations[selectedMarker].flightDirection && (
                    <span className="text-xs text-gray-500">
                      ({validLocations[selectedMarker].flightDirection === 'arrival' ? 'Arrival' : 'Departure'})
                    </span>
                  )}
                </div>
              )}
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
              suppressMarkers: true, // Hide Google's default red markers
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

