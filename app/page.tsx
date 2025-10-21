'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import GoogleLocationSearch from '@/components/GoogleLocationSearch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TimePicker } from '@/components/ui/time-picker';
import { cn } from '@/lib/utils';
import { getTrafficPredictions } from '@/lib/google-traffic-predictions';
import { searchNearbyCafes } from '@/lib/google-cafes';
import { searchEmergencyServices } from '@/lib/google-emergency-services';
import { supabase } from '@/lib/supabase';
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

interface ParkingData {
  location: string;
  coordinates: { lat: number; lng: number };
  carParks: Array<{
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    distance: number;
    totalSpaces?: number;
    operatingHours?: string;
    facilities: string[];
    type: string;
  }>;
  cpzInfo: {
    inCPZ: boolean;
    zone?: string;
    zoneName?: string;
    borough?: string;
    operatingHours?: string;
    operatingDays?: string;
    restrictions?: string;
    chargeInfo?: string;
  };
  parkingRiskScore: number;
  summary: {
    totalNearby: number;
    averageDistance: number;
    hasStationParking: boolean;
    cpzWarning: boolean;
  };
}

interface CafeData {
  location: string;
  coordinates: { lat: number; lng: number };
  cafes: Array<{
    id: string;
    name: string;
    address: string;
    rating: number;
    userRatingsTotal: number;
    priceLevel: number;
    distance?: number;
    lat: number;
    lng: number;
    types: string[];
    businessStatus?: string;
  }>;
  summary: {
    total: number;
    averageRating: number;
    averageDistance: number;
  };
}

interface CombinedData {
  crime: CrimeData;
  disruptions: DisruptionData;
  weather: WeatherData;
  events: EventData;
  parking: ParkingData;
  cafes: CafeData;
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
    <Card
      ref={setNodeRef}
      style={style}
      className="border-2 relative"
    >
      {/* ABC Letter in top-left corner */}
      <div className="absolute top-2 left-2 text-muted-foreground/40 text-xs font-normal">
        {numberToLetter(index + 1)}
      </div>
      
      <CardContent className="py-1.5 px-4">
        <div className="flex items-center gap-3">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded transition-colors flex items-center"
            title="Drag to reorder"
          >
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </div>

          {/* Time Picker and Location Search */}
          <div className="flex-1 grid sm:grid-cols-[160px_1fr] gap-3">
            {/* Time Picker */}
            <div>
              <Label className="text-xs font-medium text-secondary-foreground mb-1">
                {getTimeLabel()}
              </Label>
              <TimePicker
                value={location.time}
                onChange={(value) => onTimeChange(location.id, value)}
              />
            </div>

            {/* Location Search */}
            <div className="min-w-0">
              <Label className="text-xs font-medium text-secondary-foreground mb-1">
                Location
              </Label>
              <GoogleLocationSearch
                onLocationSelect={(loc) => {
                  console.log(`Location ${numberToLetter(index + 1)} selected:`, loc);
                  onLocationSelect(location.id, {
                    name: loc.name,
                    lat: loc.lat,
                    lng: loc.lng,
                  });
                }}
              />
            </div>
          </div>

