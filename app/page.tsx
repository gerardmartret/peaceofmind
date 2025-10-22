'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import GoogleLocationSearch from '@/components/GoogleLocationSearch';
import GoogleTripMap from '@/components/GoogleTripMap';
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
import { validateBusinessEmail } from '@/lib/email-validation';
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
    return 'Resume at';
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
          <div className="flex-1 grid sm:grid-cols-[140px_1fr] gap-3">
            {/* Time Picker */}
            <div>
              <Label className="text-xs font-medium text-secondary-foreground mb-1">
                {getTimeLabel()}
              </Label>
              <TimePicker
                value={location.time}
                onChange={(value) => onTimeChange(location.id, value)}
                className="h-9"
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

interface SortableExtractedLocationItemProps {
  location: {
    location: string;
    time: string;
    confidence: string;
    purpose: string;
    verified: boolean;
    formattedAddress: string;
    lat: number;
    lng: number;
    placeId: string | null;
  };
  index: number;
  totalLocations: number;
  onLocationSelect: (index: number, location: any) => void;
  onTimeChange: (index: number, time: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  editingIndex: number | null;
  editingField: 'location' | 'time' | null;
  onEditStart: (index: number, field: 'location' | 'time') => void;
  onEditEnd: () => void;
}

function SortableExtractedLocationItem({
  location,
  index,
  totalLocations,
  onLocationSelect,
  onTimeChange,
  onRemove,
  canRemove,
  editingIndex,
  editingField,
  onEditStart,
  onEditEnd,
}: SortableExtractedLocationItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: location.location });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Determine time label based on position
  const getTimeLabel = () => {
    if (index === 0) return 'Pickup time';
    if (index === totalLocations - 1) return 'Dropoff time';
    return 'Resume at';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card rounded-md p-4 border border-border relative"
    >
      {/* Letter Label - Top Left */}
      <div className="absolute top-2 left-2 text-muted-foreground/40 text-xs font-normal">
        {numberToLetter(index + 1)}
      </div>
      
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
        <div className="flex-1 grid sm:grid-cols-[140px_1fr] gap-3">
          {/* Time Picker */}
          <div>
            <Label className="text-xs font-medium text-secondary-foreground mb-1">
              {getTimeLabel()}
            </Label>
            <TimePicker
              value={location.time}
              onChange={(value) => onTimeChange(index, value)}
              className="h-9"
            />
          </div>

          {/* Location Search */}
          <div className="min-w-0">
            <Label className="text-xs font-medium text-secondary-foreground mb-1">Location</Label>
            {editingIndex === index && editingField === 'location' ? (
              <GoogleLocationSearch
                onLocationSelect={(loc) => {
                  onLocationSelect(index, loc);
                  onEditEnd();
                }}
              />
            ) : (
              <div 
                className="relative h-9 flex items-center px-3 cursor-pointer hover:bg-muted rounded-md border border-input bg-background"
                onClick={() => onEditStart(index, 'location')}
              >
                <svg className="w-4 h-4 text-muted-foreground mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="flex-1 truncate text-base md:text-sm">
                  {location.verified ? location.formattedAddress : location.location}
                </span>
                {location.verified && (
                  <svg className="w-4 h-4 text-green-600 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Delete Button - Far Right */}
        {canRemove && (
          <button 
            className="flex-shrink-0 p-2 text-muted-foreground hover:text-destructive transition-colors"
            onClick={() => onRemove(index)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
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
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [locations, setLocations] = useState<Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    time: string;
  }>>([
    { id: '1', name: '', lat: 0, lng: 0, time: '09:00' },
    { id: '2', name: '', lat: 0, lng: 0, time: '12:00' },
    { id: '3', name: '', lat: 0, lng: 0, time: '17:00' },
  ]);
  const [loadingTrip, setLoadingTrip] = useState(false);
  const [locationsReordered, setLocationsReordered] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0); // Smooth progress 0-100
  const [tripId, setTripId] = useState<string | null>(null); // Store trip ID for manual navigation
  const [userEmail, setUserEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loadingSteps, setLoadingSteps] = useState<Array<{
    id: string;
    title: string;
    description: string;
    source: string;
    status: 'pending' | 'loading' | 'completed' | 'error';
    locationIndex?: number;
  }>>([]);

  // Email/text extraction state
  const [extractionText, setExtractionText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractedLocations, setExtractedLocations] = useState<Array<{
    location: string;
    time: string;
    confidence: string;
    purpose: string;
    verified: boolean;
    formattedAddress: string;
    lat: number;
    lng: number;
    placeId: string | null;
  }> | null>(null);
  const [extractedDate, setExtractedDate] = useState<string | null>(null);
  const [extractedDriverSummary, setExtractedDriverSummary] = useState<string | null>(null);
  const [editingExtractedIndex, setEditingExtractedIndex] = useState<number | null>(null);
  const [editingExtractedField, setEditingExtractedField] = useState<'location' | 'time' | null>(null);


  // Refs for debouncing timeouts
  const locationEditTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timeEditTimeoutRef = useRef<NodeJS.Timeout | null>(null);



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
    
    // Restore extracted data from session storage
    console.log('🔄 [FRONTEND] Checking session storage for saved data...');
    if (typeof window !== 'undefined') {
      const savedData = sessionStorage.getItem('extractedTripData');
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          console.log('📦 [FRONTEND] Found saved extraction data:', parsed);
          console.log('📅 [FRONTEND] Saved timestamp:', parsed.timestamp);
          
          // Restore the data
          setExtractionText(parsed.text || '');
          setExtractedLocations(parsed.locations || null);
          setExtractedDate(parsed.date || null);
          setExtractedDriverSummary(parsed.driverSummary || null);
          
          console.log('✅ [FRONTEND] Restored extraction data from session storage');
        } catch (error) {
          console.error('❌ [FRONTEND] Error parsing session storage data:', error);
        }
      } else {
        console.log('ℹ️ [FRONTEND] No saved extraction data found in session storage');
      }
    }

    // Cleanup timeouts on unmount
    return () => {
      if (locationEditTimeoutRef.current) {
        clearTimeout(locationEditTimeoutRef.current);
      }
      if (timeEditTimeoutRef.current) {
        clearTimeout(timeEditTimeoutRef.current);
      }
    };
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

  // Handle drag end for extracted locations
  const handleExtractedDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over?.id && extractedLocations) {
      const oldIndex = extractedLocations.findIndex((item) => item.location === active.id);
      const newIndex = extractedLocations.findIndex((item) => item.location === over.id);

      const reorderedLocations = arrayMove(extractedLocations, oldIndex, newIndex);
      setExtractedLocations(reorderedLocations);

      // Save to session storage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('extractedTripData', JSON.stringify({
          text: extractionText,
          locations: reorderedLocations,
          date: extractedDate,
          driverSummary: extractedDriverSummary,
          timestamp: new Date().toISOString(),
        }));
        console.log('💾 [FRONTEND] Saved reordered extracted locations to session storage');
      }
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

  const handleEmailChange = (email: string) => {
    setUserEmail(email);
    // Clear error when user starts typing
    if (emailError) {
      setEmailError(null);
    }
  };

  const handleEmailBlur = () => {
    if (userEmail.trim()) {
      const validation = validateBusinessEmail(userEmail);
      if (!validation.isValid) {
        setEmailError(validation.error || 'Invalid email address');
      } else {
        setEmailError(null);
      }
    }
  };

  const handleExtractedTripSubmit = async () => {
    // Use user's email if provided, otherwise default
    const emailToUse = userEmail.trim() || 'anonymous@peaceofmind.com';

    // Validate extracted locations
    if (!extractedLocations || extractedLocations.length === 0) {
      setExtractionError('No locations to analyze. Please extract locations first.');
      return;
    }

    // Validate all extracted locations have coordinates
    const validExtractedLocations = extractedLocations.filter(loc => loc.verified && loc.lat !== 0 && loc.lng !== 0);
    
    if (validExtractedLocations.length === 0) {
      setExtractionError('All locations need to be verified. Please check the locations.');
      return;
    }

    // Map extracted locations to the format expected by the analysis pipeline
    const mappedLocations = validExtractedLocations.map((loc, idx) => ({
      id: (idx + 1).toString(),
      name: loc.purpose || `Location ${idx + 1}`, // Use AI-generated purpose as the name
      lat: loc.lat,
      lng: loc.lng,
      time: loc.time,
      fullAddress: loc.formattedAddress // Keep full address for reference
    }));

    // Set the trip date from extracted data or use today
    const tripDateToUse = extractedDate ? new Date(extractedDate) : new Date();

    console.log('\n🚀 Starting analysis for EXTRACTED trip data...');
    console.log(`📍 ${mappedLocations.length} locations mapped from extraction`);
    console.log(`📅 Trip date: ${tripDateToUse.toISOString().split('T')[0]}`);
    if (extractedDriverSummary) {
      console.log(`📝 Driver summary will be saved: ${extractedDriverSummary.substring(0, 50)}...`);
    }

    // Now call the same trip submission logic with mapped data and driver summary
    await performTripAnalysis(mappedLocations, tripDateToUse, emailToUse, extractedDriverSummary);
  };

  const handleTripSubmit = async () => {
    // Use user's email if provided, otherwise default
    const emailToUse = userEmail.trim() || 'anonymous@peaceofmind.com';

    // Validate all locations are filled
    const validLocations = locations.filter(loc => loc.name && loc.lat !== 0 && loc.lng !== 0);
    
    if (validLocations.length === 0) {
      setError('Please select at least one location');
      return;
    }

    const tripDateToUse = tripDate || new Date();

    console.log('\n🚀 Starting analysis for MANUAL trip data...');
    console.log(`📍 ${validLocations.length} locations from manual form`);
    console.log(`📅 Trip date: ${tripDateToUse.toISOString().split('T')[0]}`);

    // Call the trip analysis with manual form data
    await performTripAnalysis(validLocations, tripDateToUse, emailToUse);
  };

  const performTripAnalysis = async (
    validLocations: Array<{ id: string; name: string; lat: number; lng: number; time: string; fullAddress?: string }>,
    tripDateObj: Date,
    emailToUse: string,
    driverSummary?: string | null
  ) => {
    setLoadingTrip(true);
    setError(null);
    setEmailError(null);
    setExtractionError(null); // Clear extraction errors too
    setLocationsReordered(false); // Clear reorder indicator

    // Initialize loading steps
    const steps = generateLoadingSteps(validLocations);
    setLoadingSteps(steps);
    setLoadingProgress(0);

    // Simulate step-by-step loading with realistic timing and smooth progress
    const simulateLoadingSteps = async () => {
      for (let i = 0; i < steps.length; i++) {
        // Mark current step as loading
        setLoadingSteps(prev => prev.map((step, index) => 
          index === i ? { ...step, status: 'loading' } : step
        ));

        // Calculate progress range for this step
        const startProgress = (i / steps.length) * 100;
        const endProgress = ((i + 1) / steps.length) * 100;
        
        // Variable duration for each step (2-3.5 seconds) to simulate different processing times
        // Total target: ~10 seconds for all steps combined
        const stepDurations = [2500, 3000, 2250, 2750, 3500, 2000, 3250, 2500]; // Faster durations
        const baseDuration = stepDurations[i % stepDurations.length];
        const stepDuration = baseDuration + Math.random() * 500;
        
        // Smoothly animate progress for this step with variable speed
        const startTime = Date.now();
        const animateProgress = () => {
          const elapsed = Date.now() - startTime;
          const stepProgress = Math.min(elapsed / stepDuration, 1);
          
          // Ease in-out curve for more natural feel
          const eased = stepProgress < 0.5
            ? 2 * stepProgress * stepProgress
            : 1 - Math.pow(-2 * stepProgress + 2, 2) / 2;
          
          const currentProgress = startProgress + (endProgress - startProgress) * eased;
          setLoadingProgress(currentProgress);
          
          if (stepProgress < 1) {
            requestAnimationFrame(animateProgress);
          }
        };
        
        animateProgress();
        
        // Wait for step duration
        await new Promise(resolve => setTimeout(resolve, stepDuration));

        // Mark current step as completed
        setLoadingSteps(prev => prev.map((step, index) => 
          index === i ? { ...step, status: 'completed' } : step
        ));
      }
      
      // Ensure we hit 100% at the end
      setLoadingProgress(100);
    };

    // Start the loading simulation
    simulateLoadingSteps();

    // Track when background process completes
    let backgroundProcessComplete = false;

    try {
      const tripDateStr = tripDateObj.toISOString().split('T')[0];
      
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
              fullAddress: location.fullAddress || location.name, // Use fullAddress if available, fallback to name
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
      console.log('   Email:', emailToUse);
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .upsert({ 
          email: emailToUse,
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
      console.log('   User:', emailToUse);
      console.log('   Date:', tripDateStr);
      console.log('   Locations:', validLocations.length);
      if (driverSummary) {
        console.log('   Driver Summary:', driverSummary.substring(0, 100) + '...');
      }
      
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .insert({
          user_email: emailToUse,
          trip_date: tripDateStr,
          locations: validLocations as any,
          trip_results: results as any,
          traffic_predictions: trafficData as any,
          executive_report: executiveReportData as any,
          driver_notes: driverSummary || null
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
      console.log(`📧 User email: ${emailToUse}`);

      // Store trip ID for manual navigation
      setTripId(tripData.id);

      // Mark background process as complete
      backgroundProcessComplete = true;
      console.log('✅ Background process complete');
      
      // Wait for visual animation to complete (ensure it reaches 100%)
      console.log('🚀 Waiting for visual animation to complete...');
      
      const waitForCompletion = () => {
        // Only redirect when BOTH conditions are met:
        // 1. Background process is complete
        // 2. Visual animation reaches 100%
        if (backgroundProcessComplete && loadingProgress >= 100) {
          console.log('✅ Both background process and visual animation complete, redirecting...');
          // Small delay to show the green completion state
          setTimeout(() => {
            router.push(`/results/${tripData.id}`);
          }, 500);
        } else {
          console.log(`Background complete: ${backgroundProcessComplete}, Progress: ${loadingProgress}%`);
          setTimeout(waitForCompletion, 100);
        }
      };
      
      // Start checking for completion
      setTimeout(waitForCompletion, 100);

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

  // Handle text extraction for trip planning
  const handleExtractTrip = async () => {
    console.log('🚀 [FRONTEND] Starting extraction...');
    console.log('📝 [FRONTEND] Input text:', extractionText.substring(0, 100) + '...');
    
    if (!extractionText.trim()) {
      console.log('❌ [FRONTEND] Empty text provided');
      setExtractionError('Please enter some text to extract trip information.');
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);
    setExtractedLocations(null);
    setExtractedDate(null);

    try {
      console.log('📡 [FRONTEND] Sending request to /api/extract-trip...');
      const response = await fetch('/api/extract-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: extractionText }),
      });

      console.log('📥 [FRONTEND] Response status:', response.status);
      const data = await response.json();
      console.log('📥 [FRONTEND] Response data:', data);

      if (!data.success) {
        console.log('❌ [FRONTEND] Extraction failed:', data.error);
        setExtractionError(data.error || 'Failed to extract trip information.');
        return;
      }

      console.log('✅ [FRONTEND] Extraction successful!');
      console.log(`📍 [FRONTEND] Extracted ${data.locations?.length || 0} locations`);
      console.log('📍 [FRONTEND] Locations:', data.locations);
      if (data.driverSummary) {
        console.log('📝 [FRONTEND] Driver summary:', data.driverSummary);
      }
      
      setExtractedLocations(data.locations);
      setExtractedDate(data.date);
      setExtractedDriverSummary(data.driverSummary);

      // Save to session storage
      console.log('💾 [FRONTEND] Saving to session storage...');
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('extractedTripData', JSON.stringify({
          text: extractionText,
          locations: data.locations,
          date: data.date,
          driverSummary: data.driverSummary,
          timestamp: new Date().toISOString(),
        }));
        console.log('✅ [FRONTEND] Saved to session storage');
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Error extracting trip:', error);
      setExtractionError('An error occurred while extracting trip information.');
    } finally {
      setIsExtracting(false);
      console.log('🏁 [FRONTEND] Extraction process complete');
    }
  };


  // Handle clearing extraction results
  const handleClearExtraction = () => {
    console.log('🧹 [FRONTEND] Clearing extraction results...');
    setExtractedLocations(null);
    setExtractedDate(null);
    setExtractedDriverSummary(null);
    setExtractionText('');
    setExtractionError(null);
    
    // Clear from session storage
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('extractedTripData');
      console.log('✅ [FRONTEND] Cleared session storage');
    }
  };


  // Handle manual location edit
  const handleLocationEdit = (index: number, value: string) => {
    console.log(`✏️ [FRONTEND] Manual location edit for index ${index}: "${value}"`);
    if (extractedLocations) {
      const updatedLocations = [...extractedLocations];
      updatedLocations[index] = {
        ...updatedLocations[index],
        location: value,
        formattedAddress: value,
        verified: false,
        lat: 0,
        lng: 0,
        placeId: null,
      };
      setExtractedLocations(updatedLocations);
      
      // Save to session storage with debouncing
      if (typeof window !== 'undefined') {
        // Clear any existing timeout
        if (locationEditTimeoutRef.current) {
          clearTimeout(locationEditTimeoutRef.current);
        }
        
        // Set new timeout for saving
        locationEditTimeoutRef.current = setTimeout(() => {
          sessionStorage.setItem('extractedTripData', JSON.stringify({
            text: extractionText,
            locations: updatedLocations,
            date: extractedDate,
            timestamp: new Date().toISOString(),
          }));
          console.log('💾 [FRONTEND] Saved manual location edit to session storage');
        }, 500); // Save after 500ms of no typing
      }
    }
  };

  // Handle time edit
  const handleTimeEdit = (index: number, value: string) => {
    if (extractedLocations) {
      const updatedLocations = [...extractedLocations];
      updatedLocations[index] = {
        ...updatedLocations[index],
        time: value,
      };
      setExtractedLocations(updatedLocations);
      
      // Save to session storage with debouncing
      if (typeof window !== 'undefined') {
        // Clear any existing timeout
        if (timeEditTimeoutRef.current) {
          clearTimeout(timeEditTimeoutRef.current);
        }
        
        // Set new timeout for saving
        timeEditTimeoutRef.current = setTimeout(() => {
          sessionStorage.setItem('extractedTripData', JSON.stringify({
            text: extractionText,
            locations: updatedLocations,
            date: extractedDate,
            timestamp: new Date().toISOString(),
          }));
          console.log('💾 [FRONTEND] Saved time edit to session storage');
        }, 500); // Save after 500ms of no typing
      }
    }
  };

  // Handle date edit
  const handleDateEdit = (value: string) => {
    setExtractedDate(value);
    
    // Save to session storage
    if (typeof window !== 'undefined' && extractedLocations) {
      sessionStorage.setItem('extractedTripData', JSON.stringify({
        text: extractionText,
        locations: extractedLocations,
        date: value,
        driverSummary: extractedDriverSummary,
        timestamp: new Date().toISOString(),
      }));
    }
  };

  // Handle extracted location selection
  const handleExtractedLocationSelect = (index: number, location: any) => {
    if (extractedLocations) {
      const updatedLocations = [...extractedLocations];
      updatedLocations[index] = {
        ...updatedLocations[index],
        location: location.name,
        formattedAddress: location.name,
        lat: location.lat,
        lng: location.lng,
        placeId: null,
        verified: true,
      };
      setExtractedLocations(updatedLocations);
      
      // Save to session storage immediately
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('extractedTripData', JSON.stringify({
          text: extractionText,
          locations: updatedLocations,
          date: extractedDate,
          driverSummary: extractedDriverSummary,
          timestamp: new Date().toISOString(),
        }));
        console.log('💾 [FRONTEND] Saved Google Maps selection to session storage');
      }
    }
  };

  // Handle extracted location removal
  const handleExtractedLocationRemove = (index: number) => {
    if (extractedLocations && extractedLocations.length > 1) {
      const updatedLocations = extractedLocations.filter((_, i) => i !== index);
      setExtractedLocations(updatedLocations);
      
      // Save to session storage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('extractedTripData', JSON.stringify({
          text: extractionText,
          locations: updatedLocations,
          date: extractedDate,
          driverSummary: extractedDriverSummary,
          timestamp: new Date().toISOString(),
        }));
        console.log('💾 [FRONTEND] Saved location removal to session storage');
      }
    }
  };

  // Get time label based on position in the trip
  const getTimeLabel = (index: number, totalLocations: number) => {
    if (index === 0) return 'Pickup Time';
    if (index === totalLocations - 1) return 'Drop Off Time';
    return 'Resume At';
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

        {/* Email/Text Import Section */}
        <div className="bg-card rounded-md p-6 mb-8 border border-border">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-card-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h2 className="text-xl font-bold text-card-foreground">
              Import Trip from Email or Text
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Paste an email, message, or any text with trip details. We'll automatically extract locations and times for you.
          </p>

          <div className="space-y-4">
            {/* Textarea */}
            <div>
              <textarea
                value={extractionText}
                onChange={(e) => setExtractionText(e.target.value)}
                placeholder="Example: Pick me up from Heathrow at 9am, then we go to the office at 123 Baker Street at 11am, and finally drop off at Kings Cross at 3pm on December 25th."
                className="w-full min-h-[150px] p-3 rounded-md border-2 border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
              />
            </div>

            {/* Extract Button */}
            <div className="flex items-center gap-3">
              <Button
                onClick={() => {
                  // Scroll to the manual form section
                  const manualFormSection = document.getElementById('manual-form-section');
                  if (manualFormSection) {
                    manualFormSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                variant="outline"
                size="lg"
                className="flex-1 sm:flex-initial"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Create Trip Manually
              </Button>

              <Button
                onClick={handleExtractTrip}
                disabled={isExtracting || !extractionText.trim()}
                size="lg"
                className="flex items-center gap-2"
                style={{ backgroundColor: '#18815A', color: '#FFFFFF' }}
              >
                {isExtracting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Extracting...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Extract Locations & Times
                  </>
                )}
              </Button>
              {extractedLocations && (
                <Button
                  onClick={handleClearExtraction}
                  variant="outline"
                  size="lg"
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Error Message */}
            {extractionError && (
              <Alert variant="destructive">
                <AlertDescription>{extractionError}</AlertDescription>
              </Alert>
            )}

            {/* Extracted Results - Matching Manual Form Design */}
            {extractedLocations && extractedLocations.length > 0 && (
              <div className="bg-card rounded-md p-6 mb-8 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <h2 className="text-xl font-bold text-card-foreground">
                      Route Proposal
                    </h2>
                  </div>
                  {extractedDate && (
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(extractedDate), "PPP")}
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Found {extractedLocations.length} stop{extractedLocations.length > 1 ? 's' : ''} in chronological order. Review and edit as needed.
                </p>

                {/* Dark Header Section - Trip Date & City */}
                <div className="bg-black rounded-md p-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label className="text-white font-bold text-sm mb-2 block">Trip Date</Label>
                      <div className="relative">
                        <Input
                          type="date"
                          value={extractedDate || ''}
                          onChange={(e) => handleDateEdit(e.target.value)}
                          className="bg-white text-gray-900 border-gray-300 rounded-md h-9 pl-10"
                        />
                        <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <Label className="text-white font-bold text-sm mb-2 block">City</Label>
                      <div className="relative">
                        <Input
                          value="London"
                          readOnly
                          className="bg-white text-gray-900 border-gray-300 rounded-md h-9 pr-10"
                        />
                        <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Location Cards with Drag and Drop */}
                {isMounted ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleExtractedDragEnd}
                  >
                    <SortableContext
                      items={extractedLocations.map(loc => loc.location)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-4">
                        {extractedLocations.map((loc, index) => (
                          <SortableExtractedLocationItem
                            key={loc.location}
                            location={loc}
                            index={index}
                            totalLocations={extractedLocations.length}
                            onLocationSelect={handleExtractedLocationSelect}
                            onTimeChange={handleTimeEdit}
                            onRemove={handleExtractedLocationRemove}
                            canRemove={extractedLocations.length > 1}
                            editingIndex={editingExtractedIndex}
                            editingField={editingExtractedField}
                            onEditStart={(index, field) => {
                              setEditingExtractedIndex(index);
                              setEditingExtractedField(field);
                            }}
                            onEditEnd={() => {
                              setEditingExtractedIndex(null);
                              setEditingExtractedField(null);
                            }}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  </div>
                )}

                {/* Add Location and Analyze Trip Buttons */}
                <div className="mt-4 flex gap-3">
                  <Button
                    onClick={() => {
                      if (extractedLocations) {
                        const newLocation = {
                          location: '',
                          time: '12:00',
                          confidence: 'low',
                          purpose: `Location ${extractedLocations.length + 1}`,
                          verified: false,
                          formattedAddress: '',
                          lat: 0,
                          lng: 0,
                          placeId: null,
                        };
                        setExtractedLocations([...extractedLocations, newLocation]);
                        
                        // Save to session storage
                        if (typeof window !== 'undefined') {
                          const updatedLocations = [...extractedLocations, newLocation];
                          sessionStorage.setItem('extractedTripData', JSON.stringify({
                            text: extractionText,
                            locations: updatedLocations,
                            date: extractedDate,
                            driverSummary: extractedDriverSummary,
                            timestamp: new Date().toISOString(),
                          }));
                          console.log('💾 [FRONTEND] Saved new location to session storage');
                        }
                      }
                    }}
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
                    onClick={handleExtractedTripSubmit}
                    disabled={loadingTrip || !extractedLocations?.every(loc => loc.verified)}
                    size="lg"
                    className="flex items-center gap-2 text-white"
                    style={{ backgroundColor: '#05060A' }}
                  >
                    {loadingTrip ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        Analyze Trip
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={() => setMapOpen(true)}
                    variant="outline"
                    size="lg"
                    className="flex-1 sm:flex-initial ml-auto"
                    disabled={!extractedLocations || extractedLocations.filter(loc => loc.verified).length < 2}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    View Route
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Multi-Location Trip Planner */}
        <div id="manual-form-section" className="bg-card rounded-md p-6 mb-8 border border-border">
          <h2 className="text-xl font-bold text-card-foreground mb-4">
            Plan Your Roadshow
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Add multiple locations to analyze safety, traffic, and weather for your entire journey
          </p>
          

          {/* Trip Date and City Selector */}
          <div className="rounded-md p-4 mb-6" style={{ backgroundColor: '#05060A' }}>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tripDate" className="block text-sm font-bold text-primary-foreground mb-2">
                  Trip Date
                </label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
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
                      onSelect={(date) => {
                        setTripDate(date);
                        setDatePickerOpen(false);
                      }}
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

           {/* Add Location, Analyze Trip & View Map Buttons */}
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
               disabled={loadingTrip || locations.filter(l => l.name).length === 0}
               variant={locationsReordered ? "destructive" : "default"}
               size="lg"
               className={`flex-1 sm:flex-initial ${locationsReordered ? 'animate-pulse' : ''}`}
               style={{ backgroundColor: '#05060A', color: '#FFFFFF' }}
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

            <Button
              onClick={() => setMapOpen(true)}
              variant="outline"
              size="lg"
              className="flex-1 sm:flex-initial ml-auto"
              disabled={locations.filter(l => l.name).length < 2}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              View Route
            </Button>
          </div>
        </div>

        {/* Professional Loading State - Overlay Modal */}
        {loadingTrip && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] shadow-2xl animate-in fade-in zoom-in duration-300 overflow-y-auto">
              <CardContent className="p-8">
                <div className="space-y-8">
                  {/* Circular Progress Indicator */}
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative w-32 h-32">
                      {/* Background Circle */}
                      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                        <circle
                          cx="60"
                          cy="60"
                          r="54"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          className="text-secondary"
                        />
                        {/* Progress Circle */}
                        <circle
                          cx="60"
                          cy="60"
                          r="54"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          strokeDasharray="339.292"
                          strokeDashoffset={339.292 * (1 - loadingProgress / 100)}
                          className={loadingProgress >= 100 ? "text-green-500" : "text-primary"}
                          strokeLinecap="round"
                        />
                      </svg>
                      {/* Percentage Text */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-bold">
                          {Math.round(loadingProgress)}%
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <h3 className="text-xl font-semibold mb-1">Analyzing Your Trip</h3>
                      <p className="text-sm text-muted-foreground">
                        {loadingSteps.filter(s => s.status === 'completed').length} of {loadingSteps.length} steps completed
                      </p>
                    </div>
                  </div>

                  {/* Steps List - Carousel View or Completion View */}
                  <div className="relative h-[200px] overflow-hidden">
        {loadingProgress >= 100 ? (
          // Completion View - Show email field and View Report button only
          <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
            {/* Email Field and View Report Button */}
            <div className="bg-ring/10 border-2 border-ring rounded-md p-4">
              <div className="flex flex-col items-center space-y-4">
                <label htmlFor="userEmail" className="block text-sm font-bold text-card-foreground text-center">
                  Your Business Email <span style={{ color: '#EEEFF4' }}>*</span> (required to analyze)
                </label>
                <Input
                  type="email"
                  id="userEmail"
                  value={userEmail}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onBlur={handleEmailBlur}
                  placeholder="name@company.com"
                  className={cn(
                    "w-full max-w-xs bg-card placeholder:text-muted-foreground/40",
                    emailError && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                {emailError ? (
                  <p className="text-xs text-destructive font-medium text-center">
                    {emailError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground text-center">
                    Business email required. Personal emails (Gmail, Yahoo, etc.) are not accepted.
                  </p>
                )}
                
                {/* View Report Button */}
                <Button
                  onClick={() => {
                    if (tripId) {
                      console.log('View Report clicked - redirecting to results...');
                      router.push(`/results/${tripId}`);
                    } else {
                      console.log('Trip ID not available yet');
                    }
                  }}
                  size="lg"
                  className="px-6 py-3 font-semibold hover:scale-105 transition-transform"
                  style={{ backgroundColor: '#05060A', color: '#FFFFFF' }}
                  disabled={!tripId || !userEmail.trim() || !!emailError}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View Report
                </Button>
              </div>
            </div>
          </div>
                    ) : (
                      // Carousel View - Show current and previous steps only
                      loadingSteps.map((step, index) => {
                      const isActive = step.status === 'loading';
                      const isCompleted = step.status === 'completed';
                      const isPending = step.status === 'pending';
                      
                      // Calculate position relative to active step
                      const activeIndex = loadingSteps.findIndex(s => s.status === 'loading');
                      const position = index - activeIndex;
                      
                      // Determine visibility and styling
                      let transform = '';
                      let opacity = 0;
                      let scale = 0.85;
                      let zIndex = 0;
                      let blur = 'blur(4px)';
                      
                      if (position === 0) {
                        // Active step - center
                        transform = 'translateY(0)';
                        opacity = 1;
                        scale = 1;
                        zIndex = 30;
                        blur = 'blur(0)';
                      } else if (position === -1) {
                        // Previous step - hide completely (no watermark)
                        transform = 'translateY(-120px)';
                        opacity = 0;
                        scale = 0.85;
                        zIndex = 10;
                      } else if (position === 1) {
                        // Next step - hide completely (no watermark)
                        transform = 'translateY(120px)';
                        opacity = 0;
                        scale = 0.85;
                        zIndex = 10;
                      } else if (position < -1) {
                        // Steps further above
                        transform = 'translateY(-120px)';
                        opacity = 0;
                        scale = 0.85;
                        zIndex = 10;
                      } else {
                        // Steps further below
                        transform = 'translateY(120px)';
                        opacity = 0;
                        scale = 0.85;
                        zIndex = 10;
                      }
                      
                      return (
                        <div
                          key={step.id}
                          className="absolute inset-x-0 top-1/2 -translate-y-1/2 transition-all duration-700 ease-in-out"
                          style={{
                            transform: `${transform} scale(${scale})`,
                            opacity: opacity,
                            zIndex: zIndex,
                            filter: blur
                          }}
                        >
                          <div
                            className={`flex items-start gap-4 p-4 rounded-lg border-2 ${
                              isActive 
                                ? 'border-primary bg-primary/10' 
                                : isCompleted
                                  ? 'border-green-500/30 bg-green-500/5'
                                  : 'border-border bg-muted/30'
                            }`}
                          >
                            {/* Status Icon */}
                            <div className="flex-shrink-0 mt-0.5">
                              {isPending && (
                                <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30"></div>
                              )}
                              {isActive && (
                                <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                              )}
                              {isCompleted && (
                                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            
                            {/* Step Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h4 className={`text-base font-semibold ${isActive ? 'text-primary' : ''}`}>
                                  {step.title}
                                </h4>
                                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded whitespace-nowrap flex-shrink-0">
                                  {step.source}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {step.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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

        {/* Map Popup */}
        {mapOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
                <h3 className="text-lg font-semibold">Route Map</h3>
                <Button
                  onClick={() => setMapOpen(false)}
                  variant="ghost"
                  size="sm"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                {(() => {
                  // Use extracted locations if available, otherwise use manual locations
                  const locationsToShow = extractedLocations && extractedLocations.length > 0 
                    ? extractedLocations.filter(loc => loc.verified && loc.lat !== 0 && loc.lng !== 0)
                    : locations.filter(l => l.name && l.lat !== 0 && l.lng !== 0);
                  
                  return locationsToShow.length > 0 ? (
                  <div className="w-full h-full">
                    <GoogleTripMap 
                      locations={locationsToShow.map((loc, index) => ({
                        id: (index + 1).toString(),
                        name: 'name' in loc ? loc.name : (loc.purpose || `Location ${index + 1}`),
                        lat: loc.lat,
                        lng: loc.lng,
                        time: loc.time || '12:00'
                      }))}
                      height="100%"
                      compact={false}
                    />
                  </div>
                ) : (
                  <div className="w-full h-full bg-muted rounded-md flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-16 h-16 text-muted-foreground mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <p className="text-muted-foreground">Please select at least one location to view the map</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {locationsToShow.length} location(s) selected
                      </p>
                    </div>
                  </div>
                );
                })()}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
