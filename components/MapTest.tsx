'use client';

import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapTestProps {
  latitude?: number;
  longitude?: number;
  zoom?: number;
}

export default function MapTest({ 
  latitude = 51.5074, 
  longitude = -0.1278, 
  zoom = 12 
}: MapTestProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (map.current) return; // Initialize map only once

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    
    if (!token) {
      setError('Mapbox token not found in environment variables');
      console.error('❌ NEXT_PUBLIC_MAPBOX_TOKEN is not set');
      return;
    }

    try {
      console.log('🗺️  Initializing Mapbox...');
      console.log(`📍 Center: ${latitude}, ${longitude}`);
      console.log(`🔍 Zoom: ${zoom}`);
      
      mapboxgl.accessToken = token;

      if (!mapContainer.current) return;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [longitude, latitude],
        zoom: zoom,
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add a marker at the center
      new mapboxgl.Marker({ color: '#3b82f6' })
        .setLngLat([longitude, latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML('<h3 style="font-weight: bold; margin: 0;">Test Location</h3><p style="margin: 5px 0 0 0;">Mapbox is working!</p>')
        )
        .addTo(map.current);

      map.current.on('load', () => {
        console.log('✅ Mapbox map loaded successfully!');
        console.log('🎉 Connection to Mapbox API verified!');
        setMapLoaded(true);
      });

      map.current.on('error', (e) => {
        console.error('❌ Mapbox error:', e);
        setError('Failed to load map');
      });

    } catch (err: any) {
      console.error('❌ Error initializing Mapbox:', err);
      setError(err.message || 'Failed to initialize map');
    }

    return () => {
      if (map.current) {
        console.log('🗺️  Cleaning up Mapbox map...');
        map.current.remove();
      }
    };
  }, [latitude, longitude, zoom]);

  if (error) {
    return (
      <div className="w-full h-[500px] bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-5xl mb-4">❌</div>
          <h3 className="text-xl font-semibold text-red-800 dark:text-red-300 mb-2">
            Map Error
          </h3>
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div 
        ref={mapContainer} 
        className="w-full h-[500px] rounded-xl shadow-2xl border-2 border-gray-200 dark:border-gray-700"
      />
      {mapLoaded && (
        <div className="absolute top-4 left-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg font-semibold animate-pulse">
          ✅ Mapbox Connected!
        </div>
      )}
    </div>
  );
}

