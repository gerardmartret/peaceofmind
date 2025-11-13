'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import GoogleLocationSearch from '@/components/GoogleLocationSearch';
import GoogleTripMap from '@/components/GoogleTripMap';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TimePicker } from '@/components/ui/time-picker';
import { PassengerPicker } from '@/components/ui/passenger-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getTrafficPredictions } from '@/lib/google-traffic-predictions';
import { searchNearbyCafes } from '@/lib/google-cafes';
import { searchEmergencyServices } from '@/lib/google-emergency-services';
import { supabase } from '@/lib/supabase';
import { validateBusinessEmail } from '@/lib/email-validation';
import { useAuth } from '@/lib/auth-context';
import { useHomepageContext } from '@/lib/homepage-context';
import { getCityConfig, createMockResponse, MOCK_DATA } from '@/lib/city-helpers';
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
    purpose: string;
  };
  index: number;
  totalLocations: number;
  onLocationSelect: (id: string, data: { name: string; lat: number; lng: number }) => void;
  onTimeChange: (id: string, time: string) => void;
  onPurposeChange: (id: string, purpose: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  editingIndex: number | null;
  editingField: 'location' | 'time' | 'purpose' | null;
  onEditStart: (id: string, field: 'location' | 'time' | 'purpose') => void;
  onEditEnd: () => void;
  tripDestination?: string; // Add trip destination for city-aware location search
}

