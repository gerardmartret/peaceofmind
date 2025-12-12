'use client';

import { useState, useRef, useEffect } from 'react';
import { Autocomplete } from '@react-google-maps/api';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import { Input } from '@/components/ui/input';
import { getCityConfig } from '@/lib/city-helpers';

interface SearchResult {
  name: string;
  formattedAddress?: string; // Full formatted address from Google Places
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
  if (cityConfig.isLondon || ['Glasgow', 'Manchester'].includes(tripDestination || '')) {
    countryCode = 'gb';
  } else if (['Amsterdam'].includes(tripDestination || '')) {
    countryCode = 'nl';
  } else if (['Athens'].includes(tripDestination || '')) {
    countryCode = 'gr';
  } else if (['Barcelona', 'Madrid', 'Malaga'].includes(tripDestination || '')) {
    countryCode = 'es';
  } else if (['Brussels'].includes(tripDestination || '')) {
    countryCode = 'be';
  } else if (['Copenhagen'].includes(tripDestination || '')) {
    countryCode = 'dk';
  } else if (['Dublin'].includes(tripDestination || '')) {
    countryCode = 'ie';
  } else if (['Florence', 'Milan', 'Rome'].includes(tripDestination || '')) {
    countryCode = 'it';
  } else if (['Frankfurt', 'Hamburg', 'Munich'].includes(tripDestination || '')) {
    countryCode = 'de';
  } else if (['Geneva', 'Zurich'].includes(tripDestination || '')) {
    countryCode = 'ch';
  } else if (['Lisbon'].includes(tripDestination || '')) {
    countryCode = 'pt';
  } else if (['Lyon', 'Marseille', 'Nice', 'Paris'].includes(tripDestination || '')) {
    countryCode = 'fr';
  } else if (['Montreal', 'Toronto'].includes(tripDestination || '')) {
    countryCode = 'ca';
  } else if (['Vienna'].includes(tripDestination || '')) {
    countryCode = 'at';
  } else if (tripDestination === 'Singapore') {
    countryCode = 'sg';
  } else if (tripDestination === 'Tokyo') {
    countryCode = 'jp';
  } else if (['Cancun', 'Mexico City'].includes(tripDestination || '')) {
    countryCode = 'mx';
  } else if (['Buenos Aires'].includes(tripDestination || '')) {
    countryCode = 'ar';
  } else if (['Santiago de Chile'].includes(tripDestination || '')) {
    countryCode = 'cl';
  } else if (['Sao Paulo'].includes(tripDestination || '')) {
    countryCode = 'br';
  }
  
