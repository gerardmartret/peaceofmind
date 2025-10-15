'use client';

import { useState, useEffect } from 'react';
import GoogleLocationSearch from '@/components/GoogleLocationSearch';
import GoogleTripMap from '@/components/GoogleTripMap';
import { getTrafficPredictions } from '@/lib/google-traffic-predictions';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface CrimeData {
  district: string;
  coordinates: { lat: number; lng: number };
  crimes: any[];
  summary: {
    totalCrimes: number;
    topCategories: Array<{ category: string; count: number; percentage: number }>;
    byOutcome: Record<string, number>;
    month: string;
  };
  safetyScore: number;
}

interface DisruptionData {
  district: string;
  timeframe: string;
  isAreaFiltered: boolean;
  disruptions: any[];
  analysis: {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    active: number;
    upcoming: number;
  };
}

interface WeatherData {
  district: string;
  coordinates: { lat: number; lng: number };
  forecast: Array<{
    date: string;
    maxTemp: number;
    minTemp: number;
    precipitation: number;
    precipitationProb: number;
    weatherCode: number;
    weatherDescription: string;
    windSpeed: number;
  }>;
  summary: {
    avgMaxTemp: number;
    avgMinTemp: number;
    totalPrecipitation: number;
    rainyDays: number;
    maxWindSpeed: number;
  };
}

interface EventData {
  location: string;
  coordinates: { lat: number; lng: number };
  date: string;
  events: Array<{
    title: string;
    description: string;
    date?: string;
    severity: 'high' | 'medium' | 'low';
    type: 'strike' | 'protest' | 'festival' | 'construction' | 'other';
  }>;
  summary: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    highSeverity: number;
  };
}

interface CombinedData {
  crime: CrimeData;
  disruptions: DisruptionData;
  weather: WeatherData;
  events: EventData;
}

interface SortableLocationItemProps {
  location: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    time: string;
  };
  index: number;
  totalLocations: number;
  onLocationSelect: (id: string, data: { name: string; lat: number; lng: number }) => void;
  onTimeChange: (id: string, time: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}