function SortableLocationItem({
  location,
  index,
  totalLocations,
  onLocationSelect,
  onTimeChange,
  onPurposeChange,
  onRemove,
  canRemove,
  editingIndex,
  editingField,
  onEditStart,
  onEditEnd,
  tripDestination,
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
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted dark:hover:bg-[#181a23] rounded transition-colors flex items-center"
          title="Drag to reorder"
        >
          <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>

        {/* Time Picker, Location Search, and Purpose */}
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

          {/* Location and Purpose Stacked */}
          <div className="min-w-0 space-y-3">
            {/* Location Search */}
            <div>
              <Label className="text-xs font-medium text-secondary-foreground mb-1">Location</Label>
              {editingIndex === index && editingField === 'location' ? (
                <div className="editing-location" data-editing="true">
                  <GoogleLocationSearch
                    currentLocation={location.name}
                    tripDestination={tripDestination}
                    onLocationSelect={(loc) => {
                      onLocationSelect(location.id, loc);
                      onEditEnd();
                    }}
                  />
                </div>
              ) : (
                <div 
                  className="relative px-3 py-2 cursor-pointer hover:bg-muted dark:hover:bg-[#181a23] rounded-md border border-input bg-background transition-colors"
                  onClick={() => onEditStart(location.id, 'location')}
                >
                  {location.name ? (
                    <div className="flex items-start gap-3">
                      <svg className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        {(() => {
                          const { businessName, restOfAddress } = formatLocationDisplay(location.name);
                          
                          return (
                            <>
                              <div className="text-sm font-semibold text-card-foreground truncate flex-shrink-0">
                                {businessName}
                              </div>
                              {restOfAddress && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {restOfAddress}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span className="flex-1 text-base md:text-sm text-muted-foreground">
                        Search hotels, restaurants, landmarks, or any location...
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Purpose Field - Hidden */}
            {/* <div>
              <Label className="text-xs font-medium text-secondary-foreground mb-1">Purpose</Label>
              {editingIndex === index && editingField === 'purpose' ? (
                <div className="editing-purpose" data-editing="true">
                  <Input
                    value={location.purpose}
                    onChange={(e) => onPurposeChange(location.id, e.target.value)}
                    onBlur={onEditEnd}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onEditEnd();
                      }
                    }}
                    className="h-9"
                    autoFocus
                  />
                </div>
              ) : (
                <div 
                  className="relative h-9 flex items-center px-3 cursor-pointer hover:bg-muted dark:hover:bg-[#181a23] rounded-md border border-input bg-background transition-colors"
                  onClick={() => onEditStart(location.id, 'purpose')}
                >
                  <svg className="w-4 h-4 text-muted-foreground mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  <span className="flex-1 truncate text-base md:text-sm">
                    {location.purpose || 'Click to edit purpose...'}
                  </span>
                </div>
              )}
            </div> */}
          </div>
        </div>

        {/* Delete Button - Far Right */}
        {canRemove && (
          <button 
            className="flex-shrink-0 p-2 text-muted-foreground hover:text-destructive transition-colors"
            onClick={() => onRemove(location.id)}
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
  onPurposeChange: (index: number, purpose: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  editingIndex: number | null;
  editingField: 'location' | 'time' | 'purpose' | null;
  onEditStart: (index: number, field: 'location' | 'time' | 'purpose') => void;
  onEditEnd: () => void;
  tripDestination?: string; // Add trip destination for city-aware location search
}

function SortableExtractedLocationItem({
  location,
  index,
  totalLocations,
  onLocationSelect,
  onTimeChange,
  onPurposeChange,
  onRemove,
  canRemove,
  editingIndex,
  editingField,
  onEditStart,
  onEditEnd,
  tripDestination,
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
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted dark:hover:bg-[#181a23] rounded transition-colors flex items-center"
          title="Drag to reorder"
        >
          <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>

        {/* Time Picker, Location Search, and Purpose */}
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

          {/* Location and Purpose Stacked */}
          <div className="min-w-0 space-y-3">
            {/* Location Search */}
            <div>
              <Label className="text-xs font-medium text-secondary-foreground mb-1">Location</Label>
              {editingIndex === index && editingField === 'location' ? (
                <div className="editing-location" data-editing="true">
                  <GoogleLocationSearch
                    currentLocation={`${location.location} - ${location.formattedAddress || location.location}`}
                    tripDestination={tripDestination}
                    onLocationSelect={(loc) => {
                      onLocationSelect(index, loc);
                      onEditEnd();
                    }}
                  />
                </div>
              ) : (
                <div 
                  className="relative px-3 py-2 cursor-pointer hover:bg-muted dark:hover:bg-[#181a23] rounded-md border border-input bg-background transition-colors"
                  onClick={() => onEditStart(index, 'location')}
                >
                  <div className="flex items-start gap-3">
                    <svg className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      {(() => {
                        const fullAddr = location.formattedAddress || location.location;
                        const { businessName, restOfAddress } = formatLocationDisplay(fullAddr);
                        
                        return (
                          <>
                            <div className="text-sm font-semibold text-card-foreground truncate flex-shrink-0">
                              {businessName || location.location}
                            </div>
                            {restOfAddress && (
                              <div className="text-xs text-muted-foreground truncate">
                                {restOfAddress}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    {location.verified && (
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Purpose Field - Hidden */}
            {/* <div>
              <Label className="text-xs font-medium text-secondary-foreground mb-1">Purpose</Label>
              {editingIndex === index && editingField === 'purpose' ? (
                <div className="editing-purpose" data-editing="true">
                  <Input
                    value={location.purpose}
                    onChange={(e) => onPurposeChange(index, e.target.value)}
                    onBlur={onEditEnd}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onEditEnd();
                      }
                    }}
                    className="h-9"
                    autoFocus
                  />
                </div>
              ) : (
                <div 
                  className="relative h-9 flex items-center px-3 cursor-pointer hover:bg-muted dark:hover:bg-[#181a23] rounded-md border border-input bg-background transition-colors"
                  onClick={() => onEditStart(index, 'purpose')}
                >
                  <svg className="w-4 h-4 text-muted-foreground mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  <span className="flex-1 truncate text-base md:text-sm">
                    {location.purpose || 'Click to edit purpose...'}
                  </span>
                </div>
              )}
            </div> */}
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

// Helper function to extract business/place name and format address display
const formatLocationDisplay = (fullAddress: string): { businessName: string; restOfAddress: string } => {
  if (!fullAddress) return { businessName: '', restOfAddress: '' };
  
  const parts = fullAddress.split(',').map(p => p.trim());
  
  if (parts.length === 0) return { businessName: fullAddress, restOfAddress: '' };
  if (parts.length === 1) return { businessName: parts[0], restOfAddress: '' };
  
  // Special handling for airports - look for airport name in the address
  const lowerAddress = fullAddress.toLowerCase();
  const airportKeywords = [
    { keyword: 'heathrow', fullName: 'Heathrow Airport' },
    { keyword: 'gatwick', fullName: 'Gatwick Airport' },
    { keyword: 'stansted', fullName: 'Stansted Airport' },
    { keyword: 'luton', fullName: 'Luton Airport' },
    { keyword: 'london city airport', fullName: 'London City Airport' },
  ];
  
  for (const airport of airportKeywords) {
    if (lowerAddress.includes(airport.keyword)) {
      // If it's a terminal, show "Airport Name - Terminal X"
      const terminalMatch = parts[0].match(/terminal\s+\d+/i);
      if (terminalMatch) {
        const businessName = `${airport.fullName} - ${terminalMatch[0]}`;
        const restOfAddress = parts.slice(1).join(', ');
        return { businessName, restOfAddress };
      }
      // Otherwise, use the airport name
      const businessName = airport.fullName;
      const restOfAddress = parts.join(', ');
      return { businessName, restOfAddress };
    }
  }
  
  // For non-airports, first part is typically the business/place name
  const businessName = parts[0];
  // Rest is the detailed address
  const restOfAddress = parts.slice(1).join(', ');
  
  return { businessName, restOfAddress };
};

// Generate a random password for password protection
const generatePassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export default function Home() {
  const router = useRouter();
  const { isLoaded: isGoogleMapsLoaded } = useGoogleMaps();
  const { user, isAuthenticated } = useAuth();
  const { setResetToImport } = useHomepageContext();
  const [loading, setLoading] = useState(false);
  
  // Helper function to safely parse JSON responses
  const safeJsonParse = async (response: Response) => {
    if (!response.ok) {
      console.error(`❌ API error: ${response.status} ${response.statusText}`);
      return { success: false, error: response.statusText };
    }
    try {
      return await response.json();
    } catch (err) {
      console.error('❌ Failed to parse JSON response:', err);
      return { success: false, error: 'Invalid response format' };
    }
  };
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
    purpose: string;
  }>>([
    { id: '1', name: '', lat: 0, lng: 0, time: '09:00', purpose: '' },
    { id: '2', name: '', lat: 0, lng: 0, time: '12:00', purpose: '' },
    { id: '3', name: '', lat: 0, lng: 0, time: '17:00', purpose: '' },
  ]);
  const [loadingTrip, setLoadingTrip] = useState(false);
  const [locationsReordered, setLocationsReordered] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0); // Smooth progress 0-100
  const [tripId, setTripId] = useState<string | null>(null); // Store trip ID for manual navigation
  const [userEmail, setUserEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pendingTripData, setPendingTripData] = useState<any>(null); // Store trip data for guest users before saving
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
  const [lastExtractedText, setLastExtractedText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  
  // File upload state
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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
    flightNumber?: string;
    flightDirection?: 'arrival' | 'departure';
  }> | null>(null);
  const [extractedDate, setExtractedDate] = useState<string | null>(null);
  const [extractedDriverSummary, setExtractedDriverSummary] = useState<string | null>(null);
  const [leadPassengerName, setLeadPassengerName] = useState<string>('');
  const [vehicleInfo, setVehicleInfo] = useState<string>('');
  const [passengerCount, setPassengerCount] = useState<number>(1);
  const [protectWithPassword, setProtectWithPassword] = useState<boolean>(false);
  const [tripDestination, setTripDestination] = useState<string>('');
  const [availableDestinations, setAvailableDestinations] = useState<string[]>([]);
  const [loadingDestinations, setLoadingDestinations] = useState(false);
  const [passengerNames, setPassengerNames] = useState<string[]>([]);
  const [editingExtractedIndex, setEditingExtractedIndex] = useState<number | null>(null);
  const [editingExtractedField, setEditingExtractedField] = useState<'location' | 'time' | 'purpose' | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        
        // Configure recognition
        recognitionInstance.continuous = true; // Keep listening until stopped
        recognitionInstance.interimResults = true; // Show results while speaking
        recognitionInstance.lang = 'en-GB'; // British English
        
        // Handle results
        recognitionInstance.onresult = (event: any) => {
          let finalTranscript = '';
          
          // Loop through results
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            }
          }
          
          // Update the textarea with final transcript in real-time
          if (finalTranscript) {
            setExtractionText(prev => prev + finalTranscript);
          }
        };
        
        // Handle errors
        recognitionInstance.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          
          if (event.error === 'no-speech') {
            setRecordingError('No speech detected. Please try again.');
          } else if (event.error === 'not-allowed' || event.error === 'permission-denied') {
            setRecordingError('Microphone access denied. Please enable in browser settings.');
          } else if (event.error === 'aborted') {
            // User stopped recording, this is normal
            setRecordingError(null);
          } else {
            setRecordingError(`Error: ${event.error}`);
          }
          
          setIsRecording(false);
        };
        
        // Handle end event
        recognitionInstance.onend = () => {
          setIsRecording(false);
        };
        
        setRecognition(recognitionInstance);
      }
    }
  }, []);

  // Handle click outside to close editing mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      // Check if click is outside any editing elements
      const isClickOnEditingElement = target.closest('.editing-location') || 
                                    target.closest('.editing-time') ||
                                    target.closest('.editing-purpose') ||
                                    target.closest('[data-editing="true"]') ||
                                    target.closest('.pac-container') || // Google Places dropdown
                                    target.closest('.pac-item'); // Google Places dropdown items
      
      if (!isClickOnEditingElement) {
        // Close any open editing modes for extracted locations
        if (editingExtractedIndex !== null) {
          setEditingExtractedIndex(null);
          setEditingExtractedField(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingExtractedIndex]);
  
  // View toggle state
  const [showManualForm, setShowManualForm] = useState(false);
  
  // Manual form editing state
  const [editingManualIndex, setEditingManualIndex] = useState<number | null>(null);
  const [editingManualField, setEditingManualField] = useState<'location' | 'time' | 'purpose' | null>(null);

  // Handle click outside for manual form editing
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      // Check if click is outside any editing elements
      const isClickOnEditingElement = target.closest('.editing-location') || 
                                    target.closest('.editing-time') ||
                                    target.closest('.editing-purpose') ||
                                    target.closest('[data-editing="true"]') ||
                                    target.closest('.pac-container') || // Google Places dropdown
                                    target.closest('.pac-item'); // Google Places dropdown items
      
      if (!isClickOnEditingElement) {
        // Close any open editing modes for manual form
        if (editingManualIndex !== null) {
          setEditingManualIndex(null);
          setEditingManualField(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingManualIndex]);


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

  // Register reset function with context
  useEffect(() => {
    setResetToImport(() => handleResetToImport);
    return () => setResetToImport(null);
  }, [setResetToImport]);

  // Fetch available trip destinations from database
  useEffect(() => {
    const fetchDestinations = async () => {
      setLoadingDestinations(true);
      try {
        const response = await fetch('/api/trip-destinations');
        const data = await safeJsonParse(response);
        if (data.success !== false && data.destinations) {
          setAvailableDestinations(data.destinations || []);
          console.log('✅ Loaded trip destinations:', data.destinations);
        } else {
          console.error('❌ Failed to fetch trip destinations');
        }
      } catch (error) {
        console.error('❌ Error fetching trip destinations:', error);
      } finally {
        setLoadingDestinations(false);
      }
    };

    fetchDestinations();
  }, []);

  // Set default date range and handle client-side mounting
  useEffect(() => {
    setIsMounted(true);
    const today = new Date();
    const futureDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(futureDate.toISOString().split('T')[0]);
    setTripDate(today);
    
    // Restore extracted data from session storage
    if (typeof window !== 'undefined') {
      const savedData = sessionStorage.getItem('extractedTripData');
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          
          // Restore the data
          setExtractionText(parsed.text || '');
          // Mark all restored locations as verified
          const restoredLocations = parsed.locations?.map((loc: any) => ({
            ...loc,
            verified: true
          }));
          setExtractedLocations(restoredLocations || null);
          setExtractedDate(parsed.date || null);
          setExtractedDriverSummary(parsed.driverSummary || null);
          setLeadPassengerName(parsed.leadPassengerName || '');
          setVehicleInfo(parsed.vehicleInfo || '');
          setPassengerCount(parsed.passengerCount || 1);
          setTripDestination(parsed.tripDestination || '');
          setPassengerNames(parsed.passengerNames || []);
        } catch (error) {
          console.error('❌ [SESSION] Error restoring data:', error);
        }
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
    const newId = `location-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setLocations([...locations, {
      id: newId,
      name: '',
      lat: 0,
      lng: 0,
      time: '18:00',
      purpose: '',
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
    const updatedLocations = locations.map(loc => 
      loc.id === id ? { ...loc, time } : loc
    );
    
    // Sort locations by time
    const sortedLocations = updatedLocations.sort((a, b) => {
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      return timeA.localeCompare(timeB);
    });
    
    setLocations(sortedLocations);
  };

  const updateLocationPurpose = (id: string, purpose: string) => {
    setLocations(locations.map(loc => 
      loc.id === id ? { ...loc, purpose } : loc
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

      // Store the times in their current positions before reordering
      const timesByPosition = extractedLocations.map(item => item.time);
      
      // Reorder the locations
      const reorderedLocations = arrayMove(extractedLocations, oldIndex, newIndex);
      
      // Reassign times based on new positions (times stay with positions, not locations)
      const locationsWithSwappedTimes = reorderedLocations.map((item, index) => ({
        ...item,
        time: timesByPosition[index]
      }));
      
      setExtractedLocations(locationsWithSwappedTimes);

      // Save to session storage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('extractedTripData', JSON.stringify({
          text: extractionText,
          locations: locationsWithSwappedTimes,
          date: extractedDate,
          driverSummary: extractedDriverSummary,
          leadPassengerName: leadPassengerName,
          vehicleInfo: vehicleInfo,
          passengerCount: passengerCount,
          tripDestination: tripDestination,
          passengerNames: passengerNames,
          timestamp: new Date().toISOString(),
        }));
      }
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Professional loading steps generator (city-aware)
  const generateLoadingSteps = (locations: any[], tripDestination?: string) => {
    const cityConfig = getCityConfig(tripDestination);
    const steps = [];
    let stepId = 1;

    // London-specific data sources
    if (cityConfig.isLondon) {
      steps.push({
        id: `step-${stepId++}`,
        title: `Analyzing crime & safety data`,
        description: `Retrieving safety statistics and crime reports from official UK Police database`,
        source: 'UK Police National Database',
        status: 'pending' as const
      });

      steps.push({
        id: `step-${stepId++}`,
        title: `Assessing traffic conditions`,
        description: `Pulling real-time traffic data, road closures, and congestion patterns`,
        source: 'Transport for London',
        status: 'pending' as const
      });

      steps.push({
        id: `step-${stepId++}`,
        title: `Checking public transport disruptions`,
        description: `Monitoring Underground, bus, and rail service disruptions`,
        source: 'TfL Unified API',
        status: 'pending' as const
      });
    }

    // Universal data sources (all cities)
    steps.push({
      id: `step-${stepId++}`,
      title: `Analyzing weather conditions`,
      description: `Gathering meteorological data and forecast models for trip planning`,
      source: 'Open-Meteo Weather Service',
      status: 'pending' as const
    });

    // DISABLED: Event search to reduce OpenAI costs
    // steps.push({
    //   id: `step-${stepId++}`,
    //   title: `Scanning major events`,
    //   description: `Identifying concerts, sports events, and gatherings affecting traffic`,
    //   source: 'Event Intelligence Network',
    //   status: 'pending' as const
    // });

    // London-specific parking
    if (cityConfig.isLondon) {
      steps.push({
        id: `step-${stepId++}`,
        title: `Evaluating parking availability`,
        description: `Analyzing parking facilities, restrictions, and pricing information`,
        source: 'TfL Parking Database',
        status: 'pending' as const
      });
    }

    // Universal: Route calculation
    steps.push({
      id: `step-${stepId++}`,
      title: `Calculating optimal routes`,
      description: `Processing route efficiency, travel times, and traffic predictions`,
      source: 'Google Maps Directions API',
      status: 'pending' as const
    });

    // Universal: AI analysis
    steps.push({
      id: `step-${stepId++}`,
      title: `Generating risk assessment`,
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

  // Save guest trip to database after email is entered
  const handleGuestTripSave = async () => {
    if (!pendingTripData || !userEmail.trim() || emailError) {
      console.error('Cannot save trip: missing data or invalid email');
      return;
    }

    try {
      console.log('💾 Saving guest trip to database...');
      console.log('   Email:', userEmail);

      // Validate email one more time
      const validation = validateBusinessEmail(userEmail);
      if (!validation.isValid) {
        setEmailError(validation.error || null);
        return;
      }

      // Update pending trip data with the actual email
      const tripDataWithEmail = {
        ...pendingTripData,
        user_email: userEmail.trim(),
      };

      // Save user to database
      const { error: userError } = await supabase
        .from('users')
        .upsert({ 
          email: userEmail.trim(),
          marketing_consent: true 
        });

      if (userError) {
        console.error('❌ Error saving user:', userError);
      }

      // Save trip to database
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .insert(tripDataWithEmail)
        .select()
        .single();

      if (tripError || !tripData) {
        console.error('❌ Error saving trip:', tripError);
        setError('Failed to save trip. Please try again.');
        return;
      }

      console.log('✅ Guest trip saved to database');
      console.log(`🔗 Trip ID: ${tripData.id}`);
      console.log(`📧 Guest email: ${userEmail}`);

      // Store trip ID in sessionStorage to identify guest as creator
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('guestCreatedTripId', tripData.id);
      }

      // Redirect to results page immediately (don't clear pendingTripData first)
      router.push(`/results/${tripData.id}`);
    } catch (err) {
      console.error('Error saving guest trip:', err);
      setError('Failed to save trip. Please try again.');
    }
  };

  const handleExtractedTripSubmit = async () => {
    // Use authenticated user's email if logged in, otherwise use placeholder (will be replaced by actual email later)
    const emailToUse = isAuthenticated && user?.email 
      ? user.email 
      : 'guest@pending.com'; // Placeholder for guest users

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
      fullAddress: loc.formattedAddress, // Keep full address for reference
      purpose: loc.purpose // Store purpose in location object for database
    }));

    // Set the trip date from extracted data or use today
    const tripDateToUse = extractedDate ? new Date(extractedDate) : new Date();

    console.log('\n🚀 Starting analysis for EXTRACTED trip data...');
    console.log(`📍 ${mappedLocations.length} locations mapped from extraction`);
    console.log(`📅 Trip date: ${tripDateToUse.toISOString().split('T')[0]}`);
    if (extractedDriverSummary) {
      console.log(`📝 Driver summary will be saved: ${extractedDriverSummary.substring(0, 50)}...`);
    }

    // Now call the same trip submission logic with mapped data and all extracted fields
    await performTripAnalysis(
      mappedLocations, 
      tripDateToUse, 
      emailToUse, 
      extractedDriverSummary,
      leadPassengerName,
      vehicleInfo,
      passengerCount,
      tripDestination,
      passengerNames,
      protectWithPassword
    );
  };

  const handleTripSubmit = async () => {
    // Use authenticated user's email if logged in, otherwise use placeholder (will be replaced by actual email later)
    const emailToUse = isAuthenticated && user?.email 
      ? user.email 
      : 'guest@pending.com'; // Placeholder for guest users

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

    // Call the trip analysis with manual form data and all fields
    await performTripAnalysis(
      validLocations, 
      tripDateToUse, 
      emailToUse,
      extractedDriverSummary,
      leadPassengerName,
      vehicleInfo,
      passengerCount,
      tripDestination,
      passengerNames,
      protectWithPassword
    );
  };

  const performTripAnalysis = async (
    validLocations: Array<{ id: string; name: string; lat: number; lng: number; time: string; fullAddress?: string; purpose?: string }>,
    tripDateObj: Date,
    emailToUse: string,
    driverSummary?: string | null,
    leadPassengerName?: string,
    vehicleInfo?: string,
    passengerCount?: number,
    tripDestination?: string,
    passengerNames?: string[],
    shouldProtectWithPassword?: boolean
  ) => {
    // Check if Google Maps API is loaded
    if (!isGoogleMapsLoaded) {
      setError('Google Maps API is not loaded. Please refresh the page and try again.');
      return;
    }

    setLoadingTrip(true);
    setError(null);
    setEmailError(null);
    setExtractionError(null); // Clear extraction errors too
    setLocationsReordered(false); // Clear reorder indicator

    // Initialize loading steps (pass tripDestination for city-aware steps)
    const steps = generateLoadingSteps(validLocations, tripDestination);
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
      
      console.log(`🚀 [GENERATE] Starting report for ${validLocations.length} locations on ${tripDateStr}`);

      const days = 7; // Fixed period for trip planning

      // Get city configuration for conditional API calls
      const cityConfig = getCityConfig(tripDestination);
      console.log(`🌍 [HOMEPAGE] City configuration: ${cityConfig.cityName} (London APIs ${cityConfig.isLondon ? 'ENABLED' : 'DISABLED'})`);

      // Fetch data for all locations in parallel
      const results = await Promise.all(
        validLocations.map(async (location) => {
          
          const tempDistrictId = `custom-${Date.now()}-${location.id}`;

          // Universal APIs (always called)
          const universalCalls = [
            fetch(`/api/weather?district=${tempDistrictId}&lat=${location.lat}&lng=${location.lng}&days=${days}`),
          ];

          // London-specific APIs (conditional)
          const londonCalls = cityConfig.isLondon ? [
            fetch(`/api/uk-crime?district=${tempDistrictId}&lat=${location.lat}&lng=${location.lng}`),
            fetch(`/api/tfl-disruptions?district=${tempDistrictId}&days=${days}`),
            fetch(`/api/parking?lat=${location.lat}&lng=${location.lng}&location=${encodeURIComponent(location.name)}`),
          ] : [
            // Mock responses for non-London cities
            createMockResponse('crime', MOCK_DATA.crime),
            createMockResponse('disruptions', MOCK_DATA.disruptions),
            createMockResponse('parking', MOCK_DATA.parking),
          ];

          const [crimeResponse, disruptionsResponse, parkingResponse, weatherResponse] = await Promise.all([
            ...londonCalls,
            ...universalCalls,
          ]);

          // Parse responses with graceful fallbacks for all APIs
          let weatherData;
          if (weatherResponse.ok) {
            weatherData = await weatherResponse.json();
          } else {
            console.warn(`⚠️ Weather API failed, using fallback data`);
            weatherData = {
              success: true,
              data: {
                district: location.name,
                coordinates: { lat: location.lat, lng: location.lng },
                forecast: [],
                summary: {
                  avgMaxTemp: 15,
                  avgMinTemp: 10,
                  totalPrecipitation: 0,
                  rainyDays: 0,
                  maxWindSpeed: 10
                }
              }
            };
          }

          let crimeData;
          if (crimeResponse.ok) {
            crimeData = await crimeResponse.json();
          } else {
            console.warn(`⚠️ Crime API failed (${crimeResponse.status}), using fallback data`);
            crimeData = {
              success: true,
              data: {
                district: location.name,
                coordinates: { lat: location.lat, lng: location.lng },
                crimes: [],
                summary: {
                  totalCrimes: 0,
                  topCategories: [],
                  byOutcome: {},
                  month: 'N/A',
                },
                safetyScore: 85, // Default safe score when no data
              },
              message: 'Crime data temporarily unavailable'
            };
          }

          let disruptionsData;
          if (disruptionsResponse.ok) {
            disruptionsData = await disruptionsResponse.json();
          } else {
            console.warn(`⚠️ Disruptions API failed, using fallback data`);
            disruptionsData = {
              success: true,
              data: {
                disruptions: [],
                summary: 'No disruption data available'
              }
            };
          }

          let parkingData;
          if (parkingResponse.ok) {
            parkingData = await parkingResponse.json();
          } else {
            console.warn(`⚠️ Parking API failed, using fallback data`);
            parkingData = {
              success: true,
              data: {
                parkingInfo: [],
                summary: 'No parking data available'
              }
            };
          }

          // Create placeholder events data to maintain compatibility
          const eventsData = {
            success: true,
            data: {
              location: location.name,
              coordinates: { lat: location.lat, lng: location.lng },
              date: tripDateStr,
              events: [],
              summary: { total: 0, byType: {}, bySeverity: {}, highSeverity: 0 }
            }
          };

          // Fetch cafes using Google Places API (client-side)
          let cafeData = null;
          try {
            if (!isGoogleMapsLoaded) {
              throw new Error('Google Maps API not loaded');
            }
            cafeData = await searchNearbyCafes(location.lat, location.lng, location.name);
          } catch (cafeError) {
            // Provide empty cafe data if fetch fails
            cafeData = {
              location: location.name,
              coordinates: { lat: location.lat, lng: location.lng },
              cafes: [],
              summary: { total: 0, averageRating: 0, averageDistance: 0 },
            };
          }

          // Fetch emergency services using Google Places API (client-side)
          let emergencyServicesData = null;
          try {
            if (!isGoogleMapsLoaded) {
              throw new Error('Google Maps API not loaded');
            }
            emergencyServicesData = await searchEmergencyServices(location.lat, location.lng, location.name);
          } catch (emergencyError) {
            // Provide empty emergency services data if fetch fails
            emergencyServicesData = {
              location: location.name,
              coordinates: { lat: location.lat, lng: location.lng },
            };
          }

          if (crimeData.success && disruptionsData.success && weatherData.success && parkingData.success) {
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

      // Get traffic predictions for the route
      let trafficData = null;
      try {
        trafficData = await getTrafficPredictions(validLocations, tripDateStr);
      } catch (trafficError) {
        trafficData = {
          success: false,
          error: 'Failed to get traffic predictions',
        };
      }

      // Generate executive report
      console.log('🤖 [GENERATE] Creating executive report...');
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
            emailContent: extractionText || null,
            leadPassengerName: leadPassengerName || null,
            vehicleInfo: vehicleInfo || null,
            passengerCount: passengerCount || 1,
            tripDestination: tripDestination || null,
            passengerNames: passengerNames || [],
            driverNotes: driverSummary || null,
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

      // Prepare passenger name for database storage
      // Store all passenger names in lead_passenger_name field (comma-separated)
      // Priority: use passengerNames array if available, otherwise use leadPassengerName
      let passengerNameForDb: string | null = null;
      if (passengerNames && passengerNames.length > 0) {
        passengerNameForDb = passengerNames.join(', ');
      } else if (leadPassengerName) {
        passengerNameForDb = leadPassengerName;
      }

      // Prepare trip data
      const tripInsertData: any = {
        user_email: emailToUse,
        trip_date: tripDateStr,
        locations: validLocations as any,
        trip_results: results as any,
        traffic_predictions: trafficData as any,
        executive_report: executiveReportData as any,
        trip_notes: driverSummary || null,
        lead_passenger_name: passengerNameForDb,
        vehicle: vehicleInfo || null,
        passenger_count: passengerCount || 1,
        trip_destination: tripDestination || null,
        password: shouldProtectWithPassword ? generatePassword() : null
      };
      
      // Debug: Log what we're saving to database
      console.log('💾 [FRONTEND] Database save values:');
      console.log('   lead_passenger_name:', passengerNameForDb ? '[SET]' : '[NOT SET]');
      console.log('   vehicle:', vehicleInfo || null);
      console.log('   passenger_count:', passengerCount || 1);
      console.log('   trip_destination:', tripDestination || null);
      console.log('   trip_notes:', driverSummary || null);

      // Add user_id for authenticated users
      if (isAuthenticated && user?.id) {
        tripInsertData.user_id = user.id;
      }

      // For authenticated users: Save trip immediately
      // For guest users: Store data and wait for email input
      if (isAuthenticated) {
        console.log('🔐 Authenticated user - saving trip to database immediately');
        
        // Save user to database
        const { error: userError } = await supabase
          .from('users')
          .upsert({ 
            email: emailToUse,
            marketing_consent: true 
          });

        if (userError) {
          console.error('❌ Error saving user:', userError);
        }

        // Save trip to database
        const { data: tripData, error: tripError } = await supabase
          .from('trips')
          .insert(tripInsertData)
          .select()
          .single();

        if (tripError || !tripData) {
          console.error('❌ Error saving trip:', tripError);
          throw new Error(`Failed to save trip to database: ${tripError?.message || 'Unknown error'}`);
        }

        console.log('✅ Trip saved to database');
        console.log(`🔗 Trip ID: ${tripData.id}`);
        
        // Store trip ID for navigation
        const savedTripId = tripData.id;
        setTripId(savedTripId);
        
        // Trigger async quality evaluation (fire and forget - don't await)
        fetch('/api/evaluate-quality', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tripId: savedTripId })
        }).catch(err => {
          console.log('⚠️ Quality evaluation will run in background:', err.message);
        });
        
        // For authenticated users: auto-redirect when complete
        console.log('🔐 Authenticated user - will auto-redirect when animation completes');
        
        // Mark background process as complete
        backgroundProcessComplete = true;
        console.log('✅ Background process complete');
        
        // Force progress to 100% and redirect after a short delay
        setLoadingProgress(100);
        
        // Wait for visual animation to complete and then redirect
        setTimeout(() => {
          console.log('✅ Background process complete, redirecting...');
          // Small delay to show the green completion state
          setTimeout(() => {
            console.log(`✅ [GENERATE] Complete - redirecting to report`);
            router.push(`/results/${savedTripId}`);
          }, 1000); // Show completion state for 1 second
        }, 500);
      } else {
        console.log('👤 Guest user - storing trip data for later save (after email entry)');
        
        // Store the trip data to save later when guest enters email
        setPendingTripData(tripInsertData);
        
        // Mark background process as complete
        backgroundProcessComplete = true;
        console.log('✅ Background process complete');
        console.log('👤 Guest user - will show email field and View Report button');
        // For guest users, don't auto-redirect
        // They will manually click "View Report" button after entering email
      }

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
      
      
      setResults(allResults);
    } catch (error) {
      console.error('❌ Error:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const getSafetyColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getSafetyBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/10 border-green-500/30';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700';
    if (score >= 40) return 'bg-orange-100 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700';
    return 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700';
  };

  // Handle voice recording
  const handleStartRecording = async () => {
    if (!recognition) {
      setRecordingError('Speech recognition not available in this browser');
      return;
    }
    
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Clear any previous errors
      setRecordingError(null);
      
      // Start recognition
      recognition.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access error:', err);
      setRecordingError('Could not access microphone. Please enable permissions.');
    }
  };

  const handleStopRecording = () => {
    if (recognition && isRecording) {
      recognition.stop();
      setIsRecording(false);
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  // Handle Word file (.docx)
  const handleWordFile = async (file: File) => {
    try {
      setIsProcessingFile(true);
      setFileError(null);
      
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value;
      
      if (text.trim()) {
        setExtractionText(prev => prev + (prev ? '\n\n' : '') + text);
      } else {
        setFileError('No text found in Word document');
      }
    } catch (error) {
      console.error('Error processing Word file:', error);
      setFileError('Failed to read Word document');
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Handle Excel file (.xlsx, .xls)
  const handleExcelFile = async (file: File) => {
    try {
      setIsProcessingFile(true);
      setFileError(null);
      
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Process all sheets
      let extractedText = '';
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        // Convert to text with tab/newline separators
        const sheetText = XLSX.utils.sheet_to_txt(sheet);
        if (sheetText.trim()) {
          extractedText += (extractedText ? '\n\n' : '') + `Sheet: ${sheetName}\n${sheetText}`;
        }
      });
      
      if (extractedText.trim()) {
        setExtractionText(prev => prev + (prev ? '\n\n' : '') + extractedText);
      } else {
        setFileError('No data found in Excel file');
      }
    } catch (error) {
      console.error('Error processing Excel file:', error);
      setFileError('Failed to read Excel file');
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Handle Audio file (.opus, .m4a, .mp3, etc.)
  const handleAudioFile = async (file: File) => {
    try {
      setIsProcessingFile(true);
      setFileError(null);

      // Check file size (25MB limit)
      if (file.size > 25 * 1024 * 1024) {
        setFileError('Audio file too large. Maximum size is 25MB.');
        setIsProcessingFile(false);
        return;
      }

      const formData = new FormData();
      formData.append('audio', file);

      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        body: formData,
      });

      const data = await safeJsonParse(response);

      if (data.success && data.text) {
        setExtractionText(prev => prev + (prev ? '\n\n' : '') + data.text);
      } else {
        setFileError(data.error || 'Failed to transcribe audio file');
      }
    } catch (error) {
      console.error('Error transcribing audio file:', error);
      setFileError('Failed to transcribe audio file');
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Handle file upload (click or drag-and-drop)
  const processFile = async (file: File) => {
    const fileName = file.name.toLowerCase();
    const fileType = file.type;
    
    // Check for Word files
    if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      await handleWordFile(file);
    } 
    // Check for Excel files
    else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || 
               fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
               fileType === 'application/vnd.ms-excel') {
      await handleExcelFile(file);
    } 
    // Check for Audio files
    else if (fileType.startsWith('audio/') || 
             fileName.match(/\.(opus|m4a|mp3|ogg|wav|aac|flac|webm)$/)) {
      await handleAudioFile(file);
    } 
    else {
      setFileError('Unsupported file type. Please upload Word (.docx), Excel (.xlsx), or Audio files.');
    }
  };

  // Handle file input change (click upload)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset input so same file can be uploaded again
    e.target.value = '';
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only hide overlay if leaving the container
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0]; // Take first file only
      await processFile(file);
    }
  };

  // Handle text extraction for trip planning
  const handleExtractTrip = async () => {
    console.log('🚀 [EXTRACT] Starting extraction...');
    
    if (!extractionText.trim()) {
      setExtractionError('Please enter some text to extract trip information.');
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);
    setExtractedLocations(null);
    setExtractedDate(null);

    try {
      const response = await fetch('/api/extract-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: extractionText,
          tripDestination: tripDestination || undefined // Pass tripDestination if available, let AI detect if not
        }),
      });

      const data = await safeJsonParse(response);

      if (!data.success) {
        console.log('❌ [EXTRACT] Failed:', data.error);
        setExtractionError(data.error || 'Failed to extract trip information.');
        return;
      }

      console.log(`✅ [EXTRACT] Success - ${data.locations?.length || 0} locations, date: ${data.date}`);
      
      // Mark all extracted locations as verified
      const verifiedLocations = data.locations?.map((loc: any) => ({
        ...loc,
        verified: true
      }));
      setExtractedLocations(verifiedLocations);
      setExtractedDate(data.date);
      setExtractedDriverSummary(data.driverNotes);
      setLeadPassengerName(data.leadPassengerName || '');
      setVehicleInfo(data.vehicleInfo || '');
      setPassengerCount(data.passengerCount || 1);
      setTripDestination(data.tripDestination || '');
      setPassengerNames(data.passengerNames || []);
      setLastExtractedText(extractionText);

      // Save to session storage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('extractedTripData', JSON.stringify({
          text: extractionText,
          locations: data.locations,
          date: data.date,
          driverSummary: data.driverNotes,
          leadPassengerName: data.leadPassengerName,
          vehicleInfo: data.vehicleInfo,
          passengerCount: data.passengerCount,
          tripDestination: data.tripDestination,
          passengerNames: data.passengerNames,
          timestamp: new Date().toISOString(),
        }));
      }
    } catch (error) {
      console.error('❌ [EXTRACT] Error:', error);
      setExtractionError('An error occurred while extracting trip information.');
    } finally {
      setIsExtracting(false);
    }
  };


  // Handle clearing extraction results
  const handleClearExtraction = () => {
    setExtractedLocations(null);
    setExtractedDate(null);
    setExtractedDriverSummary(null);
    setExtractionText('');
    setLastExtractedText('');
    setExtractionError(null);
    
    // Clear from session storage
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('extractedTripData');
      console.log('✅ [FRONTEND] Cleared session storage');
    }
  };

  // Handle resetting to initial import state (for logo click)
  const handleResetToImport = () => {
    console.log('🏠 [FRONTEND] Resetting to initial import state...');
    
    // Reset extraction state
    setExtractedLocations(null);
    setExtractedDate(null);
    setExtractedDriverSummary(null);
    setExtractionText('');
    setLastExtractedText('');
    setExtractionError(null);
    
    // Reset manual form state
    setShowManualForm(false);
    setLocations([
      { id: '1', name: '', lat: 0, lng: 0, time: '09:00', purpose: '' },
      { id: '2', name: '', lat: 0, lng: 0, time: '12:00', purpose: '' },
      { id: '3', name: '', lat: 0, lng: 0, time: '17:00', purpose: '' },
    ]);
    setTripDate(undefined);
    setLeadPassengerName('');
    setVehicleInfo('');
    setPassengerCount(1);
    setTripDestination('');
    setPassengerNames([]);
    setEditingManualIndex(null);
    setEditingManualField(null);
    
    // Reset trip analysis state
    setResults([]);
    setSelectedDistricts(['westminster']);
    setStartDate('');
    setEndDate('');
    setError(null);
    setLoadingTrip(false);
    setLocationsReordered(false);
    setMapOpen(false);
    setLoadingProgress(0);
    setTripId(null);
    setUserEmail('');
    setEmailError(null);
    setPendingTripData(null);
    setLoadingSteps([]);
    
    // Clear session storage
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
            driverSummary: extractedDriverSummary,
            passengerCount: passengerCount,
            tripDestination: tripDestination,
            passengerNames: passengerNames,
            timestamp: new Date().toISOString(),
          }));
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
      
      // Sort locations by time
      const sortedLocations = updatedLocations.sort((a, b) => {
        const timeA = a.time || '00:00';
        const timeB = b.time || '00:00';
        return timeA.localeCompare(timeB);
      });
      
      setExtractedLocations(sortedLocations);
      
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
            locations: sortedLocations,
            date: extractedDate,
            driverSummary: extractedDriverSummary,
            leadPassengerName: leadPassengerName,
            vehicleInfo: vehicleInfo,
            passengerCount: passengerCount,
            tripDestination: tripDestination,
            passengerNames: passengerNames,
            timestamp: new Date().toISOString(),
          }));
        }, 500); // Save after 500ms of no typing
      }
    }
  };

  // Handle purpose edit
  const handlePurposeEdit = (index: number, value: string) => {
    if (extractedLocations) {
      const updatedLocations = [...extractedLocations];
      updatedLocations[index] = {
        ...updatedLocations[index],
        purpose: value,
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
            driverSummary: extractedDriverSummary,
            leadPassengerName: leadPassengerName,
            vehicleInfo: vehicleInfo,
            passengerCount: passengerCount,
            tripDestination: tripDestination,
            passengerNames: passengerNames,
            timestamp: new Date().toISOString(),
          }));
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
        leadPassengerName: leadPassengerName,
        vehicleInfo: vehicleInfo,
        passengerCount: passengerCount,
        tripDestination: tripDestination,
        passengerNames: passengerNames,
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
          leadPassengerName: leadPassengerName,
          vehicleInfo: vehicleInfo,
          passengerCount: passengerCount,
          tripDestination: tripDestination,
          passengerNames: passengerNames,
          timestamp: new Date().toISOString(),
        }));
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
          leadPassengerName: leadPassengerName,
          vehicleInfo: vehicleInfo,
          passengerCount: passengerCount,
          tripDestination: tripDestination,
          passengerNames: passengerNames,
          timestamp: new Date().toISOString(),
        }));
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
    <div className="min-h-screen bg-background p-4 sm:p-8 flex items-center justify-center">
      <div className="max-w-4xl mx-auto w-full">


         {/* Tagline for Homepage - Hide when extracted info or manual form is shown */}
         {!extractedLocations && !showManualForm && (
           <div className="mb-24 text-center -mt-40">
             <img 
               src="/chauffs-logo-neutral.png" 
               alt="Chauffs" 
               className="mx-auto h-7 w-auto mb-12"
             />
             <p className="text-5xl font-light text-[#05060A] dark:text-[#F4F2EE]">
               Your private driver is here.
             </p>
           </div>
         )}

        {/* Email/Text Import Section */}
        {!showManualForm && !extractedLocations && (
        <div className="mb-8 flex justify-center">
          <div className="space-y-4 w-[85%]">
            {/* Textarea with Dark Container */}
            <div>
              <div 
                className="relative"
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <textarea
                  value={extractionText}
                  onChange={(e) => {
                    setExtractionText(e.target.value);
                    // Auto-resize textarea
                    const textarea = e.target;
                    textarea.style.height = 'auto';
                    textarea.style.height = Math.min(textarea.scrollHeight, 240) + 'px';
                  }}
                  placeholder="Where are we going?"
                  className="w-full min-h-[86px] max-h-[240px] p-3 pb-10 rounded-md border border-border bg-background dark:bg-input/30 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:border-ring resize-none overflow-y-auto dark:hover:bg-[#323236] transition-colors dark:focus-visible:border-[#323236]"
                  style={{ height: '86px' }}
                />
                
                {/* Drag and Drop Overlay */}
                {isDragging && (
                  <div className="absolute inset-0 bg-blue-500/10 border-2 border-blue-500 border-dashed rounded-md flex items-center justify-center pointer-events-none z-10">
                    <div className="text-center">
                      <svg className="w-12 h-12 mx-auto mb-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-sm font-medium text-blue-500">Drop file to upload</p>
                      <p className="text-xs text-muted-foreground">Word, Excel, or Audio files</p>
                    </div>
                  </div>
                )}
                
                {/* File Upload Button (Paperclip) - Lower Left */}
                <label 
                  className={`absolute left-3 bottom-5 transition-all cursor-pointer ${
                    isProcessingFile
                      ? 'text-blue-500 opacity-100' 
                      : 'text-muted-foreground opacity-60 hover:opacity-100'
                  }`}
                  title="Upload Word, Excel, or Audio file"
                >
                  <input
                    type="file"
                    accept=".docx,.doc,.xlsx,.xls,.opus,.m4a,.mp3,.ogg,.wav,.aac,.flac,.webm,audio/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <svg 
                    className={`w-5 h-5 ${isProcessingFile ? 'animate-pulse' : ''}`}
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={1.5} 
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" 
                    />
                  </svg>
                </label>
                
                {/* Microphone Button - Lower Right */}
                <button
                  type="button"
                  onClick={handleToggleRecording}
                  disabled={!recognition}
                  className={`absolute right-3 bottom-5 transition-all ${
                    isRecording 
                      ? 'text-red-500 opacity-100 animate-pulse' 
                      : 'text-muted-foreground opacity-60 hover:opacity-100'
                  } ${!recognition ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                  title={isRecording ? 'Stop recording' : 'Start recording'}
                >
                  <svg 
                    className="w-5 h-5" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={1.5} 
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" 
                    />
                  </svg>
                </button>
              </div>
              
              {/* Recording Status */}
              {isRecording && (
                <div className="flex items-center gap-2 mt-2 text-sm text-red-500">
                  <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  <span>Listening...</span>
                </div>
              )}
              
              {/* File Processing Status */}
              {isProcessingFile && (
                <div className="flex items-center gap-2 mt-2 text-sm text-blue-500">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Processing file...</span>
                </div>
              )}
              
              {/* Recording Error */}
              {recordingError && (
                <div className="mt-2 text-sm text-destructive">
                  {recordingError}
                </div>
              )}
              
              {/* File Error */}
              {fileError && (
                <div className="mt-2 text-sm text-destructive">
                  {fileError}
                </div>
              )}
              
              {/* Browser Compatibility Warning */}
              {typeof window !== 'undefined' && 
               !(window as any).SpeechRecognition && 
               !(window as any).webkitSpeechRecognition && (
                <div className="mt-2 text-sm text-muted-foreground">
                  💡 Voice recording works best in Chrome, Edge, or Safari
                </div>
              )}
            </div>

            {/* Extract Button */}
            <div className="flex items-center justify-between gap-3">
              <Button
                onClick={() => setShowManualForm(true)}
                variant="outline"
                size="lg"
              >
                Go to manual form
              </Button>

              <Button
                onClick={handleExtractTrip}
                disabled={isExtracting || !extractionText.trim()}
                size="lg"
                className="flex items-center gap-2 bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
              >
                {isExtracting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Extracting...</span>
                  </>
                ) : (
                  <span>Extract trip data</span>
                )}
              </Button>
            </div>

            {/* Error Message */}
            {extractionError && (
              <Alert variant="destructive">
                <AlertDescription>{extractionError}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>
        )}

        {/* Extracted Results - Matching Manual Form Design */}
        {!showManualForm && extractedLocations && extractedLocations.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <h2 className="text-xl font-medium text-card-foreground">
                      Route Proposal
                    </h2>
                  </div>
                  <Button
                    onClick={handleClearExtraction}
                    variant="outline"
                    size="sm"
                  >
                    ← Back to Import
                  </Button>
                </div>

                {/* Dark Header Section - Trip Details */}
                 <div className="rounded-md p-4 mb-6 bg-primary dark:bg-[#1f1f21] border border-border">
                  {/* Unified Grid for All Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {/* Trip Date - spans 2 columns */}
                    <div className="sm:col-span-2">
                      <Label className="text-primary-foreground dark:text-card-foreground font-medium text-sm mb-2 block">Trip date</Label>
                      <div className="relative">
                        <Input
                          type="date"
                          value={extractedDate || ''}
                          onChange={(e) => handleDateEdit(e.target.value)}
                          className={`bg-background border-border rounded-md h-9 pl-10 text-foreground ${
                            !extractedDate ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700' : ''
                          }`}
                        />
                        <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      {!extractedDate && (
                        <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                          Please select a trip date to continue
                        </p>
                      )}
                    </div>

                    {/* Trip Destination - spans 2 columns */}
                    <div className="sm:col-span-2">
                      <Label className="text-primary-foreground dark:text-card-foreground font-medium text-sm mb-2 block">Trip destination</Label>
                      <Select
                        value={tripDestination || ''}
                        onValueChange={(value) => {
                          setTripDestination(value);
                          if (typeof window !== 'undefined' && extractedLocations) {
                            sessionStorage.setItem('extractedTripData', JSON.stringify({
                              text: extractionText,
                              locations: extractedLocations,
                              date: extractedDate,
                              driverSummary: extractedDriverSummary,
                              leadPassengerName: leadPassengerName,
                              vehicleInfo: vehicleInfo,
                              passengerCount: passengerCount,
                              tripDestination: value,
                              passengerNames: passengerNames,
                              timestamp: new Date().toISOString(),
                            }));
                          }
                        }}
                        disabled={loadingDestinations}
                      >
                        <SelectTrigger className="w-full bg-background border-border rounded-md h-9 text-foreground">
                          <SelectValue placeholder={loadingDestinations ? "Loading destinations..." : "Select or enter destination"} />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Default city options */}
                          <SelectItem key="London" value="London">
                            London
                          </SelectItem>
                          <SelectItem key="New York" value="New York">
                            New York
                          </SelectItem>
                          
                          {/* Database destinations (exclude default cities) */}
                          {availableDestinations
                            .filter(dest => !['London', 'New York'].includes(dest))
                            .map((destination) => (
                              <SelectItem key={destination} value={destination}>
                                {destination}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Lead Passenger Name - spans 2 columns */}
                    <div className="sm:col-span-2">
                      <Label className="text-primary-foreground dark:text-card-foreground font-medium text-sm mb-2 block">Lead passenger name</Label>
                      <Input
                        value={leadPassengerName}
                        onChange={(e) => {
                          setLeadPassengerName(e.target.value);
                          if (typeof window !== 'undefined' && extractedLocations) {
                            sessionStorage.setItem('extractedTripData', JSON.stringify({
                              text: extractionText,
                              locations: extractedLocations,
                              date: extractedDate,
                              driverSummary: extractedDriverSummary,
                              leadPassengerName: e.target.value,
                              vehicleInfo: vehicleInfo,
                              passengerCount: passengerCount,
                              tripDestination: tripDestination,
                              passengerNames: passengerNames,
                              timestamp: new Date().toISOString(),
                            }));
                          }
                        }}
                        placeholder="e.g., Mr. Smith"
                        className="bg-background border-border rounded-md h-9 text-foreground"
                      />
                    </div>
                    {/* Number of Passengers - spans 1 column */}
                    <div className="sm:col-span-1">
                      <Label className="text-primary-foreground dark:text-card-foreground font-medium text-sm mb-2 block">Number of passengers</Label>
                      <PassengerPicker
                        value={passengerCount}
                        onChange={(count) => {
                          setPassengerCount(count);
                          if (typeof window !== 'undefined' && extractedLocations) {
                            sessionStorage.setItem('extractedTripData', JSON.stringify({
                              text: extractionText,
                              locations: extractedLocations,
                              date: extractedDate,
                              driverSummary: extractedDriverSummary,
                              leadPassengerName: leadPassengerName,
                              vehicleInfo: vehicleInfo,
                              passengerCount: count,
                              tripDestination: tripDestination,
                              passengerNames: passengerNames,
                              timestamp: new Date().toISOString(),
                            }));
                          }
                        }}
                        className="h-9"
                      />
                    </div>

                    {/* Vehicle - spans 1 column */}
                    <div className="sm:col-span-1">
                      <Label className="text-primary-foreground dark:text-card-foreground font-medium text-sm mb-2 block">Vehicle</Label>
                      <Input
                        value={vehicleInfo}
                        onChange={(e) => {
                          setVehicleInfo(e.target.value);
                          if (typeof window !== 'undefined' && extractedLocations) {
                            sessionStorage.setItem('extractedTripData', JSON.stringify({
                              text: extractionText,
                              locations: extractedLocations,
                              date: extractedDate,
                              driverSummary: extractedDriverSummary,
                              leadPassengerName: leadPassengerName,
                              vehicleInfo: e.target.value,
                              passengerCount: passengerCount,
                              tripDestination: tripDestination,
                              passengerNames: passengerNames,
                              timestamp: new Date().toISOString(),
                            }));
                          }
                        }}
                        placeholder="e.g., Mercedes S-Class"
                        className="bg-background border-border rounded-md h-9 text-foreground"
                      />
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
                      items={extractedLocations.map((loc, index) => `${loc.location}-${index}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-4">
                        {extractedLocations.map((loc, index) => (
                          <SortableExtractedLocationItem
                            key={`${loc.location}-${index}`}
                            location={loc}
                            index={index}
                            totalLocations={extractedLocations.length}
                            onLocationSelect={handleExtractedLocationSelect}
                            onTimeChange={handleTimeEdit}
                            onPurposeChange={handlePurposeEdit}
                            onRemove={handleExtractedLocationRemove}
                            canRemove={extractedLocations.length > 1}
                            editingIndex={editingExtractedIndex}
                            editingField={editingExtractedField}
                            tripDestination={tripDestination}
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

                {/* Add Location Button */}
                <div className="mt-4">
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
                            leadPassengerName: leadPassengerName,
                            vehicleInfo: vehicleInfo,
                            passengerCount: passengerCount,
                            tripDestination: tripDestination,
                            passengerNames: passengerNames,
                            timestamp: new Date().toISOString(),
                          }));
                        }
                      }
                    }}
                    variant="outline"
                    size="lg"
                    className="border-dashed"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add location
                  </Button>
                </div>

                {/* Trip Notes Field */}
                <div className="mt-8 rounded-md p-4 bg-primary dark:bg-[#1f1f21] border border-border">
                  <Label className="text-sm font-medium text-primary-foreground dark:text-card-foreground mb-2 block">Trip notes</Label>
                  <textarea
                    value={extractedDriverSummary || ''}
                    onChange={(e) => {
                      setExtractedDriverSummary(e.target.value);
                      if (typeof window !== 'undefined' && extractedLocations) {
                        sessionStorage.setItem('extractedTripData', JSON.stringify({
                          text: extractionText,
                          locations: extractedLocations,
                          date: extractedDate,
                          driverSummary: e.target.value,
                          leadPassengerName: leadPassengerName,
                          vehicleInfo: vehicleInfo,
                          passengerCount: passengerCount,
                          tripDestination: tripDestination,
                          passengerNames: passengerNames,
                          timestamp: new Date().toISOString(),
                        }));
                      }
                    }}
                    placeholder="Additional notes, contact info, special instructions, etc."
                    rows={6}
                    className="w-full bg-background dark:bg-input/30 border-border rounded-md p-2 text-sm text-foreground dark:hover:bg-[#323236] transition-colors border resize-y focus:outline-none focus-visible:border-ring dark:focus-visible:border-[#323236]"
                  />
                </div>

                {/* Create Brief Button */}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    onClick={handleExtractedTripSubmit}
                    disabled={loadingTrip || !extractedLocations?.every(loc => loc.verified)}
                    size="lg"
                    className="flex items-center gap-2 bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
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
                        Create brief
                      </>
                    )}
                  </Button>

                  {/* Password Protection Checkbox - Only for authenticated users */}
                  {isAuthenticated && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="protect-password-extracted"
                        checked={protectWithPassword}
                        onChange={(e) => setProtectWithPassword(e.target.checked)}
                        className="w-4 h-4 rounded border-border bg-background checked:bg-[#05060A] dark:checked:bg-[#E5E7EF] checked:border-[#05060A] dark:checked:border-[#E5E7EF] focus:outline-none cursor-pointer transition-colors appearance-none"
                      />
                      <label htmlFor="protect-password-extracted" className="text-sm text-muted-foreground cursor-pointer select-none whitespace-nowrap">
                        Protect with password
                      </label>
                    </div>
                  )}

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

        {/* Multi-Location Trip Planner */}
        {showManualForm && (
        <div id="manual-form-section" className="mb-8">
          <div className="flex items-center justify-end mb-4">
            <Button
              onClick={() => setShowManualForm(false)}
              variant="outline"
              size="sm"
            >
              ← Back to Import
            </Button>
          </div>
          
          {/* Trip Date and Trip Destination */}
          <div className="rounded-md p-4 mb-6 bg-primary dark:bg-[#202020] border border-border">
            {/* Unified Grid for All Trip Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
              {/* Trip Date - spans 2 columns */}
              <div className="sm:col-span-2">
                <label htmlFor="tripDate" className="block text-sm font-medium text-primary-foreground dark:text-card-foreground mb-2">
                  Trip date
                </label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      id="tripDate"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-background",
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

              {/* Trip Destination - spans 2 columns */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-primary-foreground dark:text-card-foreground mb-2">
                  Trip destination
                </label>
                <Select
                  value={tripDestination || ''}
                  onValueChange={(value) => setTripDestination(value)}
                  disabled={loadingDestinations}
                >
                  <SelectTrigger className="w-full bg-background border-border rounded-md h-9 text-foreground">
                    <SelectValue placeholder={loadingDestinations ? "Loading destinations..." : "Select destination"} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Default city options */}
                    <SelectItem key="London" value="London">
                      London
                    </SelectItem>
                    <SelectItem key="New York" value="New York">
                      New York
                    </SelectItem>
                    
                    {/* Database destinations (exclude default cities) */}
                    {availableDestinations
                      .filter(dest => !['London', 'New York'].includes(dest))
                      .map((destination) => (
                        <SelectItem key={destination} value={destination}>
                          {destination}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Lead Passenger Name - spans 2 columns */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-primary-foreground dark:text-card-foreground mb-2">
                  Lead passenger name
                </label>
                <Input
                  value={leadPassengerName}
                  onChange={(e) => setLeadPassengerName(e.target.value)}
                  placeholder="e.g., Mr. Smith"
                  className="bg-background border-border rounded-md h-9 text-foreground"
                />
              </div>

              {/* Number of Passengers - spans 1 column */}
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-primary-foreground dark:text-card-foreground mb-2">
                  Number of Passengers
                </label>
                <PassengerPicker
                  value={passengerCount}
                  onChange={(count) => setPassengerCount(count)}
                  className="h-9"
                />
              </div>

              {/* Vehicle - spans 1 column */}
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-primary-foreground dark:text-card-foreground mb-2">
                  Vehicle
                </label>
                <Input
                  value={vehicleInfo}
                  onChange={(e) => setVehicleInfo(e.target.value)}
                  placeholder="e.g., Mercedes S-Class"
                  className="bg-background border-border rounded-md h-9 text-foreground"
                />
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
                      onPurposeChange={updateLocationPurpose}
                      onRemove={removeLocation}
                      canRemove={locations.length > 1}
                      editingIndex={editingManualIndex}
                      editingField={editingManualField}
                      tripDestination={tripDestination}
                      onEditStart={(id, field) => {
                        const locationIndex = locations.findIndex(loc => loc.id === id);
                        setEditingManualIndex(locationIndex);
                        setEditingManualField(field);
                      }}
                      onEditEnd={() => {
                        setEditingManualIndex(null);
                        setEditingManualField(null);
                      }}
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
                Locations reordered! Click "Create brief" to update the route.
              </AlertDescription>
            </Alert>
          )}

          {/* Add Location Button */}
          <div className="mt-4">
            <Button
              onClick={addLocation}
              variant="outline"
              size="lg"
              className="border-dashed"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Location
            </Button>
          </div>

          {/* Trip Notes Field */}
          <div className="mt-8 mb-4 rounded-md p-4 bg-primary dark:bg-[#1f1f21] border border-border">
            <label className="block text-sm font-medium text-primary-foreground dark:text-card-foreground mb-2">Trip Notes</label>
            <textarea
              value={extractedDriverSummary || ''}
              onChange={(e) => setExtractedDriverSummary(e.target.value)}
              placeholder="Additional notes, contact info, special instructions, etc."
              rows={6}
              className="w-full bg-background dark:bg-input/30 border-border rounded-md p-2 text-sm text-foreground dark:hover:bg-[#323236] transition-colors border resize-y focus:outline-none focus-visible:border-ring dark:focus-visible:border-[#323236]"
            />
          </div>

           {/* Create Brief & View Map Buttons */}
           <div className="flex flex-wrap items-center gap-3">
             <Button
               onClick={handleTripSubmit}
               disabled={loadingTrip || locations.filter(l => l.name).length === 0}
               variant={locationsReordered ? "destructive" : "default"}
               size="lg"
               className={`flex-1 sm:flex-initial flex items-center gap-2 bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] ${locationsReordered ? 'animate-pulse' : ''}`}
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
                  Create Brief
                </>
              )}
            </Button>

            {/* Password Protection Checkbox - Only for authenticated users */}
            {isAuthenticated && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="protect-password"
                  checked={protectWithPassword}
                  onChange={(e) => setProtectWithPassword(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-background checked:bg-[#05060A] dark:checked:bg-[#E5E7EF] checked:border-[#05060A] dark:checked:border-[#E5E7EF] focus:outline-none cursor-pointer transition-colors appearance-none"
                />
                <label htmlFor="protect-password" className="text-sm text-muted-foreground cursor-pointer select-none whitespace-nowrap">
                  Protect with password
                </label>
              </div>
            )}

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
        )}

        {/* Professional Loading State - Overlay Modal */}
        {loadingTrip && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] shadow-2xl animate-in fade-in zoom-in duration-300 overflow-y-auto flex items-center justify-center">
              <CardContent className="px-8 py-12 w-full">
                <div className="space-y-8">
                  {/* Circular Progress Indicator */}
                  <div className="flex flex-col items-center gap-3">
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
                          className="text-secondary dark:text-[#2a2a2c]"
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
                          className={loadingProgress >= 100 ? "text-green-500" : "text-[#05060A] dark:text-[#E5E7EF]"}
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
                        <h3 className="text-xl font-semibold mb-1">
                          {loadingProgress >= 100 ? 'Your brief is ready' : 'Creating brief'}
                        </h3>
                      <p className="text-sm text-muted-foreground">
                        {loadingSteps.filter(s => s.status === 'completed').length} of {loadingSteps.length} steps completed
                      </p>
                    </div>
                  </div>

                  {/* Steps List - Carousel View or Completion View */}
                  <div className="relative h-[200px] overflow-hidden">
        {loadingProgress >= 100 ? (
          // Completion View - For guests: show email field and button. For authenticated: show message
          <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
            {isAuthenticated ? (
              // Authenticated users: Show redirect message
              <div className="text-center">
                <div className="flex flex-col items-center justify-center gap-3">
                  <svg className="animate-spin h-12 w-12 text-muted-foreground" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                      <h3 className="text-lg font-semibold text-card-foreground">Redirecting</h3>
                </div>
              </div>
            ) : (
              // Guest users: Show email field and View Report button
              <div className="bg-[#05060A]/10 dark:bg-[#E5E7EF]/10 border border-[#05060A] dark:border-[#E5E7EF] rounded-md p-4">
                <div className="flex flex-col items-center space-y-4">
                  <label htmlFor="userEmail" className="block text-sm font-medium text-card-foreground text-center">
                    Your Business Email <span style={{ color: '#EEEFF4' }}>*</span> (required to view brief)
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
                  
                  {/* View Driver Brief Button - Only for guest users */}
                  <Button
                    onClick={handleGuestTripSave}
                    size="lg"
                    className="flex items-center gap-2 bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                    disabled={!pendingTripData || !userEmail.trim() || !!emailError}
                  >
                    {!pendingTripData ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Composing Brief...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        View Driver Brief
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
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
                              className={`flex items-start gap-4 p-4 rounded-lg border ${
                                isActive 
                                  ? 'border-[#05060A] dark:border-[#E5E7EF] bg-[#05060A]/10 dark:bg-[#E5E7EF]/10' 
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
                                <div className="w-6 h-6 rounded-full border-2 border-[#05060A] border-t-transparent animate-spin"></div>
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
                                <h4 className={`text-base font-semibold ${isActive ? 'text-[#05060A] dark:text-[#E5E7EF]' : ''}`}>
                                  {step.title}
                                </h4>
                                <span className="text-xs font-medium text-[#05060A] dark:text-[#E5E7EF] bg-secondary dark:bg-[#2a2a2c] px-2 py-1 rounded whitespace-nowrap flex-shrink-0">
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
            <div className="bg-card dark:bg-[#1f1f21] rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col border border-border/40">
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
                      tripDestination={tripDestination}
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
