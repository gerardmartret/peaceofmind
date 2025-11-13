'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import GoogleTripMap from '@/components/GoogleTripMap';
import TripRiskBreakdown from '@/components/TripRiskBreakdown';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Car } from 'lucide-react';
import { FlowHoverButton } from '@/components/ui/flow-hover-button';
import { getTrafficPredictions } from '@/lib/google-traffic-predictions';
import { searchNearbyCafes } from '@/lib/google-cafes';
import { searchEmergencyServices } from '@/lib/google-emergency-services';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import { validateBusinessEmail } from '@/lib/email-validation';
import { getCityConfig, createMockResponse, MOCK_DATA } from '@/lib/city-helpers';
import GoogleLocationSearch from '@/components/GoogleLocationSearch';
import { TimePicker } from '@/components/ui/time-picker';
import { Label } from '@/components/ui/label';
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

// Sortable location item for edit route modal
interface SortableEditLocationItemProps {
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
  tripDestination?: string;
}

function SortableEditLocationItem({
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
  tripDestination,
}: SortableEditLocationItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: location.placeId || `fallback-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

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
      <div className="absolute top-2 left-2 text-muted-foreground/40 text-xs font-normal">
        {numberToLetter(index + 1)}
      </div>
      
      <div className="flex items-center gap-3">
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

        <div className="flex-1 grid sm:grid-cols-[140px_1fr] gap-3">
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

          <div className="min-w-0">
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
        </div>

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

interface EmergencyServicesData {
  location: string;
  coordinates: { lat: number; lng: number };
  policeStation?: {
    id: string;
    name: string;
    address: string;
    distance: number;
    lat: number;
    lng: number;
    type: 'police';
  };
  hospital?: {
    id: string;
    name: string;
    address: string;
    distance: number;
    lat: number;
    lng: number;
    type: 'hospital';
  };
}

interface CombinedData {
  crime: CrimeData;
  disruptions: DisruptionData;
  weather: WeatherData;
  events: EventData;
  parking: ParkingData;
  cafes: CafeData;
  emergencyServices?: EmergencyServicesData;
}

interface TripData {
  tripDate: string;
  userEmail: string;
  locations: Array<{
    id: string;
    name: string;
    displayName?: string; // Custom user-defined name
    lat: number;
    lng: number;
    time: string;
    flightNumber?: string;
    flightDirection?: 'arrival' | 'departure';
  }>;
  tripResults: Array<{
    locationId: string;
    locationName: string;
    fullAddress?: string;
    time: string;
    data: CombinedData;
  }>;
  trafficPredictions: any;
  executiveReport: any;
  passengerCount?: number;
  tripDestination?: string;
  passengerNames?: string[];
  password?: string | null;
  status?: string;
}

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tripId = params.id as string;
  const { user, isAuthenticated, signUp } = useAuth();
  const { isLoaded: isGoogleMapsLoaded } = useGoogleMaps();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [tripData, setTripData] = useState<TripData | null>(null);
  
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
  const quoteFormRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [ownershipChecked, setOwnershipChecked] = useState<boolean>(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editingLocationName, setEditingLocationName] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [locationDisplayNames, setLocationDisplayNames] = useState<{[key: string]: string}>({});
  const [expandedLocations, setExpandedLocations] = useState<{[key: string]: boolean}>({});
  const [expandedRoutes, setExpandedRoutes] = useState<{[key: string]: boolean}>({});
  const [driverNotes, setDriverNotes] = useState<string>('');
  const [leadPassengerName, setLeadPassengerName] = useState<string>('');
  const [vehicleInfo, setVehicleInfo] = useState<string>('');
  const [passengerCount, setPassengerCount] = useState<number>(1);
  const [tripDestination, setTripDestination] = useState<string>('');
  const [passengerNames, setPassengerNames] = useState<string[]>([]);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [editedDriverNotes, setEditedDriverNotes] = useState<string>('');
  const [showNotesSuccess, setShowNotesSuccess] = useState(false);
  
  // Update functionality state
  const [updateText, setUpdateText] = useState<string>('');
  const [extractedUpdates, setExtractedUpdates] = useState<any>(null);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [comparisonDiff, setComparisonDiff] = useState<any>(null);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const updateTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [regenerationProgress, setRegenerationProgress] = useState<number>(0);
  const [regenerationStep, setRegenerationStep] = useState<string>('');
  const [regenerationSteps, setRegenerationSteps] = useState<Array<{
    id: string;
    title: string;
    description: string;
    source: string;
    status: 'pending' | 'loading' | 'completed' | 'error';
  }>>([]);
  
  // Driver view modal state
  const [showDriverModal, setShowDriverModal] = useState<boolean>(false);
  const [assignOnlyMode, setAssignOnlyMode] = useState<boolean>(false); // When true, hide quote functionality
  
  // Driver confirmation dialog state (for drivers to confirm pending trips)
  const [showDriverConfirmDialog, setShowDriverConfirmDialog] = useState<boolean>(false);
  const [showDriverRejectDialog, setShowDriverRejectDialog] = useState<boolean>(false);
  const [confirmingTrip, setConfirmingTrip] = useState<boolean>(false);
  
  // Driver token authentication (magic link)
  const [driverToken, setDriverToken] = useState<string | null>(null);
  const [validatedDriverEmail, setValidatedDriverEmail] = useState<string | null>(null);
  const [isDriverView, setIsDriverView] = useState<boolean>(false);
  const [tokenValidationError, setTokenValidationError] = useState<string | null>(null);
  const [tokenAlreadyUsed, setTokenAlreadyUsed] = useState<boolean>(false);
  const [tokenMessage, setTokenMessage] = useState<string | null>(null);
  const [canTakeAction, setCanTakeAction] = useState<boolean>(false);
  const [rejectingTrip, setRejectingTrip] = useState<boolean>(false);
  
  // Map modal state
  const [showMapModal, setShowMapModal] = useState<boolean>(false);
  
  // Edit route modal state
  const [showEditRouteModal, setShowEditRouteModal] = useState<boolean>(false);
  const [editingLocations, setEditingLocations] = useState<any[]>([]);
  const [editingExtractedIndex, setEditingExtractedIndex] = useState<number | null>(null);
  const [editingExtractedField, setEditingExtractedField] = useState<'location' | 'time' | null>(null);
  
  // Enhanced error tracking with step information
  const [updateProgress, setUpdateProgress] = useState<{
    step: string;
    error: string | null;
    canRetry: boolean;
  }>({
    step: '',
    error: null,
    canRetry: false,
  });
  
  // Live Trip functionality state
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);
  const [activeLocationIndex, setActiveLocationIndex] = useState<number | null>(null);
  const [liveTripInterval, setLiveTripInterval] = useState<NodeJS.Timeout | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  // Password protection state
  const [isPasswordProtected, setIsPasswordProtected] = useState<boolean>(false);
  const [isPasswordVerified, setIsPasswordVerified] = useState<boolean>(true); // Default to true to avoid showing form during loading
  const [showPasswordGate, setShowPasswordGate] = useState<boolean>(false); // Explicitly control password gate visibility
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [verifyingPassword, setVerifyingPassword] = useState<boolean>(false);
  
  // Trip status state
  const [tripStatus, setTripStatus] = useState<string>('not confirmed');
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [sendingStatusNotification, setSendingStatusNotification] = useState<boolean>(false);
  const [statusModalSuccess, setStatusModalSuccess] = useState<string | null>(null);
  const [resendingConfirmation, setResendingConfirmation] = useState<boolean>(false);
  const [cancellingTrip, setCancellingTrip] = useState<boolean>(false);
  
  // Flow A (quote selection) confirmation modal
  const [showFlowAModal, setShowFlowAModal] = useState<boolean>(false);
  const [selectedQuoteDriver, setSelectedQuoteDriver] = useState<string | null>(null);
  
  // Flow B (direct assign) confirmation modal  
  const [showFlowBModal, setShowFlowBModal] = useState<boolean>(false);
  const [directAssignDriver, setDirectAssignDriver] = useState<string | null>(null);
  
  // Trip update notification state
  const [showUpdateNotificationModal, setShowUpdateNotificationModal] = useState<boolean>(false);
  const [sendingUpdateNotification, setSendingUpdateNotification] = useState<boolean>(false);
  
  // Quotes state
  const [quotes, setQuotes] = useState<Array<{
    id: string;
    email: string;
    price: number;
    currency: string;
    created_at: string;
  }>>([]);
  const [loadingQuotes, setLoadingQuotes] = useState<boolean>(false);
  const [quoteEmail, setQuoteEmail] = useState<string>('');
  const [quotePrice, setQuotePrice] = useState<string>('');
  const [quoteCurrency, setQuoteCurrency] = useState<string>('USD');
  const [quoteEmailError, setQuoteEmailError] = useState<string | null>(null);
  const [quotePriceError, setQuotePriceError] = useState<string | null>(null);
  const [submittingQuote, setSubmittingQuote] = useState<boolean>(false);
  const [quoteSuccess, setQuoteSuccess] = useState<boolean>(false);
  const [quoteSuccessMessage, setQuoteSuccessMessage] = useState<string>('Quote submitted successfully!');
  
  // Driver's own quotes (only their submissions)
  const [myQuotes, setMyQuotes] = useState<Array<{
    id: string;
    email: string;
    price: number;
    currency: string;
    created_at: string;
  }>>([]);
  const [loadingMyQuotes, setLoadingMyQuotes] = useState<boolean>(false);
  
  // Driver state
  const [driverEmail, setDriverEmail] = useState<string | null>(null);
  const [manualDriverEmail, setManualDriverEmail] = useState<string>('');
  const [manualDriverError, setManualDriverError] = useState<string | null>(null);
  const [settingDriver, setSettingDriver] = useState<boolean>(false);
  const [driverSuggestions, setDriverSuggestions] = useState<string[]>([]);
  const [showDriverSuggestions, setShowDriverSuggestions] = useState<boolean>(false);
  const [filteredDriverSuggestions, setFilteredDriverSuggestions] = useState<string[]>([]);
  const [notifyingDriver, setNotifyingDriver] = useState<boolean>(false);
  const [notificationSuccess, setNotificationSuccess] = useState<boolean>(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  
  // Quote request state (for inviting drivers to quote)
  const [allocateDriverEmail, setAllocateDriverEmail] = useState<string>('');
  const [allocateDriverEmailError, setAllocateDriverEmailError] = useState<string | null>(null);
  const [sendingQuoteRequest, setSendingQuoteRequest] = useState<boolean>(false);
  const [quoteRequestSuccess, setQuoteRequestSuccess] = useState<string | null>(null);
  const [quoteRequestError, setQuoteRequestError] = useState<string | null>(null);
  const [sentDriverEmails, setSentDriverEmails] = useState<Array<{
    email: string;
    sentAt: string;
  }>>([]);
  
  // Guest signup state
  const [isGuestCreator, setIsGuestCreator] = useState<boolean>(false);
  const [guestSignupPassword, setGuestSignupPassword] = useState<string>('');
  const [guestSignupError, setGuestSignupError] = useState<string | null>(null);
  const [guestSignupLoading, setGuestSignupLoading] = useState<boolean>(false);
  const [guestSignupSuccess, setGuestSignupSuccess] = useState<boolean>(false);

  // Scroll position state for sticky update bar
  const [scrollY, setScrollY] = useState(0);
  

  // Drag and drop sensors for edit route modal
  const editRouteSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Avoid hydration mismatch for theme-dependent content
  useEffect(() => {
    setMounted(true);
  }, []);

  // Track scroll position for sticky update bar
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Update current time when in live mode
  useEffect(() => {
    if (isLiveMode) {
      const timeInterval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000); // Update every second

      return () => clearInterval(timeInterval);
    }
  }, [isLiveMode]);

  // Auto-resize textarea as content changes (up to 3 lines)
  useEffect(() => {
    const textarea = updateTextareaRef.current;
    if (textarea) {
      // Reset height to allow shrinking
      textarea.style.height = '44px';
      
      // Calculate new height based on content (up to max 3 lines ~120px)
      const newHeight = Math.min(textarea.scrollHeight, 120);
      textarea.style.height = `${newHeight}px`;
    }
  }, [updateText]);

  // Scroll to quote form if coming from quote request email
  useEffect(() => {
    if (searchParams.get('quote') === 'true' && !isOwner && !loading && quoteFormRef.current) {
      // Wait a bit for page to fully render, then scroll
      setTimeout(() => {
        quoteFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
    }
  }, [searchParams, isOwner, loading]);

  // Validate driver token if present in URL (magic link authentication)
  useEffect(() => {
    const token = searchParams.get('driver_token');
    
    if (!token || !tripId || loading) return;
    
    console.log('🔍 Driver token detected in URL, validating...');
    setDriverToken(token);
    
    async function validateToken() {
      try {
        const response = await fetch('/api/validate-driver-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: token,
            tripId: tripId,
          }),
        });

        const result = await safeJsonParse(response);

        if (result.success) {
          console.log('✅ Driver token validated successfully');
          console.log('📊 Token info:', { 
            tokenUsed: result.tokenUsed, 
            canTakeAction: result.canTakeAction,
            tripStatus: result.tripStatus,
            hasMessage: !!result.message 
          });
          
          setValidatedDriverEmail(result.driverEmail);
          setIsDriverView(true);
          setQuoteEmail(result.driverEmail); // Pre-fill email for convenience
          setTokenValidationError(null);
          setTokenAlreadyUsed(result.tokenUsed || false);
          setTokenMessage(result.message || null);
          setCanTakeAction(result.canTakeAction !== false); // Default to true if not specified
        } else {
          console.error('❌ Token validation failed:', result.error);
          setTokenValidationError(result.error || 'Invalid or expired link');
          setIsDriverView(false);
        }
      } catch (err) {
        console.error('❌ Error validating token:', err);
        setTokenValidationError('Failed to validate link. Please try again.');
        setIsDriverView(false);
      }
    }

    validateToken();
  }, [searchParams, tripId, loading]);

  // Function to format stored time - returns time as-is without any timezone conversion
  const getLondonLocalTime = (timeString: string): string => {
    if (!timeString) return 'N/A';
    
    // Simply return the time string as formatted HH:MM
    // Parse the time string (e.g., "18:35" or "18")
    const timeParts = timeString.split(':');
    const hours = parseInt(timeParts[0]) || 0;
    const minutes = parseInt(timeParts[1]) || 0;
    
    // Format as HH:MM (pad with zeros if needed)
    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    
    return `${formattedHours}:${formattedMinutes}`;
  };


  // Function to extract flight numbers from driver notes
  const extractFlightNumbers = (notes: string): {[locationName: string]: string[]} => {
    if (!notes) return {};
    
    console.log('🔍 [DEBUG] extractFlightNumbers - Input notes:', notes);
    
    const flightMap: {[locationName: string]: string[]} = {};
    
    // Common flight number patterns - more comprehensive
    const flightPatterns = [
      /\b([A-Z]{2,3}\s*\d{3,4})\b/g, // BA123, AA1234, etc.
      /\b(flight\s*([A-Z]{2,3}\s*\d{3,4}))/gi, // "flight BA123"
      /\b([A-Z]{2,3}\s*\d{3,4})\s*(?:arrives?|departs?|lands?|takes\s*off)/gi, // "BA123 arrives"
      /\b([A-Z]{2,3}\s*\d{3,4})\s*(?:at|from|to)\s*(?:heathrow|gatwick|stansted|luton|city|airport)/gi, // "BA123 at Heathrow"
      /\b(heathrow|gatwick|stansted|luton|city|airport).*?([A-Z]{2,3}\s*\d{3,4})/gi, // "Heathrow BA123"
    ];
    
    // Common airport keywords
    const airportKeywords = [
      'heathrow', 'gatwick', 'stansted', 'luton', 'city', 'airport',
      'terminal', 'arrivals', 'departures', 'lhr', 'lgw', 'stn', 'ltn'
    ];
    
    // Split notes into sentences and look for flight numbers near airport mentions
    const sentences = notes.split(/[.!?]+/);
    console.log('🔍 [DEBUG] extractFlightNumbers - Sentences:', sentences);
    
    sentences.forEach(sentence => {
      const lowerSentence = sentence.toLowerCase();
      console.log('🔍 [DEBUG] extractFlightNumbers - Checking sentence:', sentence);
      
      // Check if sentence mentions an airport
      const mentionedAirport = airportKeywords.find(keyword => 
        lowerSentence.includes(keyword)
      );
      
      console.log('🔍 [DEBUG] extractFlightNumbers - Mentioned airport:', mentionedAirport);
      
      if (mentionedAirport) {
        // Look for flight numbers in this sentence
        flightPatterns.forEach(pattern => {
          const matches = sentence.match(pattern);
          if (matches) {
            console.log('🔍 [DEBUG] extractFlightNumbers - Found flight matches:', matches);
            matches.forEach(match => {
              // Clean up the flight number
              const flightNumber = match.replace(/flight\s*/gi, '').trim();
              if (flightNumber) {
                console.log('🔍 [DEBUG] extractFlightNumbers - Cleaned flight number:', flightNumber);
                // Determine airport name based on context
                let airportName = 'Airport';
                if (lowerSentence.includes('heathrow') || lowerSentence.includes('lhr')) {
                  airportName = 'Heathrow Airport';
                } else if (lowerSentence.includes('gatwick') || lowerSentence.includes('lgw')) {
                  airportName = 'Gatwick Airport';
                } else if (lowerSentence.includes('stansted') || lowerSentence.includes('stn')) {
                  airportName = 'Stansted Airport';
                } else if (lowerSentence.includes('luton') || lowerSentence.includes('ltn')) {
                  airportName = 'Luton Airport';
                } else if (lowerSentence.includes('city')) {
                  airportName = 'London City Airport';
                }
                
                console.log('🔍 [DEBUG] extractFlightNumbers - Airport name:', airportName);
                
                if (!flightMap[airportName]) {
                  flightMap[airportName] = [];
                }
                if (!flightMap[airportName].includes(flightNumber)) {
                  flightMap[airportName].push(flightNumber);
                }
              }
            });
          }
        });
      }
    });
    
    console.log('🔍 [DEBUG] extractFlightNumbers - Final flight map:', flightMap);
    return flightMap;
  };

  // Function to extract service introduction from driver notes
  const extractServiceIntroduction = (notes: string): string => {
    if (!notes) {
      return 'Executive transportation service';
    }
    
    // Extract key operational details
    const serviceType = notes.toLowerCase().includes('full day') ? 'Full day hourly-based journey' : 
                       notes.toLowerCase().includes('hourly') ? 'Hourly-based journey' :
                       notes.toLowerCase().includes('chauffeur') ? 'Chauffeur service' :
                       'Executive transportation service';
    
    // Extract client name
    const nameMatch = notes.match(/\b(Mr\.|Mrs\.|Ms\.|Dr\.|Sir|Lady)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/);
    const clientName = nameMatch ? `${nameMatch[1]} ${nameMatch[2]}` : 'Client';
    
    // Extract location context
    const locationContext = notes.toLowerCase().includes('london') ? 'in London' : 'in the specified area';
    
    // Count stops
    const stopCount = locations?.length || 0;
    const stopText = stopCount === 1 ? 'stop' : 'stops';
    
    // Extract start and end times from locations
    let timeInfo = '';
    if (locations && locations.length > 0) {
      const startTime = locations[0]?.time ? getLondonLocalTime(locations[0].time) : '';
      const endTime = locations[locations.length - 1]?.time ? getLondonLocalTime(locations[locations.length - 1].time) : '';
      
      if (startTime && endTime && startTime !== endTime) {
        timeInfo = ` starting at ${startTime} and finishing at ${endTime}`;
      } else if (startTime) {
        timeInfo = ` starting at ${startTime}`;
      }
    }
    
    return `${serviceType} for ${clientName} with ${stopCount} ${stopText} ${locationContext}${timeInfo}`;
  };

  // Function to extract car information from driver notes
  const extractCarInfo = (notes: string): string | null => {
    if (!notes) {
      console.log('🚗 [CAR DEBUG] No driver notes provided');
      return null;
    }
    
    console.log('🚗 [CAR DEBUG] ===== CAR EXTRACTION START =====');
    console.log('🚗 [CAR DEBUG] Input driver notes:', notes);
    console.log('🚗 [CAR DEBUG] Notes length:', notes.length);
    
    // Enhanced car patterns - prioritize full specifications (brand + model)
    const carPatterns = [
      // Color + Brand + Model (highest priority)
      /\b(black|white|silver|grey|gray|blue|red|green|gold|champagne)\s+(mercedes|bmw|audi|lexus|tesla|jaguar|bentley|rolls\s*royce|porsche|ferrari|lamborghini|maserati|aston\s*martin)\s+(s-class|e-class|c-class|a-class|x5|x3|x1|x7|a4|a6|a8|q5|q7|q8|model\s*s|model\s*x|es|ls|gs|rx|gx|lx|continental|flying\s*spur|ghost|phantom|911|cayenne|macan|boxster|carrera|488|f8|huracan|aventador|granturismo|quattroporte|db11|vantage|rapide)\b/gi,
      // Brand + Model (high priority)
      /\b(mercedes|bmw|audi|lexus|tesla|jaguar|bentley|rolls\s*royce|porsche|ferrari|lamborghini|maserati|aston\s*martin)\s+(s-class|e-class|c-class|a-class|x5|x3|x1|x7|a4|a6|a8|q5|q7|q8|model\s*s|model\s*x|es|ls|gs|rx|gx|lx|continental|flying\s*spur|ghost|phantom|911|cayenne|macan|boxster|carrera|488|f8|huracan|aventador|granturismo|quattroporte|db11|vantage|rapide)\b/gi,
      // Color + Brand (medium priority)
      /\b(black|white|silver|grey|gray|blue|red|green|gold|champagne)\s+(mercedes|bmw|audi|lexus|tesla|jaguar|bentley|rolls\s*royce|porsche|ferrari|lamborghini|maserati|aston\s*martin)\b/gi,
      // Brand only (lowest priority)
      /\b(mercedes|bmw|audi|lexus|tesla|jaguar|bentley|rolls\s*royce|porsche|ferrari|lamborghini|maserati|aston\s*martin)\b/gi,
      // Vehicle type
      /\b(executive|luxury|premium|vip|chauffeur|limousine|sedan|saloon|suv|coupe|convertible|estate|wagon)\s+(car|vehicle|auto)\b/gi,
      // Requirements
      /\b(car|vehicle|auto)\s+(must\s*be|should\s*be|needs\s*to\s*be|required)\s+(mercedes|bmw|audi|lexus|tesla|jaguar|bentley|rolls\s*royce|porsche|ferrari|lamborghini|maserati|aston\s*martin)\b/gi,
      // Color + Type
      /\b(black|white|silver|grey|gray|blue|red|green|gold|champagne)\s+(executive|luxury|premium|vip|chauffeur|limousine|sedan|saloon|suv|coupe|convertible|estate|wagon)\s+(car|vehicle|auto)\b/gi,
      // Simple mentions
      /\b(mercedes|bmw|audi|lexus|tesla|jaguar|bentley|rolls\s*royce|porsche|ferrari|lamborghini|maserati|aston\s*martin)\s+(car|vehicle|auto)\b/gi,
      // "black car", "luxury vehicle" etc
      /\b(black|white|silver|grey|gray|blue|red|green|gold|champagne)\s+(car|vehicle|auto)\b/gi
    ];
    
    console.log('🚗 [CAR DEBUG] Total patterns to check:', carPatterns.length);
    
    // Split notes into sentences and look for car mentions
    const sentences = notes.split(/[.!?]+/).filter(s => s.trim().length > 0);
    console.log('🚗 [CAR DEBUG] Sentences found:', sentences.length);
    console.log('🚗 [CAR DEBUG] Sentences:', sentences);
    
    // Track the best match (most complete specification)
    let bestMatch = null;
    let bestMatchScore = 0;
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      console.log(`🚗 [CAR DEBUG] Checking sentence ${i + 1}:`, sentence);
      
      for (let j = 0; j < carPatterns.length; j++) {
        const pattern = carPatterns[j];
        console.log(`🚗 [CAR DEBUG] Testing pattern ${j + 1}:`, pattern);
        
        const matches = sentence.match(pattern);
        if (matches && matches.length > 0) {
          console.log('🚗 [CAR DEBUG] ✅ MATCH FOUND!');
          console.log('🚗 [CAR DEBUG] Matches:', matches);
          console.log('🚗 [CAR DEBUG] Pattern that matched:', pattern);
          
          // Calculate match score (higher score = more complete specification)
          let matchScore = 0;
          const match = matches[0].trim().toLowerCase();
          
          // Score based on pattern priority (earlier patterns = higher priority)
          matchScore += (carPatterns.length - j) * 10;
          
          // Bonus points for brand + model combinations
          if (match.includes('s-class') || match.includes('e-class') || match.includes('a-class') || 
              match.includes('a4') || match.includes('a6') || match.includes('a8') ||
              match.includes('x5') || match.includes('x3') || match.includes('x1') ||
              match.includes('q5') || match.includes('q7') || match.includes('q8')) {
            matchScore += 20;
          }
          
          // Bonus points for color specification
          if (match.includes('black') || match.includes('white') || match.includes('silver') ||
              match.includes('grey') || match.includes('gray') || match.includes('blue') ||
              match.includes('red') || match.includes('green') || match.includes('gold') ||
              match.includes('champagne')) {
            matchScore += 10;
          }
          
          console.log('🚗 [CAR DEBUG] Match score:', matchScore);
          
          // Keep the best match
          if (matchScore > bestMatchScore) {
            bestMatch = matches[0].trim();
            bestMatchScore = matchScore;
            console.log('🚗 [CAR DEBUG] New best match:', bestMatch);
          }
        }
      }
    }
    
    // Process the best match if found
    if (bestMatch) {
      console.log('🚗 [CAR DEBUG] ✅ BEST MATCH SELECTED!');
      console.log('🚗 [CAR DEBUG] Best match:', bestMatch);
      console.log('🚗 [CAR DEBUG] Best match score:', bestMatchScore);
      
      // Clean up and format the car mention
      let carMention = bestMatch;
      console.log('🚗 [CAR DEBUG] Raw best match:', carMention);
      
      // Capitalize first letter of each word
      carMention = carMention.replace(/\b\w/g, l => l.toUpperCase());
      console.log('🚗 [CAR DEBUG] After capitalization:', carMention);
      
      // Clean up common formatting issues
      carMention = carMention.replace(/\s+/g, ' ');
      carMention = carMention.replace(/\bCar\b/g, 'car');
      carMention = carMention.replace(/\bVehicle\b/g, 'vehicle');
      carMention = carMention.replace(/\bAuto\b/g, 'auto');
      
      // Format brand + model combinations properly
      carMention = carMention.replace(/\bMercedes\s+S-Class\b/gi, 'Mercedes S-Class');
      carMention = carMention.replace(/\bMercedes\s+E-Class\b/gi, 'Mercedes E-Class');
      carMention = carMention.replace(/\bMercedes\s+C-Class\b/gi, 'Mercedes C-Class');
      carMention = carMention.replace(/\bMercedes\s+A-Class\b/gi, 'Mercedes A-Class');
      carMention = carMention.replace(/\bAudi\s+A4\b/gi, 'Audi A4');
      carMention = carMention.replace(/\bAudi\s+A6\b/gi, 'Audi A6');
      carMention = carMention.replace(/\bAudi\s+A8\b/gi, 'Audi A8');
      carMention = carMention.replace(/\bBMW\s+X5\b/gi, 'BMW X5');
      carMention = carMention.replace(/\bBMW\s+X3\b/gi, 'BMW X3');
      carMention = carMention.replace(/\bBMW\s+X1\b/gi, 'BMW X1');
      carMention = carMention.replace(/\bAudi\s+Q5\b/gi, 'Audi Q5');
      carMention = carMention.replace(/\bAudi\s+Q7\b/gi, 'Audi Q7');
      carMention = carMention.replace(/\bAudi\s+Q8\b/gi, 'Audi Q8');
      
      console.log('🚗 [CAR DEBUG] Final formatted car mention:', carMention);
      console.log('🚗 [CAR DEBUG] ===== CAR EXTRACTION SUCCESS =====');
      return carMention;
    }
    
    console.log('🚗 [CAR DEBUG] ❌ No car information found in any sentence');
    console.log('🚗 [CAR DEBUG] ===== CAR EXTRACTION FAILED =====');
    return null;
  };

  const handleEditLocationName = (locationId: string, currentName: string) => {
    setEditingLocationId(locationId);
    // Get the current display name or use the first part of the full address
    const currentDisplayName = locationDisplayNames[locationId] || currentName.split(',')[0];
    setEditingLocationName(currentDisplayName);
    
    // Select all text in the input field after it's rendered
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.select();
      }
    }, 0);
  };

  const handleSaveLocationName = async (locationId: string) => {
    // Security check: Only owners can edit location names
    if (!isOwner) {
      console.error('❌ Unauthorized: Only trip owners can edit location names');
      setEditingLocationId(null);
      setEditingLocationName('');
      return;
    }

    if (!editingLocationName.trim() || !tripData) {
      setEditingLocationId(null);
      setEditingLocationName('');
      return;
    }

    try {
      // Update the locations array with the new display name
      const updatedLocations = tripData.locations.map(loc => 
        loc.id === locationId 
          ? { ...loc, displayName: editingLocationName.trim() }
          : loc
      );

      // Save to database
      const { error: updateError } = await supabase
        .from('trips')
        .update({ locations: updatedLocations })
        .eq('id', tripId);

      if (updateError) {
        console.error('Error saving location name:', updateError);
        setEditingLocationId(null);
        setEditingLocationName('');
        return;
      }

      // Update local state
      setTripData({
        ...tripData,
        locations: updatedLocations
      });

      setLocationDisplayNames(prev => ({
        ...prev,
        [locationId]: editingLocationName.trim()
      }));

      setEditingLocationId(null);
      setEditingLocationName('');
    } catch (error) {
      console.error('Error saving location name:', error);
      setEditingLocationId(null);
      setEditingLocationName('');
    }
  };

  // Edit route modal handlers
  const handleEditRouteDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setEditingLocations((items) => {
        const oldIndex = items.findIndex((item) => (item.placeId || `fallback-${items.indexOf(item)}`) === active.id);
        const newIndex = items.findIndex((item) => (item.placeId || `fallback-${items.indexOf(item)}`) === over.id);
        
        const reorderedItems = arrayMove(items, oldIndex, newIndex);
        console.log(`🔄 Edit route: Location reordered ${oldIndex + 1} → ${newIndex + 1}`);
        return reorderedItems;
      });
    }
  };

  const handleEditLocationSelect = (index: number, location: any) => {
    const updatedLocations = [...editingLocations];
    updatedLocations[index] = {
      ...updatedLocations[index],
      location: location.name,
      formattedAddress: location.name,
      lat: location.lat,
      lng: location.lng,
      verified: true,
      // Keep purpose unchanged
    };
    setEditingLocations(updatedLocations);
    console.log(`✅ Location updated at index ${index}:`, location.name);
    console.log(`   Purpose preserved: ${updatedLocations[index].purpose}`);
  };

  const handleEditTimeChange = (index: number, time: string) => {
    const updatedLocations = [...editingLocations];
    updatedLocations[index] = {
      ...updatedLocations[index],
      time: time,
    };
    setEditingLocations(updatedLocations);
  };

  const handleEditLocationRemove = (index: number) => {
    if (editingLocations.length > 1) {
      setEditingLocations(prev => prev.filter((_, idx) => idx !== index));
    }
  };

  const handleAddEditLocation = () => {
    const newIndex = editingLocations.length;
    const newLocation = {
      location: '',
      formattedAddress: '',
      lat: 0,
      lng: 0,
      time: '12:00',
      purpose: `Location ${newIndex + 1}`, // Default purpose for new locations
      confidence: 'low',
      verified: false,
      placeId: `new-location-${Date.now()}-${Math.random()}`,
    };
    setEditingLocations(prev => [...prev, newLocation]);
  };

  const handleSaveRouteEdits = async () => {
    try {
      console.log('💾 Saving route edits and regenerating...');
      
      // Validate all locations have valid coordinates
      const validLocations = editingLocations.filter(loc => 
        loc.lat !== 0 && loc.lng !== 0 && loc.location.trim() !== ''
      );
      
      if (validLocations.length === 0) {
        alert('Please select at least one valid location');
        return;
      }
      
      // Convert to database format - preserve original name (purpose)
      const locationsForDb = validLocations.map((loc, idx) => ({
        id: `location-${idx + 1}`,
        name: loc.purpose || loc.location, // Preserve original name (purpose), fallback to location
        fullAddress: loc.formattedAddress || loc.location,
        lat: loc.lat,
        lng: loc.lng,
        time: loc.time,
      }));
      
      setShowEditRouteModal(false);
      setIsRegenerating(true);
      setRegenerationProgress(0);
      setRegenerationStep('Preparing to regenerate route...');
      
      // Call the existing regeneration logic (reuse from lines ~2660)
      const tripDateStr = tripDate;
      const days = 7;
      
      console.log(`🚀 [EDIT-ROUTE] Regenerating for ${validLocations.length} locations`);
      
      // Get city configuration
      const cityConfig = getCityConfig(tripDestination);
      console.log(`🌍 [EDIT-ROUTE] City: ${cityConfig.cityName} (London APIs ${cityConfig.isLondon ? 'ENABLED' : 'DISABLED'})`);
      
      setRegenerationProgress(40);
      setRegenerationStep(`Fetching data for ${validLocations.length} location(s)...`);
      
      // Fetch data for all locations (same as existing regeneration logic)
      const results = await Promise.all(
        locationsForDb.map(async (location) => {
          console.log(`\n🔍 [EDIT-ROUTE] Fetching data for: ${location.name} at ${location.time}`);
          
          const tempDistrictId = `custom-${Date.now()}-${location.id}`;
          
          // Universal APIs
          const universalCalls = [
            fetch(`/api/weather?district=${tempDistrictId}&lat=${location.lat}&lng=${location.lng}&days=${days}`),
          ];
          
          // London-specific APIs (conditional)
          const londonCalls = cityConfig.isLondon ? [
            fetch(`/api/uk-crime?district=${tempDistrictId}&lat=${location.lat}&lng=${location.lng}`),
            fetch(`/api/tfl-disruptions?district=${tempDistrictId}&days=${days}`),
            fetch(`/api/parking?lat=${location.lat}&lng=${location.lng}&location=${encodeURIComponent(location.name)}`),
          ] : [
            createMockResponse('crime', MOCK_DATA.crime),
            createMockResponse('disruptions', MOCK_DATA.disruptions),
            createMockResponse('parking', MOCK_DATA.parking),
          ];
          
          const [crimeResponse, disruptionsResponse, parkingResponse, weatherResponse] = await Promise.all([
            ...londonCalls,
            ...universalCalls,
          ]);
          
          if (cityConfig.isLondon) {
            const responses = [crimeResponse, disruptionsResponse, weatherResponse, parkingResponse];
            const responseNames = ['crime', 'disruptions', 'weather', 'parking'];
            
            for (let i = 0; i < responses.length; i++) {
              if (!responses[i].ok) {
                const errorText = await responses[i].text();
                console.error(`❌ ${responseNames[i]} API failed:`, responses[i].status, errorText);
                throw new Error(`${responseNames[i]} API returned ${responses[i].status}: ${errorText}`);
              }
            }
          } else {
            if (!weatherResponse.ok) {
              const errorText = await weatherResponse.text();
              console.error(`❌ weather API failed:`, weatherResponse.status, errorText);
              throw new Error(`weather API returned ${weatherResponse.status}: ${errorText}`);
            }
          }
          
          const [crimeData, disruptionsData, parkingData, weatherData] = await Promise.all([
            crimeResponse.json(),
            disruptionsResponse.json(),
            parkingResponse.json(),
            weatherResponse.json(),
          ]);
          
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
          
          let cafeData = null;
          try {
            const cafes = await searchNearbyCafes(location.lat, location.lng, location.name);
            cafeData = { success: true, data: cafes };
          } catch (cafeError) {
            console.error(`⚠️ Cafe search failed for ${location.name}:`, cafeError);
            cafeData = {
              success: true,
              data: {
                location: location.name,
                coordinates: { lat: location.lat, lng: location.lng },
                cafes: [],
                summary: { total: 0, averageRating: 0, averageDistance: 0 }
              }
            };
          }
          
          return {
            locationId: location.id,
            locationName: location.name,
            fullAddress: location.fullAddress,
            time: location.time,
            data: {
              crime: crimeData.data,
              disruptions: disruptionsData.data,
              weather: weatherData.data,
              events: eventsData.data,
              parking: parkingData.data,
              cafes: cafeData.data,
            },
          };
        })
      );
      
      setRegenerationProgress(70);
      setRegenerationStep('Calculating traffic predictions...');
      
      // Get traffic predictions
      const trafficData = await getTrafficPredictions(
        locationsForDb.map(loc => ({
          id: loc.id,
          name: loc.name,
          lat: loc.lat,
          lng: loc.lng,
          time: loc.time,
        })),
        tripDateStr
      );
      
      setRegenerationProgress(90);
      setRegenerationStep('Generating executive report...');
      
      // Generate executive report
      const reportResponse = await fetch('/api/executive-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripData: results,
          tripDate: tripDateStr,
          routeDistance: trafficData.data?.reduce((sum: number, leg: any) => sum + (leg.distanceMeters || 0), 0) / 1000,
          routeDuration: trafficData.data?.reduce((sum: number, leg: any) => sum + (leg.minutes || 0), 0),
          trafficPredictions: trafficData.data,
          emailContent: null,
          leadPassengerName,
          vehicleInfo,
          passengerCount,
          tripDestination,
          passengerNames,
          driverNotes, // Preserve existing notes
        }),
      });
      
      const reportData = await reportResponse.json();
      
      if (!reportData.success) {
        throw new Error('Failed to generate executive report');
      }
      
      // Update database with new locations (preserve notes and other fields)
      const { error: updateError } = await supabase
        .from('trips')
        .update({
          locations: JSON.stringify(locationsForDb),
          trip_results: JSON.stringify(results),
          traffic_predictions: JSON.stringify(trafficData),
          executive_report: JSON.stringify(reportData.data),
          updated_at: new Date().toISOString(),
          version: (currentVersion || 0) + 1,
          // CRITICAL: trip_notes NOT updated (preserved)
        })
        .eq('id', tripId);
      
      if (updateError) {
        throw updateError;
      }
      
      console.log('✅ [EDIT-ROUTE] Route updated successfully!');
      
      // Reload page to show updated data
      window.location.reload();
      
    } catch (error) {
      console.error('❌ [EDIT-ROUTE] Error saving route edits:', error);
      setIsRegenerating(false);
      alert('Failed to update route. Please try again.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, locationId: string) => {
    if (e.key === 'Enter') {
      handleSaveLocationName(locationId);
    } else if (e.key === 'Escape') {
      setEditingLocationId(null);
      setEditingLocationName('');
    }
  };

  const toggleLocationExpansion = (locationId: string) => {
    setExpandedLocations(prev => ({
      ...prev,
      [locationId]: !prev[locationId]
    }));
  };

  const toggleRouteExpansion = (routeId: string) => {
    setExpandedRoutes(prev => ({
      ...prev,
      [routeId]: !prev[routeId]
    }));
  };

  // Live Trip helper functions - returns current local time without timezone conversion
  const getCurrentTripTime = (): Date => {
    // Simply return the current local time
    return new Date();
  };

  const findClosestLocation = (): number => {
    if (!tripData?.locations || tripData.locations.length === 0) {
      return 0;
    }

    const currentTime = getCurrentTripTime();
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    let closestIndex = 0;
    let smallestDiff = Infinity;

    tripData.locations.forEach((location, index) => {
      const locationTime = parseInt(location.time) || 0;
      const locationTimeInMinutes = locationTime * 60;
      const diff = Math.abs(currentTimeInMinutes - locationTimeInMinutes);
      
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestIndex = index;
      }
    });

    return closestIndex;
  };

  // Check if trip is within 1 hour of starting - simplified without timezone conversions
  const isTripWithinOneHour = (): boolean => {
    if (!tripData?.tripDate || !tripData?.locations || tripData.locations.length === 0) {
      return false;
    }

    const now = new Date();
    const tripDateTime = new Date(tripData.tripDate);
    const oneHourBefore = new Date(tripDateTime.getTime() - 60 * 60 * 1000);
    
    return now >= oneHourBefore;
  };


  const startLiveTrip = () => {
    if (!tripData?.locations) return;

    const closestIndex = findClosestLocation();
    setActiveLocationIndex(closestIndex);
    setIsLiveMode(true);

    // Set up interval to update active location every minute
    const interval = setInterval(() => {
      const newClosestIndex = findClosestLocation();
      if (newClosestIndex !== activeLocationIndex) {
        setActiveLocationIndex(newClosestIndex);
      }
    }, 60000); // Update every minute

    setLiveTripInterval(interval);
  };

  const stopLiveTrip = () => {

    setIsLiveMode(false);
    setActiveLocationIndex(null);
    if (liveTripInterval) {
      clearInterval(liveTripInterval);
      setLiveTripInterval(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!tripId) return;
    
    // Security check: Only owners can save notes
    if (!isOwner) {
      console.error('❌ Unauthorized: Only trip owners can edit driver notes');
      return;
    }

    try {
      setIsSavingNotes(true);
      
      console.log('Saving notes with values:', {
        editedDriverNotes,
        leadPassengerName,
        vehicleInfo,
        passengerCount,
        tripDestination,
        passengerNames,
        tripId
      });
      
      const updateData: any = {
        trip_notes: editedDriverNotes
      };
      
      // Only include new fields if they have values
      if (leadPassengerName) {
        updateData.lead_passenger_name = leadPassengerName;
      }
      if (vehicleInfo) {
        updateData.vehicle = vehicleInfo;
      }
      if (passengerCount && passengerCount > 0) {
        updateData.passenger_count = passengerCount;
      }
      if (tripDestination) {
        updateData.trip_destination = tripDestination;
      }
      // Note: passenger_names column doesn't exist in database
      // Passenger names are still used for display but not stored in DB
      
      console.log('Update data:', updateData);
      
      // First check if the trip exists
      const { data: existingTrip, error: fetchError } = await supabase
        .from('trips')
        .select('id')
        .eq('id', tripId)
        .single();
        
      if (fetchError) {
        console.error('Error fetching trip:', fetchError);
        return;
      }
      
      if (!existingTrip) {
        console.error('Trip not found with ID:', tripId);
        return;
      }
      
      const { error: updateError } = await supabase
        .from('trips')
        .update(updateData)
        .eq('id', tripId);

      if (updateError) {
        console.error('Error saving notes:', updateError);
        console.error('Update data:', updateData);
        console.error('Trip ID:', tripId);
        return;
      }

      // Update the local state with the saved notes
      setDriverNotes(editedDriverNotes);
      
      setIsEditingNotes(false);
      setShowNotesSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setShowNotesSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      setIsSavingNotes(false);
    }
  };

  useEffect(() => {
    async function loadTripFromDatabase() {
      if (!tripId) {
        console.log('⚠️ No trip ID provided');
        router.push('/');
        return;
      }

      try {
        console.log(`📡 Loading trip from database: ${tripId}`);
        
        const { data, error: fetchError } = await supabase
          .from('trips')
          .select('*')
          .eq('id', tripId)
          .single();

        if (fetchError) {
          console.error('❌ Error loading trip:', fetchError);
          setError('Trip not found');
          setLoading(false);
          return;
        }

        if (!data) {
          console.log('⚠️ Trip not found in database');
          setError('Trip not found');
          setLoading(false);
          return;
        }

        console.log('✅ Trip loaded from database');
        
        // Check ownership: if user is authenticated and their ID matches the trip's user_id
        const tripUserId = data.user_id;
        const currentUserId = user?.id;
        
        // Use local variable to determine ownership
        const userIsOwner = isAuthenticated && currentUserId && tripUserId === currentUserId;
        
        if (userIsOwner) {
          setIsOwner(true);
          console.log('🔐 User is the owner of this trip - editing enabled');
        } else {
          setIsOwner(false);
          console.log('👁️ User is NOT the owner - read-only mode');
        }
        
        // Check if user is guest creator (for signup CTA)
        if (!isAuthenticated && !tripUserId && typeof window !== 'undefined') {
          const createdTripId = sessionStorage.getItem('guestCreatedTripId');
          if (createdTripId === tripId) {
            setIsGuestCreator(true);
            console.log('👤 Guest user created this trip - showing signup CTA');
          }
        }
        
        // Transform database data to match expected TripData format
        // Ensure traffic_predictions has correct structure with success flag
        let trafficPredictionsFormatted: any = null;
        let rawTrafficPredictions = data.traffic_predictions as any;
        
        // Parse if stored as JSON string
        if (typeof rawTrafficPredictions === 'string') {
          try {
            rawTrafficPredictions = JSON.parse(rawTrafficPredictions);
          } catch (e) {
            console.error('❌ Failed to parse traffic_predictions JSON:', e);
            rawTrafficPredictions = null;
          }
        }
        
        if (rawTrafficPredictions) {
          // Check if it already has the correct structure
          if (rawTrafficPredictions.success !== undefined && Array.isArray(rawTrafficPredictions.data)) {
            // Already in correct format
            trafficPredictionsFormatted = rawTrafficPredictions;
          } else if (Array.isArray(rawTrafficPredictions)) {
            // Legacy format - array of route data
            trafficPredictionsFormatted = {
              success: true,
              data: rawTrafficPredictions,
            };
          } else if (rawTrafficPredictions.data && Array.isArray(rawTrafficPredictions.data)) {
            // Has data array but missing success flag or other fields
            trafficPredictionsFormatted = {
              success: rawTrafficPredictions.success !== false, // Default to true if not explicitly false
              data: rawTrafficPredictions.data,
              totalDistance: rawTrafficPredictions.totalDistance || '0 km',
              totalMinutes: rawTrafficPredictions.totalMinutes || 0,
              totalMinutesNoTraffic: rawTrafficPredictions.totalMinutesNoTraffic || 0,
            };
          } else {
            // Invalid format - set to null to show "Calculating..."
            console.warn('⚠️ Invalid traffic_predictions format:', rawTrafficPredictions);
            trafficPredictionsFormatted = null;
          }
        }

        // FIX: Validate and fix location IDs when loading from database
        const usedIds = new Set<string>();
        
        // Parse locations if they're stored as JSON string
        let locationsArray = data.locations;
        if (typeof locationsArray === 'string') {
          try {
            locationsArray = JSON.parse(locationsArray);
          } catch (e) {
            console.error('❌ Failed to parse locations JSON:', e);
            locationsArray = [];
          }
        }
        
        // Ensure locationsArray is actually an array
        if (!Array.isArray(locationsArray)) {
          console.error('❌ Locations is not an array after parsing:', typeof locationsArray, locationsArray);
          locationsArray = [];
        }
        
        const locationsWithValidIds = locationsArray.map((loc: any, idx: number) => {
          // Check if ID is invalid (literal string from AI bug)
          if (!loc.id || loc.id === 'currentLocation.id' || loc.id === 'extractedLocation.id' || loc.id.includes('Location.id')) {
            console.warn(`⚠️ [FIX] Invalid location ID detected in database: "${loc.id}", generating unique ID for location ${idx}`);
            const newId = `location-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            usedIds.add(newId);
            return {
              ...loc,
              id: newId
            };
          }
          
          // Check for duplicate IDs
          if (usedIds.has(loc.id)) {
            const newId = `location-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            console.warn(`⚠️ [FIX] Duplicate location ID detected in database: "${loc.id}" at index ${idx}, generating unique ID: "${newId}"`);
            usedIds.add(newId);
            return {
              ...loc,
              id: newId
            };
          }
          
          usedIds.add(loc.id);
          return loc;
        });

        // Parse JSON fields if they're stored as strings
        let tripResultsParsed = data.trip_results;
        if (typeof tripResultsParsed === 'string') {
          try {
            tripResultsParsed = JSON.parse(tripResultsParsed);
          } catch (e) {
            console.error('❌ Failed to parse trip_results JSON:', e);
            tripResultsParsed = [];
          }
        }
        
        let executiveReportParsed = data.executive_report;
        if (typeof executiveReportParsed === 'string') {
          try {
            executiveReportParsed = JSON.parse(executiveReportParsed);
          } catch (e) {
            console.error('❌ Failed to parse executive_report JSON:', e);
            executiveReportParsed = null;
          }
        }

        const tripData: TripData = {
          tripDate: data.trip_date,
          userEmail: data.user_email,
          locations: locationsWithValidIds,
          tripResults: tripResultsParsed as any,
          trafficPredictions: trafficPredictionsFormatted,
          executiveReport: executiveReportParsed as any,
          passengerCount: data.passenger_count || 1,
          tripDestination: data.trip_destination || '',
          passengerNames: [], // passenger_names column doesn't exist in DB
          password: data.password || null,
          status: data.status || 'not confirmed',
        };

        setTripData(tripData);
        setDriverNotes(data.trip_notes || '');
        setEditedDriverNotes(data.trip_notes || '');
        setLeadPassengerName(data.lead_passenger_name || '');
        setVehicleInfo(data.vehicle || '');
        setPassengerCount(data.passenger_count || 1);
        setTripDestination(data.trip_destination || '');
        setPassengerNames([]); // passenger_names column doesn't exist in DB, set empty array
        setCurrentVersion(data.version || 1); // Load current version
        setTripStatus(data.status || 'not confirmed'); // Load trip status
        setDriverEmail(data.driver || null); // Load driver email
        
        // Check if password protection is enabled
        const hasPassword = !!data.password;
        setIsPasswordProtected(hasPassword);
        
        // Populate location display names from database
        const displayNames: {[key: string]: string} = {};
        tripData.locations.forEach((loc: any) => {
          // Use the location name (which is now the purpose) as the display name
          if (loc.name) {
            displayNames[loc.id] = loc.name;
          }
        });
        setLocationDisplayNames(displayNames);
        
        // Determine if password gate should be shown
        // Use local userIsOwner variable to make decision before state updates
        const shouldShowPasswordGate = hasPassword && !userIsOwner;
        
        if (shouldShowPasswordGate) {
          setIsPasswordVerified(false);
          setShowPasswordGate(true);
          console.log('🔒 Report is password protected - password required');
        } else {
          setIsPasswordVerified(true);
          setShowPasswordGate(false);
          console.log('🔓 Report access granted');
        }
        
        // Mark ownership as checked and loading complete - MUST be last to prevent UI glitches
        setOwnershipChecked(true);
        setLoading(false);
      } catch (err) {
        console.error('❌ Unexpected error:', err);
        setError('Failed to load trip');
        setLoading(false);
      }
    }
    
    loadTripFromDatabase();
  }, [tripId, router, user, isAuthenticated]);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Cleanup live trip interval on unmount
  useEffect(() => {
    return () => {
      if (liveTripInterval) {
        clearInterval(liveTripInterval);
      }
    };
  }, [liveTripInterval]);

  const handleGuestSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuestSignupError(null);
    
    // Validation
    if (!guestSignupPassword || guestSignupPassword.length < 6) {
      setGuestSignupError('Password must be at least 6 characters');
      return;
    }
    
    if (!tripData?.userEmail) {
      setGuestSignupError('Email not found. Please try again.');
      return;
    }
    
    setGuestSignupLoading(true);
    
    try {
      // Create auth user with email and password
      const { error: signUpError } = await signUp(tripData.userEmail, guestSignupPassword);
      
      if (signUpError) {
        // Handle specific errors
        if (signUpError.message.toLowerCase().includes('already registered') || 
            signUpError.message.toLowerCase().includes('already exists')) {
          setGuestSignupError(`This email already has an account. Please login instead.`);
        } else {
          setGuestSignupError(signUpError.message);
        }
        setGuestSignupLoading(false);
        return;
      }
      
      // Wait a moment for auth state to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get the session to get user ID
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.id) {
        // Update ALL trips with this email to link to new user
        const { error: updateError } = await supabase
          .from('trips')
          .update({ user_id: session.user.id })
          .eq('user_email', tripData.userEmail)
          .is('user_id', null);
        
        if (updateError) {
          console.error('Error linking trips to user:', updateError);
        } else {
          console.log('✅ All guest trips linked to new account');
        }
        
        // Clear sessionStorage
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('guestCreatedTripId');
        }
        
        // Show success and refresh page
        setGuestSignupSuccess(true);
        setGuestSignupError(null);
        
        // Refresh the page after 2 seconds to show owner UI
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setGuestSignupError('Something went wrong. Please try logging in.');
      }
    } catch (err) {
      console.error('Unexpected signup error:', err);
      setGuestSignupError('An unexpected error occurred. Please try again.');
    } finally {
      setGuestSignupLoading(false);
    }
  };

  const handlePlanNewTrip = () => {
    // Redirect to home for new trip
    router.push('/');
  };

  // State transition validation
  const isValidTransition = (from: string, to: string): boolean => {
    const VALID_TRANSITIONS: Record<string, string[]> = {
      'not confirmed': ['pending', 'confirmed'],
      'pending': ['confirmed', 'rejected', 'cancelled'], // Can cancel to cancelled
      'confirmed': ['cancelled'], // Can cancel to cancelled
      'rejected': ['pending', 'not confirmed'], // Can retry after rejection
      'cancelled': [], // TERMINAL STATUS - no transitions allowed, must create new trip
    };
    
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  };

  const handleStatusToggle = () => {
    if (!tripId || updatingStatus) return;
    
    // Check if user is the assigned driver (not owner)
    const isAssignedDriver = !isOwner && driverEmail && quoteEmail && 
      driverEmail.toLowerCase().trim() === quoteEmail.toLowerCase().trim();
    
    // DRIVER FLOW: Assigned driver clicking to confirm pending trip
    if (isAssignedDriver && tripStatus === 'pending') {
      console.log('🚗 [DRIVER] Assigned driver clicked confirmation button, opening confirmation dialog');
      setShowDriverConfirmDialog(true);
      return;
    }
    
    // OWNER FLOW: Block non-owners who aren't the assigned driver
    if (!isOwner) return;
    
    // If trip is rejected, allow user to request quotes or assign driver again
    // Rejected behaves like "not confirmed" - service is not secured
    if (tripStatus === 'rejected') {
      console.log('🔄 Trip was rejected, opening driver modal for new assignment');
      setAssignOnlyMode(true);
      setShowDriverModal(true);
      return;
    }
    
    const newStatus = tripStatus === 'confirmed' ? 'not confirmed' : 'confirmed';
    
    // If confirming without a driver, open driver modal in assign-only mode
    if (newStatus === 'confirmed' && !driverEmail) {
      console.log('🚗 [STATUS] No driver assigned, opening driver modal in assign-only mode');
      setAssignOnlyMode(true);
      setShowDriverModal(true);
      return;
    }
    
    // Otherwise, show confirmation modal
    setPendingStatus(newStatus);
    setStatusModalSuccess(null);
    setResendingConfirmation(false);
    setCancellingTrip(false);
    setShowStatusModal(true);
  };

  const handleConfirmStatusChange = async (notifyDriver: boolean = false) => {
    if (!tripId || !isOwner || !pendingStatus) return;
    
    setUpdatingStatus(true);

    try {
      // If changing from confirmed to not confirmed AND notifying driver, send notification FIRST
      if (tripStatus === 'confirmed' && pendingStatus === 'not confirmed' && notifyDriver && driverEmail) {
        console.log('📧 Sending notification before clearing driver...');
        await sendStatusChangeNotification();
      }

      // Now update the status (this will clear the driver if going from confirmed to not confirmed)
      const response = await fetch('/api/update-trip-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: tripId,
          status: pendingStatus,
        }),
      });

      const result = await safeJsonParse(response);

      if (result.success) {
        const oldStatus = tripStatus;
        setTripStatus(pendingStatus);
        console.log(`✅ Trip status updated to: ${pendingStatus}`);
        
        // If changing from confirmed to not confirmed, clear driver in UI
        if (oldStatus === 'confirmed' && pendingStatus === 'not confirmed') {
          setDriverEmail(null);
          console.log(`✅ Driver assignment cleared in UI`);
        }
        
        // Send notification for other cases (confirmed -> confirmed, not confirmed -> confirmed)
        if (notifyDriver && driverEmail && !(oldStatus === 'confirmed' && pendingStatus === 'not confirmed')) {
          await sendStatusChangeNotification();
        }
        
        // Close modal
        setShowStatusModal(false);
        setPendingStatus(null);
      } else {
        console.error('❌ Failed to update status:', result.error);
      }
    } catch (err) {
      console.error('❌ Error updating trip status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const sendStatusChangeNotification = async () => {
    if (!tripId || !driverEmail || !pendingStatus) return;
    
    setSendingStatusNotification(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('❌ No session found');
        return;
      }

      const response = await fetch('/api/notify-status-change', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tripId: tripId,
          newStatus: pendingStatus,
        }),
      });

      const result = await safeJsonParse(response);

      if (result.success) {
        console.log(`✅ Status change notification sent to driver`);
      } else {
        console.error('❌ Failed to send status notification:', result.error);
      }
    } catch (err) {
      console.error('❌ Error sending status notification:', err);
    } finally {
      setSendingStatusNotification(false);
    }
  };

  const fetchQuotes = useCallback(async () => {
    if (!tripId || !isOwner) return;
    
    setLoadingQuotes(true);
    try {
      const response = await fetch('/api/get-quotes', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tripId: tripId,
        }),
      });

      // Handle non-JSON responses
      if (!response.ok) {
        console.error('❌ Failed to fetch quotes:', response.statusText);
        return;
      }

      const result = await response.json();

      if (result.success) {
        setQuotes(result.quotes || []);
        console.log(`✅ Fetched ${result.quotes?.length || 0} quotes`);
      } else {
        console.error('❌ Failed to fetch quotes:', result.error);
      }
    } catch (err) {
      console.error('❌ Error fetching quotes:', err);
    } finally {
      setLoadingQuotes(false);
    }
  }, [tripId, isOwner]);

  // Fetch quotes when page loads (for owners only)
  useEffect(() => {
    if (isOwner && tripId && !loading) {
      fetchQuotes();
    }
  }, [isOwner, tripId, loading, fetchQuotes]);

  // Fetch driver's own quotes (for non-owners)
  const fetchMyQuotes = useCallback(async (email: string) => {
    if (!tripId || !email) return;
    
    setLoadingMyQuotes(true);
    try {
      const response = await fetch('/api/get-quotes', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tripId: tripId,
          driverEmail: email.trim(), // Filter by driver's email only
        }),
      });

      const result = await safeJsonParse(response);

      if (result.success) {
        setMyQuotes(result.quotes || []);
        console.log(`✅ Fetched ${result.quotes?.length || 0} of my quotes`);
      } else {
        console.error('❌ Failed to fetch my quotes:', result.error);
      }
    } catch (err) {
      console.error('❌ Error fetching my quotes:', err);
    } finally {
      setLoadingMyQuotes(false);
    }
  }, [tripId]);

  // Fetch driver's quotes when page loads (for non-owners with email)
  useEffect(() => {
    if (!isOwner && tripId && !loading) {
      // Use validatedDriverEmail (from magic link) or quoteEmail (from form)
      const emailToFetch = validatedDriverEmail || quoteEmail;
      if (emailToFetch) {
        fetchMyQuotes(emailToFetch);
      }
    }
  }, [isOwner, tripId, loading, quoteEmail, validatedDriverEmail, fetchMyQuotes]);

  // Subscribe to quote updates (for real-time updates when driver submits quote)
  useEffect(() => {
    if (!tripId || !isOwner) return;

    console.log('🔄 Setting up realtime subscription for quote updates');

    const quotesChannel = supabase
      .channel(`quotes-${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'quotes',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          console.log('🔄 Realtime quote update received:', payload);
          // Refresh quotes when any change occurs
          fetchQuotes();
        }
      )
      .subscribe();

    return () => {
      console.log('🔄 Cleaning up quotes subscription');
      supabase.removeChannel(quotesChannel);
    };
  }, [tripId, isOwner, fetchQuotes]);

  // Subscribe to trip status changes (for real-time updates)
  useEffect(() => {
    if (!tripId || !isOwner) return;

    console.log('🔄 Setting up realtime subscription for trip status updates');

    const channel = supabase
      .channel(`trip-status-${tripId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trips',
          filter: `id=eq.${tripId}`,
        },
        (payload) => {
          console.log('🔄 Realtime trip update received');
          console.log('📊 Current UI state - Status:', tripStatus, 'Has driver:', !!driverEmail);
          
          if (payload.new) {
            const newStatus = payload.new.status;
            const newDriver = payload.new.driver;
            
            console.log('📊 Database update - New status:', newStatus, 'New driver:', newDriver);
            
            // Update status if changed
            if (newStatus && newStatus !== tripStatus) {
              console.log(`✅ Trip status updated via realtime: ${tripStatus} → ${newStatus}`);
              setTripStatus(newStatus);
              
              // Special case: Auto-confirmation from driver quote submission
              if (tripStatus === 'pending' && newStatus === 'confirmed') {
                console.log('🎯 Detected Pending → Confirmed transition (likely from driver quote submission)');
              }
            }
            
            // Update driver if changed
            if (newDriver !== undefined && newDriver !== driverEmail) {
              console.log(`✅ Driver updated via realtime: ${driverEmail ? 'assigned' : 'unassigned'} → ${newDriver ? 'assigned' : 'unassigned'}`);
              setDriverEmail(newDriver);
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔄 Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [tripId, isOwner]);

  // Fetch driver suggestions when page loads (for owners only)
  useEffect(() => {
    async function fetchDriverSuggestions() {
      if (!isOwner || !user?.id) return;
      
      try {
        const response = await fetch('/api/get-user-drivers', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
          }),
        });

        // Handle non-JSON responses
        if (!response.ok) {
          console.error('❌ Failed to fetch driver suggestions:', response.statusText);
          return;
        }

        const result = await response.json();

        if (result.success) {
          setDriverSuggestions(result.drivers || []);
          setFilteredDriverSuggestions(result.drivers || []);
          console.log(`✅ Loaded ${result.drivers?.length || 0} driver suggestions`);
        } else {
          console.error('❌ Failed to fetch driver suggestions:', result.error);
        }
      } catch (err) {
        console.error('❌ Error fetching driver suggestions:', err);
      }
    }

    if (isOwner && !loading && user?.id) {
      fetchDriverSuggestions();
    }
  }, [isOwner, loading, user?.id]);

  const handleSetDriver = async (email: string) => {
    if (!tripId || !isOwner || settingDriver) return;
    
    setSettingDriver(true);
    setManualDriverError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('❌ No session found');
        setManualDriverError('Please log in to set driver');
        setSettingDriver(false);
        return;
      }

      const response = await fetch('/api/set-driver', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tripId: tripId,
          driverEmail: email,
        }),
      });

      const result = await safeJsonParse(response);

      if (result.success) {
        setDriverEmail(email.toLowerCase());
        console.log(`✅ Driver set successfully`);
        setManualDriverEmail('');
        setShowDriverSuggestions(false);
        
        // If in assign-only mode, close modal (don't auto-confirm, let user manually confirm)
        if (assignOnlyMode) {
          console.log('🚗 [ASSIGN-ONLY] Driver assigned, closing modal. Trip status is now Pending.');
          setShowDriverModal(false);
          setAssignOnlyMode(false);
          // User can now click the "Pending" button to manually confirm
        }
      } else {
        setManualDriverError(result.error || 'Failed to set driver');
      }
    } catch (err) {
      console.error('❌ Error setting driver:', err);
      setManualDriverError('An error occurred while setting driver');
    } finally {
      setSettingDriver(false);
    }
  };

  const handleManualDriverInputChange = (value: string) => {
    setManualDriverEmail(value);
    setManualDriverError(null);
    
    // Filter suggestions based on input
    if (value.trim().length > 0) {
      const filtered = driverSuggestions.filter(driver =>
        driver.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredDriverSuggestions(filtered);
    } else {
      setFilteredDriverSuggestions(driverSuggestions);
    }
  };

  const handleManualDriverInputFocus = () => {
    setShowDriverSuggestions(true);
    if (manualDriverEmail.trim().length === 0) {
      setFilteredDriverSuggestions(driverSuggestions);
    }
  };

  const handleSelectDriverSuggestion = (driver: string) => {
    setManualDriverEmail(driver);
    setShowDriverSuggestions(false);
  };

  const handleNotifyDriver = async () => {
    if (!tripId || !isOwner || !driverEmail || notifyingDriver) return;
    
    setNotifyingDriver(true);
    setNotificationError(null);
    setNotificationSuccess(false);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('❌ No session found');
        setNotificationError('Please log in to notify driver');
        setNotifyingDriver(false);
        return;
      }

      const response = await fetch('/api/notify-driver', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tripId: tripId,
        }),
      });

      const result = await safeJsonParse(response);

      if (result.success) {
        setNotificationSuccess(true);
        console.log(`✅ Driver notified successfully`);
        // Hide success message after 5 seconds
        setTimeout(() => setNotificationSuccess(false), 5000);
      } else {
        setNotificationError(result.error || 'Failed to notify driver');
      }
    } catch (err) {
      console.error('❌ Error notifying driver:', err);
      setNotificationError('An error occurred while notifying driver');
    } finally {
      setNotifyingDriver(false);
    }
  };

  const handleUpdateNotificationResponse = async (notify: boolean) => {
    if (notify && driverEmail) {
      setSendingUpdateNotification(true);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.error('❌ No session found');
          window.location.reload();
          return;
        }

        const response = await fetch('/api/notify-driver', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            tripId: tripId,
          }),
        });

        const result = await response.json();

        if (result.success) {
          console.log(`✅ Driver notified about trip update`);
        } else {
          console.error('❌ Failed to notify driver:', result.error);
        }
      } catch (err) {
        console.error('❌ Error notifying driver:', err);
      } finally {
        setSendingUpdateNotification(false);
        // Always reload after attempting notification
        window.location.reload();
      }
    } else {
      // User chose not to notify, just reload
      window.location.reload();
    }
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset errors and success
    setQuoteEmailError(null);
    setQuotePriceError(null);
    setQuoteSuccess(false);

    // Basic email format validation (accept personal emails like Gmail)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(quoteEmail.trim())) {
      setQuoteEmailError('Please enter a valid email address');
      return;
    }

    // Validate price
    const priceNum = parseFloat(quotePrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setQuotePriceError('Please enter a valid price greater than 0');
      return;
    }

    setSubmittingQuote(true);

    try {
      const response = await fetch('/api/submit-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: tripId,
          email: quoteEmail.trim(),
          price: priceNum,
          currency: quoteCurrency,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const action = result.isUpdate ? 'updated' : 'submitted';
        console.log(`✅ Quote ${action} successfully`);
        const submittedEmail = quoteEmail.trim();
        setQuoteSuccessMessage(
          result.isUpdate 
            ? 'Quote updated successfully! The trip owner will see your updated offer.'
            : 'Quote submitted successfully! The trip owner will review your offer.'
        );
        setQuoteSuccess(true);
        
        // Fetch the driver's quotes to show their submission
        fetchMyQuotes(submittedEmail);
        
        // Clear form fields but keep email for future quotes
        setQuotePrice('');
        setQuoteCurrency('USD');
        
        // Hide success message after 5 seconds
        setTimeout(() => setQuoteSuccess(false), 5000);
      } else {
        setQuoteEmailError(result.error || 'Failed to submit quote');
      }
    } catch (err) {
      console.error('❌ Error submitting quote:', err);
      setQuoteEmailError('Failed to submit quote. Please try again.');
    } finally {
      setSubmittingQuote(false);
    }
  };

  const handleSendQuoteRequest = async (emailToUse?: string) => {
    const driverEmail = emailToUse || allocateDriverEmail;
    if (!tripId || !isOwner || !driverEmail || sendingQuoteRequest) return;
    
    // Reset errors and success
    setAllocateDriverEmailError(null);
    setManualDriverError(null);
    setQuoteRequestError(null);
    setQuoteRequestSuccess(null);

    // Basic email format validation (accept personal emails like Gmail)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(driverEmail.trim())) {
      setManualDriverError('Please enter a valid email address');
      return;
    }

    // Check if already sent to this email
    const normalizedEmail = driverEmail.trim().toLowerCase();
    if (sentDriverEmails.some(sent => sent.email.toLowerCase() === normalizedEmail)) {
      setManualDriverError('Quote request already sent to this email');
      return;
    }

    setSendingQuoteRequest(true);

    try {
      // Get the current session to send auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setQuoteRequestError('You must be logged in to send quote requests');
        setSendingQuoteRequest(false);
        return;
      }

      const response = await fetch('/api/request-quote', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tripId: tripId,
          driverEmail: driverEmail.trim(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Add to sent emails list
        setSentDriverEmails([
          ...sentDriverEmails,
          {
            email: driverEmail.trim(),
            sentAt: new Date().toISOString(),
          }
        ]);
        
        setQuoteRequestSuccess(`Quote request sent to ${driverEmail.trim()}`);
        // Clear form
        setManualDriverEmail('');
        setAllocateDriverEmail('');
        // Hide success message after 5 seconds
        setTimeout(() => setQuoteRequestSuccess(null), 5000);
      } else {
        setQuoteRequestError(result.error || 'Failed to send quote request');
      }
    } catch (err) {
      console.error('❌ Error sending quote request:', err);
      setQuoteRequestError('Failed to send quote request. Please try again.');
    } finally {
      setSendingQuoteRequest(false);
    }
  };

  const handleModifyTrip = () => {
    // For now, just redirect to home
    // Future: could pre-fill form with current trip data
    router.push('/');
  };

  // Handler for driver to confirm a pending trip
  const handleDriverConfirmTrip = async () => {
    if (!tripId || confirmingTrip) return;

    // Block action if token was already used or trip not pending
    if (driverToken && !canTakeAction) {
      alert('This trip has already been responded to or is no longer available.');
      return;
    }

    // Use validated email from token if available, otherwise use quote email
    const emailToUse = validatedDriverEmail || quoteEmail;
    if (!emailToUse) return;

    setConfirmingTrip(true);

    try {
      console.log('🔄 Driver confirming trip:', tripId, '- Token auth:', !!driverToken);

      const response = await fetch('/api/driver-confirm-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          driverEmail: emailToUse,
          token: driverToken, // Include token if present (magic link flow)
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Trip confirmed by driver');
        setShowDriverConfirmDialog(false);
        // Update local state immediately
        setTripStatus('confirmed');
        // Show success message
        setQuoteSuccess(true);
        setQuoteSuccessMessage('✅ Trip confirmed! The trip owner has been notified.');
      } else {
        console.error('❌ Failed to confirm trip:', result.error);
        alert(result.error || 'Failed to confirm trip');
      }
    } catch (err) {
      console.error('❌ Error confirming trip:', err);
      alert('Failed to confirm trip. Please try again.');
    } finally {
      setConfirmingTrip(false);
    }
  };

  // Handler for driver to reject a pending trip
  const handleDriverRejectTrip = async () => {
    if (!tripId || !driverToken || rejectingTrip) return;

    // Block action if token was already used or trip not pending
    if (!canTakeAction) {
      alert('This trip has already been responded to or is no longer available.');
      return;
    }

    setRejectingTrip(true);

    try {
      console.log('🔄 Driver rejecting trip:', { tripId });

      const response = await fetch('/api/driver-reject-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          token: driverToken,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Trip rejected by driver');
        setShowDriverRejectDialog(false); // Close dialog
        // Update local state immediately
        setTripStatus('rejected');
        setDriverEmail(null); // Clear driver assignment
        // Show success message
        setQuoteSuccess(true);
        setQuoteSuccessMessage('Trip declined. The trip owner has been notified.');
        setIsDriverView(false); // Hide driver actions
      } else {
        console.error('❌ Failed to reject trip:', result.error);
        alert(result.error || 'Failed to reject trip');
      }
    } catch (err) {
      console.error('❌ Error rejecting trip:', err);
      alert('Failed to reject trip. Please try again.');
    } finally {
      setRejectingTrip(false);
    }
  };

  const getSafetyColor = (score: number) => {
    if (score >= 80) return 'text-[#3ea34b]';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 40) return 'text-[#db7304]';
    return 'text-[#9e201b]';
  };

  // Helper function to parse notes into bullet points
  const parseNotesToBullets = (notes: string | null): string[] => {
    if (!notes) return [];
    return notes
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && (line.startsWith('-') || line.startsWith('•') || line.match(/^\d+\./)))
      .map(line => line.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, '').trim());
  };

  // Helper function to merge and deduplicate notes
  const mergeNotes = (existingNotes: string, newNotes: string): string => {
    const existingBullets = parseNotesToBullets(existingNotes);
    const newBullets = parseNotesToBullets(newNotes);
    
    // Simple deduplication: check if a bullet point is similar to an existing one
    const isSimilar = (bullet1: string, bullet2: string): boolean => {
      const normalize = (str: string) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
      const norm1 = normalize(bullet1);
      const norm2 = normalize(bullet2);
      
      // Exact match or one contains the other (for fuzzy matching)
      if (norm1 === norm2) return true;
      if (norm1.length > 20 && norm2.length > 20) {
        const words1 = norm1.split(/\s+/);
        const words2 = norm2.split(/\s+/);
        const commonWords = words1.filter(w => words2.includes(w));
        const similarity = commonWords.length / Math.max(words1.length, words2.length);
        return similarity > 0.7; // 70% similarity threshold
      }
      return false;
    };

    // Keep existing notes first
    const merged: string[] = [...existingBullets];
    
    // Add new notes that aren't similar to existing ones
    for (const newBullet of newBullets) {
      const isDuplicate = merged.some(existing => isSimilar(existing, newBullet));
      if (!isDuplicate) {
        merged.push(newBullet);
      }
    }

    // Format as bullet points
    return merged.map(bullet => `- ${bullet}`).join('\n');
  };

  // Compare extracted updates with current state
  const compareTripData = (extracted: any, current: TripData) => {
    const diff: any = {
      tripDateChanged: false,
      locations: [] as any[],
      passengerInfoChanged: false,
      vehicleInfoChanged: false,
      notesChanged: false,
      mergedNotes: '',
    };

    // Compare trip date
    if (extracted.date && extracted.date !== current.tripDate) {
      diff.tripDateChanged = true;
    }

    // Compare locations by index
    const extractedLocations = extracted.locations || [];
    const currentLocations = current.locations || [];
    const maxLength = Math.max(extractedLocations.length, currentLocations.length);

    for (let i = 0; i < maxLength; i++) {
      const extractedLoc = extractedLocations[i];
      const currentLoc = currentLocations[i];

      if (!extractedLoc && currentLoc) {
        // Location removed
        diff.locations.push({
          type: 'removed',
          index: i,
          oldAddress: currentLoc.name || '',
          oldTime: currentLoc.time || '',
          oldPurpose: currentLoc.name || '',
        });
      } else if (extractedLoc && !currentLoc) {
        // Location added
        diff.locations.push({
          type: 'added',
          index: i,
          newAddress: extractedLoc.formattedAddress || extractedLoc.location || '',
          newTime: extractedLoc.time || '',
          newPurpose: extractedLoc.purpose || '',
        });
      } else if (extractedLoc && currentLoc) {
        // Check for modifications
        const addressChanged = (extractedLoc.formattedAddress || extractedLoc.location || '') !== (currentLoc.name || '');
        const timeChanged = (extractedLoc.time || '') !== (currentLoc.time || '');
        const purposeChanged = (extractedLoc.purpose || '') !== (currentLoc.name || '');

        if (addressChanged || timeChanged || purposeChanged) {
          diff.locations.push({
            type: 'modified',
            index: i,
            addressChanged,
            timeChanged,
            purposeChanged,
            oldAddress: currentLoc.name || '',
            oldTime: currentLoc.time || '',
            oldPurpose: currentLoc.name || '',
            newAddress: extractedLoc.formattedAddress || extractedLoc.location || '',
            newTime: extractedLoc.time || '',
            newPurpose: extractedLoc.purpose || '',
          });
        }
      }
    }

    // Compare passenger info
    const extractedPassengerName = extracted.leadPassengerName || extracted.passengerNames?.join(', ') || '';
    if (extractedPassengerName && extractedPassengerName !== leadPassengerName) {
      diff.passengerInfoChanged = true;
    }

    // Compare vehicle info
    if (extracted.vehicleInfo && extracted.vehicleInfo !== vehicleInfo) {
      diff.vehicleInfoChanged = true;
    }

    // Merge notes
    const newNotes = extracted.driverNotes || '';
    if (newNotes && newNotes.trim()) {
      diff.notesChanged = true;
      diff.mergedNotes = mergeNotes(driverNotes, newNotes);
    }

    return diff;
  };

  // Merge trip updates
  const mergeTripUpdates = (extracted: any, current: TripData) => {
    const mergedLocations: any[] = [];
    const extractedLocations = extracted.locations || [];
    const currentLocations = current.locations || [];
    const maxLength = Math.max(extractedLocations.length, currentLocations.length);

    // Merge locations by index
    for (let i = 0; i < maxLength; i++) {
      const extractedLoc = extractedLocations[i];
      const currentLoc = currentLocations[i];

      if (extractedLoc) {
        // Use extracted location, but preserve existing coordinates if address matches
        const newLoc: any = {
          id: currentLoc?.id || (i + 1).toString(),
          name: extractedLoc.purpose || extractedLoc.location || '',
          time: extractedLoc.time || '',
          lat: extractedLoc.lat || currentLoc?.lat || 0,
          lng: extractedLoc.lng || currentLoc?.lng || 0,
          fullAddress: extractedLoc.formattedAddress || extractedLoc.location || '',
          purpose: extractedLoc.purpose || '',
        };

        // If address seems the same, preserve coordinates
        if (currentLoc && (
          (extractedLoc.formattedAddress || extractedLoc.location || '').toLowerCase() === 
          (currentLoc.name || '').toLowerCase()
        )) {
          newLoc.lat = currentLoc.lat;
          newLoc.lng = currentLoc.lng;
        }

        mergedLocations.push(newLoc);
      }
      // If no extracted location at this index, skip it (removed)
    }

    // Merge notes
    const newNotes = extracted.driverNotes || '';
    const mergedNotes = newNotes && newNotes.trim() ? mergeNotes(driverNotes, newNotes) : driverNotes;

    // Merge passenger info
    const mergedPassengerName = extracted.leadPassengerName || 
      (extracted.passengerNames?.length > 0 ? extracted.passengerNames.join(', ') : leadPassengerName);

    return {
      locations: mergedLocations,
      tripDate: extracted.date || current.tripDate,
      passengerName: mergedPassengerName,
      vehicleInfo: extracted.vehicleInfo || vehicleInfo,
      passengerCount: extracted.passengerCount || passengerCount,
      tripDestination: extracted.tripDestination || tripDestination,
      notes: mergedNotes,
      passengerNames: extracted.passengerNames || [],
    };
  };

  // Helper: Strip email metadata to prevent false positives
  const stripEmailMetadata = (text: string): string => {
    console.log('🧹 [PRE-PROCESSING] Stripping email headers...');
    
    // Remove standalone email headers ONLY (headers on their own line or with just email/date after colon)
    // Match patterns like "From: email@domain.com\n" or "Subject: Some Subject\n"
    // But DON'T match "Date: 12 nov 2025 hey there..." (has content after date)
    let cleaned = text
      // Remove "From: email@domain.com"
      .replace(/^From:\s*[^\n]+@[^\n]+$/gim, '')
      // Remove "To: email@domain.com"  
      .replace(/^To:\s*[^\n]+@[^\n]+$/gim, '')
      // Remove "Subject: ..." on its own line
      .replace(/^Subject:\s*[^\n]+$/gim, '')
      // Remove "Date: DD MMM YYYY HH:MM" ONLY if it's at start and followed by newline or just whitespace
      .replace(/^Date:\s*\d{1,2}\s+[a-z]{3}\s+\d{4}\s+\d{2}:\d{2}\s*$/gim, '')
      .replace(/^Cc:\s*[^\n]+$/gim, '')
      .replace(/^Bcc:\s*[^\n]+$/gim, '')
      .replace(/^\s*[\r\n]+/gm, '') // Remove empty lines
      .trim();
    
    // If Date: is inline with content, just remove the date portion
    // "Date: 12 nov 2025 08:11  hey again..." → "  hey again..."
    cleaned = cleaned.replace(/^Date:\s*\d{1,2}\s+[a-z]{3}\s+\d{4}\s+\d{2}:\d{2}\s+/gim, '');
    
    // Remove command markers (EXTRAER VIAJE, EXTRACT TRIP, etc.)
    cleaned = cleaned.replace(/\s+EXTRAER\s+VIAJE\s*$/i, '');
    cleaned = cleaned.replace(/\s+EXTRACT\s+TRIP\s*$/i, '');
    
    const removedChars = text.length - cleaned.length;
    if (removedChars > 0) {
      console.log(`✅ [PRE-PROCESSING] Removed ${removedChars} characters of email metadata`);
    }
    
    return cleaned.trim();
  };

  // Helper: Detect unchanged fields from "same" language
  const detectUnchangedFields = (updateText: string): Set<string> => {
    const text = updateText.toLowerCase();
    const unchangedFields = new Set<string>();
    
    // Detect "same" language indicating most fields unchanged
    const hasSameLanguage = text.includes('rest same') || text.includes('same same') || 
                           text.includes('everything else same') || text.includes('rest unchanged');
    
    if (hasSameLanguage) {
      console.log('🔍 [POST-PROCESSING] Detected "same" language - will validate extracted fields');
      
      // If update doesn't explicitly mention these fields, they should be unchanged
      if (!text.includes('vehicle') && !text.includes('car') && !text.includes('mercedes') && 
          !text.includes('bmw') && !text.includes('audi')) {
        unchangedFields.add('vehicle');
      }
      if (!text.includes('passenger') && !text.match(/mr\.|ms\.|mrs\.|dr\./)) {
        unchangedFields.add('passengers');
      }
      if (!text.match(/\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) && 
          !text.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s*\d{1,2}/i)) {
        unchangedFields.add('date');
      }
    }
    
    return unchangedFields;
  };

  // Extract updates handler
  const handleExtractUpdates = async () => {
    // Security check: Only owners can extract updates
    if (!isOwner) {
      console.error('❌ Unauthorized: Only trip owners can extract updates');
      setError('Only trip owners can update trip information');
      return;
    }

    if (!updateText.trim()) return;

    setIsExtracting(true);
    setError(null);
    setUpdateProgress({ step: '', error: null, canRetry: false });

    try {
      // PRE-PROCESSING: Strip email headers to prevent false positives
      const cleanedText = stripEmailMetadata(updateText);
      
      // Step 1: Extract updates from text
      setUpdateProgress({ step: 'Extracting trip data', error: null, canRetry: false });
      console.log('🔄 Step 1: Extracting updates from text...');
      
      const extractResponse = await fetch('/api/extract-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: cleanedText,  // Use cleaned text without email headers
          tripDestination: tripDestination || undefined // Pass current trip destination for proper geocoding
        }),
      });

      const extractedData = await extractResponse.json();

      if (!extractedData.success) {
        const errorMsg = extractedData.error || 'Could not understand the update text';
        console.error('❌ Extraction failed:', errorMsg);
        setError(errorMsg); // Keep old error state as fallback
        setUpdateProgress({
          step: 'Extraction',
          error: 'Could not understand the update. Try rephrasing or breaking it into smaller pieces. For example: "Change pickup time to 3pm" or "Add stop at The Ritz Hotel"',
          canRetry: true,
        });
        return;
      }

      // POST-PROCESSING: Log removal operations if detected
      if (extractedData.removedLocations && extractedData.removedLocations.length > 0) {
        console.log(`🗑️ [REMOVAL] Detected ${extractedData.removedLocations.length} location(s) to remove:`, extractedData.removedLocations);
      }
      
      // POST-PROCESSING: Log insertion operations if detected
      if (extractedData.locations && extractedData.locations.length > 0) {
        extractedData.locations.forEach((loc: any, idx: number) => {
          if (loc.insertAfter) {
            console.log(`📌 [INSERT] Location "${loc.location}" should be inserted AFTER "${loc.insertAfter}"`);
          } else if (loc.insertBefore) {
            console.log(`📌 [INSERT] Location "${loc.location}" should be inserted BEFORE "${loc.insertBefore}"`);
          }
        });
      }
      
      // POST-PROCESSING: Validate and override fields based on "same" language
      const unchangedFields = detectUnchangedFields(updateText);
      
      if (unchangedFields.size > 0) {
        console.log(`🔧 [POST-PROCESSING] Found ${unchangedFields.size} field(s) that should be unchanged:`, Array.from(unchangedFields));
        
        if (unchangedFields.has('vehicle') && extractedData.vehicleInfo) {
          console.log(`   → Ignoring extracted vehicle: "${extractedData.vehicleInfo}"`);
          extractedData.vehicleInfo = null;
        }
        if (unchangedFields.has('passengers') && extractedData.leadPassengerName) {
          console.log(`   → Ignoring extracted passenger data`);
          extractedData.leadPassengerName = null;
          extractedData.passengerNames = [];
        }
        if (unchangedFields.has('date') && extractedData.date) {
          console.log(`   → Ignoring extracted date: "${extractedData.date}"`);
          extractedData.date = null;
        }
      }
      
      // POST-PROCESSING: Validate date makes sense (not email send date)
      if (extractedData.date && tripData) {
        const extractedDate = new Date(extractedData.date);
        const currentTripDate = new Date(tripData.tripDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // If extracted date is before current trip date, likely email metadata
        if (extractedDate < currentTripDate) {
          console.warn(`⚠️ [VALIDATION] Extracted date ${extractedData.date} is BEFORE trip date ${tripData.tripDate}`);
          console.warn(`   This is likely email send date (metadata), not a trip date change. Ignoring.`);
          extractedData.date = null;
        }
        
        // If extracted date matches today, might be email send date
        const extractedDateOnly = extractedData.date;
        const todayStr = today.toISOString().split('T')[0];
        if (extractedDateOnly === todayStr && !updateText.toLowerCase().includes('today')) {
          console.warn(`⚠️ [VALIDATION] Extracted date matches today but update doesn't say "today". Likely email metadata. Ignoring.`);
          extractedData.date = null;
        }
      }

      console.log('✅ Step 1 complete: Extracted data successfully');
      setExtractedUpdates(extractedData);
      
      // Step 2: Intelligently compare with current state using AI
      if (tripData) {
        setUpdateProgress({ step: 'Comparing with current trip', error: null, canRetry: false });
        console.log('🔄 [UPDATE] Step 2: Comparing updates...');
        console.log('📍 [UPDATE] Current:', tripData.locations.length, 'locations');
        console.log('📍 [UPDATE] Extracted:', extractedData.locations?.length || 0, 'locations');
        
        const compareResponse = await fetch('/api/compare-trip-updates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            extractedData,
            currentTripData: {
              tripDate: tripData.tripDate,
              leadPassengerName: leadPassengerName,
              vehicle: vehicleInfo,
              passengerCount: passengerCount,
              tripDestination: tripDestination,
              tripNotes: driverNotes,
              locations: tripData.locations.map((loc: any, idx: number) => ({
                id: loc.id,
                name: loc.name,
                address: loc.fullAddress || loc.name, // FIX: Send actual address, fallback to name
                fullAddress: loc.fullAddress || loc.name, // FIX: Include fullAddress field
                formattedAddress: loc.formattedAddress || loc.fullAddress || loc.name, // FIX: Include formattedAddress
                time: loc.time,
                purpose: loc.name, // Purpose is stored in name field
                lat: loc.lat,
                lng: loc.lng,
                role: idx === 0 ? 'pickup' : (idx === tripData.locations.length - 1 ? 'drop-off' : 'stop'), // Add role for AI to understand
              })),
            },
          }),
        });

        const compareResult = await compareResponse.json();

        if (!compareResult.success) {
          const errorMsg = compareResult.error || 'Failed to compare updates';
          console.error('❌ [UPDATE] Comparison failed:', errorMsg);
          setError(errorMsg); // Keep old error state as fallback
          setUpdateProgress({
            step: 'Comparison',
            error: 'Could not match updates with current trip. This usually happens when location names are ambiguous. Try being more specific (e.g., "Change pickup at Gatwick to 3pm" instead of "Change time to 3pm")',
            canRetry: true,
          });
          return;
        }

        console.log('✅ [UPDATE] Step 2: Comparison successful');
        console.log('📊 [UPDATE] Changes detected:', compareResult.comparison?.locations?.filter((l: any) => l.action !== 'unchanged').length || 0);
        
        // Transform AI comparison result to our diff format
        setUpdateProgress({ step: 'Preparing preview', error: null, canRetry: false });
        console.log('🔄 Step 3: Transforming comparison to preview format...');
        
        const diff = transformComparisonToDiff(compareResult.comparison, extractedData);
        setComparisonDiff(diff);
        setShowPreview(true);
        
        console.log('✅ All steps complete: Preview ready');
        setUpdateProgress({ step: '', error: null, canRetry: false }); // Clear progress on success
      }
    } catch (err) {
      console.error('❌ Unexpected error during update extraction:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage); // Keep old error state as fallback
      setUpdateProgress({
        step: updateProgress.step || 'Processing update',
        error: `Something went wrong during ${updateProgress.step || 'the update process'}. ${errorMessage}`,
        canRetry: true,
      });
    } finally {
      setIsExtracting(false);
    }
  };

  // Transform AI comparison result to our diff format for UI display
  const transformComparisonToDiff = (comparison: any, extractedData: any) => {
    const diff: any = {
      tripDateChanged: comparison.tripDateChanged || false,
      locations: [],
      passengerInfoChanged: comparison.passengerInfoChanged || false,
      vehicleInfoChanged: comparison.vehicleInfoChanged || false,
      passengerCountChanged: comparison.passengerCountChanged || false,
      tripDestinationChanged: comparison.tripDestinationChanged || false,
      notesChanged: comparison.notesChanged || false,
      mergedNotes: comparison.mergedNotes || '',
      finalLocations: [], // Store final merged locations for regeneration
    };

    // Transform location changes - first collect all, then sort by index for final locations
    const finalLocationsMap: { [key: number]: any } = {};
    
    // If comparison doesn't return locations or they're all unchanged, ensure all current locations are preserved
    if (!comparison.locations || !Array.isArray(comparison.locations) || comparison.locations.length === 0) {
      // No location changes - preserve all current locations as unchanged
      if (tripData?.locations && tripData.locations.length > 0) {
        tripData.locations.forEach((loc: any, idx: number) => {
          finalLocationsMap[idx] = {
            id: loc.id,
            name: loc.name,
            formattedAddress: loc.formattedAddress || loc.fullAddress || loc.name,
            address: loc.name,
            time: loc.time,
            purpose: loc.name,
            lat: loc.lat,
            lng: loc.lng,
            fullAddress: loc.fullAddress || loc.name,
          };
        });
      }
    } else if (comparison.locations && Array.isArray(comparison.locations)) {
      comparison.locations.forEach((locChange: any) => {
        // GUARD: Skip invalid location changes
        if (!locChange || typeof locChange !== 'object') {
          console.warn('⚠️ Skipping invalid location change (not an object):', locChange);
          return;
        }
        
        if (!locChange.action) {
          console.warn('⚠️ Skipping location change without action:', locChange);
          return;
        }
        
        if (locChange.action === 'removed') {
          diff.locations.push({
            type: 'removed',
            index: locChange.currentIndex,
            oldAddress: locChange.currentLocation?.address || locChange.currentLocation?.name || '',
            oldTime: locChange.currentLocation?.time || '',
            oldPurpose: locChange.currentLocation?.purpose || locChange.currentLocation?.name || '',
          });
        } else if (locChange.action === 'added') {
          // Check if this is an insertion (has insertPosition) or append
          const isInsertion = !!(locChange as any).insertPosition;
          const insertPos = (locChange as any).insertPosition;
          
          diff.locations.push({
            type: 'added',
            index: isInsertion ? insertPos?.referenceIndex : locChange.extractedIndex,
            newAddress: locChange.extractedLocation?.formattedAddress || locChange.extractedLocation?.location || '',
            newTime: locChange.extractedLocation?.time || '',
            newPurpose: locChange.extractedLocation?.purpose || '',
          });
          
          // Handle insertion vs append
          if (locChange.finalLocation) {
            const finalLoc = locChange.finalLocation;
            
            // GUARD: Validate finalLocation is a proper object with required fields
            if (!finalLoc || typeof finalLoc !== 'object') {
              console.error('❌ Invalid finalLocation for added action (not an object):', finalLoc);
              return; // Skip this location
            }
            
            // GUARD: Ensure lat/lng exist and are numbers (allow 0 for now, existing logic handles it)
            if (finalLoc.lat === undefined || finalLoc.lng === undefined) {
              console.error('❌ Invalid finalLocation for added action (missing lat/lng):', finalLoc);
              return; // Skip this location
            }
            
            // FIX: Validate and fix ID for added locations
            if (!finalLoc.id || finalLoc.id === 'currentLocation.id' || finalLoc.id === 'extractedLocation.id' || finalLoc.id.includes('Location.id')) {
              console.warn(`⚠️ [FIX] AI returned invalid ID for added location: "${finalLoc.id}", generating new one`);
              finalLoc.id = `location-added-${locChange.extractedIndex}-${Date.now()}`;
            }
            
            // Ensure finalLocation has valid coordinates
            if ((!finalLoc.lat || finalLoc.lat === 0) && locChange.extractedLocation?.lat && locChange.extractedLocation.lat !== 0) {
              finalLoc.lat = locChange.extractedLocation.lat;
            }
            if ((!finalLoc.lng || finalLoc.lng === 0) && locChange.extractedLocation?.lng && locChange.extractedLocation.lng !== 0) {
              finalLoc.lng = locChange.extractedLocation.lng;
            }
            // If still no coordinates, try to get from current location
            if ((!finalLoc.lat || finalLoc.lat === 0) && tripData?.locations[locChange.extractedIndex]?.lat) {
              finalLoc.lat = tripData.locations[locChange.extractedIndex].lat;
            }
            if ((!finalLoc.lng || finalLoc.lng === 0) && tripData?.locations[locChange.extractedIndex]?.lng) {
              finalLoc.lng = tripData.locations[locChange.extractedIndex].lng;
            }
            
            // CRITICAL FIX: Ensure fullAddress and formattedAddress are set from extractedLocation for proper display
            if (!finalLoc.fullAddress && locChange.extractedLocation) {
              finalLoc.fullAddress = locChange.extractedLocation.formattedAddress || 
                                     locChange.extractedLocation.location || 
                                     finalLoc.address || 
                                     finalLoc.name;
            }
            if (!finalLoc.formattedAddress && locChange.extractedLocation) {
              finalLoc.formattedAddress = locChange.extractedLocation.formattedAddress || 
                                     locChange.extractedLocation.location || 
                                     finalLoc.address || 
                                     finalLoc.name;
            }
            
            // DISPLAY FIX: Ensure name field includes both purpose and formatted address for consistent display
            // Format: "Purpose, Formatted Address" so that .split(',')[0] shows the purpose
            if (finalLoc.purpose && finalLoc.formattedAddress && finalLoc.purpose !== finalLoc.formattedAddress) {
              finalLoc.name = `${finalLoc.purpose}, ${finalLoc.formattedAddress}`;
            } else if (finalLoc.formattedAddress) {
              finalLoc.name = finalLoc.formattedAddress;
            } else {
              finalLoc.name = finalLoc.purpose || finalLoc.name || finalLoc.fullAddress || finalLoc.address;
            }
            
            // Handle insertion logic
            if (isInsertion && insertPos) {
              console.log(`📌 [INSERT] Adding location ${insertPos.type} reference index ${insertPos.referenceIndex} (${insertPos.referenceName})`);
              
              const insertAtIndex = insertPos.type === 'after' ? insertPos.referenceIndex + 1 : insertPos.referenceIndex;
              
              // Shift all locations at insertAtIndex and beyond up by 1
              const shiftedMap: { [key: number]: any } = {};
              Object.keys(finalLocationsMap).forEach(key => {
                const idx = parseInt(key);
                if (idx >= insertAtIndex) {
                  shiftedMap[idx + 1] = finalLocationsMap[idx];
                } else {
                  shiftedMap[idx] = finalLocationsMap[idx];
                }
              });
              
              // Insert new location at the calculated position
              shiftedMap[insertAtIndex] = finalLoc;
              
              // Replace finalLocationsMap with shifted version
              Object.keys(finalLocationsMap).forEach(key => delete (finalLocationsMap as any)[key]);
              Object.assign(finalLocationsMap, shiftedMap);
              
              console.log(`✅ [INSERT] Location inserted at index ${insertAtIndex}`);
            } else {
              // Regular append at extracted index
            finalLocationsMap[locChange.extractedIndex] = finalLoc;
            }
          }
        } else if (locChange.action === 'modified') {
          diff.locations.push({
            type: 'modified',
            index: locChange.currentIndex,
            addressChanged: locChange.changes?.addressChanged || false,
            timeChanged: locChange.changes?.timeChanged || false,
            purposeChanged: locChange.changes?.purposeChanged || false,
            oldAddress: locChange.currentLocation?.address || locChange.currentLocation?.name || '',
            oldTime: locChange.currentLocation?.time || '',
            oldPurpose: locChange.currentLocation?.purpose || locChange.currentLocation?.name || '',
            newAddress: locChange.extractedLocation?.formattedAddress || locChange.extractedLocation?.location || '',
            newTime: locChange.extractedLocation?.time || '',
            newPurpose: locChange.extractedLocation?.purpose || '',
          });
          // Add to final locations (modified version) - use currentIndex to preserve position
          if (locChange.finalLocation) {
            const finalLoc = locChange.finalLocation;
            const currentLoc = tripData?.locations[locChange.currentIndex];
            
            // GUARD: Validate finalLocation is a proper object with required fields
            if (!finalLoc || typeof finalLoc !== 'object') {
              console.error('❌ Invalid finalLocation for modified action (not an object):', finalLoc);
              // Fallback: Use current location if available
              if (currentLoc) {
                console.log('↩️ Falling back to current location for index', locChange.currentIndex);
                finalLocationsMap[locChange.currentIndex] = currentLoc;
              }
              return; // Skip to next location
            }
            
            // GUARD: Ensure lat/lng exist (allow 0 for now, existing logic handles it)
            if (finalLoc.lat === undefined || finalLoc.lng === undefined) {
              console.error('❌ Invalid finalLocation for modified action (missing lat/lng):', finalLoc);
              // Fallback: Use current location if available
              if (currentLoc) {
                console.log('↩️ Falling back to current location for index', locChange.currentIndex);
                finalLocationsMap[locChange.currentIndex] = currentLoc;
              }
              return; // Skip to next location
            }
            
            // FIX: Validate and fix ID if AI returned literal string instead of actual value
            if (!finalLoc.id || finalLoc.id === 'currentLocation.id' || finalLoc.id === 'extractedLocation.id' || finalLoc.id.includes('Location.id')) {
              console.warn(`⚠️ [FIX] AI returned invalid ID: "${finalLoc.id}", using fallback`);
              finalLoc.id = currentLoc?.id || `location-${locChange.currentIndex}-${Date.now()}`;
            }
            
            // FIX: Preserve address fields for time-only changes (prevent address corruption)
            if (locChange.changes?.timeChanged && !locChange.changes?.addressChanged && currentLoc) {
              console.log(`🔧 [FIX] Time-only change detected, preserving address fields from current location`);
              finalLoc.fullAddress = (currentLoc as any).fullAddress || finalLoc.fullAddress;
              finalLoc.formattedAddress = (currentLoc as any).formattedAddress || finalLoc.formattedAddress;
              finalLoc.address = (currentLoc as any).address || finalLoc.address;
              // Reconstruct name with preserved address
              if (finalLoc.purpose && (currentLoc as any).fullAddress) {
                finalLoc.name = `${finalLoc.purpose}, ${(currentLoc as any).fullAddress}`;
              }
            }
            
            // Ensure finalLocation has valid coordinates
            if ((!finalLoc.lat || finalLoc.lat === 0) && locChange.extractedLocation?.lat && locChange.extractedLocation.lat !== 0) {
              finalLoc.lat = locChange.extractedLocation.lat;
            }
            if ((!finalLoc.lng || finalLoc.lng === 0) && locChange.extractedLocation?.lng && locChange.extractedLocation.lng !== 0) {
              finalLoc.lng = locChange.extractedLocation.lng;
            }
            // If still no coordinates, try to get from current location (already defined above)
            if ((!finalLoc.lat || finalLoc.lat === 0) && currentLoc?.lat && currentLoc.lat !== 0) {
              finalLoc.lat = currentLoc.lat;
            }
            if ((!finalLoc.lng || finalLoc.lng === 0) && currentLoc?.lng && currentLoc.lng !== 0) {
              finalLoc.lng = currentLoc.lng;
            }
            
            // CRITICAL FIX: Ensure fullAddress and formattedAddress are set from extractedLocation for proper display
            if (!finalLoc.fullAddress && locChange.extractedLocation) {
              finalLoc.fullAddress = locChange.extractedLocation.formattedAddress || 
                                     locChange.extractedLocation.location || 
                                     finalLoc.address || 
                                     finalLoc.name;
            }
            if (!finalLoc.formattedAddress && locChange.extractedLocation) {
              finalLoc.formattedAddress = locChange.extractedLocation.formattedAddress || 
                                     locChange.extractedLocation.location || 
                                     finalLoc.address || 
                                     finalLoc.name;
            }
            
            // DISPLAY FIX: Ensure name field includes both purpose and formatted address for consistent display
            // Format: "Purpose, Formatted Address" so that .split(',')[0] shows the purpose
            // ALSO: If addressChanged, force name reconstruction (handles AI missing it)
            const addressChanged = locChange.changes?.addressChanged;
            if (addressChanged || (finalLoc.purpose && finalLoc.formattedAddress && finalLoc.purpose !== finalLoc.formattedAddress)) {
              finalLoc.name = `${finalLoc.purpose}, ${finalLoc.formattedAddress}`;
            } else if (finalLoc.formattedAddress) {
              finalLoc.name = finalLoc.formattedAddress;
            } else {
              finalLoc.name = finalLoc.purpose || finalLoc.name || finalLoc.fullAddress || finalLoc.address;
            }
            
            finalLocationsMap[locChange.currentIndex] = finalLoc;
          } else if (locChange.currentLocation && locChange.extractedLocation) {
            // Build final location from current + extracted
            const currentLoc = tripData?.locations[locChange.currentIndex];
            
            // FIX: Validate ID first
            let locationId = currentLoc?.id || (locChange.currentIndex + 1).toString();
            if (locationId === 'currentLocation.id' || locationId === 'extractedLocation.id' || locationId.includes('Location.id')) {
              console.warn(`⚠️ [FIX] Invalid ID detected: "${locationId}", generating new one`);
              locationId = `location-${locChange.currentIndex}-${Date.now()}`;
            }
            
            // Prioritize extracted coordinates, fallback to current, ensure we never use 0
            let lat = locChange.extractedLocation.lat && locChange.extractedLocation.lat !== 0 
              ? locChange.extractedLocation.lat 
              : (currentLoc?.lat && currentLoc.lat !== 0 ? currentLoc.lat : 0);
            let lng = locChange.extractedLocation.lng && locChange.extractedLocation.lng !== 0 
              ? locChange.extractedLocation.lng 
              : (currentLoc?.lng && currentLoc.lng !== 0 ? currentLoc.lng : 0);
            
            // CRITICAL FIX: Ensure fullAddress is properly set for display
            // For time-only changes, preserve the original fullAddress from currentLoc
            const timeOnlyChange = locChange.changes?.timeChanged && !locChange.changes?.addressChanged;
            const fullAddress = timeOnlyChange && (currentLoc as any)?.fullAddress
              ? (currentLoc as any).fullAddress
              : (locChange.extractedLocation.formattedAddress || 
                 locChange.extractedLocation.location || 
                 locChange.currentLocation.address ||
                 (currentLoc as any)?.fullAddress ||
                 locChange.currentLocation.name);
            
            const purpose = locChange.extractedLocation.purpose || locChange.currentLocation.purpose || locChange.currentLocation.name;
            const formattedAddress = fullAddress;
            
            // DISPLAY FIX: Ensure name field includes both purpose and formatted address for consistent display
            // Force reconstruction if address changed (handles AI not reconstructing name)
            const addressChanged = locChange.changes?.addressChanged;
            let displayName = purpose;
            if (addressChanged || (purpose && formattedAddress && purpose !== formattedAddress)) {
              displayName = `${purpose}, ${formattedAddress}`;
            } else if (formattedAddress) {
              displayName = formattedAddress;
            }
            
            finalLocationsMap[locChange.currentIndex] = {
              id: locationId,
              name: displayName,
              formattedAddress: formattedAddress,
              address: locChange.extractedLocation.formattedAddress || locChange.extractedLocation.location,
              time: locChange.extractedLocation.time || locChange.currentLocation.time,
              purpose: purpose,
              lat: lat,
              lng: lng,
              fullAddress: fullAddress,
            };
          }
        } else if (locChange.action === 'unchanged') {
          // Add unchanged location to final locations - ALWAYS preserve from current trip data
            const currentLoc = tripData?.locations[locChange.currentIndex];
            if (currentLoc) {
            // Always use current location data for unchanged locations to preserve coordinates
              finalLocationsMap[locChange.currentIndex] = {
                id: currentLoc.id,
                name: currentLoc.name,
                formattedAddress: (currentLoc as any).formattedAddress || (currentLoc as any).fullAddress || currentLoc.name,
                address: currentLoc.name,
                time: currentLoc.time,
                purpose: currentLoc.name,
                lat: currentLoc.lat,
                lng: currentLoc.lng,
              fullAddress: (currentLoc as any).fullAddress || currentLoc.name,
            };
          } else if (locChange.finalLocation) {
            // Fallback to finalLocation only if currentLoc doesn't exist
            const finalLoc = locChange.finalLocation;
            // Ensure formattedAddress is set for proper display
            if (!finalLoc.formattedAddress) {
              finalLoc.formattedAddress = finalLoc.fullAddress || finalLoc.address || finalLoc.name;
            }
            finalLocationsMap[locChange.currentIndex] = finalLoc;
          }
        }
      });
    }

    // Track removed location indices BEFORE preservation
    const removedIndices = new Set<number>();
    if (comparison.locations && Array.isArray(comparison.locations)) {
      comparison.locations.forEach((loc: any) => {
        if (loc.action === 'removed') {
          removedIndices.add(loc.currentIndex);
          console.log(`🗑️ [REMOVAL] Marking location ${loc.currentIndex} for removal: ${loc.currentLocation?.name || 'Unknown'}`);
        }
      });
    }

    // CRITICAL FIX: Ensure ALL current locations are preserved if not explicitly removed
    // This handles cases where the AI comparison might miss some unchanged locations
    if (tripData?.locations && tripData.locations.length > 0) {
      tripData.locations.forEach((currentLoc: any, idx: number) => {
        // Skip if explicitly removed
        if (removedIndices.has(idx)) {
          console.log(`⛔ [REMOVAL] Skipping removed location ${idx}: ${currentLoc.name}`);
          return;
        }
        
        // If this location index doesn't exist in finalLocationsMap yet, add it
        if (finalLocationsMap[idx] === undefined) {
          console.log(`🔄 Preserving missing location at index ${idx}: ${currentLoc.name}`);
          finalLocationsMap[idx] = {
            id: currentLoc.id,
            name: currentLoc.name,
            formattedAddress: (currentLoc as any).formattedAddress || (currentLoc as any).fullAddress || currentLoc.name,
            address: currentLoc.name,
            time: currentLoc.time,
            purpose: currentLoc.name,
            lat: currentLoc.lat,
            lng: currentLoc.lng,
            fullAddress: (currentLoc as any).fullAddress || currentLoc.name,
          };
        }
        // Also ensure existing entries have valid coordinates
        else if (finalLocationsMap[idx] && (!finalLocationsMap[idx].lat || !finalLocationsMap[idx].lng || finalLocationsMap[idx].lat === 0 || finalLocationsMap[idx].lng === 0)) {
          console.log(`🔄 Restoring coordinates for location at index ${idx}: ${currentLoc.name}`);
          finalLocationsMap[idx].lat = currentLoc.lat;
          finalLocationsMap[idx].lng = currentLoc.lng;
        }
      });
    }

    // Sort final locations by index and add to diff
    const sortedIndices = Object.keys(finalLocationsMap)
      .map(k => parseInt(k))
      .filter(idx => !isNaN(idx))
      .sort((a, b) => a - b);
    
    diff.finalLocations = sortedIndices.map(idx => finalLocationsMap[idx]);
    
    // FIX: Ensure unique IDs in final locations array (prevent React duplicate key errors)
    const usedIds = new Set<string>();
    diff.finalLocations = diff.finalLocations.map((loc: any, idx: number) => {
      if (usedIds.has(loc.id)) {
        const newId = `location-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.warn(`⚠️ [FIX] Duplicate ID detected: "${loc.id}" at index ${idx}, replacing with: "${newId}"`);
        return { ...loc, id: newId };
      }
      usedIds.add(loc.id);
      return loc;
    });

    // If no locations in final (shouldn't happen, but fallback), preserve all current locations
    if (diff.finalLocations.length === 0 && tripData?.locations && tripData.locations.length > 0) {
      console.log('⚠️ No final locations found, preserving all current locations as fallback');
      diff.finalLocations = tripData.locations.map((loc: any, idx: number) => ({
        id: loc.id,
        name: loc.name,
        address: loc.name,
        time: loc.time,
        purpose: loc.name,
        lat: loc.lat,
        lng: loc.lng,
        fullAddress: loc.name,
      }));
    }

    // Store additional comparison data for merging
    diff.comparisonData = comparison;

    return diff;
  };

  // Perform trip analysis update (regeneration)
  const performTripAnalysisUpdate = async (
    validLocations: Array<{ id: string; name: string; lat: number; lng: number; time: string; fullAddress?: string; purpose?: string }>,
    tripDateObj: Date,
    leadPassengerName?: string,
    vehicleInfo?: string,
    passengerCount?: number,
    tripDestination?: string,
    passengerNames?: string[],
    driverNotes?: string,
    latestChanges?: any
  ) => {
    if (!isGoogleMapsLoaded) {
      setError('Google Maps API is not loaded. Please refresh the page and try again.');
      setIsRegenerating(false);
      return;
    }

    setIsRegenerating(true);
    setError(null);

    try {
      const tripDateStr = tripDateObj.toISOString().split('T')[0];
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔄 Regenerating Trip Analysis - Version ${(currentVersion || 1) + 1}`);
      console.log(`🗓️  Trip Date: ${tripDateStr}`);
      console.log(`📍 Analyzing ${validLocations.length} location(s)`);
      console.log(`${'='.repeat(80)}\n`);

      const days = 7; // Fixed period for trip planning

      // Get city configuration for conditional API calls
      const cityConfig = getCityConfig(tripDestination);
      console.log(`🌍 [RESULTS] City configuration: ${cityConfig.cityName} (London APIs ${cityConfig.isLondon ? 'ENABLED' : 'DISABLED'})`);

      // Fetch data for all locations in parallel
      setRegenerationProgress(40);
      setRegenerationStep(`Fetching data for ${validLocations.length} location(s)...`);
      const results = await Promise.all(
        validLocations.map(async (location) => {
          console.log(`\n🔍 Fetching data for Location ${numberToLetter(validLocations.indexOf(location) + 1)}: ${location.name} at ${location.time}`);
          
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

          // Check if any response failed (only for London, mocks always succeed)
          if (cityConfig.isLondon) {
            const responses = [crimeResponse, disruptionsResponse, weatherResponse, parkingResponse];
            const responseNames = ['crime', 'disruptions', 'weather', 'parking'];
            
            for (let i = 0; i < responses.length; i++) {
              if (!responses[i].ok) {
                const errorText = await responses[i].text();
                console.error(`❌ ${responseNames[i]} API failed:`, responses[i].status, errorText);
                throw new Error(`${responseNames[i]} API returned ${responses[i].status}: ${errorText}`);
              }
            }
          } else {
            // For non-London, only check weather API
            if (!weatherResponse.ok) {
              const errorText = await weatherResponse.text();
              console.error(`❌ weather API failed:`, weatherResponse.status, errorText);
              throw new Error(`weather API returned ${weatherResponse.status}: ${errorText}`);
            }
          }

          const [crimeData, disruptionsData, weatherData, parkingData] = await Promise.all([
            crimeResponse.json(),
            disruptionsResponse.json(),
            weatherResponse.json(),
            parkingResponse.json()
          ]);

          // Create placeholder events data
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

          // Fetch cafes
          let cafeData = null;
          try {
            cafeData = await searchNearbyCafes(location.lat, location.lng, location.name);
          } catch (cafeError) {
            console.error('❌ Error fetching cafes:', cafeError);
            cafeData = {
              location: location.name,
              coordinates: { lat: location.lat, lng: location.lng },
              cafes: [],
              summary: { total: 0, averageRating: 0, averageDistance: 0 },
            };
          }

          // Fetch emergency services
          let emergencyServicesData = null;
          try {
            emergencyServicesData = await searchEmergencyServices(location.lat, location.lng, location.name);
          } catch (emergencyError) {
            console.error('❌ Error fetching emergency services:', emergencyError);
            emergencyServicesData = {
              location: location.name,
              coordinates: { lat: location.lat, lng: location.lng },
            };
          }

          if (crimeData.success && disruptionsData.success && weatherData.success && parkingData.success) {
            return {
              locationId: location.id,
              locationName: location.name,
              fullAddress: location.fullAddress || location.name,
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

      // Get traffic predictions
      setRegenerationProgress(60);
      setRegenerationStep('Calculating traffic predictions...');
      setRegenerationSteps(prev => prev.map(s => 
        s.id === '2' ? { ...s, status: 'completed' as const } :
        s.id === '3' ? { ...s, status: 'loading' as const } : s
      ));
      console.log('🚦 Fetching traffic predictions...');
      let trafficData = null;
      try {
        trafficData = await getTrafficPredictions(validLocations, tripDateStr);
      } catch (trafficError) {
        console.error('❌ Traffic prediction error:', trafficError);
        trafficData = {
          success: false,
          error: 'Failed to get traffic predictions',
        };
      }

      // Generate executive report
      setRegenerationProgress(75);
      setRegenerationStep('Generating executive report...');
      setRegenerationSteps(prev => prev.map(s => 
        s.id === '3' ? { ...s, status: 'completed' as const } :
        s.id === '4' ? { ...s, status: 'loading' as const } : s
      ));
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
            emailContent: updateText || null,
            leadPassengerName: leadPassengerName || null,
            vehicleInfo: vehicleInfo || null,
            passengerCount: passengerCount || 1,
            tripDestination: tripDestination || null,
            passengerNames: passengerNames || [],
            driverNotes: driverNotes || null,
          }),
        });

        const reportResult = await reportResponse.json();
        
        if (reportResult.success) {
          executiveReportData = reportResult.data;
          console.log('✅ Executive Report Generated!');
        }
      } catch (reportError) {
        console.error('⚠️ Could not generate executive report:', reportError);
      }

      // Prepare passenger name for database storage
      let passengerNameForDb: string | null = null;
      if (passengerNames && passengerNames.length > 0) {
        passengerNameForDb = passengerNames.join(', ');
      } else if (leadPassengerName) {
        passengerNameForDb = leadPassengerName;
      }

      // Prepare update data with incremented version
      // Ensure traffic_predictions has the correct structure with success flag
      const trafficPredictionsForDb = trafficData?.success ? {
        success: true,
        data: trafficData.data,
        totalDistance: trafficData.totalDistance,
        totalMinutes: trafficData.totalMinutes,
        totalMinutesNoTraffic: trafficData.totalMinutesNoTraffic,
      } : {
        success: false,
        data: null,
        error: trafficData?.error || 'Failed to get traffic predictions',
      };

      // Update locations with coordinates and addresses from analysis results
      // The results array has correct coordinates from crime API and is in the same order as validLocations
      // Match by index since results are created in the same order as validLocations were processed
      const locationsWithCoordinates = validLocations.map((loc, idx) => {
        const result = results[idx]; // Match by index - results are in same order as validLocations
        if (result && result.data && result.data.crime && result.data.crime.coordinates) {
          // Use coordinates from analysis results (most accurate - comes from crime API)
          // Also update fullAddress if available from results
          return {
            ...loc,
            lat: result.data.crime.coordinates.lat,
            lng: result.data.crime.coordinates.lng,
            fullAddress: result.fullAddress || loc.fullAddress || loc.name,
            name: result.locationName || loc.name, // Use location name from results if available
          };
        }
        // If no result found at this index, log warning and keep original location
        console.warn(`⚠️ No result found at index ${idx} for location ${loc.id} (${loc.name}), keeping original location`);
        console.warn(`   Results length: ${results.length}, validLocations length: ${validLocations.length}`);
        return loc;
      });

      console.log('💾 [DEBUG] Locations with coordinates before saving:');
      locationsWithCoordinates.forEach((loc, idx) => {
        console.log(`   ${idx + 1}. ${loc.name} - (${loc.lat}, ${loc.lng}) - ${loc.fullAddress}`);
      });

      const updateData: any = {
        trip_date: tripDateStr,
        locations: locationsWithCoordinates as any,
        trip_results: results as any,
        traffic_predictions: trafficPredictionsForDb as any,
        executive_report: executiveReportData as any,
        trip_notes: driverNotes || null,
        lead_passenger_name: passengerNameForDb,
        vehicle: vehicleInfo || null,
        passenger_count: passengerCount || 1,
        trip_destination: tripDestination || null,
        version: (currentVersion || 1) + 1,
        updated_at: new Date().toISOString(),
        latest_changes: latestChanges || null,
      };

      // Update trip in database
      setRegenerationProgress(90);
      setRegenerationStep('Saving updated report...');
      setRegenerationSteps(prev => prev.map(s => 
        s.id === '4' ? { ...s, status: 'completed' as const } :
        s.id === '5' ? { ...s, status: 'loading' as const } : s
      ));
      console.log(`💾 Updating trip ${tripId} with version ${updateData.version}...`);
      const { data: updatedTrip, error: updateError} = await supabase
        .from('trips')
        .update(updateData)
        .eq('id', tripId)
        .select()
        .single();

      if (updateError || !updatedTrip) {
        console.error('❌ Error updating trip:', updateError);
        throw new Error(`Failed to update trip: ${updateError?.message || 'Unknown error'}`);
      }

      console.log('✅ Trip updated successfully');
      console.log(`🔗 Trip ID: ${tripId}`);
      console.log(`📌 Version: ${updateData.version}`);

      setRegenerationProgress(100);
      setRegenerationStep('Update complete!');
      setRegenerationSteps(prev => prev.map(s => s.id === '5' ? { ...s, status: 'completed' as const } : s));

      // Small delay to show completion, then handle next steps
      setTimeout(() => {
        setIsRegenerating(false);
        setShowPreview(false); // Close preview modal
        
        // Show notification modal if driver is set
        if (driverEmail) {
          console.log('🔔 [DEBUG] Driver assigned, showing notification modal');
          setTimeout(() => {
            console.log('🔔 [DEBUG] Setting showUpdateNotificationModal to true');
            setShowUpdateNotificationModal(true);
          }, 500); // Increased delay for modal transition
        } else {
          console.log('📝 [DEBUG] No driver assigned, reloading page');
          // No driver, just reload
          window.location.reload();
        }
      }, 1000); // Increased to show "Update complete!" clearly
    } catch (err) {
      console.error('❌ Error regenerating report:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate report');
      setIsRegenerating(false);
    }
  };

  // Regenerate report handler
  const handleRegenerateReport = async () => {
    // Security check: Only owners can regenerate reports
    if (!isOwner) {
      console.error('❌ Unauthorized: Only trip owners can regenerate reports');
      setError('Only trip owners can regenerate reports');
      return;
    }

    if (!comparisonDiff || !extractedUpdates || !tripData) return;

    setIsRegenerating(true);
    setError(null);
    setRegenerationProgress(0);
    setRegenerationStep('Preparing updated locations...');
    
    // Initialize loading steps
    const steps = [
      { id: '1', title: 'Preparing Locations', description: 'Validating and geocoding updated locations', source: 'Google Maps', status: 'loading' as const },
      { id: '2', title: 'Fetching Location Data', description: 'Gathering crime, weather, disruptions, parking data', source: 'Multiple APIs', status: 'pending' as const },
      { id: '3', title: 'Traffic Analysis', description: 'Calculating real-time traffic predictions', source: 'Google Maps', status: 'pending' as const },
      { id: '4', title: 'Executive Report', description: 'Generating AI-powered risk analysis', source: 'OpenAI', status: 'pending' as const },
      { id: '5', title: 'Saving Report', description: 'Updating database with new information', source: 'Supabase', status: 'pending' as const },
    ];
    setRegenerationSteps(steps);

    try {
      // Use finalLocations from AI comparison (already merged intelligently)
      const finalLocations = comparisonDiff.finalLocations || [];
      
      // Convert final locations to format expected by performTripAnalysis
      // Log for debugging
      console.log('🔍 [DEBUG] Final locations before validation:', JSON.stringify(finalLocations, null, 2));
      
      // Filter out locations with invalid coordinates (lat === 0 && lng === 0)
      const validLocations = finalLocations
        .map((loc: any, idx: number) => {
          const location = {
            id: loc.id || (idx + 1).toString(),
            name: loc.name || loc.purpose || loc.fullAddress || loc.address || '',
            lat: loc.lat || 0,
            lng: loc.lng || 0,
            time: loc.time || '',
            fullAddress: loc.fullAddress || loc.address || loc.name || '',
            purpose: loc.purpose || loc.name || '',
          };
          
          // Log locations with invalid coordinates
          if (location.lat === 0 && location.lng === 0) {
            console.warn(`⚠️ [DEBUG] Location ${idx + 1} (${location.name}) has invalid coordinates (0, 0)`);
          }
          
          return location;
        })
        .filter((loc: any) => {
          const isValid = loc.lat !== 0 || loc.lng !== 0;
          if (!isValid) {
            console.warn(`⚠️ [DEBUG] Filtering out location "${loc.name}" due to invalid coordinates`);
          }
          return isValid;
        });
      
      console.log(`✅ [DEBUG] Valid locations after filtering: ${validLocations.length}`);
      validLocations.forEach((loc: any, idx: number) => {
        console.log(`   ${idx + 1}. ${loc.name} - (${loc.lat}, ${loc.lng})`);
      });
      
      // Validate that we have at least 2 valid locations for traffic predictions
      if (validLocations.length < 2) {
        console.error('❌ Need at least 2 locations with valid coordinates for traffic predictions');
        console.error(`   Current valid locations: ${validLocations.length}`);
        console.error(`   Total final locations: ${finalLocations.length}`);
        setError('Need at least 2 locations with valid coordinates to calculate routes. Please ensure all locations have valid addresses.');
        setIsRegenerating(false);
        return;
      }

      // VALIDATION: Check for coordinate/address mismatches BEFORE geocoding decision
      console.log('🔍 [VALIDATION] Checking coordinate/address consistency...');
      const inconsistentLocations: Array<{loc: any, index: number, reason: string}> = [];
      
      validLocations.forEach((loc: any, i: number) => {
        if (loc.lat && loc.lng && loc.lat !== 0 && loc.lng !== 0 && loc.fullAddress) {
          const addressLower = loc.fullAddress.toLowerCase();
          
          // Check 1: Airport address but central London coordinates
          const isAirportAddress = addressLower.includes('airport') || 
                                  addressLower.includes('gatwick') || 
                                  addressLower.includes('heathrow') ||
                                  addressLower.includes('stansted') ||
                                  addressLower.includes('luton');
          
          // Central London bounds: ~51.49-51.53 lat, -0.14 to -0.07 lng
          const inCentralLondon = (loc.lat > 51.49 && loc.lat < 51.53) && 
                                 (loc.lng > -0.14 && loc.lng < -0.07);
          
          if (isAirportAddress && inCentralLondon) {
            console.error(`❌ [VALIDATION] Location ${i} has AIRPORT address but CENTRAL LONDON coords!`);
            console.error(`   Address: ${loc.fullAddress}`);
            console.error(`   Coords: ${loc.lat}, ${loc.lng}`);
            inconsistentLocations.push({ loc, index: i, reason: 'airport-central-mismatch' });
          }
          
          // Check 2: Gatwick address but coords far from Gatwick
          if (addressLower.includes('gatwick')) {
            // Gatwick coords: ~51.1537, -0.1821
            const distanceFromGatwick = Math.sqrt(
              Math.pow((loc.lat - 51.1537) * 111, 2) + // rough km conversion
              Math.pow((loc.lng - (-0.1821)) * 111 * Math.cos(loc.lat * Math.PI / 180), 2)
            );
            
            if (distanceFromGatwick > 5) {
              console.error(`❌ [VALIDATION] Gatwick address but coords are ${distanceFromGatwick.toFixed(1)}km away!`);
              console.error(`   Address: ${loc.fullAddress}`);
              console.error(`   Coords: ${loc.lat}, ${loc.lng}`);
              inconsistentLocations.push({ loc, index: i, reason: 'gatwick-distance-mismatch' });
            }
          }
          
          // Check 3: Generic "London, UK" address (likely geocoding fallback)
          if (loc.fullAddress === 'London, UK' || loc.fullAddress.length < 15) {
            console.warn(`⚠️ [VALIDATION] Location ${i} has generic address: "${loc.fullAddress}"`);
            inconsistentLocations.push({ loc, index: i, reason: 'generic-address' });
          }
        }
      });
      
      // Re-geocode inconsistent locations
      if (inconsistentLocations.length > 0) {
        console.log(`🔧 [FIX] Re-geocoding ${inconsistentLocations.length} inconsistent locations...`);
        
        for (const inconsistent of inconsistentLocations) {
          try {
            const geocoder = new google.maps.Geocoder();
            const query = inconsistent.loc.fullAddress;
            
            const result = await new Promise<any>((resolve) => {
              geocoder.geocode(
                { address: query, region: getCityConfig(tripDestination).geocodingRegion },
                (results, status) => {
                  if (status === google.maps.GeocoderStatus.OK && results?.[0]) {
                    resolve(results[0]);
                  } else {
                    resolve(null);
                  }
                }
              );
            });
            
            if (result) {
              validLocations[inconsistent.index].lat = result.geometry.location.lat();
              validLocations[inconsistent.index].lng = result.geometry.location.lng();
              validLocations[inconsistent.index].fullAddress = result.formatted_address;
              console.log(`✅ [FIX] Corrected location ${inconsistent.index}: ${result.formatted_address} (${result.geometry.location.lat()}, ${result.geometry.location.lng()})`);
            }
          } catch (err) {
            console.error(`❌ Failed to re-geocode location ${inconsistent.index}:`, err);
          }
        }
      } else {
        console.log('✅ [VALIDATION] All locations passed consistency checks');
      }

      // OPTIMIZATION: Separate locations that need geocoding from those that don't
      // Check for: 1) Invalid coordinates OR 2) Incomplete/missing fullAddress
      const needsGeocoding = (loc: any): boolean => {
        // No coordinates = definitely needs geocoding
        if (loc.lat === 0 && loc.lng === 0) return true;
        
        // Has coordinates but missing/incomplete address = needs geocoding
        const fullAddr = loc.fullAddress || '';
        const hasIncompleteAddress = fullAddr.length < 20 || !fullAddr.includes(',');
        
        if (hasIncompleteAddress) {
          console.log(`   ⚠️ Location "${loc.name}" has incomplete address: "${fullAddr}" (needs geocoding)`);
        }
        
        return hasIncompleteAddress;
      };
      
      const locationsNeedingGeocoding = validLocations.filter(needsGeocoding);
      const locationsWithValidData = validLocations.filter((loc: any) => !needsGeocoding(loc));
      
      console.log(`🗺️ [OPTIMIZATION] Geocoding: ${locationsNeedingGeocoding.length} locations need geocoding, ${locationsWithValidData.length} already have valid data`);
      setRegenerationProgress(10);
      setRegenerationStep(`Geocoding ${locationsNeedingGeocoding.length} location(s)...`);
      setRegenerationSteps(prev => prev.map(s => s.id === '1' ? { ...s, status: 'loading' as const } : s));
      
      // Only geocode locations that actually need it
      let geocodedLocations: any[] = [];
      if (locationsNeedingGeocoding.length > 0) {
        console.log('🗺️ [DEBUG] Geocoding locations without valid coordinates...');
        // Get city configuration for geocoding
        const cityConfig = getCityConfig(tripDestination);
        console.log(`🌍 [GEOCODING] Using city context: ${cityConfig.cityName} (bias: ${cityConfig.geocodingBias})`);
        
        geocodedLocations = await Promise.all(
          locationsNeedingGeocoding.map(async (loc: any) => {
            try {
              console.log(`   Geocoding: ${loc.name || loc.fullAddress || loc.address || 'Unknown location'}`);
              
              // Use Google Maps Geocoding API
              const geocoder = new google.maps.Geocoder();
              const query = loc.fullAddress || loc.address || loc.name || '';
              
              return new Promise<typeof loc>((resolve) => {
                geocoder.geocode(
                  { address: `${query}, ${cityConfig.geocodingBias}`, region: cityConfig.geocodingRegion },
                  (results, status) => {
                    if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
                      const result = results[0];
                      const geocodedLoc = {
                        ...loc,
                        lat: result.geometry.location.lat(),
                        lng: result.geometry.location.lng(),
                        fullAddress: result.formatted_address || loc.fullAddress || loc.address || loc.name,
                      };
                      console.log(`   ✅ Geocoded: ${geocodedLoc.name} → (${geocodedLoc.lat}, ${geocodedLoc.lng})`);
                      resolve(geocodedLoc);
                    } else {
                      console.warn(`   ⚠️ Geocoding failed for: ${query} (status: ${status})`);
                      // Keep original location even if geocoding fails
                      resolve(loc);
                    }
                  }
                );
              });
            } catch (geocodeError) {
              console.error(`   ❌ Error geocoding ${loc.name}:`, geocodeError);
              // Keep original location if geocoding fails
              return loc;
            }
          })
        );
        console.log(`✅ [DEBUG] Geocoding complete for ${geocodedLocations.length} locations`);
      } else {
        console.log('⚡️ [OPTIMIZATION] No geocoding needed - all locations have valid coordinates!');
      }

      // Combine geocoded locations with those that already had valid data
      // Preserve original order by matching indices
      const finalValidLocations = validLocations.map((loc: any) => {
        if (needsGeocoding(loc)) {
          // Find this location in geocoded results
          const geocoded = geocodedLocations.find((g: any) => g.id === loc.id);
          return geocoded || loc;
        }
        return loc; // Already has valid coordinates and complete address
      });

      console.log('✅ [DEBUG] Final locations ready');
      finalValidLocations.forEach((loc: any, idx: number) => {
        console.log(`   ${idx + 1}. ${loc.name} - (${loc.lat}, ${loc.lng})`);
      });
      setRegenerationProgress(20);
      setRegenerationStep('Fetching updated data for all locations...');
      setRegenerationSteps(prev => prev.map(s => 
        s.id === '1' ? { ...s, status: 'completed' as const } :
        s.id === '2' ? { ...s, status: 'loading' as const } : s
      ));

      // Get updated trip date (from AI comparison or use current)
      const comparisonData = comparisonDiff.comparisonData;
      const updatedTripDate = comparisonData?.tripDateNew || 
        (comparisonData?.tripDateChanged ? extractedUpdates.date : tripData.tripDate) ||
        tripData.tripDate;

      // Get merged notes (from AI comparison)
      const mergedNotes = comparisonDiff.mergedNotes || driverNotes;

      // Get updated passenger info (from AI comparison)
      const updatedPassengerName = comparisonData?.passengerInfoNew || 
        (comparisonData?.passengerInfoChanged ? (extractedUpdates.leadPassengerName || extractedUpdates.passengerNames?.join(', ')) : leadPassengerName) ||
        leadPassengerName;

      // Get updated vehicle info (from AI comparison)
      const updatedVehicleInfo = comparisonData?.vehicleInfoNew ||
        (comparisonData?.vehicleInfoChanged ? extractedUpdates.vehicleInfo : vehicleInfo) ||
        vehicleInfo;

      // Get updated passenger count
      const updatedPassengerCount = comparisonData?.passengerCountNew ||
        (comparisonData?.passengerCountChanged ? extractedUpdates.passengerCount : passengerCount) ||
        passengerCount;

      // Get updated trip destination
      const updatedTripDestination = comparisonData?.tripDestinationNew ||
        (comparisonData?.tripDestinationChanged ? extractedUpdates.tripDestination : tripDestination) ||
        tripDestination;

      // Parse trip date
      const tripDateObj = new Date(updatedTripDate);

      // Get passenger names array
      const updatedPassengerNames = extractedUpdates.passengerNames || [];

      // Call the regeneration function
      setRegenerationProgress(30);
      setRegenerationStep('Analyzing trip data...');
      await performTripAnalysisUpdate(
        finalValidLocations,
        tripDateObj,
        updatedPassengerName,
        updatedVehicleInfo,
        updatedPassengerCount,
        updatedTripDestination,
        updatedPassengerNames,
        mergedNotes,
        comparisonDiff
      );
    } catch (err) {
      console.error('Error regenerating report:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate report');
      setIsRegenerating(false);
    }
  };

  // Show loading state until ownership is checked
  if (loading || !ownershipChecked) {
    return (
      <div className="min-h-screen bg-background">
        {/* Show sticky quote form even during loading if ownership is checked and user is not owner */}
        {ownershipChecked && !isOwner && (
          <div 
            className={`fixed left-0 right-0 bg-background transition-all duration-300 ${
              scrollY > 0 ? 'top-0 z-[60]' : 'top-[57px] z-40'
            }`}
          >
            <div className="container mx-auto px-4 pt-8 pb-3">
              <div className="rounded-md pl-6 pr-4 py-3 bg-primary dark:bg-[#1f1f21] border border-border">
                <label className="block text-sm font-medium text-primary-foreground dark:text-card-foreground mb-3">Submit quote</label>
                
                {quoteSuccess && (
                  <div className="mb-3 px-3 py-2 rounded-md bg-[#3ea34b]/10 border border-[#3ea34b]/30">
                    <p className="text-sm text-[#3ea34b]">
                      ✅ {quoteSuccessMessage}
                    </p>
                  </div>
                )}

                <form onSubmit={handleSubmitQuote} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <Input
                      id="quote-email-loading"
                      type="email"
                      value={quoteEmail}
                      onChange={(e) => setQuoteEmail(e.target.value)}
                      placeholder="your.email@company.com"
                      disabled={submittingQuote}
                      className={`h-[44px] border-border bg-background dark:bg-input/30 text-foreground placeholder:text-muted-foreground/60 dark:hover:bg-[#323236] transition-colors ${quoteEmailError ? 'border-destructive' : ''}`}
                    />
                    {quoteEmailError && (
                      <p className="text-xs text-destructive mt-1">{quoteEmailError}</p>
                    )}
                  </div>

                  <div className="w-[140px]">
                    <Input
                      id="quote-price-loading"
                      type="number"
                      step="0.01"
                      min="0"
                      value={quotePrice}
                      onChange={(e) => setQuotePrice(e.target.value)}
                      placeholder="100.00"
                      disabled={submittingQuote}
                      className={`h-[44px] border-border bg-background dark:bg-input/30 text-foreground placeholder:text-muted-foreground/60 dark:hover:bg-[#323236] transition-colors ${quotePriceError ? 'border-destructive' : ''}`}
                    />
                    {quotePriceError && (
                      <p className="text-xs text-destructive mt-1">{quotePriceError}</p>
                    )}
                  </div>

                  <div className="w-[100px]">
                    <select
                      id="quote-currency-loading"
                      value={quoteCurrency}
                      onChange={(e) => setQuoteCurrency(e.target.value)}
                      disabled={submittingQuote}
                      className="w-full h-[44px] px-3 rounded-md border border-border bg-background dark:bg-input/30 text-sm text-foreground dark:hover:bg-[#323236] transition-colors"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="JPY">JPY</option>
                      <option value="CAD">CAD</option>
                      <option value="AUD">AUD</option>
                      <option value="CHF">CHF</option>
                    </select>
                  </div>

                  <Button
                    type="submit"
                    disabled={submittingQuote || !quoteEmail || !quotePrice}
                    className="h-[44px] bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] hover:bg-[#05060A]/90 dark:hover:bg-[#E5E7EF]/90"
                  >
                    {submittingQuote ? (
                      <>
                        <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      'Submit quote'
                    )}
                  </Button>
                </form>

                {/* Display driver's submitted quotes */}
                {myQuotes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Your submitted quote:</p>
                    {myQuotes.map((quote) => {
                      const timeAgo = (() => {
                        const now = new Date();
                        const created = new Date(quote.created_at);
                        const diffMs = now.getTime() - created.getTime();
                        const diffMins = Math.floor(diffMs / 60000);
                        const diffHours = Math.floor(diffMins / 60);
                        const diffDays = Math.floor(diffHours / 24);
                        
                        if (diffDays > 0) return `${diffDays}d ago`;
                        if (diffHours > 0) return `${diffHours}h ago`;
                        if (diffMins > 0) return `${diffMins}m ago`;
                        return 'just now';
                      })();

                      return (
                        <div 
                          key={quote.id} 
                          className="flex items-center justify-between px-3 py-2 rounded-md bg-background/50 dark:bg-input/20 border border-border/50"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{quote.email}</p>
                            <p className="text-xs text-muted-foreground">{timeAgo}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-foreground">
                              {quote.currency} {quote.price.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Loading spinner */}
        <div className={`flex items-center justify-center ${ownershipChecked && !isOwner ? 'pt-32' : ''} min-h-screen`}>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Loading Your Trip Analysis...
            </h2>
            <div className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-muted-foreground">Please wait...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !tripData || !tripData.tripResults) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="p-8 text-center">
          <h2 className="text-2xl font-bold text-card-foreground mb-4">
            Trip Not Found
          </h2>
          <p className="text-muted-foreground mb-6">
            {error || 'This trip analysis could not be found. It may have been deleted or the link is incorrect.'}
          </p>
          <Button
            onClick={() => router.push('/')}
            size="lg"
          >
            Go to Home
          </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Password verification form for protected reports (show only if explicitly flagged)
  if (showPasswordGate) {
    const handlePasswordSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setPasswordError(null);
      setVerifyingPassword(true);

      try {
        const response = await fetch('/api/verify-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId: tripId,
            password: passwordInput,
          }),
        });

        const result = await response.json();

        if (result.success) {
          setIsPasswordVerified(true);
          setShowPasswordGate(false); // Hide password gate
          setPasswordError(null);
          console.log('✅ Password verified successfully');
        } else {
          setPasswordError(result.error || 'Incorrect password');
          setPasswordInput('');
        }
      } catch (err) {
        console.error('Error verifying password:', err);
        setPasswordError('Failed to verify password. Please try again.');
      } finally {
        setVerifyingPassword(false);
      }
    };

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary mb-4">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-card-foreground mb-2">
                Password Protected Report
              </h2>
              <p className="text-muted-foreground">
                This report is password protected. Please enter the password to continue.
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <Input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter password"
                  className="text-center"
                  autoFocus
                  disabled={verifyingPassword}
                />
                {passwordError && (
                  <Alert className="mt-3">
                    <AlertDescription className="text-destructive text-sm">
                      {passwordError}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                disabled={!passwordInput || verifyingPassword}
              >
                {verifyingPassword ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Verifying...
                  </>
                ) : (
                  'Unlock Report'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Button
                onClick={() => router.push('/')}
                variant="outline"
                size="sm"
              >
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { tripDate, locations, tripResults, trafficPredictions, executiveReport } = tripData;

  return (
    <div className="min-h-screen bg-background">
      {/* Quote Form Section - Sticky Bar - Shows for:
          1. Guests invited to submit quotes
          2. Assigned drivers (with or without magic link)
          3. Any non-owner viewer */}
      {!isOwner && (
        <div 
          className={`fixed left-0 right-0 bg-background transition-all duration-300 ${
            scrollY > 0 ? 'top-0 z-[60]' : 'top-[57px] z-40'
          }`}
        >
          <div className="container mx-auto px-4 pt-8 pb-3">
            <div className="rounded-md pl-6 pr-4 py-3 bg-primary dark:bg-[#1f1f21] border border-border">
              <label className="block text-sm font-medium text-primary-foreground dark:text-card-foreground mb-3">Submit quote</label>
              
              {quoteSuccess && (
                <div className="mb-3 px-3 py-2 rounded-md bg-[#3ea34b]/10 border border-[#3ea34b]/30">
                  <p className="text-sm text-[#3ea34b]">
                    ✅ {quoteSuccessMessage}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmitQuote} className="flex gap-3 items-start">
                <div className="flex-1">
                  <Input
                    id="quote-email"
                    type="email"
                    value={quoteEmail}
                    onChange={(e) => setQuoteEmail(e.target.value)}
                    placeholder="your.email@company.com"
                    disabled={submittingQuote}
                    className={`h-[44px] border-border bg-background dark:bg-input/30 text-foreground placeholder:text-muted-foreground/60 dark:hover:bg-[#323236] transition-colors ${quoteEmailError ? 'border-destructive' : ''}`}
                  />
                  {quoteEmailError && (
                    <p className="text-xs text-destructive mt-1">{quoteEmailError}</p>
                  )}
                </div>

                <div className="w-[140px]">
                  <Input
                    id="quote-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={quotePrice}
                    onChange={(e) => setQuotePrice(e.target.value)}
                    placeholder="100.00"
                    disabled={submittingQuote}
                    className={`h-[44px] border-border bg-background dark:bg-input/30 text-foreground placeholder:text-muted-foreground/60 dark:hover:bg-[#323236] transition-colors ${quotePriceError ? 'border-destructive' : ''}`}
                  />
                  {quotePriceError && (
                    <p className="text-xs text-destructive mt-1">{quotePriceError}</p>
                  )}
                </div>

                <div className="w-[100px]">
                  <select
                    id="quote-currency"
                    value={quoteCurrency}
                    onChange={(e) => setQuoteCurrency(e.target.value)}
                    disabled={submittingQuote}
                    className="w-full h-[44px] px-3 rounded-md border border-border bg-background dark:bg-input/30 text-sm text-foreground dark:hover:bg-[#323236] transition-colors"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                    <option value="CAD">CAD</option>
                    <option value="AUD">AUD</option>
                    <option value="CHF">CHF</option>
                  </select>
                </div>

                <Button
                  type="submit"
                  disabled={submittingQuote || !quoteEmail || !quotePrice}
                  className="h-[44px] bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] hover:bg-[#05060A]/90 dark:hover:bg-[#E5E7EF]/90"
                >
                  {submittingQuote ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    'Submit quote'
                  )}
                </Button>
              </form>

              {/* Display driver's submitted quotes */}
              {myQuotes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Your submitted quote:</p>
                  {myQuotes.map((quote) => {
                    const timeAgo = (() => {
                      const now = new Date();
                      const created = new Date(quote.created_at);
                      const diffMs = now.getTime() - created.getTime();
                      const diffMins = Math.floor(diffMs / 60000);
                      const diffHours = Math.floor(diffMins / 60);
                      const diffDays = Math.floor(diffHours / 24);
                      
                      if (diffDays > 0) return `${diffDays}d ago`;
                      if (diffHours > 0) return `${diffHours}h ago`;
                      if (diffMins > 0) return `${diffMins}m ago`;
                      return 'just now';
                    })();

                    return (
                      <div 
                        key={quote.id} 
                        className="flex items-center justify-between px-3 py-2 rounded-md bg-background/50 dark:bg-input/20 border border-border/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{quote.email}</p>
                          <p className="text-xs text-muted-foreground">{timeAgo}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">
                            {quote.currency} {quote.price.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Update Trip Section - Sticky Bar - Only show for owners */}
        {isOwner && !isLiveMode && (
        <div 
          className={`fixed left-0 right-0 bg-background transition-all duration-300 ${
            scrollY > 0 ? 'top-0 z-[60]' : 'top-[57px] z-40'
          }`}
        >
          <div className="container mx-auto px-4 pt-8 pb-3">
            
            <div className="rounded-md pl-6 pr-4 py-3 bg-primary dark:bg-[#1f1f21] border border-border">
              <label className="block text-sm font-medium text-primary-foreground dark:text-card-foreground mb-3">Trip Update</label>
              <div className="flex gap-4 items-start">
                <div className="flex-1 relative">
                  <textarea
                    ref={updateTextareaRef}
                    id="update-text"
                  value={updateText}
                  onChange={(e) => setUpdateText(e.target.value)}
                  placeholder={isExtracting && updateProgress.step && !updateProgress.error ? `${updateProgress.step}...` : "Paste any updated trip information here..."}
                  className="w-full min-h-[51px] h-[51px] px-3 py-2 pr-12 rounded-md border border-border bg-background dark:bg-input/30 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:border-ring resize-none overflow-y-auto dark:hover:bg-[#323236] transition-colors dark:focus-visible:border-[#323236]"
                  disabled={isExtracting || isRegenerating}
                  />
                  <button
                    onClick={handleExtractUpdates}
                    disabled={!updateText.trim() || isExtracting || isRegenerating}
                    className={`absolute right-3 top-[13px] p-1 rounded-md transition-all ${
                      updateText.trim() && !isExtracting
                        ? 'hover:bg-muted/50 opacity-100' 
                        : 'opacity-30 cursor-not-allowed'
                    }`}
                    aria-label="Update trip"
                    type="button"
                  >
                    {isExtracting ? (
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <img 
                        src="/update-dark.png"
                        alt="Update" 
                        className="w-4 h-4 dark:invert"
                      />
                    )}
                  </button>
                </div>
                
                <div className="flex items-center gap-3 flex-shrink-0">
                {/* Update Trip Button */}
                <Button
                  variant="default"
                  className="flex items-center gap-2 h-[51px] bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] hover:bg-[#05060A]/90 dark:hover:bg-[#E5E7EF]/90"
                  onClick={handleExtractUpdates}
                  disabled={!updateText.trim() || isExtracting || isRegenerating}
                >
                  {isExtracting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Updating...
                    </>
                  ) : (
                    <>
                      <img 
                        src="/update-dark.png"
                        alt="Update" 
                        className="w-4 h-4 dark:invert"
                      />
                      Update trip
                    </>
                  )}
                </Button>
                
                {/* Edit Route Button */}
                <Button
                  variant="outline"
                  className="flex items-center gap-2 h-[51px] bg-input/30 border-input hover:bg-[#323236] text-white dark:bg-background dark:border-border dark:hover:bg-accent dark:text-foreground"
                  onClick={() => {
                    // Pre-fill modal with current trip data - preserve name (purpose) and fullAddress
                    setEditingLocations(locations.map((loc, idx) => ({
                      location: (loc as any).fullAddress || loc.name,
                      formattedAddress: (loc as any).fullAddress || loc.name,
                      lat: loc.lat,
                      lng: loc.lng,
                      time: loc.time,
                      purpose: loc.name || '', // Store original name (purpose) to preserve it
                      confidence: 'high',
                      verified: true,
                      placeId: `stable-id-${idx}-${Date.now()}`,
                    })));
                    setShowEditRouteModal(true);
                  }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit route
                </Button>
                </div>
                
                <div className="flex gap-3 flex-shrink-0">
                    {extractedUpdates && !isExtracting && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setUpdateText('');
                          setExtractedUpdates(null);
                          setShowPreview(false);
                          setComparisonDiff(null);
                          setUpdateProgress({ step: '', error: null, canRetry: false });
                        }}
                      >
                        Clear
                      </Button>
                    )}
                </div>
                </div>

                {/* Enhanced Error Display with Step Information */}
                {updateProgress.error && (
                <Alert variant="destructive" className="mt-2">
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-semibold">
                          ❌ Failed at: {updateProgress.step}
                        </p>
                        <p className="text-sm">
                          {updateProgress.error}
                        </p>
                        {updateProgress.canRetry && (
                          <Button
                            onClick={handleExtractUpdates}
                            variant="outline"
                            size="sm"
                            className="mt-2"
                          >
                            🔄 Retry
                          </Button>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
              )}
            </div>
          </div>
        </div>
        )}

      {/* Main Content */}
      <div className={`container mx-auto px-4 ${(isOwner && !isLiveMode) || !isOwner ? 'pt-32 pb-8' : 'py-8'}`}>

        {/* Loading State Modal - Full Screen Overlay (Same as Homepage) */}
        {isRegenerating && (
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
                          strokeDashoffset={339.292 * (1 - regenerationProgress / 100)}
                          className={regenerationProgress >= 100 ? "text-green-500" : "text-[#05060A] dark:text-[#E5E7EF]"}
                          strokeLinecap="round"
                        />
                      </svg>
                      {/* Percentage Text */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-bold">
                          {Math.round(regenerationProgress)}%
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <h3 className="text-xl font-semibold mb-1">Updating Report</h3>
                      <p className="text-sm text-muted-foreground">
                        {regenerationSteps.filter(s => s.status === 'completed').length} of {regenerationSteps.length} steps completed
                      </p>
                    </div>
                  </div>

                  {/* Steps Carousel - Exact Homepage Animation */}
                  <div className="relative h-[200px] overflow-hidden">
                    {regenerationSteps.map((step, index) => {
                      const isActive = step.status === 'loading';
                      const isCompleted = step.status === 'completed';
                      const isPending = step.status === 'pending';
                      
                      // Calculate position relative to active step
                      const activeIndex = regenerationSteps.findIndex(s => s.status === 'loading');
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
                        // Previous step - hide completely
                        transform = 'translateY(-120px)';
                        opacity = 0;
                        scale = 0.85;
                        zIndex = 10;
                      } else if (position === 1) {
                        // Next step - hide completely
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
                                <div className="w-6 h-6 rounded-full border-2 border-[#05060A] dark:border-[#E5E7EF] border-t-transparent animate-spin"></div>
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
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Preview Modal */}
        {showPreview && comparisonDiff && isOwner && !isLiveMode && (
          <Dialog open={showPreview} onOpenChange={(open) => {
            if (!open && !isRegenerating) {
              setShowPreview(false);
              setComparisonDiff(null);
              setExtractedUpdates(null);
              setUpdateText('');
            }
          }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <>
                <DialogHeader>
                  <DialogTitle className="text-2xl">Preview Changes</DialogTitle>
                  <DialogDescription>
                    Review the changes before updating the report
                  </DialogDescription>
                </DialogHeader>
              <div className="space-y-4">
                {/* Trip Date Changes */}
                {comparisonDiff.tripDateChanged && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="font-medium mb-1">Trip Date Updated:</div>
                    <div className="text-sm">
                      <span className="line-through text-muted-foreground">
                        {new Date(tripDate).toLocaleDateString()}
                      </span>
                      {' → '}
                      <span className="font-semibold">
                        {new Date(extractedUpdates.date || tripDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Location Changes */}
                {comparisonDiff.locations.length > 0 && (
                  <div className="space-y-2">
                    <div className="font-medium mb-2">Location Changes:</div>
                    {comparisonDiff.locations.map((locChange: any, idx: number) => {
                      // Determine the location name to display
                      const locationName = locChange.type === 'added' 
                        ? locChange.newAddress 
                        : (locChange.type === 'removed' ? locChange.oldAddress : (locChange.newAddress || locChange.oldAddress));
                      
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border-l-4 ${
                            locChange.type === 'added'
                              ? 'bg-[#3ea34b]/10 border-[#3ea34b]'
                              : locChange.type === 'removed'
                              ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
                              : 'bg-yellow-50 dark:bg-yellow-900/20 border-orange-500'
                          }`}
                        >
                          <div className="font-semibold mb-2 text-base">
                            {locationName || `Location ${idx + 1}`}
                          </div>
                          <div className={`text-xs font-medium mb-2 ${
                            locChange.type === 'added' 
                              ? 'text-[#3ea34b]' 
                              : locChange.type === 'removed' 
                              ? 'text-red-600' 
                              : 'text-orange-600'
                          }`}>
                            {locChange.type === 'added' ? '✓ Added' : locChange.type === 'removed' ? '✗ Removed' : '⟳ Modified'}
                          </div>
                          
                          {locChange.type === 'modified' && (
                            <div className="text-sm space-y-2">
                              {locChange.addressChanged && (
                                <div className="space-y-1">
                                  <div className="font-medium text-xs text-muted-foreground">Address:</div>
                                  <div className="pl-2">
                                    <div className="line-through text-muted-foreground text-xs">{locChange.oldAddress}</div>
                                    <div className="text-orange-600">→</div>
                                    <div className="font-semibold">{locChange.newAddress}</div>
                                  </div>
                                </div>
                              )}
                              {locChange.timeChanged && (
                                <div className="space-y-1">
                                  <div className="font-medium text-xs text-muted-foreground">Time:</div>
                                  <div className="pl-2">
                                    <span className="line-through text-muted-foreground">{locChange.oldTime}</span>
                                    <span className="text-orange-600 mx-2">→</span>
                                    <span className="font-semibold">{locChange.newTime}</span>
                                  </div>
                                </div>
                              )}
                              {locChange.purposeChanged && (
                                <div className="space-y-1">
                                  <div className="font-medium text-xs text-muted-foreground">Purpose:</div>
                                  <div className="pl-2">
                                    <div className="line-through text-muted-foreground text-xs">{locChange.oldPurpose}</div>
                                    <div className="text-orange-600">→</div>
                                    <div className="font-semibold">{locChange.newPurpose}</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {locChange.type === 'added' && (
                            <div className="text-sm space-y-1">
                              <div><span className="font-medium text-xs text-muted-foreground">Time:</span> <span className="font-semibold">{locChange.newTime}</span></div>
                              {locChange.newPurpose && <div><span className="font-medium text-xs text-muted-foreground">Purpose:</span> <span>{locChange.newPurpose}</span></div>}
                            </div>
                          )}
                          {locChange.type === 'removed' && (
                            <div className="text-sm space-y-1 opacity-75">
                              <div><span className="font-medium text-xs text-muted-foreground">Time:</span> {locChange.oldTime}</div>
                              {locChange.oldPurpose && <div><span className="font-medium text-xs text-muted-foreground">Purpose:</span> {locChange.oldPurpose}</div>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Passenger Info Changes */}
                {(comparisonDiff.passengerInfoChanged || comparisonDiff.vehicleInfoChanged) && (
                  <div className="space-y-2">
                    {comparisonDiff.passengerInfoChanged && (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div className="font-medium mb-1">Passenger Info Updated:</div>
                        <div className="text-sm">
                          <span className="line-through text-muted-foreground">{leadPassengerName || 'None'}</span>
                          {' → '}
                          <span className="font-semibold">{extractedUpdates.leadPassengerName || extractedUpdates.passengerNames?.join(', ') || 'None'}</span>
                        </div>
                      </div>
                    )}
                    {comparisonDiff.vehicleInfoChanged && (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div className="font-medium mb-1">Vehicle Updated:</div>
                        <div className="text-sm">
                          <span className="line-through text-muted-foreground">{vehicleInfo || 'None'}</span>
                          {' → '}
                          <span className="font-semibold">{extractedUpdates.vehicleInfo || 'None'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes Preview - Show only NEW notes */}
                {comparisonDiff.notesChanged && extractedUpdates?.driverNotes && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="font-medium mb-2">New Notes Added:</div>
                    <div className="text-sm whitespace-pre-wrap">{extractedUpdates.driverNotes}</div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowPreview(false);
                        setComparisonDiff(null);
                        setExtractedUpdates(null);
                        setUpdateText('');
                      }}
                      disabled={isRegenerating}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleRegenerateReport}
                      disabled={isRegenerating}
                      className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                    >
                      Confirm & Update
                    </Button>
                  </DialogFooter>
                </>
            </DialogContent>
          </Dialog>
        )}

        {/* Results Section */}
        <div className="mb-8">


          {/* Service Introduction */}
          {!isLiveMode && (
              <div className="mb-6 mt-[25px]">
                {/* Trip Summary Box */}
                <div className="mb-6 bg-card rounded-lg p-8 shadow-none">
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-5xl font-normal text-card-foreground mb-5 leading-tight">
                          {leadPassengerName || 'Passenger'} (x{passengerCount || 1}) {(() => {
                            if (locations && locations.length >= 2) {
                              const pickupTime = parseInt(locations[0]?.time) || 0;
                              const dropoffTime = parseInt(locations[locations.length - 1]?.time) || 0;
                              const duration = dropoffTime - pickupTime;
                              
                              if (duration > 0) {
                                const hours = Math.floor(duration);
                                return `${hours}h`;
                              }
                              return '0h';
                            }
                            return '0h';
                          })()} in {tripDestination || 'London'}
                        </h2>
                        <div className="flex items-center gap-3 mb-3">
                          <svg className="w-5 h-5 flex-shrink-0 text-card-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm font-normal text-card-foreground">
                            Trip Date{' '}
                            <span className="text-xl font-semibold ml-2">
                              {new Date(tripDate).toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                day: 'numeric', 
                                month: 'long', 
                                year: 'numeric' 
                              })}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 flex-shrink-0 text-card-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span className="text-sm font-normal text-card-foreground">
                            Number of Passengers{' '}
                            <span className="text-xl font-semibold ml-2">
                              {passengerCount || 1}
                            </span>
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <FlowHoverButton
                          variant={
                            tripStatus === 'cancelled' ? 'cancelled' :
                            tripStatus === 'rejected' ? 'rejected' :
                            tripStatus === 'confirmed' ? 'confirmed' : 
                            driverEmail ? 'pending' : 
                            'not-confirmed'
                          }
                          onClick={handleStatusToggle}
                          disabled={updatingStatus || tripStatus === 'cancelled'}
                          icon={
                            tripStatus === 'cancelled' ? (
                              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            ) : tripStatus === 'rejected' ? (
                              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            ) : tripStatus === 'confirmed' ? (
                              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : undefined
                          }
                        >
                          {tripStatus === 'cancelled' ? 'Cancelled' : tripStatus === 'rejected' ? 'Rejected' : tripStatus === 'confirmed' ? 'Confirmed' : driverEmail ? 'Pending' : 'Not confirmed'}
                        </FlowHoverButton>
                      </div>
                    </div>
                </div>

                {/* Vehicle Image - Show for sedan services */}
                {(() => {
                  const numberOfPassengers = passengerCount || 1;
                  const extractCarInfo = (text: string | null): string | null => {
                    if (!text) return null;
                    const carPatterns = [
                      /(?:Mercedes|Merc)\s*(?:E|S)[\s-]*Class/i,
                      /(?:Mercedes|Merc)\s*Maybach\s*S/i,
                      /BMW\s*(?:5|7)\s*Series/i,
                      /Audi\s*(?:A6|A8)/i,
                      /Lincoln\s*(?:Continental|MKS)/i,
                      /Lexus\s*(?:E350|LS\s*500)/i,
                      /Volvo\s*S90/i,
                      /Cadillac\s*XTS/i,
                    ];
                    
                    for (const pattern of carPatterns) {
                      if (pattern.test(text)) {
                        return text.match(pattern)?.[0] || null;
                      }
                    }
                    return null;
                  };
                  
                  const isSedan = numberOfPassengers <= 3 || 
                                  extractCarInfo(vehicleInfo || '') || 
                                  extractCarInfo(driverNotes || '');
                  
                  return isSedan ? (
                    <Card className="mb-6 shadow-none">
                      <CardContent className="p-5 relative">
                        {/* Assign Driver button - Top Right */}
                        {isOwner && (
                          <div className="absolute top-5 right-5">
                            <div className="relative inline-block">
                              <Button
                                variant="outline"
                                className={`flex items-center gap-2 h-10 ${
                                  tripStatus === 'cancelled' 
                                    ? 'border !border-gray-400 opacity-50 cursor-not-allowed'
                                    : tripStatus === 'confirmed' && driverEmail 
                                    ? 'border !border-[#3ea34b] hover:bg-[#3ea34b]/10' 
                                    : driverEmail 
                                    ? 'border !border-[#e77500] hover:bg-[#e77500]/10' 
                                    : ''
                                }`}
                                onClick={() => {
                                  if (tripStatus === 'cancelled') {
                                    alert('This trip has been cancelled. Please create a new trip instead.');
                                    return;
                                  }
                                  setShowDriverModal(true);
                                }}
                                disabled={tripStatus === 'cancelled'}
                              >
                                {mounted && driverEmail && (
                                  <img 
                                    src={theme === 'dark' ? "/driver-dark.png" : "/driver-light.png"}
                                    alt="Driver" 
                                    className="w-4 h-4"
                                  />
                                )}
                                {tripStatus === 'cancelled' ? 'Trip cancelled' : driverEmail ? 'Driver assigned' : quotes.length > 0 ? 'Quoted' : sentDriverEmails.length > 0 ? 'Quote requested' : 'Request quote'}
                              </Button>
                              {quotes.length > 0 && !driverEmail && (
                                <span className="absolute -top-2 -right-2 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold text-white bg-[#9e201b] rounded-full">
                                  {quotes.length}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Vehicle Image and Info - Bottom */}
                        <div className="flex gap-6 items-end mt-8">
                          {/* Vehicle Image on the left */}
                          <img 
                            src="/sedan-driverbrief.svg" 
                            alt="Sedan Vehicle" 
                            className="h-32 w-auto flex-shrink-0"
                          />
                          
                          {/* Vehicle Info on the right */}
                          <div className="flex flex-col flex-1 min-w-0 pb-2">
                                <div className="flex items-center gap-3 mb-2">
                                  <Car className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                                  <span className="text-sm text-muted-foreground font-medium">Vehicle</span>
                                </div>
                                <p className="text-3xl font-semibold text-card-foreground break-words">
                                  {(() => {
                                    const carInfo = vehicleInfo || extractCarInfo(driverNotes);
                                    return carInfo || 'N/A';
                                  })()}
                                </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null;
                })()}

                {/* Trip Details Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Pickup Time Card */}
                  <Card className="shadow-none">
                    <CardContent className="p-5 h-full flex flex-col">
                      <div className="flex items-center gap-3 mb-2">
                        <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                        <span className="text-sm text-muted-foreground font-medium">Pickup Time</span>
                </div>
                      <p className="text-4xl font-semibold text-card-foreground">
                    {locations[0]?.time ? getLondonLocalTime(locations[0].time) : 'N/A'}
                  </p>
                </CardContent>
              </Card>

                  {/* Trip Duration Card */}
                  <Card className="shadow-none">
                    <CardContent className="p-5 h-full flex flex-col">
                      <div className="flex items-center gap-3 mb-2">
                        <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                        <span className="text-sm text-muted-foreground font-medium">Trip Duration</span>
                </div>
                      <p className="text-4xl font-semibold text-card-foreground">
                    {(() => {
                      if (locations && locations.length >= 2) {
                        const pickupTime = parseInt(locations[0]?.time) || 0;
                        const dropoffTime = parseInt(locations[locations.length - 1]?.time) || 0;
                        const duration = dropoffTime - pickupTime;
                        
                        if (duration > 0) {
                          const hours = Math.floor(duration);
                          const minutes = Math.round((duration - hours) * 60);
                          return `${hours}h ${minutes}m`;
                        } else {
                          return 'Same day';
                        }
                      }
                      return 'N/A';
                    })()}
                  </p>
                </CardContent>
              </Card>

              {/* Estimated Distance */}
              <Card className="shadow-none">
                <CardContent className="p-5 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-2">
                    <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                    <span className="text-sm text-muted-foreground font-medium">Estimated Distance</span>
                </div>
                  <p className="text-4xl font-semibold text-card-foreground">
                    {(() => {
                      // Check if traffic predictions exist and have the correct structure
                      if (trafficPredictions?.success && trafficPredictions.data && Array.isArray(trafficPredictions.data) && trafficPredictions.data.length > 0) {
                        // Calculate total distance from traffic predictions
                        const totalKm = trafficPredictions.data.reduce((total: number, route: any) => {
                          if (route.distance) {
                            // Parse distance (format: "5.2 km" or just number)
                            const distanceStr = typeof route.distance === 'string' ? route.distance : String(route.distance);
                            const distanceKm = parseFloat(distanceStr.replace(/[^\d.]/g, ''));
                            return total + (isNaN(distanceKm) ? 0 : distanceKm);
                          }
                          return total;
                        }, 0);
                        
                        // Convert km to miles (1 km = 0.621371 miles)
                        const totalMiles = totalKm * 0.621371;
                        return totalMiles > 0 ? totalMiles.toFixed(1) + ' miles' : 'Calculating...';
                      }
                      
                      // Fallback: try to use totalDistance from trafficPredictions if available
                      if (trafficPredictions?.totalDistance) {
                        const distanceStr = trafficPredictions.totalDistance;
                        const distanceKm = parseFloat(distanceStr.replace(/[^\d.]/g, ''));
                        if (!isNaN(distanceKm) && distanceKm > 0) {
                          const totalMiles = distanceKm * 0.621371;
                          return totalMiles.toFixed(1) + ' miles';
                        }
                      }
                      
                      return 'Calculating...';
                    })()}
                  </p>
                </CardContent>
              </Card>
                </div>

              </div>
          )}

          {/* Trip Locations */}
          {!isLiveMode && (
            <Card className="mb-6 shadow-none">
              <CardContent className="p-6">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <h3 className="text-xl font-semibold text-card-foreground">Trip Locations</h3>
                  
                  {/* Action Buttons - Right Side */}
                  <div className="flex items-center gap-2">
                    {/* Trip Breakdown Button */}
                    {(() => {
                      const now = new Date();
                      const tripDateTime = new Date(tripDate);
                      const oneHourBefore = new Date(tripDateTime.getTime() - 60 * 60 * 1000);
                      const isLiveTripActive = now >= oneHourBefore;
                      
                      return (
                        <Button
                          variant={isLiveTripActive ? "default" : "outline"}
                          size="sm"
                          className={`flex items-center gap-2 ${
                            isLiveTripActive 
                              ? 'bg-[#3ea34b] text-white hover:bg-[#359840] border-[#3ea34b]' 
                              : ''
                          }`}
                          onClick={() => {
                            if (isLiveMode) {
                              stopLiveTrip();
                            } else {
                              startLiveTrip();
                            }
                          }}
                        >
                          {isLiveTripActive ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                              <span>
                                {isLiveMode ? 'Stop Live Trip' : 'Live Trip'}
                              </span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                            Trip Breakdown
                          </>
                        )}
                        </Button>
                      );
                    })()}
                    
                    {/* View Map Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                      onClick={() => setShowMapModal(true)}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      View Map
                    </Button>
                  </div>
                </div>
            <div className="relative">
              {/* Connecting Line */}
              <div 
                className="absolute w-px bg-primary/30"
                style={{ 
                  height: `${(locations.length - 1) * 4.5}rem - 1.5rem`,
                  left: '0.75rem',
                  top: '0.75rem'
                }}
              ></div>
              
              {/* Transparent Line After Drop-off */}
              <div 
                className="absolute w-px bg-transparent"
                style={{ 
                  height: '1.5rem',
                  left: '0.75rem',
                  top: `${(locations.length - 1) * 4.5}rem`
                }}
              ></div>
              
              <div className="space-y-3">
                {locations.map((location: any, index: number) => (
                  <div key={location.id || index} id={`location-${index}`} className="flex items-start gap-3 relative z-10">
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold border-2 border-background ${
                      (isLiveMode && activeLocationIndex === index) || (!isLiveMode && isTripWithinOneHour() && findClosestLocation() === index)
                        ? 'animate-live-pulse text-white' 
                        : 'bg-primary text-primary-foreground'
                    }`}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start">
                        <div className="w-32 flex-shrink-0">
                          <div className="text-sm font-medium text-muted-foreground mb-1">
                            {index === 0 ? 'Pickup' : 
                             index === locations.length - 1 ? 'Drop-off' : 
                             'Resume at'}
                            {((isLiveMode && activeLocationIndex === index) || (!isLiveMode && isTripWithinOneHour() && findClosestLocation() === index)) && (
                              <span className="ml-2 px-2 py-1 text-xs font-bold text-white bg-[#3ea34b] rounded">
                                LIVE
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {getLondonLocalTime(location.time)}
                          </div>
                        </div>
                        <div className="flex-1 ml-12">
                          <button 
                            onClick={() => {
                              const address = location.formattedAddress || location.fullAddress || location.address || location.name;
                              const encodedAddress = encodeURIComponent(address);
                              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
                              
                              // Calculate center position for popup
                              const width = 800;
                              const height = 600;
                              const left = (screen.width - width) / 2;
                              const top = (screen.height - height) / 2;
                              
                              window.open(mapsUrl, '_blank', `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`);
                            }}
                            className="text-left hover:text-primary transition-colors cursor-pointer block w-full"
                            title={location.formattedAddress || location.fullAddress || location.address || location.name}
                          >
                            {(() => {
                              const fullAddr = location.formattedAddress || location.fullAddress || location.address || location.name;
                              const { businessName, restOfAddress } = formatLocationDisplay(fullAddr);
                              const flightMap = extractFlightNumbers(driverNotes);
                              
                              // Check if this location is an airport and has flight numbers
                              const isAirport = businessName.toLowerCase().includes('airport') || 
                                              businessName.toLowerCase().includes('heathrow') ||
                                              businessName.toLowerCase().includes('gatwick') ||
                                              businessName.toLowerCase().includes('stansted') ||
                                              businessName.toLowerCase().includes('luton');
                              
                              let displayBusinessName = businessName;
                              
                              if (isAirport && Object.keys(flightMap).length > 0) {
                                // Find matching airport in flight map
                                const matchingAirport = Object.keys(flightMap).find(airport => 
                                  businessName.toLowerCase().includes(airport.toLowerCase().replace(' airport', ''))
                                );
                                
                                if (matchingAirport && flightMap[matchingAirport].length > 0) {
                                  const flights = flightMap[matchingAirport].join(', ');
                                  displayBusinessName = `${businessName} for flight ${flights}`;
                                }
                              }
                              
                              return (
                                <div>
                                  <div className="text-lg font-semibold text-card-foreground">
                                    {displayBusinessName}
                                  </div>
                                  {restOfAddress && (
                                    <div className="text-sm text-muted-foreground mt-0.5">
                                      {restOfAddress}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
              </CardContent>
            </Card>
          )}

          {/* Exceptional Information */}
          {!isLiveMode && executiveReport?.exceptionalInformation && (
            <div 
              className={`sticky z-[59] transition-all duration-300 ${
                scrollY > 0 ? 'top-[146px]' : 'top-[203px]'
              }`}
            >
              <Card className="mb-6 shadow-none bg-[#9e2622] dark:bg-[#9e2622] border-[#9e2622] dark:border-[#9e2622]">
                <CardContent className="px-3 py-1 pl-6">
                  <div className="mb-3">
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="#f60000">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      Protocol alerts
                    </h3>
                  </div>
                  <div className="text-lg leading-snug text-white/95">
                    {executiveReport.exceptionalInformation?.split('\n').map((point: string, index: number) => (
                      <div key={index} className="flex items-start gap-2 mb-0.5">
                        <span className="text-white mt-0.5">-</span>
                        <span>{point.trim().replace(/^[-•*]\s*/, '')}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

              {/* Important Information */}
          {!isLiveMode && executiveReport?.importantInformation && (
            <Card className="mb-6 shadow-none">
              <CardContent className="px-3 py-1 pl-6">
                <div className="mb-3">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Operational notes
                  </h3>
                </div>
                <div className="text-lg leading-snug">
                  {executiveReport.importantInformation?.split('\n').map((point: string, index: number) => (
                    <div key={index} className="flex items-start gap-2 mb-0.5">
                      <span className="text-muted-foreground mt-0.5">-</span>
                      <span>{point.trim().replace(/^[-•*]\s*/, '')}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risk Score and Recommendations */}
          {!isLiveMode && executiveReport && (
            <div className="space-y-4 mb-6">
                    {/* Top row: Risk Score (33%) and Top Disruptor (66%) */}
                    <div className="flex gap-4">
                      {/* Risk Score - 33% width */}
                      <Card className="bg-primary dark:bg-[#1f1f21] w-1/3 flex-shrink-0">
                        <CardContent className="px-3 py-1 pl-6">
                          <h4 className="text-xl font-semibold text-primary-foreground dark:text-card-foreground mb-2">
                            Risk score
                          </h4>
                          <div className="bg-card border border-border rounded-md p-3 text-center">
                            <div 
                              className="text-5xl font-bold mb-1"
                              style={{
                                color: (() => {
                                  const riskScore = Math.max(0, executiveReport.tripRiskScore);
                                  if (riskScore <= 3) return '#3ea34b';
                                  if (riskScore <= 6) return '#db7304';
                                  return '#9e201b';
                                })()
                              }}
                            >
                              {Math.max(0, executiveReport.tripRiskScore)}
                            </div>
                            <div className="text-sm text-muted-foreground font-medium mb-2">
                              out of 10
                            </div>
                            <div 
                              className="text-sm font-semibold tracking-wide px-3 py-1 rounded"
                              style={{
                                backgroundColor: (() => {
                                  const riskScore = Math.max(0, executiveReport.tripRiskScore);
                                  if (riskScore <= 3) return '#3ea34b';
                                  if (riskScore <= 6) return '#db7304';
                                  return '#9e201b';
                                })(),
                                color: '#FFFFFF'
                              }}
                            >
                              {Math.max(0, executiveReport.tripRiskScore) <= 3 ? 'LOW RISK' :
                               Math.max(0, executiveReport.tripRiskScore) <= 6 ? 'MODERATE RISK' :
                               Math.max(0, executiveReport.tripRiskScore) <= 8 ? 'HIGH RISK' : 'CRITICAL RISK'}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      {/* Top Disruptor - 66% width */}
                      <Card className="bg-primary dark:bg-[#1f1f21] w-2/3 flex-shrink-0">
                        <CardContent className="px-3 py-1 pl-6">
                          <h4 className="text-xl font-semibold text-primary-foreground dark:text-card-foreground mb-3">
                            Top Disruptor
                          </h4>
                          <p className="text-lg text-primary-foreground/80 dark:text-muted-foreground leading-snug">
                            {executiveReport.topDisruptor}
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Bottom row: Recommendations for the Driver - full width */}
                    <Card className="shadow-none">
                      <CardContent className="px-3 py-1 pl-6">
                        <div className="mb-3">
                          <h4 className="text-xl font-semibold text-card-foreground">Recommendations for the Driver</h4>
                        </div>
                        <div className="text-lg leading-snug">
                          {executiveReport.recommendations.map((rec: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 mb-0.5">
                              <span className="text-muted-foreground mt-0.5">-</span>
                              <span>{rec}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
            </div>
          )}

          {/* Executive Report */}
          {executiveReport && !isLiveMode && (
            <>
              {/* Debug: Log executive report data */}
              {console.log('🔍 Executive Report Data:', executiveReport)}
              {console.log('🔍 Recommendations:', executiveReport.recommendations)}
              {console.log('🔍 Highlights:', executiveReport.highlights)}
              {console.log('🔍 Exceptional Info:', executiveReport.exceptionalInformation)}
              {console.log('🔍 Important Info:', executiveReport.importantInformation)}




            </>
          )}

          {/* Chronological Journey Flow */}
          {isLiveMode && (
            <div className="relative space-y-6" style={{ overflowAnchor: 'none' }}>
            {/* Back Button - Top Right */}
            <div className="sticky top-20 mb-6 flex justify-end z-20">
              <Button
                onClick={stopLiveTrip}
                size="lg"
                className="flex items-center gap-2 bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] hover:bg-[#05060A]/90 dark:hover:bg-[#E5E7EF]/90"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </Button>
            </div>
            {/* Connecting Line */}
            <div className="absolute left-6 w-0.5 bg-border" style={{ top: '4rem', bottom: 0 }}></div>
            {tripResults.map((result, index) => (
              <React.Fragment key={result.locationId}>
                {/* Location Hour Display */}
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-32 text-right relative">
                    {/* Timeline Dot for Location */}
                    <div className={`absolute left-2 top-0 w-8 h-8 rounded-full border-2 border-background flex items-center justify-center z-10 ${
                      isLiveMode && activeLocationIndex === index 
                        ? 'animate-live-pulse text-white' 
                        : 'bg-primary text-primary-foreground'
                    }`}>
                      <span className="text-base font-bold">{numberToLetter(index + 1)}</span>
                    </div>
                    <div className="text-base font-bold text-foreground ml-6">
                      {getLondonLocalTime(result.time)}
                    </div>
                    <div className="text-sm text-muted-foreground ml-2">
                      {index === 0 ? 'Pick up' : index === tripResults.length - 1 ? 'Drop off' : 'Resume'}
                      {isLiveMode && activeLocationIndex === index && (
                        <span className="ml-2 px-2 py-1 text-xs font-bold text-white rounded bg-[#3ea34b]">
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>
                <div className="flex-1">
              <div key={result.locationId} id={`trip-breakdown-${index}`} className="rounded-md p-3 border border-border bg-background dark:bg-[#363636] text-foreground">
                {/* Header with Full Address */}
                <div className="flex items-center justify-between mb-2 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="relative" style={{ width: '30px', height: '35px' }}>
                      <svg 
                        viewBox="0 0 24 24" 
                        className="fill-foreground stroke-background"
                        strokeWidth="1.5"
                        style={{ width: '100%', height: '100%' }}
                      >
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: '4px' }}>
                        <span className="font-bold text-xs text-background">
                          {numberToLetter(index + 1)}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      
                       {/* Editable Location Name - Only for owners */}
                      {isOwner && editingLocationId === result.locationId ? (
                        <Input
                          ref={inputRef}
                          value={editingLocationName}
                          onChange={(e) => setEditingLocationName(e.target.value)}
                          onKeyDown={(e) => handleKeyPress(e, result.locationId)}
                          onBlur={() => handleSaveLocationName(result.locationId)}
                           className="text-base font-semibold bg-background/20 border-primary-foreground/30 text-primary-foreground mt-1 mb-1"
                           placeholder="Enter location name"
                          autoFocus
                        />
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                           <p className="text-base font-semibold text-foreground">
                             {locationDisplayNames[result.locationId] || `Stop ${index + 1}`}
                          </p>
                          {/* Only show edit button for owners */}
                          {isOwner && (
                            <button
                               onClick={() => handleEditLocationName(result.locationId, `Stop ${index + 1}`)}
                              className="p-1 hover:bg-muted rounded transition-colors"
                               title="Edit location name"
                            >
                              <svg className="w-4 h-4 text-muted-foreground hover:text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                      
                      {/* Full Address with Flight Info - Formatted */}
                      <div className="mt-1">
                        {(() => {
                          const fullAddr = result.fullAddress || result.locationName;
                          const { businessName, restOfAddress } = formatLocationDisplay(fullAddr);
                          const flightMap = extractFlightNumbers(driverNotes);
                          
                          // Check if this location is an airport and has flight numbers
                          const isAirport = businessName.toLowerCase().includes('airport') || 
                                          businessName.toLowerCase().includes('heathrow') ||
                                          businessName.toLowerCase().includes('gatwick') ||
                                          businessName.toLowerCase().includes('stansted') ||
                                          businessName.toLowerCase().includes('luton');
                          
                          let displayBusinessName = businessName;
                          
                          if (isAirport && Object.keys(flightMap).length > 0) {
                            // Find matching airport in flight map
                            const matchingAirport = Object.keys(flightMap).find(airport => 
                              businessName.toLowerCase().includes(airport.toLowerCase().replace(' airport', ''))
                            );
                            
                            if (matchingAirport && flightMap[matchingAirport].length > 0) {
                              const flights = flightMap[matchingAirport].join(', ');
                              displayBusinessName = `${businessName} for flight ${flights}`;
                            }
                          }
                          
                          return (
                            <>
                              <p className="text-sm font-semibold text-foreground">
                                {displayBusinessName}
                              </p>
                              {restOfAddress && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {restOfAddress}
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Safety, Cafes, Parking Info */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#3ea34b]"></span>
                        <span>Safety: {result.data.crime.safetyScore}/100</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span>{result.data.cafes?.summary.total || 0} Cafes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                        <span>{result.data.parking?.carParks?.length || 0} Parking</span>
                      </div>
                    </div>
                    
                    {/* Expand/Collapse Button */}
                    <button
                      onClick={() => toggleLocationExpansion(result.locationId)}
                      className="p-2 hover:bg-muted rounded transition-colors"
                      title={expandedLocations[result.locationId] ? "Collapse details" : "Expand details"}
                    >
                      <svg 
                        className={`w-5 h-5 text-foreground transition-transform ${expandedLocations[result.locationId] ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>


                {/* All Information Cards - Single Row - Only when expanded */}
                <div 
                  className={`overflow-hidden transition-all duration-500 ease-in-out ${
                    expandedLocations[result.locationId] ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                  {/* Traveller Safety */}
                  <div 
                    className="border border-border/40 rounded-md p-3"
                      style={{
                        backgroundColor: (() => {
                          const safetyScore = result.data.crime.safetyScore;
                          if (safetyScore >= 60) return '#3ea34b'; // Success green ([#3ea34b])
                          if (safetyScore >= 40) return '#db7304'; // Warning orange
                          return '#9e201b'; // Error red
                        })(),
                        borderColor: (() => {
                          const safetyScore = result.data.crime.safetyScore;
                          if (safetyScore >= 60) return '#3ea34b'; // Green-500
                          if (safetyScore >= 40) return '#db7304'; // Orange
                          return '#9e201b'; // Error red
                        })()
                      }}
                  >
                    <h4 className="font-bold text-foreground mb-2">Traveller Safety</h4>
                    <div className="flex items-center gap-2 mb-2">
                      {(() => {
                        const safetyScore = result.data.crime.safetyScore;
                        if (safetyScore >= 80) {
                          return (
                            <>
                              <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-foreground">Very Safe</div>
                                <div className="text-xs text-muted-foreground">Low crime area with excellent safety record</div>
                              </div>
                            </>
                          );
                        } else if (safetyScore >= 60) {
                          return (
                            <>
                              <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-foreground">Safe</div>
                                <div className="text-xs text-muted-foreground">Generally safe with minimal concerns</div>
                              </div>
                            </>
                          );
                        } else if (safetyScore >= 40) {
                          return (
                            <>
                              <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-foreground">Moderate</div>
                                <div className="text-xs text-muted-foreground">Mixed safety profile, stay aware</div>
                              </div>
                            </>
                          );
                        } else if (safetyScore >= 20) {
                          return (
                            <>
                              <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-foreground">Caution Advised</div>
                                <div className="text-xs text-muted-foreground">Higher crime area, extra caution needed</div>
                              </div>
                            </>
                          );
                        } else {
                          return (
                            <>
                              <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-foreground">High Alert</div>
                                <div className="text-xs text-muted-foreground">High crime area, avoid if possible</div>
                              </div>
                            </>
                          );
                        }
                      })()}
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground font-medium mb-1">
                        These are the 3 most common crimes in this area. Be aware.
                      </div>
                      {result.data.crime.summary.topCategories
                        .filter(cat => !cat.category.toLowerCase().includes('other'))
                        .slice(0, 3)
                        .map((cat, idx) => (
                          <div key={idx} className="text-xs text-muted-foreground">
                            {(() => {
                              const category = cat.category.toLowerCase();
                              if (category.includes('violence')) return 'Violence and assault incidents';
                              if (category.includes('theft')) return 'Theft and burglary cases';
                              if (category.includes('robbery')) return 'Robbery and street crime';
                              if (category.includes('vehicle')) return 'Vehicle-related crimes';
                              if (category.includes('drug')) return 'Drug-related offenses';
                              if (category.includes('criminal damage')) return 'Criminal damage and vandalism';
                              if (category.includes('public order')) return 'Public order disturbances';
                              if (category.includes('burglary')) return 'Burglary and break-ins';
                              if (category.includes('shoplifting')) return 'Shoplifting incidents';
                              if (category.includes('anti-social')) return 'Anti-social behavior';
                              return cat.category;
                            })()}
                          </div>
                        ))}
                    </div>
                    
                    {/* Emergency Services Links */}
                    <div className="mt-3 pt-3 border-t border-primary-foreground/20 space-y-2">
                      {result.data.emergencyServices?.policeStation ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(result.data.emergencyServices.policeStation.name)}&query_place_id=${result.data.emergencyServices.policeStation.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between text-xs text-foreground hover:underline"
                        >
                          <div>
                            <div className="font-medium">Closest Police Station</div>
                            <div className="text-muted-foreground">{Math.round(result.data.emergencyServices.policeStation.distance)}m away</div>
                          </div>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : (
                        <a
                          href={`https://www.google.com/maps/search/police+station+near+${encodeURIComponent(result.locationName)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between text-xs text-foreground hover:underline"
                        >
                          <span className="font-medium">Closest Police Station</span>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}

                      {result.data.emergencyServices?.hospital ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(result.data.emergencyServices.hospital.name)}&query_place_id=${result.data.emergencyServices.hospital.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between text-xs text-foreground hover:underline"
                        >
                          <div>
                            <div className="font-medium">Closest Hospital</div>
                            <div className="text-muted-foreground">{Math.round(result.data.emergencyServices.hospital.distance)}m away</div>
                          </div>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : (
                        <a
                          href={`https://www.google.com/maps/search/hospital+near+${encodeURIComponent(result.locationName)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between text-xs text-foreground hover:underline"
                        >
                          <span className="font-medium">Closest Hospital</span>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Potential Disruptive Events */}
                  <div className="bg-muted/30 border border-border rounded-md p-3">
                    <h4 className="font-bold text-foreground mb-3">Potential Disruptive Events</h4>
                    {result.data.events.events.length > 0 ? (
                      <>
                        <div className="space-y-2 mb-3">
                          {result.data.events.events.slice(0, 3).map((event: any, idx: number) => (
                            <div key={idx} className="text-xs text-muted-foreground">
                              • {event.title}
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground italic pt-2 border-t border-border">
                          {result.data.events.summary.total === 1 
                            ? 'This event will be in the area. It might affect the trip. Be aware.'
                            : `These ${result.data.events.summary.total} events will be in the area. They might affect the trip. Be aware.`}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground">No events found</div>
                    )}
                  </div>

                  {/* Nearby Cafes & Parking */}
                  <div className="bg-muted/30 border border-border rounded-md p-3">
                    <h4 className="font-bold text-foreground mb-3">Nearby Cafes & Parking</h4>
                    
                    {/* Cafes Section */}
                    <div className="mb-4">
                      <h5 className="text-sm font-semibold text-foreground mb-2">Cafes</h5>
                    <div className="space-y-2">
                      {result.data.cafes?.cafes && result.data.cafes.cafes.length > 0 ? (
                        result.data.cafes.cafes
                          .filter((cafe: any) => {
                            // Calculate if cafe is open (location time - 20 minutes)
                            const locationTime = new Date(`${tripDate} ${result.time}`);
                            const checkTime = new Date(locationTime.getTime() - 20 * 60000); // Subtract 20 minutes
                            const currentHour = checkTime.getHours();
                            const currentMinute = checkTime.getMinutes();
                            const currentTimeMinutes = currentHour * 60 + currentMinute;
                            
                            // Simple business hours check (assuming 7 AM - 10 PM)
                            return currentTimeMinutes >= 420 && currentTimeMinutes <= 1320; // 7 AM to 10 PM
                          })
                            .slice(0, 2)
                          .map((cafe: any, idx: number) => {
                            return (
                              <div key={idx} className="text-xs text-primary-foreground/70 border-b border-background/20 pb-1 last:border-b-0">
                                <div className="flex items-center justify-between mb-1">
                                  <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cafe.name + ' ' + result.locationName.split(',')[0])}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-primary-foreground hover:text-ring transition-colors truncate"
                                  >
                                    {cafe.name.length > 20 ? cafe.name.substring(0, 20) + '...' : cafe.name}
                                  </a>
                                  <div className="text-xs font-medium text-[#3ea34b]">
                                    Open
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1">
                                    <span className="text-ring">★</span>
                                    <span>{cafe.rating}/5</span>
                                    <span className="text-primary-foreground/60">({cafe.userRatingsTotal})</span>
                                  </div>
                                  <div className="text-xs text-primary-foreground/60">
                                  {Math.round(cafe.distance)}m away
                                    </div>
                                </div>
                              </div>
                            );
                          })
                      ) : (
                        <div className="text-xs text-primary-foreground/70">No cafes found</div>
                      )}
                    </div>
                  </div>

                    {/* Parking Section */}
                    <div>
                      <h5 className="text-sm font-semibold text-primary-foreground mb-2">Parking</h5>
                      <div className="text-xs text-primary-foreground/80 mb-2">
                      {result.data.parking?.cpzInfo?.inCPZ ? 'CPZ Zone - Charges Apply' :
                       (result.data.parking?.parkingRiskScore || 5) >= 7 ? 'Limited Street Parking' : 'Good Parking Options'}
                    </div>
                    <div className="space-y-2">
                      {result.data.parking?.carParks && result.data.parking.carParks.length > 0 ? (
                          result.data.parking.carParks.slice(0, 2).map((carPark: any, idx: number) => (
                          <div key={idx} className="text-xs text-primary-foreground/70 border-b border-background/20 pb-1 last:border-b-0">
                            <div className="flex items-center justify-between mb-1">
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(carPark.name + ' ' + result.locationName.split(',')[0])}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-primary-foreground hover:text-ring transition-colors truncate"
                              >
                                {carPark.name.length > 20 ? carPark.name.substring(0, 20) + '...' : carPark.name}
                              </a>
                              <div className="text-xs text-primary-foreground/60">
                                {Math.round(carPark.distance)}m
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <span>{carPark.operatingHours || '24/7'}</span>
                                {carPark.totalSpaces && (
                                  <span className="text-primary-foreground/60">({carPark.totalSpaces} spaces)</span>
                                )}
                              </div>
                              <div className="text-xs text-primary-foreground/60 text-right">
                                {carPark.facilities && carPark.facilities.length > 0 
                                  ? carPark.facilities.slice(0, 2).join(', ')
                                  : 'Standard'}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                          <div className="text-xs text-primary-foreground/70">No parking data available</div>
                      )}
                      {result.data.parking?.cpzInfo?.inCPZ && (
                        <div className="text-xs text-destructive-foreground border-t border-background/20 pt-1 mt-1">
                          <div className="font-semibold">CPZ: {result.data.parking.cpzInfo.zoneName || 'Controlled Zone'}</div>
                          <div>{result.data.parking.cpzInfo.operatingHours || 'Mon-Sat 8:30am-6:30pm'}</div>
                          {result.data.parking.cpzInfo.chargeInfo && (
                            <div>{result.data.parking.cpzInfo.chargeInfo}</div>
                          )}
                        </div>
                      )}
                      </div>
                    </div>
                  </div>

                  </div>
                </div>
                  </div>
                </div>
              </div>

              {/* Route Card (after each location except the last) */}
              {index < tripResults.length - 1 && trafficPredictions?.success && trafficPredictions.data && Array.isArray(trafficPredictions.data) && trafficPredictions.data[index] && (
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-32 text-right relative">
                    {/* Timeline Dot for Route */}
                    <div className="absolute left-2 top-0 w-8 h-8 rounded-full bg-card border-2 border-border flex items-center justify-center z-10">
                      <span className="text-base font-bold text-card-foreground">→</span>
                    </div>
                    <div className="text-base font-bold text-foreground ml-6">
                      {getLondonLocalTime(result.time)}
                    </div>
                    <div className="text-sm text-muted-foreground ml-2">
                      Route
                    </div>
                  </div>
                  <div className="flex-1">
                <div 
                  className="bg-card rounded-md p-8 border border-border/40"
                >
                  {/* Route Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl font-bold text-card-foreground flex items-center gap-2">
                        <span>Route: {numberToLetter(index + 1)}</span>
                        <span 
                          className="inline-block text-lg"
                        >
                          →
                        </span>
                        <span>{numberToLetter(index + 2)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div 
                        className="px-4 py-2 rounded-lg font-semibold"
                        style={{
                          backgroundColor: (() => {
                            const leg = trafficPredictions?.data?.[index];
                            if (!leg) return '#808080'; // Default gray if no data
                            const delay = Math.max(0, (leg.minutes || 0) - (leg.minutesNoTraffic || 0));
                            if (delay < 5) return '#3ea34b'; // Success green ([#3ea34b])
                            if (delay < 10) return '#db7304'; // Warning orange
                            return '#9e201b'; // Error red (white text)
                          })(),
                          color: '#FFFFFF'
                        }}
                      >
                        {(() => {
                          const leg = trafficPredictions?.data?.[index];
                          if (!leg) return 'Delay Risk: Unknown';
                          const delay = Math.max(0, (leg.minutes || 0) - (leg.minutesNoTraffic || 0));
                          if (delay < 5) return 'Delay Risk: Low';
                          if (delay < 10) return 'Delay Risk: Moderate';
                          return 'Delay Risk: High';
                        })()}
                      </div>
                      
                      {/* Expand/Collapse Button */}
                      <button
                        onClick={() => toggleRouteExpansion(`route-${index}`)}
                        className="p-2 hover:bg-secondary/50 dark:hover:bg-[#181a23] rounded transition-colors"
                        title={expandedRoutes[`route-${index}`] ? "Collapse details" : "Expand details"}
                      >
                        <svg 
                          className={`w-5 h-5 text-card-foreground transition-transform ${expandedRoutes[`route-${index}`] ? 'rotate-180' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Collapsed Summary */}
                  <div 
                      className={`overflow-hidden transition-all duration-500 ease-in-out ${
                        !expandedRoutes[`route-${index}`] ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
                      }`}
                  >
                    <div className="flex items-center justify-between text-sm text-muted-foreground py-3">
                      <div className="flex items-center gap-4">
                        {trafficPredictions.data[index] && (
                          <>
                            <div className="flex items-center gap-1">
                              <span className="text-card-foreground font-medium">Time:</span>
                              <span>{trafficPredictions.data[index].minutes || 0} min</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-card-foreground font-medium">Distance:</span>
                              <span>{trafficPredictions.data[index].distance || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-card-foreground font-medium">Delay:</span>
                              <span>-{Math.max(0, (trafficPredictions.data[index].minutes || 0) - (trafficPredictions.data[index].minutesNoTraffic || 0))} min</span>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground/60">
                        Click to expand
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Details */}
                  <div 
                    className={`overflow-hidden transition-all duration-500 ease-in-out ${
                      expandedRoutes[`route-${index}`] ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="pt-2">

                  {/* Route Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Left Column - Google Maps Route Preview */}
                    <div className="rounded-lg overflow-hidden h-[200px] border border-border">
                      <GoogleTripMap 
                        height="200px"
                        compact={true}
                        tripDestination={tripDestination}
                        locations={[
                          {
                            id: tripResults[index].locationId,
                            name: tripResults[index].locationName,
                            // Use weather coordinates (universal) instead of crime (London-only, 0,0 for other cities)
                            lat: result.data.weather.coordinates.lat,
                            lng: result.data.weather.coordinates.lng,
                            time: tripResults[index].time,
                            safetyScore: result.data.crime.safetyScore,
                          },
                          {
                            id: tripResults[index + 1].locationId,
                            name: tripResults[index + 1].locationName,
                            // Use weather coordinates (universal) instead of crime (London-only, 0,0 for other cities)
                            lat: tripResults[index + 1].data.weather.coordinates.lat,
                            lng: tripResults[index + 1].data.weather.coordinates.lng,
                            time: tripResults[index + 1].time,
                            safetyScore: tripResults[index + 1].data.crime.safetyScore,
                          }
                        ]}
                      />
                    </div>
                    
                    {/* Right Column - Address Details */}
                    <div>
                      <div className="space-y-2">
                        <div className="text-sm">
                          <span className="font-semibold text-muted-foreground">From: </span>
                          <span className="text-card-foreground">{tripResults[index].locationName}</span>
                        </div>
                        <div className="text-sm">
                          <span className="font-semibold text-muted-foreground">To: </span>
                          <span className="text-card-foreground">{tripResults[index + 1].locationName}</span>
                        </div>
                      </div>
                      {trafficPredictions?.data?.[index]?.busyMinutes && (
                        <div className="text-sm text-destructive mt-3 pt-3 border-t border-border/30">
                          Busy traffic expected: -{Math.max(0, (trafficPredictions.data[index].busyMinutes || 0) - (trafficPredictions.data[index].minutesNoTraffic || 0))} min additional delay
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Route Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <div 
                      className="rounded-lg p-4"
                      style={{
                        backgroundColor: (() => {
                          const leg = trafficPredictions?.data?.[index];
                          if (!leg) return 'rgba(128, 128, 128, 0.2)'; // Gray if no data
                          const delay = Math.max(0, (leg.minutes || 0) - (leg.minutesNoTraffic || 0));
                          if (delay < 5) return 'rgba(62, 163, 75, 0.2)'; // Green-500 with opacity
                          if (delay < 10) return 'rgba(219, 115, 4, 0.2)'; // Orange #db7304 with opacity
                          return 'rgba(158, 32, 27, 0.2)'; // Red #9e201b with opacity
                        })()
                      }}
                    >
                      <div 
                        className="text-sm mb-1"
                        style={{
                          color: (() => {
                            const leg = trafficPredictions?.data?.[index];
                            if (!leg) return '#808080'; // Gray if no data
                            const delay = Math.max(0, (leg.minutes || 0) - (leg.minutesNoTraffic || 0));
                            if (delay < 5) return '#3ea34b'; // Success green ([#3ea34b])
                            if (delay < 10) return '#db7304'; // Warning orange
                            return '#9e201b'; // Error red - light bg
                          })()
                        }}
                      >
                        Traffic Delay
                      </div>
                      <div 
                        className="text-2xl font-bold"
                        style={{
                          color: (() => {
                            const leg = trafficPredictions?.data?.[index];
                            if (!leg) return '#808080'; // Gray if no data
                            const delay = Math.max(0, (leg.minutes || 0) - (leg.minutesNoTraffic || 0));
                            if (delay < 5) return '#3ea34b'; // Success green ([#3ea34b])
                            if (delay < 10) return '#db7304'; // Warning orange
                            return '#9e201b'; // Error red - light bg
                          })()
                        }}
                      >
                        -{(() => {
                          const leg = trafficPredictions?.data?.[index];
                          if (!leg) return '0';
                          return Math.max(0, (leg.minutes || 0) - (leg.minutesNoTraffic || 0));
                        })()} min
                      </div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">Travel Time</div>
                      <div className="text-2xl font-bold text-card-foreground">
                        {trafficPredictions?.data?.[index]?.minutes || 0} min
                      </div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">Distance</div>
                      <div className="text-2xl font-bold text-card-foreground">
                        {trafficPredictions?.data?.[index]?.distance || 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Road Closures */}
                  {result.data.disruptions.disruptions.length > 0 && (
                    <div className="bg-secondary/30 rounded-lg p-4 mt-4">
                      <div className="text-sm font-semibold mb-3 text-card-foreground">Road Closures</div>
                      <div className="space-y-2 mb-3">
                        {result.data.disruptions.disruptions.slice(0, 2).map((disruption: any, idx: number) => (
                          <div key={idx} className="text-xs">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(disruption.location)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-card-foreground hover:underline flex items-center gap-1"
                            >
                              {disruption.location}
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                            <div className="text-destructive mt-1">{disruption.severity}</div>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground italic pt-2 border-t border-border/30">
                        Data from Transport for London
                      </div>
                    </div>
                  )}
                  
                    </div>
                  </div>
                    </div>
                  </div>
                </div>
              )}
              </React.Fragment>
            ))}
          </div>
          )}

        </div>

        {/* Request Quotes from Drivers - Now only in modal */}
        {false && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Request Quotes from Drivers</h2>
              
              <p className="text-muted-foreground mb-6">
                Invite drivers to submit quotes for this trip. Each driver will receive an email with the trip details.
              </p>
              
              {quoteRequestSuccess && (
                <Alert className="mb-4 bg-[#3ea34b]/10 border-[#3ea34b]/30">
                  <AlertDescription className="text-[#3ea34b]">
                    ✅ {quoteRequestSuccess}
                  </AlertDescription>
                </Alert>
              )}
              
              {quoteRequestError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{quoteRequestError}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label htmlFor="allocate-driver-email" className="block text-sm font-medium mb-2">
                      Driver Email Address
                    </label>
                    <Input
                      id="allocate-driver-email"
                      type="email"
                      value={allocateDriverEmail}
                      onChange={(e) => setAllocateDriverEmail(e.target.value)}
                      placeholder="driver@company.com"
                      disabled={sendingQuoteRequest}
                      className={allocateDriverEmailError ? 'border-destructive' : ''}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && allocateDriverEmail && !sendingQuoteRequest) {
                          handleSendQuoteRequest();
                        }
                      }}
                    />
                    {allocateDriverEmailError && (
                      <p className="text-sm text-destructive mt-1">{allocateDriverEmailError}</p>
                    )}
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => handleSendQuoteRequest(allocateDriverEmail)}
                      disabled={sendingQuoteRequest || !allocateDriverEmail}
                      className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                    >
                      {sendingQuoteRequest ? (
                        <>
                          <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Sending...
                        </>
                      ) : (
                        'Request Quote'
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* List of sent invitations */}
                {sentDriverEmails.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="text-sm font-semibold mb-3">Sent ({sentDriverEmails.length})</h3>
                    <div className="space-y-2">
                      {sentDriverEmails.map((sent, index) => {
                        const hasQuote = quotes.some(q => q.email.toLowerCase() === sent.email.toLowerCase());
                        return (
                          <div 
                            key={index} 
                            className="flex items-center justify-between p-3 rounded-md bg-secondary/50 border border-[#3ea34b]"
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium">{sent.email}</p>
                            </div>
                            <div className="text-right flex-shrink-0 ml-4">
                              <p className="text-xs text-muted-foreground">
                                Sent {new Date(sent.sentAt).toLocaleDateString()} at {new Date(sent.sentAt).toLocaleTimeString()}
                              </p>
                            </div>
                            {hasQuote && (
                              <span className="px-2 py-1 text-xs font-bold text-white bg-[#3ea34b] rounded">
                                QUOTE RECEIVED
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quotes Table - Now only in modal */}
        {false && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Received Quotes</h2>
              {loadingQuotes ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="ml-2 text-muted-foreground">Loading quotes...</span>
                </div>
              ) : quotes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No quotes received yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold text-sm">Email</th>
                        <th className="text-right py-3 px-4 font-semibold text-sm">Price</th>
                        <th className="text-left py-3 px-4 font-semibold text-sm">Currency</th>
                        <th className="text-left py-3 px-4 font-semibold text-sm">Date</th>
                        <th className="text-center py-3 px-4 font-semibold text-sm">Driver</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map((quote) => {
                        const isDriver = driverEmail && driverEmail.toLowerCase() === quote.email.toLowerCase();
                        return (
                          <tr 
                            key={quote.id} 
                            className={`border-b hover:bg-secondary/50 dark:hover:bg-[#181a23] transition-colors ${
                              isDriver ? 'bg-[#3ea34b]/10 border-[#3ea34b]/30' : ''
                            }`}
                          >
                            <td className="py-3 px-4 text-sm">
                              {quote.email}
                              {isDriver && (
                                <span className="ml-2 px-2 py-1 text-xs font-bold text-white bg-[#3ea34b] rounded">
                                  DRIVER
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm text-right font-medium">
                              {quote.price.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-sm">{quote.currency}</td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {new Date(quote.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Button
                                size="sm"
                                variant={isDriver ? "outline" : "default"}
                                onClick={() => handleSetDriver(quote.email)}
                                disabled={settingDriver}
                                className={isDriver ? "border-[#3ea34b] text-[#3ea34b] hover:bg-[#3ea34b]/10" : ""}
                              >
                                {settingDriver ? (
                                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                ) : isDriver ? (
                                  '✓ Assigned'
                                ) : (
                                  'Assign Driver'
                                )}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Manual Driver Form - shown always for owners */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-lg font-semibold mb-4">Add Driver Manually</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Set a driver email address manually. Personal emails (Gmail, Yahoo, etc.) are accepted.
                </p>
                
                {manualDriverError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{manualDriverError}</AlertDescription>
                  </Alert>
                )}
                
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="email"
                      value={manualDriverEmail}
                      onChange={(e) => handleManualDriverInputChange(e.target.value)}
                      onFocus={handleManualDriverInputFocus}
                      onBlur={() => setTimeout(() => setShowDriverSuggestions(false), 200)}
                      placeholder="driver@gmail.com or driver@company.com"
                      disabled={settingDriver}
                      className={manualDriverError ? 'border-destructive' : ''}
                    />
                    
                    {/* Autocomplete Dropdown */}
                    {showDriverSuggestions && filteredDriverSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                        {filteredDriverSuggestions.map((driver, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleSelectDriverSuggestion(driver)}
                            className="w-full text-left px-4 py-2 hover:bg-secondary/50 dark:hover:bg-[#181a23] transition-colors text-sm border-b last:border-b-0"
                          >
                            <div className="flex items-center justify-between">
                              <span>{driver}</span>
                              {driverEmail && driverEmail.toLowerCase() === driver.toLowerCase() && (
                                <span className="text-xs px-2 py-1 bg-[#3ea34b] text-white rounded">
                                  Current
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Show message when no suggestions match */}
                    {showDriverSuggestions && manualDriverEmail.trim().length > 0 && filteredDriverSuggestions.length === 0 && driverSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg p-4">
                        <p className="text-sm text-muted-foreground">No matching drivers found</p>
                      </div>
                    )}
                  </div>
                  
                  <Button
                    onClick={() => handleSetDriver(manualDriverEmail)}
                    disabled={settingDriver || !manualDriverEmail.trim()}
                    className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                  >
                    {settingDriver ? (
                      <>
                        <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Setting...
                      </>
                    ) : (
                      'Set as Driver'
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Driver Confirmation Card - Token validation error */}
        {!isOwner && tokenValidationError && (
          <Card className="mb-8 border-2 border-red-500 shadow-lg">
            <CardContent className="p-6">
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>
                  ⚠️ {tokenValidationError}
                </AlertDescription>
              </Alert>
              <p className="text-muted-foreground">
                This link may have expired or already been used. Please contact the trip owner if you need a new invitation.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Driver Confirmation Card - Magic Link Flow (Token-based) */}
        {!isOwner && isDriverView && validatedDriverEmail && (
          <Card className={`mb-8 border-2 shadow-lg ${
            !canTakeAction ? 'border-gray-400' : 'border-[#e77500]'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                  !canTakeAction ? 'bg-gray-100' : 'bg-[#e77500]/10'
                }`}>
                  <svg
                    className={`w-6 h-6 ${!canTakeAction ? 'text-gray-500' : 'text-[#e77500]'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={!canTakeAction ? "M5 13l4 4L19 7" : "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"}
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold">
                    {!canTakeAction ? 'Trip status update' : 'Trip confirmation required'}
                  </h2>
                  <p className="text-muted-foreground">
                    {!canTakeAction ? 'You\'ve already responded to this trip' : 'You\'ve been assigned to this trip'}
                  </p>
                </div>
              </div>
              
              {canTakeAction ? (
                <>
                  <Alert className="mb-4 bg-[#e77500]/10 border-[#e77500]/30">
                    <AlertDescription className="text-[#e77500] font-medium">
                      ⏱️ This trip is waiting for your confirmation
                    </AlertDescription>
                  </Alert>
                  
                  <div className="mb-6">
                    <p className="text-muted-foreground mb-4">
                      Please confirm your availability for this trip. The trip owner will be notified of your decision.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-sm">
                        <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-muted-foreground">Assigned to:</span>
                        <span className="font-medium">{validatedDriverEmail}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      onClick={handleDriverConfirmTrip}
                      disabled={confirmingTrip || rejectingTrip}
                      className="flex-1 bg-[#3ea34b] hover:bg-[#3ea34b]/90 text-white"
                      size="lg"
                    >
                      {confirmingTrip ? (
                        <>
                          <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Confirming...
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-5 h-5 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Confirm trip
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => setShowDriverRejectDialog(true)}
                      disabled={confirmingTrip || rejectingTrip}
                      variant="outline"
                      className="flex-1 border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                      size="lg"
                    >
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      Reject trip
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Alert className={`mb-4 ${
                    tripStatus === 'confirmed' 
                      ? 'bg-[#3ea34b]/10 border-[#3ea34b]/30' 
                      : tripStatus === 'rejected'
                      ? 'bg-red-500/10 border-red-500/30'
                      : tripStatus === 'cancelled'
                      ? 'bg-gray-500/10 border-gray-500/30'
                      : 'bg-blue-500/10 border-blue-500/30'
                  }`}>
                    <AlertDescription className={`font-medium ${
                      tripStatus === 'confirmed' 
                        ? 'text-[#3ea34b]' 
                        : tripStatus === 'rejected'
                        ? 'text-red-600'
                        : tripStatus === 'cancelled'
                        ? 'text-gray-600'
                        : 'text-blue-600'
                    }`}>
                      {tripStatus === 'confirmed' && '✅ You have confirmed this trip'}
                      {tripStatus === 'rejected' && '❌ You have rejected this trip'}
                      {tripStatus === 'cancelled' && '🚫 This trip has been cancelled'}
                      {tokenMessage && !['confirmed', 'rejected', 'cancelled'].includes(tripStatus) && `ℹ️ ${tokenMessage}`}
                    </AlertDescription>
                  </Alert>
                  
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm mb-3">
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-muted-foreground">Assigned to:</span>
                      <span className="font-medium">{validatedDriverEmail}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {tripStatus === 'confirmed' && 'The trip owner has been notified of your acceptance.'}
                      {tripStatus === 'rejected' && 'The trip owner has been notified that you declined.'}
                      {tripStatus === 'cancelled' && 'The trip owner has cancelled this trip.'}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Driver Confirmation Card - Email-based Flow (Old flow for backward compatibility) */}
        {!isOwner && !isDriverView && tripStatus === 'pending' && driverEmail && quoteEmail && 
         driverEmail.toLowerCase().trim() === quoteEmail.toLowerCase().trim() && (
          <Card className="mb-8 border-2 border-[#e77500] shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#e77500]/10 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-[#e77500]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Trip confirmation required</h2>
                  <p className="text-muted-foreground">You've been assigned to this trip</p>
                </div>
              </div>
              
              <Alert className="mb-4 bg-[#e77500]/10 border-[#e77500]/30">
                <AlertDescription className="text-[#e77500] font-medium">
                  ⏱️ This trip is waiting for your confirmation
                </AlertDescription>
              </Alert>
              
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  To confirm your availability for this trip:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
                  <li>Enter your email address in the form below (if you haven't already)</li>
                  <li>Click the orange <strong className="text-[#e77500]">"Pending"</strong> button at the top of the page</li>
                  <li>Confirm when prompted</li>
                </ol>
                <p className="text-sm text-muted-foreground mt-4">
                  💡 The trip owner will be notified once you confirm.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quote Submission Form - REMOVED - Now sticky at top for non-owners */}

        {/* Guest Signup CTA - Only for guests who created this report */}
        {isGuestCreator && !guestSignupSuccess && (
          <Card className="mb-8 border border-primary/60 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="p-8">
              <div className="max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-center mb-3">
                  🎉 Want to save this report and access it anytime?
                </h2>
                <p className="text-center text-muted-foreground mb-6">
                  Create an account now to unlock powerful features
                </p>
                
                {/* Benefits Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Edit trips anytime</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Share with links</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Get driver quotes</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Password protect</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Notify drivers</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Save all trips</span>
                  </div>
                </div>

                {/* Signup Form */}
                <form onSubmit={handleGuestSignup} className="space-y-4">
                  <div>
                    <label htmlFor="guest-email" className="block text-sm font-medium mb-2">
                      Email Address
                    </label>
                    <Input
                      id="guest-email"
                      type="email"
                      value={tripData?.userEmail || ''}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      We already have your email from when you created this report
                    </p>
                  </div>

                  <div>
                    <label htmlFor="guest-password" className="block text-sm font-medium mb-2">
                      Create Password
                    </label>
                    <Input
                      id="guest-password"
                      type="password"
                      value={guestSignupPassword}
                      onChange={(e) => setGuestSignupPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      disabled={guestSignupLoading}
                      className={guestSignupError ? 'border-destructive' : ''}
                    />
                    {guestSignupError && (
                      <p className="text-sm text-destructive mt-1">{guestSignupError}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full text-lg py-6 bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                    disabled={guestSignupLoading || !guestSignupPassword}
                  >
                    {guestSignupLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Creating Account...
                      </>
                    ) : (
                      <>
                        🚀 Create Account & Save Report
                      </>
                    )}
                  </Button>
                </form>

                <p className="text-xs text-center text-muted-foreground mt-4">
                  Already have an account? <a href="/login" className="text-primary hover:underline">Log in here</a>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success message after signup */}
        {guestSignupSuccess && (
          <Alert className="mb-8 bg-[#3ea34b]/10 border-[#3ea34b]/30">
            <AlertDescription className="text-[#3ea34b] text-center">
              ✅ Account created successfully! This trip is now saved to your account. Refreshing...
            </AlertDescription>
          </Alert>
        )}

        {/* Footer Navigation */}
        <div className="text-center py-8">
          <p className="text-lg font-medium text-foreground mb-4">
            Driverbrief wishes you a nice trip
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            <Button
              onClick={handlePlanNewTrip}
              variant="default"
              size="lg"
              className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
            >
              Plan New Trip
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Powered by UK Police API, TfL, Open-Meteo, OpenAI - 100% Free
          </p>
        </div>
      </div>

      {/* Driver & Quotes Modal */}
      {showDriverModal && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-card-foreground">
                  {assignOnlyMode ? 'Assign driver' : 'Get driver quotes'}
                </h2>
                <button
                  onClick={() => {
                    setShowDriverModal(false);
                    setAssignOnlyMode(false); // Reset assign-only mode
                  }}
                  className="p-2 hover:bg-secondary/50 rounded-md transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Cancelled Trip Warning */}
              {tripStatus === 'cancelled' && (
                <Alert variant="destructive" className="mb-6">
                  <AlertDescription className="flex items-center gap-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="font-semibold">This trip has been cancelled</p>
                      <p className="text-sm mt-1">You cannot assign drivers or request quotes for a cancelled trip. Please create a new trip instead.</p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Driver Management Section - Unified */}
              <div className="mb-8">
                {!assignOnlyMode && (
                  <p className="text-muted-foreground mb-6">
                    Request quotes from drivers. After receiving a quote, you can assign that driver to your trip.
                  </p>
                )}
                
                {assignOnlyMode && (
                  <p className="text-muted-foreground mb-6">
                    Assign a driver to confirm this trip
                  </p>
                )}
                
                {/* Success Messages */}
                {quoteRequestSuccess && (
                  <Alert className="mb-4 bg-[#3ea34b]/10 border-[#3ea34b]/30">
                    <AlertDescription className="text-[#3ea34b]">
                      ✅ {quoteRequestSuccess}
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Error Messages */}
                {(quoteRequestError || manualDriverError) && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{quoteRequestError || manualDriverError}</AlertDescription>
                  </Alert>
                )}
                
                {/* Unified Email Input with Two Buttons */}
                <div className="space-y-4">
                  <div className="flex gap-3 items-center">
                    <div className="relative flex-1">
                      <Input
                        id="driver-email-unified"
                        type="email"
                        value={manualDriverEmail}
                        onChange={(e) => handleManualDriverInputChange(e.target.value)}
                        onFocus={handleManualDriverInputFocus}
                        onBlur={() => setTimeout(() => setShowDriverSuggestions(false), 200)}
                        placeholder="Enter driver email"
                        disabled={settingDriver || sendingQuoteRequest}
                        className={(manualDriverError || allocateDriverEmailError) ? 'border-destructive' : ''}
                      />
                      
                      {/* Autocomplete Dropdown */}
                      {showDriverSuggestions && filteredDriverSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                          {filteredDriverSuggestions.map((driver, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => handleSelectDriverSuggestion(driver)}
                              className="w-full text-left px-4 py-2 hover:bg-secondary/50 dark:hover:bg-[#181a23] transition-colors text-sm border-b last:border-b-0"
                            >
                              <div className="flex items-center justify-between">
                                <span>{driver}</span>
                                {driverEmail && driverEmail.toLowerCase() === driver.toLowerCase() && (
                                  <span className="text-xs px-2 py-1 bg-[#3ea34b] text-white rounded">
                                    Current
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* Show message when no suggestions match */}
                      {showDriverSuggestions && manualDriverEmail.trim().length > 0 && filteredDriverSuggestions.length === 0 && driverSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg p-4">
                          <p className="text-sm text-muted-foreground">No matching drivers found</p>
                        </div>
                      )}
                    </div>
                    
                      <div className="flex gap-2">
                        {/* Request Quote - Hide in assign-only mode */}
                        {!assignOnlyMode && (
                        <Button
                          onClick={() => handleSendQuoteRequest(manualDriverEmail)}
                          disabled={sendingQuoteRequest || !manualDriverEmail.trim() || settingDriver || tripStatus === 'cancelled'}
                            className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                        >
                          {sendingQuoteRequest ? (
                            <>
                              <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Sending...
                            </>
                          ) : (
                              'Request quote'
                          )}
                        </Button>
                        )}
                        
                        {/* Assign Driver - Only show in assign-only mode (Flow B) */}
                        {assignOnlyMode && (
                        <Button
                            onClick={() => {
                              // Flow B: Show confirmation modal before assigning
                              if (!manualDriverEmail.trim()) return;
                              if (tripStatus === 'cancelled') {
                                alert('This trip has been cancelled. Please create a new trip instead.');
                                return;
                              }
                              setDirectAssignDriver(manualDriverEmail);
                              setShowFlowBModal(true);
                            }}
                          disabled={settingDriver || !manualDriverEmail.trim() || sendingQuoteRequest || tripStatus === 'cancelled'}
                          className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                        >
                          {settingDriver ? (
                            <>
                              <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Assigning...
                            </>
                          ) : (
                              'Assign driver & request acceptance'
                          )}
                        </Button>
                        )}
                      </div>
                  </div>
                  
                  {/* Error message below the input row */}
                  {(manualDriverError || allocateDriverEmailError) && (
                    <p className="text-sm text-destructive">{manualDriverError || allocateDriverEmailError}</p>
                  )}
                  
                  {/* List of sent invitations - Hide in assign-only mode */}
                  {!assignOnlyMode && sentDriverEmails.length > 0 && (
                    <div className="mt-6 pt-6 border-t">
                      <h3 className="text-sm font-semibold mb-3">Sent ({sentDriverEmails.length})</h3>
                      <div className="space-y-2">
                        {sentDriverEmails.map((sent, index) => {
                          const hasQuote = quotes.some(q => q.email.toLowerCase() === sent.email.toLowerCase());
                          return (
                            <div 
                              key={index} 
                              className="flex items-center justify-between p-3 rounded-md bg-secondary/50 border border-[#3ea34b]"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium">{sent.email}</p>
                              </div>
                              <div className="text-right flex-shrink-0 ml-4">
                                <p className="text-xs text-muted-foreground">
                                  Sent {new Date(sent.sentAt).toLocaleDateString()} at {new Date(sent.sentAt).toLocaleTimeString()}
                                </p>
                              </div>
                              {hasQuote && (
                                <span className="px-2 py-1 text-xs font-bold text-white bg-[#3ea34b] rounded">
                                  QUOTE RECEIVED
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Received Quotes Section - Hide in assign-only mode */}
              {!assignOnlyMode && (
              <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Received</h3>
                {loadingQuotes ? (
                  <div className="flex items-center justify-center py-8">
                    <svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="ml-2 text-muted-foreground">Loading quotes...</span>
                  </div>
                ) : quotes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No quotes received yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left py-3 px-4 font-semibold text-sm">Email</th>
                          <th className="text-right py-3 px-4 font-semibold text-sm">Price</th>
                          <th className="text-left py-3 px-4 font-semibold text-sm">Currency</th>
                          <th className="text-left py-3 px-4 font-semibold text-sm">Date</th>
                          <th className="text-center py-3 px-4 font-semibold text-sm">Driver</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quotes.map((quote) => {
                          const isDriver = driverEmail && driverEmail.toLowerCase() === quote.email.toLowerCase();
                          return (
                            <tr 
                              key={quote.id} 
                              className={`border-b hover:bg-secondary/50 dark:hover:bg-[#181a23] transition-colors ${
                                isDriver ? 'bg-[#3ea34b]/10 border-[#3ea34b]/30' : ''
                              }`}
                            >
                              <td className="py-3 px-4 text-sm">
                                {quote.email}
                                {isDriver && (
                                  <span className="ml-2 px-2 py-1 text-xs font-bold text-white bg-[#3ea34b] rounded">
                                    DRIVER
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-sm text-right font-medium">
                                {quote.price.toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-sm">{quote.currency}</td>
                              <td className="py-3 px-4 text-sm text-muted-foreground">
                                {new Date(quote.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Button
                                  size="sm"
                                  variant={isDriver ? "outline" : "default"}
                                  onClick={() => {
                                    // Flow A: Show confirmation modal before assigning from quote
                                    if (tripStatus === 'cancelled') {
                                      alert('This trip has been cancelled. Please create a new trip instead.');
                                      return;
                                    }
                                    setSelectedQuoteDriver(quote.email);
                                    setShowFlowAModal(true);
                                  }}
                                  disabled={settingDriver || isDriver || tripStatus === 'cancelled'}
                                  className={isDriver ? "border-[#3ea34b] text-[#3ea34b] hover:bg-[#3ea34b]/10" : ""}
                                >
                                  {settingDriver ? (
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                  ) : isDriver ? (
                                    '✓ Driver'
                                  ) : (
                                    'Select driver'
                                  )}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Change Confirmation Modal */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {/* Show "Trip actions" for pending state OR when unconfirming */}
              {driverEmail 
                ? 'Trip actions' 
                : 'Driver not allocated'}
            </DialogTitle>
            <DialogDescription>
              {statusModalSuccess ? (
                <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{statusModalSuccess}</span>
                </span>
              ) : driverEmail ? (
                <>
                  Choose an action for this trip:
                </>
              ) : (
                <>
                  Please allocate a driver before confirming the trip.
                  <br /><br />
                  Click the "Driver" button to open Driver Management and assign a driver.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {/* Show success close button */}
            {statusModalSuccess ? (
                    <Button
                      onClick={() => {
                        setShowStatusModal(false);
                        setPendingStatus(null);
                  setStatusModalSuccess(null);
                  setResendingConfirmation(false);
                  setCancellingTrip(false);
                      }}
                className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                    >
                Close
                    </Button>
            ) : driverEmail ? (
              <>
                    <Button
                  variant="outline"
                  onClick={async () => {
                    // Keep modal open, show loading and then success
                    setResendingConfirmation(true);
                    
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session) return;
                      
                      // If status is "not confirmed", upgrade to "confirmed"
                      if (tripStatus === 'not confirmed') {
                        const statusResponse = await fetch('/api/update-trip-status', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            tripId: tripId,
                            status: 'confirmed',
                          }),
                        });
                        
                        const statusResult = await statusResponse.json();
                        if (statusResult.success) {
                          setTripStatus('confirmed');
                          console.log('✅ Trip confirmed');
                        }
                      }
                      
                      // Send notification to driver with trip details
                      const notifyResponse = await fetch('/api/notify-status-change', {
                        method: 'POST',
                        headers: { 
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify({
                          tripId: tripId,
                          newStatus: 'confirmed',
                          driverEmail: driverEmail,
                          tripDate: tripDate,
                          leadPassengerName: leadPassengerName,
                        }),
                      });
                      
                      const notifyResult = await notifyResponse.json();
                      console.log('✅ Confirmation notification response:', notifyResult);
                      
                      // Show success message
                      setStatusModalSuccess('Confirmation sent to driver successfully!');
                    } catch (err) {
                      console.error('❌ Error sending confirmation:', err);
                      setStatusModalSuccess('Failed to send confirmation. Please try again.');
                    } finally {
                      setResendingConfirmation(false);
                    }
                  }}
                  disabled={resendingConfirmation || cancellingTrip}
                  className="bg-[#3ea34b] hover:bg-[#3ea34b]/90 text-white"
                >
                  {resendingConfirmation ? (
                        <>
                          <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                      Sending...
                        </>
                      ) : (
                    'Resend confirmation to the driver'
                      )}
                    </Button>
                    <Button
                  onClick={async () => {
                    // Cancel trip and notify driver
                    setCancellingTrip(true);
                    
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session) return;
                      
                      // Capture driver email BEFORE any operations
                      const driverToNotify = driverEmail;
                      console.log('📧 Preparing to notify driver of cancellation');
                      
                      // STEP 1: Send cancellation notification to driver FIRST (before DB changes)
                      if (driverToNotify) {
                        console.log(`📧 Sending cancellation email to driver`);
                        const notifyResponse = await fetch('/api/notify-status-change', {
                          method: 'POST',
                          headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`,
                          },
                        body: JSON.stringify({
                          tripId: tripId,
                          newStatus: 'cancelled',
                          driverEmail: driverToNotify, // Use captured email, not the cleared one
                          message: 'Trip cancelled',
                          tripDate: tripDate,
                          leadPassengerName: leadPassengerName,
                        }),
                        });
                        
                        const notifyResult = await notifyResponse.json();
                        console.log('✅ Cancellation notification response:', notifyResult);
                      }
                      
                      // STEP 2: Now update trip status to cancelled (clears driver in DB)
                      const statusResponse = await fetch('/api/update-trip-status', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          tripId: tripId,
                          status: 'cancelled',
                        }),
                      });
                      
                      const statusResult = await statusResponse.json();
                      console.log('📊 Status update response:', statusResult);
                      
                      if (statusResult.success) {
                        setTripStatus('cancelled');
                        setDriverEmail(null); // Clear driver assignment in UI
                        console.log('✅ Trip cancelled - status set to cancelled, driver cleared');
                        
                        // Show success message
                        if (driverToNotify) {
                          setStatusModalSuccess('Service cancelled successfully. Driver has been notified.');
                        } else {
                          setStatusModalSuccess('Service cancelled successfully.');
                        }
                      } else {
                        console.error('❌ Failed to update trip status:', statusResult.error);
                        setStatusModalSuccess(`Failed to cancel trip: ${statusResult.error || 'Unknown error'}`);
                        setCancellingTrip(false);
                        return;
                      }
                    } catch (err) {
                      console.error('Error cancelling trip:', err);
                      setStatusModalSuccess('Failed to cancel trip. Please try again.');
                    } finally {
                      setCancellingTrip(false);
                    }
                  }}
                  disabled={resendingConfirmation || cancellingTrip}
                  variant="destructive"
                >
                  {cancellingTrip ? (
                        <>
                          <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                      Cancelling...
                        </>
                      ) : (
                    'Cancel this trip'
                      )}
                    </Button>
              </>
            ) : (
                    <Button
                onClick={() => {
                  setShowStatusModal(false);
                  setPendingStatus(null);
                  setStatusModalSuccess(null);
                  setResendingConfirmation(false);
                  setCancellingTrip(false);
                }}
                      className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                    >
                OK
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flow A Confirmation Modal - Selecting driver from quotes */}
      <Dialog open={showFlowAModal} onOpenChange={setShowFlowAModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign driver</DialogTitle>
            <DialogDescription>
              Assigning this driver will set the trip to pending status and send them an acceptance request email.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowFlowAModal(false);
                setSelectedQuoteDriver(null);
              }}
              disabled={settingDriver}
            >
              Dismiss
            </Button>
            <Button
              onClick={async () => {
                if (!selectedQuoteDriver) return;
                
                setSettingDriver(true);
                
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) {
                    setManualDriverError('Please log in to set driver');
                    return;
                  }

                  // Assign driver
                  const response = await fetch('/api/set-driver', {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                      tripId: tripId,
                      driverEmail: selectedQuoteDriver,
                    }),
                  });

                  const result = await response.json();

                  if (result.success) {
                    setDriverEmail(selectedQuoteDriver.toLowerCase());
                    console.log(`✅ [FLOW A] Driver selected from quotes`);
                    
                    // Update status to pending (waiting for driver acceptance)
                    const statusResponse = await fetch('/api/update-trip-status', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        tripId: tripId,
                        status: 'pending',
                      }),
                    });
                    
                    const statusResult = await statusResponse.json();
                    if (statusResult.success) {
                      setTripStatus('pending');
                      console.log('✅ [FLOW A] Trip status set to pending (awaiting driver acceptance)');
                    }
                    
                    // Send magic link email to driver
                    const notifyResponse = await fetch('/api/notify-driver-assignment', {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        tripId: tripId,
                        driverEmail: selectedQuoteDriver,
                        tripDate: tripDate,
                        leadPassengerName: leadPassengerName,
                        tripDestination: tripDestination,
                      }),
                    });
                    
                    const notifyResult = await notifyResponse.json();
                    if (notifyResult.success) {
                      console.log('✅ [FLOW A] Magic link email sent to driver');
                    } else {
                      console.error('❌ [FLOW A] Failed to send magic link email:', notifyResult.error);
                    }
                    
                    // Close both modals
                    setShowFlowAModal(false);
                    setShowDriverModal(false);
                    setSelectedQuoteDriver(null);
                  } else {
                    setManualDriverError(result.error || 'Failed to set driver');
                  }
                } catch (err) {
                  console.error('❌ Error in Flow A:', err);
                  setManualDriverError('An error occurred');
                } finally {
                  setSettingDriver(false);
                }
              }}
              disabled={settingDriver}
              className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
            >
              {settingDriver ? (
                        <>
                          <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                  Confirming...
                        </>
                      ) : (
                'Confirm trip'
                      )}
                    </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flow B Confirmation Modal - Direct driver assignment */}
      <Dialog open={showFlowBModal} onOpenChange={setShowFlowBModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign driver</DialogTitle>
            <DialogDescription>
              Assigning this driver will set the trip to pending status and send them an acceptance request email.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
              <Button
              variant="outline"
                onClick={() => {
                setShowFlowBModal(false);
                setDirectAssignDriver(null);
                }}
              disabled={settingDriver}
              >
              Dismiss
              </Button>
            <Button
              onClick={async () => {
                if (!directAssignDriver) return;
                
                setSettingDriver(true);
                
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) {
                    setManualDriverError('Please log in to set driver');
                    return;
                  }

                  // Assign driver
                  const response = await fetch('/api/set-driver', {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                      tripId: tripId,
                      driverEmail: directAssignDriver,
                    }),
                  });

                  const result = await response.json();

                  if (result.success) {
                    setDriverEmail(directAssignDriver.toLowerCase());
                    console.log(`✅ [FLOW B] Driver assigned successfully`);
                    
                    // Update status to pending (waiting for driver acceptance)
                    const statusResponse = await fetch('/api/update-trip-status', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        tripId: tripId,
                        status: 'pending',
                      }),
                    });
                    
                    const statusResult = await statusResponse.json();
                    if (statusResult.success) {
                      setTripStatus('pending');
                      console.log('✅ [FLOW B] Trip status set to pending (awaiting driver acceptance)');
                    }
                    
                    // Send magic link email to driver
                    const notifyResponse = await fetch('/api/notify-driver-assignment', {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        tripId: tripId,
                        driverEmail: directAssignDriver,
                        tripDate: tripDate,
                        leadPassengerName: leadPassengerName,
                        tripDestination: tripDestination,
                      }),
                    });
                    
                    const notifyResult = await notifyResponse.json();
                    if (notifyResult.success) {
                      console.log('✅ [FLOW B] Magic link email sent to driver');
                    } else {
                      console.error('❌ [FLOW B] Failed to send magic link email:', notifyResult.error);
                    }
                    
                    // Close both modals
                    setShowFlowBModal(false);
                    setShowDriverModal(false);
                    setAssignOnlyMode(false);
                    setDirectAssignDriver(null);
                    setManualDriverEmail('');
                  } else {
                    setManualDriverError(result.error || 'Failed to set driver');
                  }
                } catch (err) {
                  console.error('❌ Error in Flow B:', err);
                  setManualDriverError('An error occurred');
                } finally {
                  setSettingDriver(false);
                }
              }}
              disabled={settingDriver}
              className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
            >
              {settingDriver ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Confirming...
                </>
              ) : (
                'Yes, confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Driver Confirmation Dialog */}
      <Dialog open={showDriverConfirmDialog} onOpenChange={setShowDriverConfirmDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Confirm trip</DialogTitle>
            <DialogDescription>
              You're about to confirm this trip
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#e77500]/10 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-[#e77500]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  This will notify the trip owner that you've accepted this trip.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  The trip status will change from Pending to Confirmed.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDriverConfirmDialog(false)}
              disabled={confirmingTrip}
            >
              Dismiss
            </Button>
            <Button
              onClick={handleDriverConfirmTrip}
              disabled={confirmingTrip}
              className="bg-[#3ea34b] hover:bg-[#3ea34b]/90 text-white"
            >
              {confirmingTrip ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Confirming...
                </>
              ) : (
                'Yes, confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Driver Rejection Dialog */}
      <Dialog open={showDriverRejectDialog} onOpenChange={setShowDriverRejectDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Reject trip</DialogTitle>
            <DialogDescription>
              You're about to decline this trip assignment
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  This will notify the trip owner that you're declining this trip.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  The trip status will change to Rejected and you'll be unassigned.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDriverRejectDialog(false)}
              disabled={rejectingTrip}
            >
              Dismiss
            </Button>
            <Button
              onClick={handleDriverRejectTrip}
              disabled={rejectingTrip}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {rejectingTrip ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Rejecting...
                </>
              ) : (
                'Yes, reject'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Route View Map Modal */}
      {showMapModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-card dark:bg-[#1f1f21] rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col border border-border/40">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold">Route View</h3>
                <p className="text-sm text-muted-foreground">View your trip route on the map</p>
              </div>
              <Button
                onClick={() => setShowMapModal(false)}
                variant="ghost"
                size="sm"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="w-full h-full">
                <GoogleTripMap 
                  locations={tripResults.map((result, index) => ({
                    id: result.locationId,
                    name: result.locationName,
                    // Use weather coordinates (universal, works for all cities)
                    lat: result.data.weather.coordinates.lat,
                    lng: result.data.weather.coordinates.lng,
                    time: result.time,
                    safetyScore: result.data.crime.safetyScore || undefined,
                  }))}
                  height="100%"
                  compact={false}
                  tripDestination={tripDestination}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trip Update Notification Modal */}
      <Dialog open={showUpdateNotificationModal} onOpenChange={setShowUpdateNotificationModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trip Updated</DialogTitle>
            <DialogDescription>
              The trip was updated successfully.
              <br /><br />
              Do you want to notify the driver about these changes?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleUpdateNotificationResponse(false)}
              disabled={sendingUpdateNotification}
            >
              No
            </Button>
            <Button
              onClick={() => handleUpdateNotificationResponse(true)}
              disabled={sendingUpdateNotification}
              className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
            >
              {sendingUpdateNotification ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending...
                </>
              ) : (
                'Yes, Notify Driver'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Route Modal */}
      <Dialog open={showEditRouteModal} onOpenChange={setShowEditRouteModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Route</DialogTitle>
            <DialogDescription>
              Update locations and times. Trip notes and other details will be preserved.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Sortable Location Cards */}
            <DndContext
              sensors={editRouteSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleEditRouteDragEnd}
            >
              <SortableContext
                items={editingLocations.map((loc) => loc.placeId || `fallback-${editingLocations.indexOf(loc)}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {editingLocations.map((loc, index) => (
                    <SortableEditLocationItem
                      key={loc.placeId || `fallback-${index}`}
                      location={loc}
                      index={index}
                      totalLocations={editingLocations.length}
                      onLocationSelect={handleEditLocationSelect}
                      onTimeChange={handleEditTimeChange}
                      onRemove={handleEditLocationRemove}
                      canRemove={editingLocations.length > 1}
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
            
            {/* Add Location Button */}
            <Button
              onClick={handleAddEditLocation}
              variant="outline"
              className="w-full"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add location
            </Button>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowEditRouteModal(false)}
              disabled={isRegenerating}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveRouteEdits}
              disabled={isRegenerating || editingLocations.length === 0}
              className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
            >
              {isRegenerating ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Updating...
                </>
              ) : (
                'Update route'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}




