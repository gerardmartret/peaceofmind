'use client';

import { useState, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number];
  text: string;
  place_type: string[];
}

interface LocationSearchProps {
  onLocationSelect?: (location: { name: string; lat: number; lng: number }) => void;
}

export default function LocationSearch({ onLocationSelect }: LocationSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  const searchLocations = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    try {
      console.log(`🔍 Searching for: ${query}`);
      
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${token}&` +
        `proximity=-0.1278,51.5074&` + // Bias towards London
        `bbox=-0.5103,51.2868,0.3340,51.6918&` + // London bounding box
        `types=poi,address,place,neighborhood,locality&` + // Include POIs and all location types
        `limit=8` // Increased limit for more business results
      );

      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }

      const data = await response.json();
      console.log(`✅ Found ${data.features.length} suggestions`);
      
      // Log POI details
      const poiResults = data.features.filter((f: SearchResult) => f.place_type.includes('poi'));
      if (poiResults.length > 0) {
        console.log(`🏢 Including ${poiResults.length} business/POI result(s)`);
      }
      
      setSuggestions(data.features);
    } catch (error) {
      console.error('❌ Error searching locations:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.length >= 3) {
      searchLocations(query);
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectLocation = (suggestion: SearchResult) => {
    const [lng, lat] = suggestion.center;
    const location = {
      name: suggestion.place_name,
      lat,
      lng,
    };

    console.log(`📍 Selected location: ${location.name}`);
    console.log(`📌 Coordinates: ${lat}, ${lng}`);

    setSelectedLocation(location);
    setSearchQuery(suggestion.text);
    setSuggestions([]);
    setShowMap(true);

    if (onLocationSelect) {
      onLocationSelect(location);
    }

    // Initialize or update map
    setTimeout(() => initializeMap(lat, lng, suggestion.place_name), 100);
  };

  const initializeMap = (lat: number, lng: number, placeName: string) => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    if (map.current) {
      // Update existing map
      map.current.flyTo({
        center: [lng, lat],
        zoom: 14,
        duration: 2000,
      });

      if (marker.current) {
        marker.current.setLngLat([lng, lat]);
      } else {
        marker.current = new mapboxgl.Marker({ color: '#3b82f6' })
          .setLngLat([lng, lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              `<div style="padding: 8px;">
                <h3 style="font-weight: bold; margin: 0 0 5px 0; font-size: 14px;">${placeName}</h3>
                <p style="margin: 0; font-size: 12px; color: #666;">${lat.toFixed(4)}°N, ${Math.abs(lng).toFixed(4)}°${lng < 0 ? 'W' : 'E'}</p>
              </div>`
            )
          )
          .addTo(map.current);
      }
    } else {
      // Create new map
      if (!mapContainer.current) return;

      console.log('🗺️  Creating new map...');

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [lng, lat],
        zoom: 14,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      marker.current = new mapboxgl.Marker({ color: '#3b82f6' })
        .setLngLat([lng, lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div style="padding: 8px;">
              <h3 style="font-weight: bold; margin: 0 0 5px 0; font-size: 14px;">${placeName}</h3>
              <p style="margin: 0; font-size: 12px; color: #666;">${lat.toFixed(4)}°N, ${Math.abs(lng).toFixed(4)}°${lng < 0 ? 'W' : 'E'}</p>
            </div>`
          )
        )
        .addTo(map.current);

      map.current.on('load', () => {
        console.log('✅ Map loaded and location displayed!');
      });
    }
  };

  useEffect(() => {
    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search hotels, restaurants, landmarks, or any location..."
            className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-3 px-4 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
        </div>

        {/* Suggestions Dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-lg shadow-2xl max-h-96 overflow-y-auto">
            {suggestions.map((suggestion) => {
              const isPOI = suggestion.place_type.includes('poi');
              const category = isPOI ? '🏢 Business' : '📍 Location';
              
              return (
                <button
                  key={suggestion.id}
                  onClick={() => handleSelectLocation(suggestion)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        {suggestion.text}
                        {isPOI && (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                            POI
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {suggestion.place_name}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {isPOI ? '🏢' : '📍'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Location Info */}
      {selectedLocation && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-blue-800 dark:text-blue-300">
                📍 Selected Location
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                {selectedLocation.name}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                {selectedLocation.lat.toFixed(4)}°N, {Math.abs(selectedLocation.lng).toFixed(4)}°W
              </p>
            </div>
            <button
              onClick={() => {
                setShowMap(!showMap);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              {showMap ? 'Hide Map' : 'Show Map'}
            </button>
          </div>
        </div>
      )}

      {/* Map Display */}
      {showMap && selectedLocation && (
        <div className="rounded-xl overflow-hidden shadow-2xl border-2 border-gray-200 dark:border-gray-700">
          <div 
            ref={mapContainer} 
            className="w-full h-[500px]"
          />
        </div>
      )}
    </div>
  );
}

