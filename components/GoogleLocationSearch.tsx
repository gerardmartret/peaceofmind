'use client';

import { useState, useRef, useEffect } from 'react';
import { Autocomplete } from '@react-google-maps/api';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import { Input } from '@/components/ui/input';
import { getCityConfig } from '@/lib/city-helpers';

interface SearchResult {
  name: string;
  lat: number;
  lng: number;
}

interface GoogleLocationSearchProps {
  onLocationSelect?: (location: SearchResult) => void;
  currentLocation?: string;
  tripDestination?: string; // Add trip destination prop for city-aware search
}

export default function GoogleLocationSearch({ onLocationSelect, currentLocation, tripDestination }: GoogleLocationSearchProps) {
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<SearchResult | null>(null);
  const [inputValue, setInputValue] = useState(currentLocation || '');
  const inputRef = useRef<HTMLInputElement>(null);

  const { isLoaded, loadError } = useGoogleMaps();
  
  // Get city configuration for location bias
  const cityConfig = getCityConfig(tripDestination);
  // Determine country code based on trip destination
  let countryCode = 'us'; // Default to US
  if (cityConfig.isLondon) {
    countryCode = 'gb';
  } else if (tripDestination === 'Singapore') {
    countryCode = 'sg';
  } else if (tripDestination === 'Frankfurt') {
    countryCode = 'de';
  } else if (tripDestination === 'Paris') {
    countryCode = 'fr';
  } else if (tripDestination === 'Tokyo') {
    countryCode = 'jp';
  } else if (tripDestination === 'Boston') {
    countryCode = 'us';
  } else if (tripDestination === 'Zurich') {
    countryCode = 'ch';
  }
  
  // City-specific location bounds (prioritizes metro area while allowing broader searches)
  const getLocationBounds = () => {
    if (tripDestination === 'New York') {
      // NYC metro area bounds: covers Manhattan, Bronx, Queens, Brooklyn, Staten Island, Yonkers, Jersey City, Newark, Long Island
      // Southwest corner to Northeast corner (~50km coverage)
      return new google.maps.LatLngBounds(
        new google.maps.LatLng(40.4774, -74.2591), // Southwest (Staten Island)
        new google.maps.LatLng(40.9176, -73.7004)  // Northeast (Yonkers/Long Island)
      );
    } else if (cityConfig.isLondon) {
      // Greater London bounds: covers all 32 boroughs
      // Southwest corner to Northeast corner (~30km coverage)
      return new google.maps.LatLngBounds(
        new google.maps.LatLng(51.2868, -0.5103), // Southwest
        new google.maps.LatLng(51.6918, 0.3340)   // Northeast
      );
    } else if (tripDestination === 'Singapore') {
      // Singapore island bounds with buffer: covers Singapore island and surrounding areas
      // Southwest corner to Northeast corner (~50km coverage)
      return new google.maps.LatLngBounds(
        new google.maps.LatLng(1.15, 103.6),  // Southwest
        new google.maps.LatLng(1.47, 104.0)    // Northeast
      );
    } else if (tripDestination === 'Frankfurt') {
      // Frankfurt bounds with generous buffer for day trips: covers Frankfurt and surrounding areas
      // Southwest corner to Northeast corner (~80-100km coverage)
      return new google.maps.LatLngBounds(
        new google.maps.LatLng(49.6, 8.0),   // Southwest
        new google.maps.LatLng(50.6, 9.2)    // Northeast
      );
    } else if (tripDestination === 'Paris') {
      // Paris bounds with generous buffer for day trips: covers Paris and surrounding areas
      // Southwest corner to Northeast corner (~80-100km coverage)
      return new google.maps.LatLngBounds(
        new google.maps.LatLng(48.3, 1.8),   // Southwest
        new google.maps.LatLng(49.4, 2.8)    // Northeast
      );
    } else if (tripDestination === 'Tokyo') {
      // Tokyo bounds with generous buffer for day trips: covers Tokyo and surrounding areas
      // Southwest corner to Northeast corner (~80-100km coverage)
      return new google.maps.LatLngBounds(
        new google.maps.LatLng(35.0, 139.0), // Southwest
        new google.maps.LatLng(36.2, 140.2)  // Northeast
      );
    } else if (tripDestination === 'Boston') {
      // Boston bounds with generous buffer for day trips: covers Boston and surrounding areas
      // Southwest corner to Northeast corner (~80-100km coverage)
      return new google.maps.LatLngBounds(
        new google.maps.LatLng(41.8, -71.6), // Southwest
        new google.maps.LatLng(42.9, -70.4)  // Northeast
      );
    } else if (tripDestination === 'Zurich') {
      // Zurich bounds with generous buffer for day trips: covers Zurich and surrounding areas
      // Southwest corner to Northeast corner (~80-100km coverage)
      return new google.maps.LatLngBounds(
        new google.maps.LatLng(46.9, 8.0),    // Southwest
        new google.maps.LatLng(47.8, 9.0)     // Northeast
      );
    }
    return undefined; // No bounds for other cities
  };

  const onLoad = (autocompleteInstance: google.maps.places.Autocomplete) => {
    setAutocomplete(autocompleteInstance);
    const bounds = getLocationBounds();
    if (bounds) {
      autocompleteInstance.setBounds(bounds);
      console.log(`🔍 Google Places Autocomplete loaded for ${cityConfig.cityName} (country: ${countryCode}, with metro area bounds)`);
    } else {
      console.log(`🔍 Google Places Autocomplete loaded for ${cityConfig.cityName} (country: ${countryCode})`);
    }
  };

  // Sync input value with currentLocation prop changes
  useEffect(() => {
    if (currentLocation !== undefined) {
      setInputValue(currentLocation);
    }
  }, [currentLocation]);

  const onPlaceChanged = () => {
    if (autocomplete) {
      const place = autocomplete.getPlace();
      
      if (!place.geometry || !place.geometry.location) {
        console.log('⚠️ No geometry available for this place');
        return;
      }

      // Create a display name that includes both business name and address
      let displayName = '';
      if (place.name && place.formatted_address) {
        // If we have both name and address, show "Name, Address"
        displayName = `${place.name}, ${place.formatted_address}`;
      } else if (place.name) {
        // If we only have the name
        displayName = place.name;
      } else if (place.formatted_address) {
        // If we only have the address
        displayName = place.formatted_address;
      } else {
        displayName = 'Unknown location';
      }

      const location: SearchResult = {
        name: displayName,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      };

      console.log('📍 Selected:', location.name);
      console.log('   Coordinates:', location.lat, location.lng);
      
      // Log place types for debugging
      if (place.types) {
        const isPOI = place.types.some(type => 
          ['point_of_interest', 'establishment', 'restaurant', 'cafe', 'store'].includes(type)
        );
        console.log('   Types:', place.types.join(', '));
        if (isPOI) {
          console.log('   🏢 Business/POI detected');
        }
      }

      // Log additional place details if available
      if (place.rating) {
        console.log('   ⭐ Rating:', place.rating);
      }
      if (place.business_status) {
        console.log('   Status:', place.business_status);
      }

      // Update the input value with the selected location
      setInputValue(displayName);
      setSelectedLocation(location);

      if (onLocationSelect) {
        onLocationSelect(location);
      }
    }
  };

  if (loadError) {
    return (
      <div className="w-full p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg">
        <div className="text-red-800 dark:text-red-300 font-semibold">
          ❌ Failed to load Google Places
        </div>
        <div className="text-sm text-red-600 dark:text-red-400 mt-1">
          Check your API key configuration
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="relative">
        <Input
          type="text"
          disabled
          placeholder="Loading Google Places..."
          className="w-full pr-10 h-9 bg-white"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <svg className="animate-spin h-5 w-5 text-gray-400" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Input with Autocomplete */}
      <div className="relative">
        <Autocomplete
          onLoad={onLoad}
          onPlaceChanged={onPlaceChanged}
          options={{
            types: ['establishment', 'geocode'], // Include businesses and addresses
            componentRestrictions: { country: countryCode }, // Dynamic country based on trip destination
            // Note: bounds are set via setBounds() in onLoad (not in options)
            fields: [
              'formatted_address',
              'name',
              'geometry',
              'place_id',
              'types',
              'rating',
              'business_status',
              'opening_hours'
            ],
          }}
        >
          <Input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search hotels, restaurants, landmarks, or any location..."
            className="w-full pr-10 h-9 bg-white"
          />
        </Autocomplete>
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>


    </div>
  );
}

