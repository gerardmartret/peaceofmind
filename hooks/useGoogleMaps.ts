import { useJsApiLoader } from '@react-google-maps/api';

// Define libraries once - used by all components
const libraries: ("places" | "geometry")[] = ["places", "geometry"];

// Shared Google Maps loader hook
// This ensures the Google Maps script is loaded only once with consistent options
export function useGoogleMaps() {
  return useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '',
    libraries,
  });
}