  // City-specific location bounds (prioritizes metro area while allowing broader searches)
  const getLocationBounds = () => {
    if (tripDestination === 'New York') {
      // NYC metro area bounds: covers Manhattan, Bronx, Queens, Brooklyn, Staten Island, Yonkers, Jersey City, Newark, Long Island
      return new google.maps.LatLngBounds(
        new google.maps.LatLng(40.4774, -74.2591), // Southwest
        new google.maps.LatLng(40.9176, -73.7004)  // Northeast
      );
    } else if (cityConfig.isLondon || ['Glasgow', 'Manchester'].includes(tripDestination || '')) {
      // UK cities: Greater London bounds or city-specific bounds
      if (tripDestination === 'Glasgow') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(55.8, -4.4),
          new google.maps.LatLng(55.9, -4.1)
        );
      } else if (tripDestination === 'Manchester') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(53.4, -2.4),
          new google.maps.LatLng(53.6, -2.1)
        );
      } else {
        // Greater London
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(51.2868, -0.5103),
          new google.maps.LatLng(51.6918, 0.3340)
        );
      }
    } else if (tripDestination === 'Singapore') {
      return new google.maps.LatLngBounds(
        new google.maps.LatLng(1.15, 103.6),
        new google.maps.LatLng(1.47, 104.0)
      );
    } else if (['Frankfurt', 'Hamburg', 'Munich'].includes(tripDestination || '')) {
      // German cities - use city-specific bounds
      if (tripDestination === 'Frankfurt') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(49.6, 8.0),
          new google.maps.LatLng(50.6, 9.2)
        );
      } else if (tripDestination === 'Hamburg') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(53.4, 9.8),
          new google.maps.LatLng(53.7, 10.2)
        );
      } else if (tripDestination === 'Munich') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(48.0, 11.3),
          new google.maps.LatLng(48.3, 11.7)
        );
      }
    } else if (['Paris', 'Lyon', 'Marseille', 'Nice'].includes(tripDestination || '')) {
      // French cities
      if (tripDestination === 'Paris') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(48.3, 1.8),
          new google.maps.LatLng(49.4, 2.8)
        );
      } else if (tripDestination === 'Lyon') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(45.6, 4.7),
          new google.maps.LatLng(45.9, 5.0)
        );
      } else if (tripDestination === 'Marseille') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(43.1, 5.2),
          new google.maps.LatLng(43.5, 5.6)
        );
      } else if (tripDestination === 'Nice') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(43.6, 7.1),
          new google.maps.LatLng(43.8, 7.4)
        );
      }
    } else if (['Barcelona', 'Madrid', 'Malaga'].includes(tripDestination || '')) {
      // Spanish cities
      if (tripDestination === 'Barcelona') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(41.2, 2.0),
          new google.maps.LatLng(41.5, 2.3)
        );
      } else if (tripDestination === 'Madrid') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(40.3, -3.8),
          new google.maps.LatLng(40.6, -3.6)
        );
      } else if (tripDestination === 'Malaga') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(36.6, -4.6),
          new google.maps.LatLng(36.8, -4.3)
        );
      }
    } else if (['Milan', 'Rome', 'Florence'].includes(tripDestination || '')) {
      // Italian cities
      if (tripDestination === 'Milan') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(45.3, 9.0),
          new google.maps.LatLng(45.6, 9.3)
        );
      } else if (tripDestination === 'Rome') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(41.7, 12.3),
          new google.maps.LatLng(42.1, 12.7)
        );
      } else if (tripDestination === 'Florence') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(43.7, 11.1),
          new google.maps.LatLng(43.8, 11.4)
        );
      }
    } else if (tripDestination === 'Tokyo') {
      return new google.maps.LatLngBounds(
        new google.maps.LatLng(35.0, 139.0),
        new google.maps.LatLng(36.2, 140.2)
      );
    } else if (tripDestination === 'Boston') {
      return new google.maps.LatLngBounds(
        new google.maps.LatLng(41.8, -71.6),
        new google.maps.LatLng(42.9, -70.4)
      );
    } else if (['Zurich', 'Geneva'].includes(tripDestination || '')) {
      // Swiss cities
      if (tripDestination === 'Zurich') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(46.9, 8.0),
          new google.maps.LatLng(47.8, 9.0)
        );
      } else if (tripDestination === 'Geneva') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(46.1, 6.0),
          new google.maps.LatLng(46.3, 6.3)
        );
      }
    } else if (['Los Angeles', 'San Francisco', 'San Diego', 'San Jose'].includes(tripDestination || '')) {
      // California cities
      if (tripDestination === 'Los Angeles') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(33.7, -118.7),
          new google.maps.LatLng(34.4, -118.0)
        );
      } else if (tripDestination === 'San Francisco') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(37.6, -122.6),
          new google.maps.LatLng(37.9, -122.3)
        );
      } else if (tripDestination === 'San Diego') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(32.5, -117.3),
          new google.maps.LatLng(33.0, -116.9)
        );
      } else if (tripDestination === 'San Jose') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(37.2, -122.1),
          new google.maps.LatLng(37.5, -121.7)
        );
      }
    } else if (['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'West Palm Beach'].includes(tripDestination || '')) {
      // Florida cities
      if (tripDestination === 'Miami') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(25.7, -80.4),
          new google.maps.LatLng(25.9, -80.1)
        );
      } else if (tripDestination === 'Orlando') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(28.3, -81.6),
          new google.maps.LatLng(28.8, -81.0)
        );
      } else if (tripDestination === 'Tampa') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(27.8, -82.6),
          new google.maps.LatLng(28.1, -82.3)
        );
      } else if (tripDestination === 'Jacksonville') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(30.2, -81.8),
          new google.maps.LatLng(30.5, -81.5)
        );
      } else if (tripDestination === 'West Palm Beach') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(26.6, -80.2),
          new google.maps.LatLng(26.8, -80.0)
        );
      }
    } else if (['Chicago', 'Dallas', 'Houston', 'Atlanta', 'Seattle', 'Phoenix', 'Denver', 'Washington'].includes(tripDestination || '')) {
      // Other major US cities - use reasonable metro bounds
      if (tripDestination === 'Chicago') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(41.6, -88.0),
          new google.maps.LatLng(42.1, -87.4)
        );
      } else if (tripDestination === 'Dallas') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(32.6, -97.1),
          new google.maps.LatLng(33.0, -96.5)
        );
      } else if (tripDestination === 'Houston') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(29.5, -95.8),
          new google.maps.LatLng(30.0, -95.0)
        );
      } else if (tripDestination === 'Atlanta') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(33.6, -84.6),
          new google.maps.LatLng(33.9, -84.2)
        );
      } else if (tripDestination === 'Seattle') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(47.4, -122.5),
          new google.maps.LatLng(47.8, -122.1)
        );
      } else if (tripDestination === 'Phoenix') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(33.2, -112.3),
          new google.maps.LatLng(33.7, -111.8)
        );
      } else if (tripDestination === 'Denver') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(39.6, -105.2),
          new google.maps.LatLng(39.9, -104.8)
        );
      } else if (tripDestination === 'Washington') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(38.7, -77.2),
          new google.maps.LatLng(39.1, -76.8)
        );
      }
    } else if (['Montreal', 'Toronto'].includes(tripDestination || '')) {
      // Canadian cities
      if (tripDestination === 'Montreal') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(45.4, -73.8),
          new google.maps.LatLng(45.6, -73.4)
        );
      } else if (tripDestination === 'Toronto') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(43.5, -79.6),
          new google.maps.LatLng(43.8, -79.2)
        );
      }
    } else if (['Amsterdam', 'Brussels', 'Vienna', 'Copenhagen', 'Dublin', 'Lisbon', 'Athens'].includes(tripDestination || '')) {
      // Other European cities - use reasonable city bounds
      if (tripDestination === 'Amsterdam') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(52.3, 4.7),
          new google.maps.LatLng(52.4, 5.1)
        );
      } else if (tripDestination === 'Brussels') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(50.7, 4.2),
          new google.maps.LatLng(50.9, 4.5)
        );
      } else if (tripDestination === 'Vienna') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(48.1, 16.2),
          new google.maps.LatLng(48.3, 16.5)
        );
      } else if (tripDestination === 'Copenhagen') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(55.6, 12.4),
          new google.maps.LatLng(55.8, 12.7)
        );
      } else if (tripDestination === 'Dublin') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(53.2, -6.4),
          new google.maps.LatLng(53.5, -6.1)
        );
      } else if (tripDestination === 'Lisbon') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(38.6, -9.3),
          new google.maps.LatLng(38.8, -9.0)
        );
      } else if (tripDestination === 'Athens') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(37.9, 23.6),
          new google.maps.LatLng(38.1, 23.9)
        );
      }
    } else if (['Mexico City', 'Cancun'].includes(tripDestination || '')) {
      // Mexican cities
      if (tripDestination === 'Mexico City') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(19.2, -99.3),
          new google.maps.LatLng(19.6, -98.9)
        );
      } else if (tripDestination === 'Cancun') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(21.0, -87.0),
          new google.maps.LatLng(21.3, -86.7)
        );
      }
    } else if (['Buenos Aires', 'Santiago de Chile', 'Sao Paulo'].includes(tripDestination || '')) {
      // South American cities
      if (tripDestination === 'Buenos Aires') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(-34.7, -58.6),
          new google.maps.LatLng(-34.5, -58.3)
        );
      } else if (tripDestination === 'Santiago de Chile') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(-33.6, -70.8),
          new google.maps.LatLng(-33.3, -70.5)
        );
      } else if (tripDestination === 'Sao Paulo') {
        return new google.maps.LatLngBounds(
          new google.maps.LatLng(-23.7, -46.8),
          new google.maps.LatLng(-23.4, -46.5)
        );
      }
    }
    return undefined; // No bounds for other cities
  };

  const onLoad = (autocompleteInstance: google.maps.places.Autocomplete) => {
    setAutocomplete(autocompleteInstance);
    const bounds = getLocationBounds();
    if (bounds) {
      autocompleteInstance.setBounds(bounds);
    } else {
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
        formattedAddress: place.formatted_address || undefined, // Return formatted address separately
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      };

      
      // Log place types for debugging
      if (place.types) {
        const isPOI = place.types.some(type => 
          ['point_of_interest', 'establishment', 'restaurant', 'cafe', 'store'].includes(type)
        );
        if (isPOI) {
        }
      }

      // Log additional place details if available
      if (place.rating) {
      }
      if (place.business_status) {
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

