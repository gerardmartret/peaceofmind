'use client';

import { useEffect, useState } from 'react';

export default function TestGoogleMaps() {
  const [status, setStatus] = useState<{
    apiKeyFound: boolean;
    apiKeyValue: string;
    scriptLoaded: boolean;
    mapLoaded: boolean;
    error: string | null;
  }>({
    apiKeyFound: false,
    apiKeyValue: '',
    scriptLoaded: false,
    mapLoaded: false,
    error: null,
  });

  useEffect(() => {
    // Check for API key in environment
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;
    
    console.log('🔍 Checking Google Maps API key...');
    console.log('NEXT_PUBLIC_GOOGLE_API_KEY:', process.env.NEXT_PUBLIC_GOOGLE_API_KEY);
    console.log('GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY);
    
    if (!apiKey) {
      setStatus(prev => ({
        ...prev,
        apiKeyFound: false,
        error: 'API key not found. Make sure NEXT_PUBLIC_GOOGLE_API_KEY is set in .env.local',
      }));
      return;
    }

    setStatus(prev => ({
      ...prev,
      apiKeyFound: true,
      apiKeyValue: `${apiKey.substring(0, 20)}...`,
    }));

    // Load Google Maps JavaScript API
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log('✅ Google Maps script loaded successfully');
      setStatus(prev => ({ ...prev, scriptLoaded: true }));

      // Initialize a test map
      try {
        const mapDiv = document.getElementById('test-map');
        if (!mapDiv) {
          throw new Error('Map div not found');
        }

        const map = new google.maps.Map(mapDiv, {
          center: { lat: 51.5074, lng: -0.1278 }, // London
          zoom: 13,
          mapId: 'test-map-id',
        });

        // Add a test marker
        new google.maps.Marker({
          position: { lat: 51.5074, lng: -0.1278 },
          map: map,
          title: 'Test Location - London',
        });

        console.log('✅ Google Maps initialized successfully');
        setStatus(prev => ({ ...prev, mapLoaded: true }));

        // Test Places API
        const service = new google.maps.places.PlacesService(map);
        service.findPlaceFromQuery(
          {
            query: 'British Museum',
            fields: ['name', 'geometry'],
          },
          (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results && results[0]) {
              console.log('✅ Places API working:', results[0].name);
            } else {
              console.log('⚠️ Places API test:', status);
            }
          }
        );

        // Test Directions API
        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
          {
            origin: 'Westminster, London',
            destination: 'Tower Bridge, London',
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
              console.log('✅ Directions API working');
              console.log('Route distance:', result?.routes[0].legs[0].distance?.text);
              console.log('Route duration:', result?.routes[0].legs[0].duration?.text);
            } else {
              console.log('⚠️ Directions API test:', status);
            }
          }
        );

      } catch (err: any) {
        console.error('❌ Error initializing map:', err);
        setStatus(prev => ({ ...prev, error: err.message }));
      }
    };

    script.onerror = () => {
      console.error('❌ Failed to load Google Maps script');
      setStatus(prev => ({
        ...prev,
        error: 'Failed to load Google Maps script. Check API key validity and permissions.',
      }));
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            🗺️ Google Maps API Connection Test
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Testing Google Maps API connectivity for Peace of Mind
          </p>
        </div>

        {/* Status Checks */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            Connection Status
          </h2>
          
          <div className="space-y-3">
            {/* API Key Check */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className={`text-2xl ${status.apiKeyFound ? 'animate-bounce' : ''}`}>
                {status.apiKeyFound ? '✅' : '❌'}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-800 dark:text-gray-200">
                  API Key Found
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {status.apiKeyFound ? `Key: ${status.apiKeyValue}` : 'Not found in environment variables'}
                </div>
              </div>
            </div>

            {/* Script Loading Check */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className={`text-2xl ${status.scriptLoaded ? 'animate-bounce' : ''}`}>
                {status.scriptLoaded ? '✅' : status.apiKeyFound ? '⏳' : '⏸️'}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-800 dark:text-gray-200">
                  Google Maps Script Loaded
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {status.scriptLoaded ? 'Script loaded successfully' : 'Waiting for script...'}
                </div>
              </div>
            </div>

            {/* Map Initialization Check */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className={`text-2xl ${status.mapLoaded ? 'animate-bounce' : ''}`}>
                {status.mapLoaded ? '✅' : status.scriptLoaded ? '⏳' : '⏸️'}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-800 dark:text-gray-200">
                  Map Initialized
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {status.mapLoaded ? 'Map rendered successfully' : 'Waiting for map...'}
                </div>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {status.error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-xl">⚠️</span>
                <div>
                  <div className="font-bold text-red-800 dark:text-red-300">Error</div>
                  <div className="text-sm text-red-600 dark:text-red-400">{status.error}</div>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {status.mapLoaded && !status.error && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-xl">🎉</span>
                <div>
                  <div className="font-bold text-green-800 dark:text-green-300">Success!</div>
                  <div className="text-sm text-green-600 dark:text-green-400">
                    Google Maps API is working correctly. Check browser console for detailed test results.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Test Map */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            Test Map
          </h2>
          <div
            id="test-map"
            className="w-full h-96 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700"
          />
        </div>

        {/* Configuration Help */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-300 mb-3">
            ⚙️ Configuration Note
          </h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-3">
            For Next.js to access environment variables in the browser, they must be prefixed with <code className="bg-yellow-200 dark:bg-yellow-900 px-2 py-1 rounded">NEXT_PUBLIC_</code>
          </p>
          <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-3 font-mono text-xs">
            <div className="text-yellow-800 dark:text-yellow-300">
              # In .env.local, use:
            </div>
            <div className="text-yellow-900 dark:text-yellow-200 font-bold mt-1">
              NEXT_PUBLIC_GOOGLE_API_KEY=AIzaSyDiOF8u5Ly9iBB8P5RWKVLnmbOBMpGrbnc
            </div>
            <div className="text-yellow-700 dark:text-yellow-400 mt-2">
              # Not just:
            </div>
            <div className="text-yellow-600 dark:text-yellow-500 line-through">
              GOOGLE_API_KEY=AIzaSyDiOF8u5Ly9iBB8P5RWKVLnmbOBMpGrbnc
            </div>
          </div>
          <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-3">
            💡 After updating .env.local, restart your dev server: <code>npm run dev</code>
          </p>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <a
            href="/"
            className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
          >
            ← Back to Peace of Mind
          </a>
        </div>
      </div>
    </div>
  );
}

