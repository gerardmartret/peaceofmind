'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface TripLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  time: string;
  safetyScore?: number;
}

interface TripMapProps {
  locations: TripLocation[];
}

export default function TripMap({ locations }: TripMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!mapContainer.current || locations.length === 0) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    // Initialize map if not already created
    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [locations[0].lng, locations[0].lat],
        zoom: 12,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      console.log('🗺️ Trip map initialized');
    }

    // Wait for map to load before adding route
    map.current.on('load', async () => {
      if (!map.current) return;

      // Clear existing markers
      markers.current.forEach(marker => marker.remove());
      markers.current = [];

      // Remove existing route layer if it exists
      if (map.current.getLayer('route')) {
        map.current.removeLayer('route');
      }
      if (map.current.getSource('route')) {
        map.current.removeSource('route');
      }

      // Add markers for all locations
      locations.forEach((location, index) => {
        const el = document.createElement('div');
        el.className = 'trip-marker';
        el.style.cssText = `
          background-color: ${getMarkerColor(location.safetyScore)};
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: white;
          font-size: 14px;
          cursor: pointer;
        `;
        el.textContent = (index + 1).toString();

        const marker = new mapboxgl.Marker(el)
          .setLngLat([location.lng, location.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div class="p-2">
                <div class="font-bold text-gray-800">${index + 1}. ${location.name.split(',')[0]}</div>
                <div class="text-sm text-gray-600 mt-1">🕐 ${location.time}</div>
                ${location.safetyScore ? `
                  <div class="text-sm font-bold mt-1" style="color: ${getSafetyColor(location.safetyScore)}">
                    Safety: ${location.safetyScore}/100
                  </div>
                ` : ''}
                <div class="text-xs text-gray-500 mt-1">${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}</div>
              </div>
            `)
          )
          .addTo(map.current!);

        markers.current.push(marker);
      });

      console.log(`✅ Added ${locations.length} marker(s) to map`);

      // Fetch and display driving route if there are 2 or more locations
      if (locations.length >= 2) {
        console.log('🚗 Fetching driving route...');
        
        const coordinates = locations.map(loc => `${loc.lng},${loc.lat}`).join(';');
        const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&access_token=${mapboxgl.accessToken}`;

        try {
          const response = await fetch(directionsUrl);
          const data = await response.json();

          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0].geometry;
            const distance = (data.routes[0].distance / 1000).toFixed(1); // km
            const duration = Math.round(data.routes[0].duration / 60); // minutes

            console.log(`✅ Route found: ${distance} km, ${duration} min`);

            // Add route as a layer
            if (map.current.getSource('route')) {
              (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
                type: 'Feature',
                properties: {},
                geometry: route
              });
            } else {
              map.current.addSource('route', {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: route
                }
              });

              map.current.addLayer({
                id: 'route',
                type: 'line',
                source: 'route',
                layout: {
                  'line-join': 'round',
                  'line-cap': 'round'
                },
                paint: {
                  'line-color': '#3B82F6',
                  'line-width': 4,
                  'line-opacity': 0.75
                }
              });
            }

            // Fit map to show route and all markers
            const bounds = new mapboxgl.LngLatBounds();
            locations.forEach(loc => bounds.extend([loc.lng, loc.lat]));
            map.current.fitBounds(bounds, { padding: 80 });

            console.log('🗺️ Driving route displayed on map');
          }
        } catch (error) {
          console.error('❌ Error fetching route:', error);
        }
      } else {
        // Single location - just center on it
        map.current.flyTo({
          center: [locations[0].lng, locations[0].lat],
          zoom: 14,
        });
      }
    });

    // If map is already loaded, trigger the logic immediately
    if (map.current.isStyleLoaded()) {
      map.current.fire('load');
    }
  }, [locations]);

  const getMarkerColor = (safetyScore?: number) => {
    if (!safetyScore) return '#3B82F6'; // blue
    if (safetyScore >= 70) return '#10B981'; // green
    if (safetyScore >= 50) return '#F59E0B'; // yellow
    return '#EF4444'; // red
  };

  const getSafetyColor = (score: number) => {
    if (score >= 70) return '#10B981';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div 
      ref={mapContainer} 
      className="w-full h-96 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-600"
    />
  );
}

