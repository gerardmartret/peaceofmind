'use client';

import { useState, useRef, useEffect } from 'react';
import { Autocomplete } from '@react-google-maps/api';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import { Input } from '@/components/ui/input';

interface SearchResult {
  name: string;
  lat: number;
  lng: number;
}

interface GoogleLocationSearchProps {
  onLocationSelect?: (location: SearchResult) => void;
  currentLocation?: string;
}

export default function GoogleLocationSearch({ onLocationSelect, currentLocation }: GoogleLocationSearchProps) {
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<SearchResult | null>(null);
  const [inputValue, setInputValue] = useState(currentLocation || '');
  const inputRef = useRef<HTMLInputElement>(null);

  const { isLoaded, loadError } = useGoogleMaps();

  const onLoad = (autocompleteInstance: google.maps.places.Autocomplete) => {
    setAutocomplete(autocompleteInstance);
    console.log('🔍 Google Places Autocomplete loaded');
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
            componentRestrictions: { country: 'gb' }, // UK only
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