          {/* Remove Button */}
          <Button
            onClick={() => onRemove(location.id)}
            disabled={!canRemove}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-muted hover:text-foreground h-8 w-8"
            title="Remove location"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to convert numbers to letters (1 -> A, 2 -> B, etc.)
const numberToLetter = (num: number): string => {
  return String.fromCharCode(64 + num); // 65 is 'A' in ASCII
};

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ district: string; data: CombinedData }>>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(['westminster']);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // Multi-location trip state
  const [tripDate, setTripDate] = useState<Date | undefined>(undefined);
  const [userEmail, setUserEmail] = useState('');
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
  const [loadingTrip, setLoadingTrip] = useState(false);
  const [locationsReordered, setLocationsReordered] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState<Array<{
    id: string;
    title: string;
    description: string;
    source: string;
    status: 'pending' | 'loading' | 'completed' | 'error';
    locationIndex?: number;
  }>>([]);

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
    setTripDate(today);
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

        // Store the times in their current positions before reordering
        const timesByPosition = items.map(item => item.time);
        
        // Reorder the locations
        const reorderedItems = arrayMove(items, oldIndex, newIndex);
        
        // Reassign times based on new positions (times stay with positions, not locations)
        const itemsWithSwappedTimes = reorderedItems.map((item, index) => ({
          ...item,
          time: timesByPosition[index]
        }));
        
        console.log(`Location reordered: ${numberToLetter(oldIndex + 1)} → ${numberToLetter(newIndex + 1)}`);
        console.log(`Time swapped: ${items[oldIndex].time} ↔ ${items[newIndex].time}`);
        
        // Show reorder indicator
        setLocationsReordered(true);
        
        return itemsWithSwappedTimes;
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Professional loading steps generator
  const generateLoadingSteps = (locations: any[]) => {
    const steps = [];
    let stepId = 1;

    // Simplified data sources - not per location
    steps.push({
      id: `step-${stepId++}`,
      title: `Analyzing Crime & Safety Data`,
      description: `Retrieving safety statistics and crime reports from official UK Police database`,
      source: 'UK Police National Database',
      status: 'pending' as const
    });

    steps.push({
      id: `step-${stepId++}`,
      title: `Assessing Traffic Conditions`,
      description: `Pulling real-time traffic data, road closures, and congestion patterns`,
      source: 'Transport for London',
      status: 'pending' as const
    });

    steps.push({
      id: `step-${stepId++}`,
      title: `Checking Public Transport Disruptions`,
      description: `Monitoring Underground, bus, and rail service disruptions`,
      source: 'TfL Unified API',
      status: 'pending' as const
    });

    steps.push({
      id: `step-${stepId++}`,
      title: `Analyzing Weather Conditions`,
      description: `Gathering meteorological data and forecast models for trip planning`,
      source: 'Open-Meteo Weather Service',
      status: 'pending' as const
    });

    steps.push({
      id: `step-${stepId++}`,
      title: `Scanning Major Events`,
      description: `Identifying concerts, sports events, and gatherings affecting traffic`,
      source: 'Event Intelligence Network',
      status: 'pending' as const
    });

    steps.push({
      id: `step-${stepId++}`,
      title: `Evaluating Parking Availability`,
      description: `Analyzing parking facilities, restrictions, and pricing information`,
      source: 'TfL Parking Database',
      status: 'pending' as const
    });

    steps.push({
      id: `step-${stepId++}`,
      title: `Calculating Optimal Routes`,
      description: `Processing route efficiency, travel times, and traffic predictions`,
      source: 'Google Maps Directions API',
      status: 'pending' as const
    });

    steps.push({
      id: `step-${stepId++}`,
      title: `Generating Risk Assessment`,
      description: `Synthesizing data into comprehensive executive report with recommendations`,
      source: 'OpenAI GPT-4 Analysis',
      status: 'pending' as const
    });

    return steps;
  };

  const handleTripSubmit = async () => {
    // Validate email
    if (!userEmail || !userEmail.trim()) {
      setError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate all locations are filled
    const validLocations = locations.filter(loc => loc.name && loc.lat !== 0 && loc.lng !== 0);
    
    if (validLocations.length === 0) {
      setError('Please select at least one location');
      return;
    }

    setLoadingTrip(true);
    setError(null);
    setLocationsReordered(false); // Clear reorder indicator

    // Initialize loading steps
    const steps = generateLoadingSteps(validLocations);
    setLoadingSteps(steps);

    // Simulate step-by-step loading with realistic timing
    const simulateLoadingSteps = async () => {
      for (let i = 0; i < steps.length; i++) {
        // Mark current step as loading
        setLoadingSteps(prev => prev.map((step, index) => 
          index === i ? { ...step, status: 'loading' } : step
        ));

        // Wait 2-3 seconds for each step
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));

        // Mark current step as completed
        setLoadingSteps(prev => prev.map((step, index) => 
          index === i ? { ...step, status: 'completed' } : step
        ));
      }
    };

    // Start the loading simulation
    simulateLoadingSteps();

    try {
      const tripDateStr = tripDate ? tripDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🗓️  Trip Date: ${tripDateStr}`);
      console.log(`📍 Analyzing ${validLocations.length} location(s)`);
      console.log(`${'='.repeat(80)}\n`);

      const days = 7; // Fixed period for trip planning

      // Fetch data for all locations in parallel
      const results = await Promise.all(
        validLocations.map(async (location) => {
          console.log(`\n🔍 Fetching data for Location ${numberToLetter(validLocations.indexOf(location) + 1)}: ${location.name} at ${location.time}`);
          
          const tempDistrictId = `custom-${Date.now()}-${location.id}`;

          const [crimeResponse, disruptionsResponse, weatherResponse, eventsResponse, parkingResponse] = await Promise.all([
            fetch(`/api/uk-crime?district=${tempDistrictId}&lat=${location.lat}&lng=${location.lng}`),
            fetch(`/api/tfl-disruptions?district=${tempDistrictId}&days=${days}`),
            fetch(`/api/weather?district=${tempDistrictId}&lat=${location.lat}&lng=${location.lng}&days=${days}`),
            fetch(`/api/events?location=${encodeURIComponent(location.name)}&lat=${location.lat}&lng=${location.lng}&date=${tripDateStr}`),
            fetch(`/api/parking?lat=${location.lat}&lng=${location.lng}&location=${encodeURIComponent(location.name)}`)
          ]);

          // Check if any response failed
          const responses = [crimeResponse, disruptionsResponse, weatherResponse, eventsResponse, parkingResponse];
          const responseNames = ['crime', 'disruptions', 'weather', 'events', 'parking'];
          
          for (let i = 0; i < responses.length; i++) {
            if (!responses[i].ok) {
              const errorText = await responses[i].text();
              console.error(`❌ ${responseNames[i]} API failed:`, responses[i].status, errorText);
              throw new Error(`${responseNames[i]} API returned ${responses[i].status}: ${errorText}`);
            }
          }

          const [crimeData, disruptionsData, weatherData, eventsData, parkingData] = await Promise.all([
            crimeResponse.json(),
            disruptionsResponse.json(),
            weatherResponse.json(),
            eventsResponse.json(),
            parkingResponse.json()
          ]);

          // Fetch cafes using Google Places API (client-side)
          console.log(`☕ Searching for top cafes near ${location.name}...`);
          let cafeData = null;
          try {
            cafeData = await searchNearbyCafes(location.lat, location.lng, location.name);
            console.log(`✅ Found ${cafeData.cafes.length} cafes`);
          } catch (cafeError) {
            console.error('❌ Error fetching cafes:', cafeError);
            // Provide empty cafe data if fetch fails
            cafeData = {
              location: location.name,
              coordinates: { lat: location.lat, lng: location.lng },
              cafes: [],
              summary: { total: 0, averageRating: 0, averageDistance: 0 },
            };
          }

          // Fetch emergency services using Google Places API (client-side)
          console.log(`🚨 Searching for emergency services near ${location.name}...`);
          let emergencyServicesData = null;
          try {
            emergencyServicesData = await searchEmergencyServices(location.lat, location.lng, location.name);
            console.log(`✅ Found emergency services`);
          } catch (emergencyError) {
            console.error('❌ Error fetching emergency services:', emergencyError);
            // Provide empty emergency services data if fetch fails
            emergencyServicesData = {
              location: location.name,
              coordinates: { lat: location.lat, lng: location.lng },
            };
          }

          if (crimeData.success && disruptionsData.success && weatherData.success && eventsData.success && parkingData.success) {
            console.log(`✅ ${location.name}: Safety ${crimeData.data.safetyScore}/100, Events: ${eventsData.data.events.length}, Parking Risk: ${parkingData.data.parkingRiskScore}/10, Cafes: ${cafeData.cafes.length}`);
            
            // Log events to browser console
            if (eventsData.data.events.length > 0) {
              console.log(`\n📰 Events found for ${location.name}:`);
              eventsData.data.events.forEach((event: any, idx: number) => {
                console.log(`  ${idx + 1}. ${event.title} (${event.type}, ${event.severity})`);
              });
            } else {
              console.log(`📰 No events found for ${location.name}`);
            }

            // Log parking summary
            console.log(`\n🅿️  Parking at ${location.name}:`);
            console.log(`   ${parkingData.data.summary.totalNearby} car parks within 1km`);
            if (parkingData.data.cpzInfo.inCPZ) {
              console.log(`   ⚠️  CPZ: ${parkingData.data.cpzInfo.zoneName} (${parkingData.data.cpzInfo.operatingHours})`);
            } else {
              console.log(`   ✓ No CPZ restrictions`);
            }

            // Log cafes summary
            console.log(`\n☕ Top Cafes at ${location.name}:`);
            if (cafeData.cafes.length > 0) {
              cafeData.cafes.forEach((cafe: any, idx: number) => {
                const priceDisplay = cafe.priceLevel > 0 ? '$'.repeat(cafe.priceLevel) : 'N/A';
                console.log(`   ${idx + 1}. ${cafe.name} - ${cafe.rating}⭐ (${cafe.userRatingsTotal} reviews, ${priceDisplay}) - ${Math.round(cafe.distance)}m`);
              });
            } else {
              console.log(`   ⚠️  No cafes found within 250m`);
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
                parking: parkingData.data,
                cafes: cafeData,
                emergencyServices: emergencyServicesData,
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

      // Get traffic predictions for the route
      console.log('🚦 Fetching traffic predictions...');
      let trafficData = null;
      try {
        trafficData = await getTrafficPredictions(validLocations, tripDateStr);
        
        if (trafficData.success) {
          console.log('✅ Traffic predictions completed successfully');
        } else {
          console.error('⚠️ Traffic predictions failed:', trafficData.error);
        }
      } catch (trafficError) {
        console.error('❌ Traffic prediction error:', trafficError);
        trafficData = {
          success: false,
          error: 'Failed to get traffic predictions',
        };
      }

      // Generate executive report
      console.log('🤖 Generating Executive Peace of Mind Report...');
      let executiveReportData = null;
      
      try {
        const reportData = results.map(r => ({
          locationName: r.locationName,
          time: r.time,
          crime: r.data.crime,
          disruptions: r.data.disruptions,
          weather: r.data.weather,
          events: r.data.events,
          parking: r.data.parking,
          cafes: r.data.cafes,
        }));

        const reportResponse = await fetch('/api/executive-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripData: reportData,
            tripDate: tripDateStr,
            routeDistance: trafficData?.totalDistance || '0 km',
            routeDuration: trafficData?.totalMinutes || 0,
            trafficPredictions: trafficData?.success ? trafficData.data : null,
          }),
        });

        const reportResult = await reportResponse.json();
        
        if (reportResult.success) {
          executiveReportData = reportResult.data;
          console.log('✅ Executive Report Generated!');
          console.log(`🎯 Trip Risk Score: ${reportResult.data.tripRiskScore}/10`);
        } else {
          console.error('❌ Executive Report API returned error:', reportResult.error);
          console.error('Full response:', reportResult);
        }
      } catch (reportError) {
        console.error('⚠️ Could not generate executive report:', reportError);
        console.error('Error details:', reportError instanceof Error ? reportError.message : String(reportError));
        // Don't fail the whole trip analysis if report fails
      }

      // Save user to database (upsert - add if new, ignore if exists)
      console.log('💾 Saving user to database...');
      console.log('   Email:', userEmail);
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .upsert({ 
          email: userEmail,
          marketing_consent: true 
        })
        .select();

      if (userError) {
        console.error('❌ Error saving user:', userError);
        console.error('   Details:', JSON.stringify(userError, null, 2));
        throw new Error(`Failed to save user to database: ${userError.message || 'Unknown error'}`);
      }
      console.log('✅ User saved/updated:', userData);

      // Save trip to database
      console.log('💾 Saving trip to database...');
      console.log('   User:', userEmail);
      console.log('   Date:', tripDateStr);
      console.log('   Locations:', validLocations.length);
      
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .insert({
          user_email: userEmail,
          trip_date: tripDateStr,
          locations: validLocations as any,
          trip_results: results as any,
          traffic_predictions: trafficData as any,
          executive_report: executiveReportData as any
        })
        .select()
        .single();

      if (tripError || !tripData) {
        console.error('❌ Error saving trip:', tripError);
        console.error('   Details:', JSON.stringify(tripError, null, 2));
        throw new Error(`Failed to save trip to database: ${tripError?.message || 'Unknown error'}`);
      }

      console.log('✅ Trip saved to database');
      console.log(`🔗 Trip ID: ${tripData.id}`);
      console.log(`📧 User email: ${userEmail}`);

      // Redirect to shareable results page
      console.log('🚀 Redirecting to shareable results page...');
      router.push(`/results/${tripData.id}`);

    } catch (err) {
      console.error('❌ Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch trip data';
      setError(`Trip analysis failed: ${errorMessage}. Please try again or check your internet connection.`);
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
              parking: {
                location: districtName,
                coordinates: { lat: 0, lng: 0 },
                carParks: [],
                cpzInfo: { inCPZ: false },
                parkingRiskScore: 0,
                summary: {
                  totalNearby: 0,
                  averageDistance: 0,
                  hasStationParking: false,
                  cpzWarning: false,
                },
              },
              cafes: {
                location: districtName,
                coordinates: { lat: 0, lng: 0 },
                cafes: [],
                summary: {
                  total: 0,
                  averageRating: 0,
                  averageDistance: 0,
                },
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
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          {/* Logo and Title */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <img src="/Logo.png" alt="My Roadshow Planner Logo" className="h-12 w-auto" />
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                My Roadshow Planner
              </h1>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-muted-foreground text-lg mb-3">
              Plan Your London Trip with Safety, Traffic, Weather & Top Cafes
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <div className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md text-xs font-medium">
                <span>Crime</span>
              </div>
              <div className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md text-xs font-medium">
                <span>Traffic</span>
              </div>
              <div className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md text-xs font-medium">
                <span>Weather</span>
              </div>
              <div className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md text-xs font-medium">
                <span>Cafes</span>
              </div>
              <div className="inline-flex items-center gap-2 bg-ring/20 text-ring px-3 py-1.5 rounded-md text-xs font-semibold border-2 border-ring">
                <span>100% FREE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Multi-Location Trip Planner */}
        <div className="bg-card rounded-md p-6 mb-8 border border-border">
          <h2 className="text-xl font-bold text-card-foreground mb-4">
            Plan Your Roadshow
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Add multiple locations to analyze safety, traffic, and weather for your entire journey
          </p>
          
          {/* User Email - Required Field */}
          <div className="bg-ring/10 border-2 border-ring rounded-md p-4 mb-6">
            <label htmlFor="userEmail" className="block text-sm font-bold text-card-foreground mb-2">
              Your Email <span style={{ color: '#EEEFF4' }}>*</span> (required to analyze)
            </label>
            <Input
              type="email"
              id="userEmail"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="your.email@example.com"
              className="w-full max-w-md bg-card"
            />
            <p className="text-xs text-muted-foreground mt-2">
              We'll use this to send you your trip analysis report
            </p>
          </div>

          {/* Trip Date and City Selector */}
          <div className="rounded-md p-4 mb-6" style={{ backgroundColor: '#1F253D' }}>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tripDate" className="block text-sm font-bold text-primary-foreground mb-2">
                  Trip Date
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      id="tripDate"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-card",
                        !tripDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tripDate ? format(tripDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={tripDate}
                      onSelect={setTripDate}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return date < today;
                      }}
                      defaultMonth={new Date()}
                      showOutsideDays={false}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label htmlFor="citySelect" className="block text-sm font-bold text-primary-foreground mb-2">
                  City
                </label>
                <Select defaultValue="london">
                  <SelectTrigger className="w-full bg-card">
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="london">London</SelectItem>
                    <SelectItem value="newyork" disabled>New York (Coming Soon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            </div>
          )}

          {/* Reorder Indicator */}
          {locationsReordered && (
            <Alert className="mb-4 border-destructive bg-destructive/10">
              <svg className="w-5 h-5 text-destructive flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <AlertDescription className="text-destructive">
                Locations reordered! Click "Analyze Trip" to update the route.
              </AlertDescription>
            </Alert>
          )}

          {/* Add Location & Analyze Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={addLocation}
              variant="outline"
              size="lg"
              className="flex-1 sm:flex-initial border-dashed"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Location
            </Button>

            <Button
              onClick={handleTripSubmit}
              disabled={loadingTrip || !userEmail.trim() || locations.filter(l => l.name).length === 0}
              variant={locationsReordered ? "destructive" : "default"}
              size="lg"
              className={`flex-1 sm:flex-initial ${locationsReordered ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: '#1F253D', color: '#FFFFFF' }}
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
                  Analyze Trip
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Professional Loading State - Vertical Carousel */}
        {loadingTrip && (
          <Card className="mb-8 shadow-xl">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <h3 className="text-xl font-bold text-card-foreground mb-2">Analyzing Your Trip</h3>
                <p className="text-muted-foreground">
                  Gathering comprehensive data from official sources for accurate risk assessment
                </p>
              </div>
              
              {/* Vertical Carousel - Single Active Card */}
              <div className="relative h-48 overflow-hidden">
                {loadingSteps.map((step, index) => {
                  const isActive = step.status === 'loading';
                  const isCompleted = step.status === 'completed';
                  const isPending = step.status === 'pending';
                  
                  return (
                    <div
                      key={step.id}
                      className={`absolute inset-0 transition-all duration-500 ease-in-out ${
                        isActive 
                          ? 'opacity-100 translate-y-0' 
                          : isCompleted 
                            ? 'opacity-0 -translate-y-full pointer-events-none' 
                            : 'opacity-0 translate-y-full pointer-events-none'
                      }`}
                    >
                      <div className="flex items-start gap-6 p-6 rounded-md border-2 border-border bg-card">
                        {/* Status Icon */}
                        <div className="flex-shrink-0 mt-1">
                          {isActive && (
                            <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                          )}
                          {isCompleted && (
                            <div className="w-12 h-12 rounded-full bg-ring flex items-center justify-center">
                              <svg className="w-6 h-6 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                        
                        {/* Step Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <h4 className="text-lg font-bold text-card-foreground leading-tight">
                              {step.title}
                            </h4>
                            <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0">
                              {step.source}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {step.description}
                          </p>
                          
                          {/* Progress indicator */}
                          <div className="mt-4 flex items-center gap-2">
                            <div className="text-xs font-medium text-muted-foreground">
                              Step {loadingSteps.filter(s => s.status === 'completed').length + 1} of {loadingSteps.length}
                            </div>
                            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary transition-all duration-500 ease-out"
                                style={{ 
                                  width: `${((loadingSteps.filter(s => s.status === 'completed').length) / loadingSteps.length) * 100}%` 
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Alert className="border-destructive bg-destructive/10">
            <svg className="w-5 h-5 text-destructive flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <AlertDescription className="text-destructive">
              <strong>Error Loading Data:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

      </div>
    </div>
  );
}