function SortableLocationItem({
  location,
  index,
  totalLocations,
  onLocationSelect,
  onTimeChange,
  onRemove,
  canRemove,
}: SortableLocationItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: location.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Determine time label based on position
  const getTimeLabel = () => {
    if (index === 0) return 'Pickup time';
    if (index === totalLocations - 1) return 'Dropoff time';
    return 'Resume';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border-2 border-gray-200 dark:border-gray-600"
    >
      <div className="flex items-start gap-3">
        {/* Location Search and Time */}
        <div className="flex-1 grid sm:grid-cols-[1fr_auto_auto] gap-3">
          {/* Location Number and Drag Handle - positioned over the address field */}
          <div className="relative">
            <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 text-sm">
              {index + 1}
            </div>
            {/* Drag Handle */}
            <div
              {...attributes}
              {...listeners}
              className="absolute -left-12 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              title="Drag to reorder"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </div>
            {/* Location Search */}
            <div className="min-w-0">
              <GoogleLocationSearch
                onLocationSelect={(loc) => {
                  console.log(`📍 Location ${index + 1} selected:`, loc);
                  onLocationSelect(location.id, {
                    name: loc.name,
                    lat: loc.lat,
                    lng: loc.lng,
                  });
                }}
              />
              {location.name && (
                <div className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium">
                  ✓ {location.name.split(',')[0]}
                </div>
              )}
            </div>
          </div>

          {/* Time Picker */}
          <div className="sm:w-32">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {getTimeLabel()}
            </label>
            <input
              type="time"
              value={location.time}
              onChange={(e) => onTimeChange(location.id, e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Remove Button */}
          <div className="flex items-end">
            <button
              onClick={() => onRemove(location.id)}
              disabled={!canRemove}
              className="rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-30 disabled:cursor-not-allowed p-2 transition-all"
              title="Remove location"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ district: string; data: CombinedData }>>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(['westminster']);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // Multi-location trip state
  const [tripDate, setTripDate] = useState('');
  const [locations, setLocations] = useState<Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    time: string;
  }>>([
    { id: '1', name: '', lat: 0, lng: 0, time: '09:00' },
    { id: '2', name: '', lat: 0, lng: 0, time: '12:00' },
    { id: '3', name: '', lat: 0, lng: 0, time: '15:00' },
  ]);
  const [tripResults, setTripResults] = useState<Array<{
    locationId: string;
    locationName: string;
    time: string;
    data: CombinedData;
  }> | null>(null);
  const [loadingTrip, setLoadingTrip] = useState(false);
  const [locationsReordered, setLocationsReordered] = useState(false);
  const [executiveReport, setExecutiveReport] = useState<any | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [trafficPredictions, setTrafficPredictions] = useState<any>(null);

  const londonDistricts = [
    { id: 'westminster', name: 'Westminster' },
    { id: 'city-of-london', name: 'City of London' },
    { id: 'camden', name: 'Camden' },
    { id: 'islington', name: 'Islington' },
    { id: 'hackney', name: 'Hackney' },
    { id: 'tower-hamlets', name: 'Tower Hamlets' },
    { id: 'greenwich', name: 'Greenwich' },
    { id: 'lewisham', name: 'Lewisham' },
    { id: 'southwark', name: 'Southwark' },
    { id: 'lambeth', name: 'Lambeth' },
    { id: 'wandsworth', name: 'Wandsworth' },
    { id: 'hammersmith-fulham', name: 'Hammersmith & Fulham' },
    { id: 'kensington-chelsea', name: 'Kensington & Chelsea' },
    { id: 'soho', name: 'Soho' },
    { id: 'covent-garden', name: 'Covent Garden' },
    { id: 'shoreditch', name: 'Shoreditch' },
    { id: 'notting-hill', name: 'Notting Hill' },
    { id: 'brixton', name: 'Brixton' },
    { id: 'clapham', name: 'Clapham' },
    { id: 'chelsea', name: 'Chelsea' },
    { id: 'mayfair', name: 'Mayfair' },
    { id: 'canary-wharf', name: 'Canary Wharf' },
    { id: 'stratford', name: 'Stratford' },
    { id: 'wimbledon', name: 'Wimbledon' },
  ];

  // Set default date range and handle client-side mounting
  useEffect(() => {
    setIsMounted(true);
    const today = new Date();
    const futureDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(futureDate.toISOString().split('T')[0]);
    setTripDate(today.toISOString().split('T')[0]);
  }, []);

  const toggleDistrict = (districtId: string) => {
    if (selectedDistricts.includes(districtId)) {
      // Remove if already selected
      if (selectedDistricts.length > 1) {
        setSelectedDistricts(selectedDistricts.filter(d => d !== districtId));
      }
    } else {
      // Add to selection
      setSelectedDistricts([...selectedDistricts, districtId]);
    }
  };

  const calculateDaysFromDates = () => {
    if (!startDate || !endDate) return 30;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const addLocation = () => {
    const newId = (locations.length + 1).toString();
    setLocations([...locations, {
      id: newId,
      name: '',
      lat: 0,
      lng: 0,
      time: '18:00',
    }]);
  };

  const removeLocation = (id: string) => {
    if (locations.length > 1) {
      setLocations(locations.filter(loc => loc.id !== id));
    }
  };

  const updateLocation = (id: string, data: { name: string; lat: number; lng: number }) => {
    setLocations(locations.map(loc => 
      loc.id === id ? { ...loc, ...data } : loc
    ));
  };

  const updateLocationTime = (id: string, time: string) => {
    setLocations(locations.map(loc => 
      loc.id === id ? { ...loc, time } : loc
    ));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLocations((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const reorderedItems = arrayMove(items, oldIndex, newIndex);
        
        console.log(`📦 Location reordered: ${oldIndex + 1} → ${newIndex + 1}`);
        
        // Clear results and show reorder indicator
        setTripResults(null);
        setLocationsReordered(true);
        
        return reorderedItems;
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleTripSubmit = async () => {
    // Validate all locations are filled
    const validLocations = locations.filter(loc => loc.name && loc.lat !== 0 && loc.lng !== 0);
    
    if (validLocations.length === 0) {
      setError('Please select at least one location');
      return;
    }

    setLoadingTrip(true);
    setTripResults(null);
    setError(null);
    setLocationsReordered(false); // Clear reorder indicator

    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🗓️  Trip Date: ${tripDate}`);
      console.log(`📍 Analyzing ${validLocations.length} location(s)`);
      console.log(`${'='.repeat(80)}\n`);

      const days = 7; // Fixed period for trip planning

      // Fetch data for all locations in parallel
      const results = await Promise.all(
        validLocations.map(async (location) => {
          console.log(`\n🔍 Fetching data for: ${location.name} at ${location.time}`);
          
          const tempDistrictId = `custom-${Date.now()}-${location.id}`;

          const [crimeResponse, disruptionsResponse, weatherResponse, eventsResponse] = await Promise.all([
            fetch(`/api/uk-crime?district=${tempDistrictId}&lat=${location.lat}&lng=${location.lng}`),
            fetch(`/api/tfl-disruptions?district=${tempDistrictId}&days=${days}`),
            fetch(`/api/weather?district=${tempDistrictId}&lat=${location.lat}&lng=${location.lng}&days=${days}`),
            fetch(`/api/events?location=${encodeURIComponent(location.name)}&lat=${location.lat}&lng=${location.lng}&date=${tripDate}`)
          ]);

          const [crimeData, disruptionsData, weatherData, eventsData] = await Promise.all([
            crimeResponse.json(),
            disruptionsResponse.json(),
            weatherResponse.json(),
            eventsResponse.json()
          ]);

          if (crimeData.success && disruptionsData.success && weatherData.success && eventsData.success) {
            console.log(`✅ ${location.name}: Safety ${crimeData.data.safetyScore}/100, Events: ${eventsData.data.events.length}`);
            
            // Log events to browser console
            if (eventsData.data.events.length > 0) {
              console.log(`\n📰 Events found for ${location.name}:`);
              eventsData.data.events.forEach((event: any, idx: number) => {
                console.log(`  ${idx + 1}. ${event.title} (${event.type}, ${event.severity})`);
              });
            } else {
              console.log(`📰 No events found for ${location.name}`);
            }
            
            return {
              locationId: location.id,
              locationName: location.name,
              time: location.time,
              data: {
                crime: crimeData.data,
                disruptions: disruptionsData.data,
                weather: weatherData.data,
                events: eventsData.data,
              },
            };
          } else {
            throw new Error(`Failed to fetch data for ${location.name}`);
          }
        })
      );

      console.log(`\n${'='.repeat(80)}`);
      console.log(`✅ Successfully analyzed all ${results.length} location(s)`);
      console.log(`${'='.repeat(80)}\n`);

      setTripResults(results);

      // Get traffic predictions for the route
      console.log('🚦 Fetching traffic predictions...');
      try {
        const trafficData = await getTrafficPredictions(validLocations, tripDate);
        setTrafficPredictions(trafficData);
        
        if (trafficData.success) {
          console.log('✅ Traffic predictions completed successfully');
        } else {
          console.error('⚠️ Traffic predictions failed:', trafficData.error);
        }
      } catch (trafficError) {
        console.error('❌ Traffic prediction error:', trafficError);
        setTrafficPredictions({
          success: false,
          error: 'Failed to get traffic predictions',
        });
      }

      // Generate executive report
      console.log('🤖 Generating Executive Peace of Mind Report...');
      setLoadingReport(true);
      
      try {
        const reportData = results.map(r => ({
          locationName: r.locationName,
          time: r.time,
          crime: r.data.crime,
          disruptions: r.data.disruptions,
          weather: r.data.weather,
          events: r.data.events,
        }));

        const reportResponse = await fetch('/api/executive-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripData: reportData,
            tripDate,
            routeDistance: trafficPredictions?.totalDistance || '0 km',
            routeDuration: trafficPredictions?.totalMinutes || 0,
            trafficPredictions: trafficPredictions?.success ? trafficPredictions.data : null,
          }),
        });

        const reportResult = await reportResponse.json();
        
        if (reportResult.success) {
          setExecutiveReport(reportResult.data);
          console.log('✅ Executive Report Generated!');
          console.log(`🎯 Trip Risk Score: ${reportResult.data.tripRiskScore}/10`);
        }
      } catch (reportError) {
        console.error('⚠️ Could not generate executive report:', reportError);
        // Don't fail the whole trip analysis if report fails
      } finally {
        setLoadingReport(false);
      }
    } catch (err) {
      console.error('❌ Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch trip data');
    } finally {
      setLoadingTrip(false);
    }
  };

  const fetchDistrictData = async () => {
    setLoading(true);
    setResults([]);
    setError(null);
    
    try {
      const days = calculateDaysFromDates();
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🚀 Fetching data for ${selectedDistricts.length} district(s)`);
      console.log(`📅 Date Range: ${startDate} to ${endDate} (${days} days)`);
      console.log(`📍 Districts: ${selectedDistricts.map(id => londonDistricts.find(d => d.id === id)?.name).join(', ')}`);
      console.log(`${'='.repeat(80)}\n`);
      
      // Fetch data for all selected districts in parallel
      const districtPromises = selectedDistricts.map(async (districtId) => {
        const districtName = londonDistricts.find(d => d.id === districtId)?.name || districtId;
        
        console.log(`\n🔍 Fetching data for ${districtName}...`);
        
        const [crimeResponse, disruptionsResponse, weatherResponse] = await Promise.all([
          fetch(`/api/uk-crime?district=${districtId}`),
          fetch(`/api/tfl-disruptions?district=${districtId}&days=${days}`),
          fetch(`/api/weather?district=${districtId}&days=${Math.min(days, 16)}`) // Open-Meteo max 16 days
        ]);
        
        const crimeData = await crimeResponse.json();
        const disruptionsData = await disruptionsResponse.json();
        const weatherData = await weatherResponse.json();
        
        if (crimeData.success && disruptionsData.success && weatherData.success) {
          console.log(`✅ ${districtName}: ${crimeData.data.summary.totalCrimes} crimes, ${disruptionsData.data.analysis.total} disruptions, ${weatherData.data.forecast.length} days forecast`);
          
          return {
            district: districtId,
            data: {
              crime: crimeData.data,
              disruptions: disruptionsData.data,
              weather: weatherData.data,
              events: { 
                location: districtName, 
                coordinates: { lat: 0, lng: 0 }, 
                date: '', 
                events: [], 
                summary: { total: 0, byType: {}, bySeverity: {}, highSeverity: 0 } 
              },
            },
          };
        } else {
          throw new Error(`Failed to fetch data for ${districtName}`);
        }
      });
      
      const allResults = await Promise.all(districtPromises);
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`✅ Successfully retrieved data for all ${allResults.length} district(s)!`);
      console.log(`${'='.repeat(80)}\n`);
      
      setResults(allResults);
    } catch (error) {
      console.error('❌ Error:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const getSafetyColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getSafetyBg = (score: number) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700';
    if (score >= 40) return 'bg-orange-100 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700';
    return 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700';
  };

  const getSafetyLabel = (score: number) => {
    if (score >= 80) return 'Very Safe';
    if (score >= 60) return 'Moderately Safe';
    if (score >= 40) return 'Caution Advised';
    return 'High Alert';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <span className="text-5xl">🇬🇧</span>
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Peace of Mind
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-300 text-lg mb-3">
            Plan Your London Trip with Safety, Traffic & Weather Analysis
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-3 py-1.5 rounded-lg text-xs font-medium">
              <span>🚨</span>
              <span>Crime</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 px-3 py-1.5 rounded-lg text-xs font-medium">
              <span>🚦</span>
              <span>Traffic</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200 px-3 py-1.5 rounded-lg text-xs font-medium">
              <span>🌤️</span>
              <span>Weather</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-3 py-1.5 rounded-lg text-xs font-semibold">
              <span>✅</span>
              <span>100% FREE</span>
            </div>
          </div>
        </div>

        {/* Multi-Location Trip Planner */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
            <span>🗺️</span> Plan Your Trip
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Add multiple locations to analyze safety, traffic, and weather for your entire journey
          </p>
          
          {/* Trip Date at Top */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <label htmlFor="tripDate" className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">
              📅 Trip Date (applies to all locations)
            </label>
            <input
              type="date"
              id="tripDate"
              value={tripDate}
              onChange={(e) => setTripDate(e.target.value)}
              className="w-full max-w-xs rounded-lg border-2 border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-2 px-4 text-base font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Multiple Location Inputs with Drag and Drop */}
          {isMounted ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={locations.map(loc => loc.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4 mb-4">
                  {locations.map((location, index) => (
                    <SortableLocationItem
                      key={location.id}
                      location={location}
                      index={index}
                      totalLocations={locations.length}
                      onLocationSelect={updateLocation}
                      onTimeChange={updateLocationTime}
                      onRemove={removeLocation}
                      canRemove={locations.length > 1}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="space-y-4 mb-4">
              <div className="text-center py-8 text-gray-500">Loading...</div>
            </div>
          )}

          {/* Reorder Indicator */}
          {locationsReordered && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg p-3 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                Locations reordered! Click <strong>"Analyze Trip"</strong> to update the route.
              </p>
            </div>
          )}

          {/* Add Location & Analyze Buttons */}
          <div className="flex gap-3">
            <button
              onClick={addLocation}
              className="flex-1 sm:flex-initial rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium py-3 px-6 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Location
            </button>

            <button
              onClick={handleTripSubmit}
              disabled={loadingTrip || locations.filter(l => l.name).length === 0}
              className={`flex-1 sm:flex-initial rounded-lg ${locationsReordered ? 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 animate-pulse' : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'} text-white font-bold py-3 px-8 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-2`}
            >
              {loadingTrip ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  🚀 Analyze Trip
                </>
              )}
            </button>
          </div>
        </div>

        {/* Trip Results */}
        {tripResults && tripResults.length > 0 && (
          <div className="mb-8">
            {/* Executive Report */}
            {loadingReport && (
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-2xl p-8 mb-6 text-white">
                <div className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-xl font-semibold">Generating Executive Peace of Mind Report...</p>
                </div>
              </div>
            )}

            {executiveReport && (
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-3xl shadow-2xl p-8 mb-6 border-4 border-slate-300 dark:border-slate-700">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-6 border-b-4 border-slate-300 dark:border-slate-600">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                      <span className="text-4xl">🛡️</span>
                      Peace of Mind Report
                      <span className="text-sm font-normal text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">AI-Powered</span>
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300 mt-2">
                      Executive Summary • {tripDate} • {tripResults.length} Location{tripResults.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Trip Risk Score</div>
                    <div className={`text-6xl font-bold ${
                      executiveReport.tripRiskScore <= 3 ? 'text-green-600 dark:text-green-400' :
                      executiveReport.tripRiskScore <= 6 ? 'text-yellow-600 dark:text-yellow-400' :
                      executiveReport.tripRiskScore <= 8 ? 'text-orange-600 dark:text-orange-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {executiveReport.tripRiskScore}
                      <span className="text-3xl text-slate-400">/10</span>
                    </div>
                    <div className={`text-xs font-semibold mt-1 ${
                      executiveReport.tripRiskScore <= 3 ? 'text-green-600 dark:text-green-400' :
                      executiveReport.tripRiskScore <= 6 ? 'text-yellow-600 dark:text-yellow-400' :
                      executiveReport.tripRiskScore <= 8 ? 'text-orange-600 dark:text-orange-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {executiveReport.tripRiskScore <= 3 ? 'LOW RISK' :
                       executiveReport.tripRiskScore <= 6 ? 'MODERATE RISK' :
                       executiveReport.tripRiskScore <= 8 ? 'HIGH RISK' : 'CRITICAL RISK'}
                    </div>
                  </div>
                </div>

                {/* Overall Summary */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-6 shadow-lg border-l-4 border-blue-500">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <span>📊</span> Executive Summary
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {executiveReport.overallSummary}
                  </p>
                </div>

                {/* Key Highlights */}
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  {executiveReport.highlights.map((highlight: any, idx: number) => (
                    <div
                      key={idx}
                      className={`rounded-xl p-4 shadow-lg border-l-4 ${
                        highlight.type === 'danger' ? 'bg-red-50 dark:bg-red-900/20 border-red-500' :
                        highlight.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500' :
                        highlight.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-500' :
                        'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xl flex-shrink-0">
                          {highlight.type === 'danger' ? '🔴' :
                           highlight.type === 'warning' ? '⚠️' :
                           highlight.type === 'success' ? '✅' : 'ℹ️'}
                        </span>
                        <p className={`text-sm font-medium leading-snug ${
                          highlight.type === 'danger' ? 'text-red-800 dark:text-red-200' :
                          highlight.type === 'warning' ? 'text-yellow-800 dark:text-yellow-200' :
                          highlight.type === 'success' ? 'text-green-800 dark:text-green-200' :
                          'text-blue-800 dark:text-blue-200'
                        }`}>
                          {highlight.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Location Analysis */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {executiveReport.locationAnalysis.map((loc: any, idx: number) => (
                    <div key={idx} className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs">
                            {idx + 1}
                          </span>
                          {loc.locationName.split(',')[0]}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          loc.riskLevel === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                          loc.riskLevel === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                          'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        }`}>
                          {loc.riskLevel.toUpperCase()}
                        </span>
                      </div>
                      <ul className="space-y-2">
                        {loc.keyFindings.map((finding: string, fIdx: number) => (
                          <li key={fIdx} className="text-xs text-slate-700 dark:text-slate-300 leading-tight flex items-start gap-1">
                            <span className="text-blue-500 flex-shrink-0 mt-0.5">•</span>
                            <span>{finding}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* Route Disruptions */}
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg border-l-4 border-orange-500">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <span>🚗</span> Driving Risks
                    </h3>
                    <ul className="space-y-2">
                      {executiveReport.routeDisruptions.drivingRisks.map((risk: string, idx: number) => (
                        <li key={idx} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                          <span className="text-orange-500 flex-shrink-0 mt-1">▸</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg border-l-4 border-purple-500">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <span>🚶</span> External Disruptions
                    </h3>
                    <ul className="space-y-2">
                      {executiveReport.routeDisruptions.externalDisruptions.map((disruption: string, idx: number) => (
                        <li key={idx} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                          <span className="text-purple-500 flex-shrink-0 mt-1">▸</span>
                          <span>{disruption}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-6 shadow-xl text-white">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span>💡</span> Recommendations
                  </h3>
                  <ul className="space-y-3">
                    {executiveReport.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-white/95 leading-relaxed">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Traffic Predictions */}
            {trafficPredictions && trafficPredictions.success && (
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-xl p-6 mb-6 text-white">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span>🚦</span> Traffic Predictions
                  <span className="text-sm font-normal text-blue-100">(Historical-based)</span>
                </h2>
                
                {/* Summary Stats */}
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white/20 rounded-lg p-4">
                    <div className="text-2xl font-bold">{trafficPredictions.totalDistance}</div>
                    <div className="text-blue-100 text-sm">Total Distance</div>
                  </div>
                  <div className="bg-white/20 rounded-lg p-4">
                    <div className="text-2xl font-bold">{trafficPredictions.totalMinutes} min</div>
                    <div className="text-blue-100 text-sm">With Traffic</div>
                  </div>
                  <div className="bg-white/20 rounded-lg p-4">
                    <div className="text-2xl font-bold">
                      +{trafficPredictions.totalMinutes - trafficPredictions.totalMinutesNoTraffic} min
                    </div>
                    <div className="text-blue-100 text-sm">Traffic Delay</div>
                  </div>
                </div>

                {/* Route Legs */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-blue-100">Route Breakdown:</h3>
                  {trafficPredictions.data.map((leg: any, index: number) => (
                    <div key={index} className="bg-white/10 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold">{leg.leg}</div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{leg.minutes} min</div>
                          <div className="text-xs text-blue-200">{leg.distance}</div>
                        </div>
                      </div>
                      <div className="text-sm text-blue-100">
                        {leg.originName.split(',')[0]} → {leg.destinationName.split(',')[0]}
                      </div>
                      {leg.busyMinutes && (
                        <div className="text-xs text-yellow-200 mt-1">
                          ⚠️ Busy traffic expected: +{leg.busyMinutes - leg.minutesNoTraffic} min delay
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Map View */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                <span>🗺️</span> Your Trip Map
                <span className="text-sm font-normal text-gray-500">({tripResults.length} location{tripResults.length > 1 ? 's' : ''})</span>
              </h2>
              <GoogleTripMap 
                locations={tripResults.map((result, index) => {
                  const location = locations.find(l => l.id === result.locationId);
                  return {
                    id: result.locationId,
                    name: result.locationName,
                    lat: location?.lat || 0,
                    lng: location?.lng || 0,
                    time: result.time,
                    safetyScore: result.data.crime.safetyScore,
                  };
                })}
              />
            </div>

            {/* Location Reports */}
            <div className="space-y-6">
              {tripResults.map((result, index) => (
                <div key={result.locationId} className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl p-6 border-2 border-gray-200 dark:border-gray-700">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-lg">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                          {result.locationName.split(',')[0]}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          🕐 {result.time} • 📅 {tripDate}
                        </p>
                      </div>
                    </div>
                    <div className={`text-4xl font-bold ${getSafetyColor(result.data.crime.safetyScore)}`}>
                      {result.data.crime.safetyScore}
                      <span className="text-lg text-gray-500">/100</span>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow border-l-4 border-blue-500">
                      <div className="text-xl mb-1">🚨</div>
                      <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
                        {result.data.crime.summary.totalCrimes.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Crimes</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow border-l-4 border-orange-500">
                      <div className="text-xl mb-1">🚧</div>
                      <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
                        {result.data.disruptions.analysis.total}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Disruptions</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow border-l-4 border-cyan-500">
                      <div className="text-xl mb-1">🌡️</div>
                      <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
                        {result.data.weather.summary.avgMaxTemp}°C
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Avg Temp</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow border-l-4 border-purple-500">
                      <div className="text-xl mb-1">☔</div>
                      <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
                        {result.data.weather.summary.rainyDays}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Rainy Days</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow border-l-4 border-pink-500">
                      <div className="text-xl mb-1">📰</div>
                      <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
                        {result.data.events.summary.total}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Events</div>
                    </div>
                  </div>

                  {/* Detailed Breakdown */}
                  <div className="grid lg:grid-cols-4 gap-4">
                    {/* Crime */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                      <h4 className="text-sm font-bold mb-2 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <span>🚨</span> Top Crimes
                      </h4>
                      <div className="space-y-2">
                        {result.data.crime.summary.topCategories.slice(0, 3).map((cat, idx) => (
                          <div key={idx}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-700 dark:text-gray-300">{cat.category}</span>
                              <span className="font-bold text-gray-800 dark:text-gray-200">{cat.count}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full"
                                style={{ width: `${cat.percentage}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Traffic */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                      <h4 className="text-sm font-bold mb-2 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <span>🚦</span> Traffic
                      </h4>
                      <div className="space-y-2">
                        {result.data.disruptions.disruptions.slice(0, 2).map((disruption: any, idx: number) => (
                          <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded p-2 border border-gray-200 dark:border-gray-600">
                            <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-tight">
                              {disruption.location.substring(0, 30)}...
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {disruption.severity}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Weather */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                      <h4 className="text-sm font-bold mb-2 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <span>🌤️</span> Weather
                      </h4>
                      <div className="space-y-2">
                        {result.data.weather.forecast.slice(0, 2).map((day: any, idx: number) => {
                          const weatherEmoji = day.weatherCode === 0 ? '☀️' : 
                                             day.weatherCode <= 3 ? '⛅' :
                                             day.weatherCode >= 61 && day.weatherCode <= 67 ? '🌧️' : '🌤️';
                          return (
                            <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded p-2 border border-gray-200 dark:border-gray-600">
                              <div className="flex items-center justify-between">
                                <span className="text-lg">{weatherEmoji}</span>
                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                  {day.minTemp}°-{day.maxTemp}°C
                                </span>
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Events */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                      <h4 className="text-sm font-bold mb-2 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <span>📰</span> Events
                        <span className="text-xs font-normal text-gray-500">AI</span>
                      </h4>
                      {result.data.events.summary.total > 0 ? (
                        <div className="space-y-2">
                          {result.data.events.events.slice(0, 3).map((event: any, idx: number) => {
                            const severityColor = event.severity === 'high' ? 'red' : event.severity === 'medium' ? 'orange' : 'yellow';
                            const typeEmoji = event.type === 'strike' ? '✊' : event.type === 'protest' ? '📢' : event.type === 'festival' ? '🎉' : '🚧';
                            return (
                              <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded p-2 border border-gray-200 dark:border-gray-600">
                                <div className="flex items-start gap-1">
                                  <span className="text-sm">{typeEmoji}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-tight">
                                      {event.title.substring(0, 35)}...
                                    </div>
                                    <div className={`text-xs mt-1 text-${severityColor}-600 dark:text-${severityColor}-400 font-medium`}>
                                      {event.severity.toUpperCase()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                          No significant events found
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* Hidden: District Results removed, keeping only trip planner */}
        {false && results.length > 0 && (
          <div className="space-y-8">
            {/* Comparison Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white text-center">
              <h2 className="text-3xl font-bold mb-2">
                Comparing {results.length} District{results.length > 1 ? 's' : ''}
              </h2>
              <p className="text-blue-100">
                {startDate} to {endDate} • {calculateDaysFromDates()} days analysis
              </p>
            </div>

            {/* Results for Each District */}
            {results.map((result, resultIdx) => {
              const districtName = londonDistricts.find(d => d.id === result.district)?.name || result.district;
              
              return (
                <div key={result.district} className="space-y-6 border-4 border-gray-200 dark:border-gray-700 rounded-3xl p-6 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
                  {/* District Header */}
                  <div className="flex items-center justify-between pb-4 border-b-2 border-gray-200 dark:border-gray-700">
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                      {resultIdx + 1}. {districtName}
                    </h3>
                    <div className={`text-5xl font-bold ${getSafetyColor(result.data.crime.safetyScore)}`}>
                      {result.data.crime.safetyScore}
                      <span className="text-xl text-gray-500">/100</span>
                    </div>
                  </div>

                  {/* Safety Score Card */}
                  <div className={`rounded-2xl p-6 border-2 ${getSafetyBg(result.data.crime.safetyScore)}`}>
                    <div className="text-center">
                      <div className={`inline-block px-4 py-2 rounded-full text-lg font-bold mb-2 ${getSafetyBg(result.data.crime.safetyScore)}`}>
                        <span className={getSafetyColor(result.data.crime.safetyScore)}>
                          {getSafetyLabel(result.data.crime.safetyScore)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Based on {result.data.crime.summary.totalCrimes.toLocaleString()} crimes • {result.data.crime.summary.month}
                      </p>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border-l-4 border-blue-500">
                      <div className="text-2xl mb-1">🚨</div>
                      <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                        {result.data.crime.summary.totalCrimes.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Crimes</div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border-l-4 border-orange-500">
                      <div className="text-2xl mb-1">🚧</div>
                      <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                        {result.data.disruptions.analysis.total}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Disruptions</div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border-l-4 border-cyan-500">
                      <div className="text-2xl mb-1">🌡️</div>
                      <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                        {result.data.weather.summary.avgMaxTemp}°C
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Avg Temp</div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border-l-4 border-purple-500">
                      <div className="text-2xl mb-1">☔</div>
                      <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                        {result.data.weather.summary.rainyDays}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Rainy Days</div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border-l-4 border-red-500">
                      <div className="text-2xl mb-1">⚠️</div>
                      <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                        {result.data.disruptions.analysis.bySeverity['Moderate'] || 0}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Moderate</div>
                    </div>
                  </div>

                  {/* Three Column Layout for Crime, Disruptions, and Weather */}
                  <div className="grid lg:grid-cols-3 gap-4">
                    {/* Top Crime Categories */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-xl">
                      <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <span>🚨</span> Crime Report
                      </h3>
                      <div className="space-y-2.5">
                        {result.data.crime.summary.topCategories.slice(0, 5).map((cat, idx) => (
                          <div key={idx} className="relative">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {idx + 1}. {cat.category}
                              </span>
                              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                {cat.count}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full"
                                style={{ width: `${cat.percentage}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* TfL Disruptions */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-xl">
                      <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <span>🚦</span> Disruptions
                      </h3>
                      
                      {/* Disruption Mini Stats */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 text-center">
                          <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                            {result.data.disruptions.analysis.total}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Total</div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 text-center">
                          <div className="text-xl font-bold text-red-600 dark:text-red-400">
                            {result.data.disruptions.analysis.bySeverity['Moderate'] || 0}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Moderate</div>
                        </div>
                      </div>

                      {/* Top 3 Disruptions */}
                      <div className="space-y-2">
                        {result.data.disruptions.disruptions.slice(0, 3).map((disruption: any, idx: number) => (
                          <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
                            <div className="flex items-start justify-between mb-1">
                              <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-xs leading-tight">
                                {disruption.location.length > 35 ? disruption.location.substring(0, 35) + '...' : disruption.location}
                              </h4>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                                disruption.severity === 'Moderate' 
                                  ? 'bg-orange-200 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300'
                                  : 'bg-yellow-200 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300'
                              }`}>
                                {disruption.severity}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {new Date(disruption.startDateTime).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Weather Forecast */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-xl">
                      <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <span>🌤️</span> Weather Forecast
                      </h3>
                      
                      {/* Weather Summary */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-2 text-center">
                          <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
                            {result.data.weather.summary.avgMaxTemp}°C
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Avg Max</div>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center">
                          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                            {result.data.weather.summary.rainyDays}/{result.data.weather.forecast.length}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Rainy Days</div>
                        </div>
                      </div>

                      {/* All Days in Date Range */}
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 sticky top-0 bg-white dark:bg-gray-800 py-1">
                          Full Forecast ({result.data.weather.forecast.length} days):
                        </h4>
                        {result.data.weather.forecast.map((day: any, idx: number) => {
                          const weatherEmoji = day.weatherCode === 0 ? '☀️' : 
                                             day.weatherCode <= 3 ? '⛅' :
                                             day.weatherCode >= 61 && day.weatherCode <= 67 ? '🌧️' :
                                             day.weatherCode >= 71 && day.weatherCode <= 77 ? '❄️' :
                                             day.weatherCode >= 95 ? '⛈️' : '🌤️';
                          
                          return (
                            <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5 border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl">{weatherEmoji}</span>
                                  <div>
                                    <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                                      {new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {day.weatherDescription}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                    {day.minTemp}°-{day.maxTemp}°C
                                  </div>
                                  {day.precipitation > 0 && (
                                    <div className="text-xs text-blue-600 dark:text-blue-400">
                                      💧 {day.precipitation}mm
                                    </div>
                                  )}
                                </div>
                              </div>
                              {day.windSpeed > 15 && (
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1">
                                  <span>💨</span>
                                  <span>{day.windSpeed} km/h wind</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Full Weather Forecast - Full Width */}
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
                    <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <span>🌤️</span> Complete Weather Forecast for {districtName}
                    </h3>
                    
                    {/* Weather Summary Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                      <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-lg p-3 border-2 border-cyan-200 dark:border-cyan-800">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Avg Temp</div>
                        <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                          {result.data.weather.summary.avgMinTemp}°-{result.data.weather.summary.avgMaxTemp}°C
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-3 border-2 border-blue-200 dark:border-blue-800">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Precipitation</div>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {result.data.weather.summary.totalPrecipitation}mm
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-3 border-2 border-purple-200 dark:border-purple-800">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Rainy Days</div>
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {result.data.weather.summary.rainyDays}/{result.data.weather.forecast.length}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 rounded-lg p-3 border-2 border-green-200 dark:border-green-800">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Max Wind</div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {result.data.weather.summary.maxWindSpeed} km/h
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg p-3 border-2 border-orange-200 dark:border-orange-800">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Forecast</div>
                        <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                          {result.data.weather.forecast.length} Days
                        </div>
                      </div>
                    </div>

                    {/* Daily Weather Cards - Horizontal Scroll */}
                    <div className="overflow-x-auto pb-2">
                      <div className="flex gap-3" style={{ minWidth: 'fit-content' }}>
                        {result.data.weather.forecast.map((day: any, idx: number) => {
                          const weatherEmoji = day.weatherCode === 0 ? '☀️' : 
                                             day.weatherCode <= 3 ? '⛅' :
                                             day.weatherCode >= 61 && day.weatherCode <= 67 ? '🌧️' :
                                             day.weatherCode >= 71 && day.weatherCode <= 77 ? '❄️' :
                                             day.weatherCode >= 95 ? '⛈️' : '🌤️';
                          
                          const isRainy = day.precipitation > 0;
                          const isWindy = day.windSpeed > 15;
                          
                          return (
                            <div 
                              key={idx} 
                              className={`flex-shrink-0 w-48 rounded-xl p-4 shadow-lg border-2 ${
                                isRainy 
                                  ? 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 border-blue-300 dark:border-blue-700'
                                  : 'bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border-gray-200 dark:border-gray-600'
                              }`}
                            >
                              <div className="text-center mb-3">
                                <div className="text-5xl mb-2">{weatherEmoji}</div>
                                <div className="font-bold text-gray-800 dark:text-gray-200">
                                  {new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short' })}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  {new Date(day.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">Temp</span>
                                  <span className="font-bold text-gray-800 dark:text-gray-200">
                                    {day.minTemp}°-{day.maxTemp}°C
                                  </span>
                                </div>
                                
                                {isRainy && (
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Rain</span>
                                    <span className="font-bold text-blue-600 dark:text-blue-400">
                                      💧 {day.precipitation}mm
                                    </span>
                                  </div>
                                )}
                                
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">Wind</span>
                                  <span className={`font-bold ${isWindy ? 'text-orange-600 dark:text-orange-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                    {isWindy ? '💨 ' : ''}{day.windSpeed} km/h
                                  </span>
                                </div>

                                <div className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                  {day.weatherDescription}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Overall Footer */}
            <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4 bg-white dark:bg-gray-800 rounded-xl">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✅</span>
                  <span>UK Police API</span>
                </div>
                <div className="hidden sm:block text-gray-400">•</div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✅</span>
                  <span>TfL API</span>
                </div>
                <div className="hidden sm:block text-gray-400">•</div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✅</span>
                  <span>Open-Meteo API</span>
                </div>
              </div>
              <p className="text-xs mt-2">
                {results.length} district{results.length > 1 ? 's' : ''} • Crime + Traffic + Weather • 100% Free
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">❌</div>
            <h3 className="text-xl font-semibold text-red-800 dark:text-red-300 mb-2">
              Error Loading Data
            </h3>
            <p className="text-red-600 dark:text-red-400">
              {error}
            </p>
          </div>
        )}


      </div>
    </div>
  );
}
