'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import GoogleTripMap from '@/components/GoogleTripMap';
import TripRiskBreakdown from '@/components/TripRiskBreakdown';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import type { Database } from '@/lib/database.types';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Car, Calendar as CalendarIcon, Maximize2, Trash2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PassengerPicker } from '@/components/ui/passenger-picker';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { getTrafficPredictions } from '@/lib/google-traffic-predictions';
import { searchNearbyCafes } from '@/lib/google-cafes';
import { searchEmergencyServices } from '@/lib/google-emergency-services';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import { validateBusinessEmail } from '@/lib/email-validation';
import { getCityConfig, createMockResponse, MOCK_DATA, isValidTripDestination, normalizeTripDestination, getDestinationTimezone } from '@/lib/city-helpers';
import { getDisplayVehicle } from '@/lib/vehicle-helpers';
import { numberToLetter } from '@/lib/helpers/string-helpers';
import { formatLocationDisplay } from '@/lib/helpers/location-formatters';
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
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { safeJsonParse } from '@/lib/helpers/api-helpers';
import type {
  TripData,
  DriverRecord,
} from './types';
import { formatTimeForPicker, getDestinationLocalTime, getLondonLocalTime } from './utils/time-helpers';
import { normalizeTripLocations, isAirportLocation } from './utils/location-helpers';
import { normalizeMatchKey, matchesDriverToVehicle } from './utils/vehicle-helpers';
import { formatPriceDisplay, parsePriceInput } from './utils/price-helpers';
import { calculateCombinedScheduleRisk, calculateTimelineRealism } from './utils/risk-helpers';
import { extractFlightNumbers, extractServiceIntroduction } from './utils/extraction-helpers';
import { isValidTransition } from './utils/validation-helpers';
import { determineVehicleType, extractCarInfo } from './utils/vehicle-detection-helpers';
import { stripEmailMetadata, detectUnchangedFields, mapExtractedToManualForm, calculateChanges } from './utils/update-helpers';
import { usePreviewApplication } from './hooks/usePreviewApplication';
import { useUpdateExtraction } from './hooks/useUpdateExtraction';
import { useTripRegeneration } from './hooks/useTripRegeneration';
import { useScrollPosition } from './hooks/useScrollPosition';
import { useUrlParams } from './hooks/useUrlParams';
import { useDriverTokenValidation } from './hooks/useDriverTokenValidation';
import { useQuotes } from './hooks/useQuotes';
import { useRealtimeTripUpdates } from './hooks/useRealtimeTripUpdates';
import { useTripActions } from './hooks/useTripActions';
import { useTripLoading } from './hooks/useTripLoading';
import { useQuoteSubmission } from './hooks/useQuoteSubmission';
import { useDriverActions } from './hooks/useDriverActions';
import { useLocationManagement } from './hooks/useLocationManagement';
import { useGuestActions } from './hooks/useGuestActions';
import { useNotifications } from './hooks/useNotifications';
import { bookingPreviewInitialState, requiredFields, CURRENCY_OPTIONS, type BookingPreviewFieldKey } from './constants';
import { QuoteFormSection } from './components/QuoteFormSection';
import { ChronologicalView } from './components/ChronologicalView';
import { TripSummarySection } from './components/TripSummarySection';
import { LocationCardSection } from './components/LocationCardSection';
import { UpdateQuoteModal } from './components/UpdateQuoteModal';
import { GuestSignupModal } from './components/GuestSignupModal';
import { StatusChangeModal } from './components/StatusChangeModal';
import { DriverConfirmDialog } from './components/DriverConfirmDialog';
import { DriverRejectDialog } from './components/DriverRejectDialog';
import { UpdateNotificationModal } from './components/UpdateNotificationModal';
import { ConfirmDriverRequiredModal } from './components/ConfirmDriverRequiredModal';
import { DriverAcceptRejectModal } from './components/DriverAcceptRejectModal';
import { DriverAssignmentInfoModal } from './components/DriverAssignmentInfoModal';
import { FlowAModal } from './components/FlowAModal';
import { FlowBModal } from './components/FlowBModal';
import { RouteViewMapModal } from './components/RouteViewMapModal';
import { EditRouteModal } from './components/EditRouteModal';
import { LoadingState } from './components/LoadingState';
import { ErrorState } from './components/ErrorState';
import { useMatchingDrivers } from './hooks/useMatchingDrivers';
import { useDrivaniaVehicleCalculations } from './hooks/useDrivaniaVehicleCalculations';
import { useRouteEditing } from './hooks/useRouteEditing';
import { UpdateTripSection } from './components/UpdateTripSection';
import { RegenerationLoadingModal } from './components/RegenerationLoadingModal';
import { DriverQuotesModal } from './components/DriverQuotesModal';
import { generateRegenerationSteps } from './utils/regeneration-helpers';
import { useUserRole } from './hooks/useUserRole';
import { generateReport } from '@/lib/services/report-service';

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tripId = params.id as string;
  const { user, isAuthenticated, loading: authLoading, signUp } = useAuth();
  const { isLoaded: isGoogleMapsLoaded } = useGoogleMaps();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [tripData, setTripData] = useState<TripData | null>(null);
  const locations = React.useMemo(() => normalizeTripLocations(tripData?.locations), [tripData?.locations]);

  const quoteFormRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [ownershipChecked, setOwnershipChecked] = useState<boolean>(false);
  // Location editing state handled by useLocationManagement hook
  const inputRef = useRef<HTMLInputElement>(null);
  const [locationDisplayNames, setLocationDisplayNames] = useState<{ [key: string]: string }>({});
  const [expandedLocations, setExpandedLocations] = useState<{ [key: string]: boolean }>({});
  const [expandedRoutes, setExpandedRoutes] = useState<{ [key: string]: boolean }>({});
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
  // confirmingTrip and rejectingTrip handled by useDriverActions hook
  const [showDriverAcceptRejectModal, setShowDriverAcceptRejectModal] = useState<boolean>(false);
  const [showDriverAssignmentInfoModal, setShowDriverAssignmentInfoModal] = useState<boolean>(false);

  // Map modal state
  const [showMapModal, setShowMapModal] = useState<boolean>(false);

  // Edit route modal state
  const [showEditRouteModal, setShowEditRouteModal] = useState<boolean>(false);
  const [availableDestinations, setAvailableDestinations] = useState<string[]>([]);
  const [loadingDestinations, setLoadingDestinations] = useState(false);
  const [editingLocations, setEditingLocations] = useState<any[]>([]);
  const [editingExtractedIndex, setEditingExtractedIndex] = useState<number | null>(null);
  const [editingExtractedField, setEditingExtractedField] = useState<'location' | 'time' | null>(null);
  const [editingTripDate, setEditingTripDate] = useState<Date | undefined>(undefined);

  // Preview modal state for AI-assisted updates
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewLocations, setPreviewLocations] = useState<any[]>([]);
  const [previewChanges, setPreviewChanges] = useState<{
    removed: Array<{ index: number; location: any }>;
    modified: number[];
    added: number[];
    originalLocationMap?: Map<number, any>; // Map from mappedLocations index to original location
  }>({ removed: [], modified: [], added: [] });
  const [previewDriverNotes, setPreviewDriverNotes] = useState<string>('');
  const [previewNonLocationFields, setPreviewNonLocationFields] = useState<{
    leadPassengerName?: string;
    vehicleInfo?: string;
    passengerCount?: number;
    tripDestination?: string;
  }>({});
  // Store original values from tripData for comparison
  const [originalValues, setOriginalValues] = useState<{
    leadPassengerName?: string;
    vehicleInfo?: string;
    passengerCount?: number;
    tripDestination?: string;
    driverNotes?: string;
  }>({});

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


  // Trip status state
  const [tripStatus, setTripStatus] = useState<string>('not confirmed');
  const [showChronologicalView, setShowChronologicalView] = useState<boolean>(false);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [showConfirmDriverRequiredModal, setShowConfirmDriverRequiredModal] = useState<boolean>(false);
  // sendingStatusNotification handled by useTripActions hook
  const [statusModalSuccess, setStatusModalSuccess] = useState<string | null>(null);
  const [resendingConfirmation, setResendingConfirmation] = useState<boolean>(false);
  const [cancellingTrip, setCancellingTrip] = useState<boolean>(false);
  
  // Delete trip state
  const [deletingTrip, setDeletingTrip] = useState<boolean>(false);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  // Flow A (quote selection) confirmation modal
  const [showFlowAModal, setShowFlowAModal] = useState<boolean>(false);
  const [selectedQuoteDriver, setSelectedQuoteDriver] = useState<string | null>(null);

  // Flow B (direct assign) confirmation modal  
  const [showFlowBModal, setShowFlowBModal] = useState<boolean>(false);
  const [directAssignDriver, setDirectAssignDriver] = useState<string | null>(null);

  // Trip update notification state handled by useNotifications hook

  // Quote form state - email managed separately, rest handled by useQuoteSubmission hook
  const [quoteEmail, setQuoteEmail] = useState<string>('');

  // Driver state
  const [driverEmail, setDriverEmail] = useState<string | null>(null);
  // Store original driver email from database to check activity even if state changes
  const originalDriverEmailRef = useRef<string | null>(null);
  // Driver and status management handled by useTripActions hook
  // Notification state handled by useNotifications hook

  // Quote request state (for inviting drivers to quote)
  const [allocateDriverEmail, setAllocateDriverEmail] = useState<string>('');
  const [allocateDriverEmailError, setAllocateDriverEmailError] = useState<string | null>(null);
  const [sentDriverEmails, setSentDriverEmails] = useState<Array<{
    email: string;
    sentAt: string;
  }>>([]);

  // Chauffs quote state
  const [loadingDrivaniaQuote, setLoadingDrivaniaQuote] = useState<boolean>(false);
  const [drivaniaQuotes, setDrivaniaQuotes] = useState<any>(null);
  const [drivaniaError, setDrivaniaError] = useState<string | null>(null);
  const [drivaniaServiceType, setDrivaniaServiceType] = useState<'one-way' | 'hourly' | null>(null);
  const [selectedDrivaniaVehicle, setSelectedDrivaniaVehicle] = useState<any>(null);
  const [showBookingPreview, setShowBookingPreview] = useState<boolean>(false);
  // Track selection state for each vehicle: { vehicleId: { isVehicleSelected: boolean, selectedDriverIds: string[] } }
  const [vehicleSelections, setVehicleSelections] = useState<Record<string, { isVehicleSelected: boolean; selectedDriverIds: string[] }>>({});
  const [bookingPreviewFields, setBookingPreviewFields] = useState(bookingPreviewInitialState);
  const [missingFields, setMissingFields] = useState<Set<BookingPreviewFieldKey>>(new Set());
  const [bookingSubmissionState, setBookingSubmissionState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [bookingSubmissionMessage, setBookingSubmissionMessage] = useState<string>('');
  const [processingTimer, setProcessingTimer] = useState<NodeJS.Timeout | null>(null);
  const [showBookingSuccess, setShowBookingSuccess] = useState<boolean>(false);

  // Guest signup state
  const [isGuestCreator, setIsGuestCreator] = useState<boolean>(false);
  const [isGuestCreatedTrip, setIsGuestCreatedTrip] = useState<boolean>(false);
  // Guest signup state handled by useGuestActions hook
  const [showSignupModal, setShowSignupModal] = useState<boolean>(false);

  // Driver token authentication (magic link) - must be after setQuoteEmail is declared
  const {
    driverToken,
    validatedDriverEmail,
    isDriverView,
    canTakeAction,
    tokenValidationError,
    tokenAlreadyUsed,
    tokenMessage,
    driverResponseStatus,
    setDriverResponseStatus,
    setValidatedDriverEmail,
  } = useDriverTokenValidation({
    searchParams,
    tripId,
    loading,
    onEmailPreFill: setQuoteEmail,
  });

  // Quotes fetching and management - must be after driverEmail and validatedDriverEmail are declared
  const {
    quotes,
    loadingQuotes,
    fetchQuotes,
    myQuotes,
    loadingMyQuotes,
    fetchMyQuotes,
  } = useQuotes({
    tripId,
    isOwner,
    loading,
    ownershipChecked,
    driverEmail,
    quoteEmail,
    validatedDriverEmail,
    onQuoteEmailSet: setQuoteEmail,
  });

  // URL parameters handling (must be after all state declarations)
  const { quoteParam, emailParam, isEmailFromUrl } = useUrlParams({
    searchParams,
    isOwner,
    isGuestCreator,
    isGuestCreatedTrip,
    loading,
    quoteFormRef,
    onEmailChange: setQuoteEmail,
  });

  // Scroll position for sticky update bar
  const { scrollY } = useScrollPosition();


  // Drag and drop sensors for edit route modal
  const editRouteSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Memoize map locations to prevent unnecessary re-renders
  // Must be called at top level before any conditional logic to maintain hook order
  const mapLocations = React.useMemo(() => {
    if (!tripData?.tripResults) return [];
    return tripData.tripResults.map((result, index) => ({
      id: result.locationId,
      name: result.locationName,
      // Use weather coordinates (universal, works for all cities)
      lat: result.data.weather.coordinates.lat,
      lng: result.data.weather.coordinates.lng,
      time: result.time,
      safetyScore: result.data.crime.safetyScore || undefined,
    }));
  }, [tripData?.tripResults]);

  // Avoid hydration mismatch for theme-dependent content
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check for booking success message from confirmation page
  useEffect(() => {
    if (typeof window !== 'undefined' && tripId) {
      const bookingSuccess = sessionStorage.getItem(`bookingSuccess_${tripId}`);
      if (bookingSuccess === 'true') {
        setShowBookingSuccess(true);
        // Remove the flag so it only shows once
        sessionStorage.removeItem(`bookingSuccess_${tripId}`);
      }
    }
  }, [tripId]);

  const highlightMissing = (field: BookingPreviewFieldKey) =>
    missingFields.has(field) ? 'border-destructive/70 bg-destructive/10 text-destructive' : '';

  useEffect(() => {
    return () => {
      if (processingTimer) {
        clearTimeout(processingTimer);
      }
    };
  }, [processingTimer]);

  const driverDestinationForDrivers = React.useMemo(() => {
    return (tripDestination || tripData?.tripDestination || '').trim();
  }, [tripDestination, tripData?.tripDestination]);

  // Fetch matching drivers based on destination
  const { matchingDrivers, loadingMatchingDrivers, matchingDriversError } = useMatchingDrivers({
    driverDestination: driverDestinationForDrivers,
  });

  // Calculate Chauffs vehicle-related values
  const { lowestDrivaniaPrice, drivaniaCurrency, lowestExtraHourPrice } = useDrivaniaVehicleCalculations({
    drivaniaQuotes,
  });

  // Removed booking preview functions - now handled on booking page
  // openBookingPreview, handleBookingFieldChange, handleReturnToReport, handleBookNow moved to /booking/[tripId]/page.tsx

  // Removed renderVehicleCard function - now handled on booking page

  // Scroll position tracking handled by useScrollPosition hook


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

  // URL parameters handling (quote, email) - handled by useUrlParams hook

  // Driver token validation handled by useDriverTokenValidation hook




  // Function to extract flight numbers from driver notes
  const extractFlightNumbers = (notes: string): { [locationName: string]: string[] } => {
    if (!notes) return {};

    const flightMap: { [locationName: string]: string[] } = {};

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

    sentences.forEach(sentence => {
      const lowerSentence = sentence.toLowerCase();

      // Check if sentence mentions an airport
      const mentionedAirport = airportKeywords.find(keyword =>
        lowerSentence.includes(keyword)
      );

      if (mentionedAirport) {
        // Look for flight numbers in this sentence
        flightPatterns.forEach(pattern => {
          const matches = sentence.match(pattern);
          if (matches) {
            matches.forEach(match => {
              // Clean up the flight number
              const flightNumber = match.replace(/flight\s*/gi, '').trim();
              if (flightNumber) {
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

    return flightMap;
  };


  // Function to extract car information from driver notes
  const extractCarInfo = (notes: string): string | null => {
    if (!notes) {
      return null;
    }

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

    // Split notes into sentences and look for car mentions
    const sentences = notes.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Track the best match (most complete specification)
    let bestMatch = null;
    let bestMatchScore = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();

      for (let j = 0; j < carPatterns.length; j++) {
        const pattern = carPatterns[j];

        const matches = sentence.match(pattern);
        if (matches && matches.length > 0) {

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

          // Keep the best match
          if (matchScore > bestMatchScore) {
            bestMatch = matches[0].trim();
            bestMatchScore = matchScore;
          }
        }
      }
    }

    // Process the best match if found
    if (bestMatch) {
      // Clean up and format the car mention
      let carMention = bestMatch;

      // Capitalize first letter of each word
      carMention = carMention.replace(/\b\w/g, l => l.toUpperCase());

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

      return carMention;
    }

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

  // Location name saving handled by useLocationManagement hook

  // Route editing handlers - extracted to hook
  const {
    handleEditRouteDragEnd,
    handleEditLocationSelect,
    handleEditTimeChange,
    handleEditLocationRemove,
    handleAddEditLocation,
  } = useRouteEditing({
    editingLocations,
    setEditingLocations,
  });

  const handleSaveRouteEdits = async (locationsToUse?: any[]) => {
    try {
      // Use provided locations or fall back to editingLocations
      // This avoids React state timing issues when called immediately after setState
      // Ensure locations is always an array
      const locations = Array.isArray(locationsToUse) 
        ? locationsToUse 
        : (Array.isArray(editingLocations) ? editingLocations : []);

      // Guard: If locations is empty or not an array, show error
      if (!Array.isArray(locations) || locations.length === 0) {
        alert('No locations to save. Please add at least one location.');
        setIsRegenerating(false);
        return;
      }

      // Validate all locations have valid coordinates
      // Use the 'locations' variable (which may be from parameter) instead of 'editingLocations' state
      // Also check all possible location fields: location, formattedAddress, or purpose
      const validLocations = locations.filter(loc => {
        // Must have valid coordinates
        const hasCoords = loc.lat !== 0 && loc.lng !== 0;
        // Must have at least one name field populated
        const hasName = (loc.location && loc.location.trim() !== '') ||
          (loc.formattedAddress && loc.formattedAddress.trim() !== '') ||
          (loc.purpose && loc.purpose.trim() !== '');
        // Exception: Airport locations are valid even without coordinates if they match airport pattern
        const isAirport = isAirportLocation(loc.location) || 
                         isAirportLocation(loc.formattedAddress) || 
                         isAirportLocation(loc.purpose);
        return (hasCoords && hasName) || (isAirport && hasName);
      });

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

      // Use editing trip date if set, otherwise fall back to current trip date
      const tripDateStr = editingTripDate ? editingTripDate.toISOString().split('T')[0] : (tripData?.tripDate || tripDate);
      const days = 7;

      // Get city configuration
      const cityConfig = getCityConfig(tripDestination);

      // Initialize steps (same as home page)
      const steps = generateRegenerationSteps(validLocations, tripDestination);
      setRegenerationSteps(steps);
      setRegenerationProgress(0);

      // Simulate step-by-step loading with realistic timing and smooth progress (EXACT home page logic)
      const simulateRegenerationSteps = async () => {
        for (let i = 0; i < steps.length; i++) {
          // Mark current step as loading
          setRegenerationSteps(prev => prev.map((step, index) =>
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
            setRegenerationProgress(currentProgress);

            if (stepProgress < 1) {
              requestAnimationFrame(animateProgress);
            }
          };

          animateProgress();

          // Wait for step duration
          await new Promise(resolve => setTimeout(resolve, stepDuration));

          // Mark current step as completed
          setRegenerationSteps(prev => prev.map((step, index) =>
            index === i ? { ...step, status: 'completed' } : step
          ));
        }

        // Ensure we hit 100% at the end
        setRegenerationProgress(100);
      };

      // Start the loading simulation
      simulateRegenerationSteps();

      // Track when background process completes
      let backgroundCompleted = false;
      let backgroundError: Error | null = null;
      let backgroundResults: any = null;
      let backgroundTrafficData: any = null;
      let backgroundReportData: any = null;

      // Run actual API calls in parallel with animation
      const runBackgroundProcess = async () => {
        try {
          // Fetch data for all locations (same as existing regeneration logic)
          const results = await Promise.all(
            locationsForDb.map(async (location) => {
              const tempDistrictId = `custom-${Date.now()}-${location.id}`;

              // Universal APIs
              const universalCalls = [
                fetch(`/api/weather?district=${tempDistrictId}&lat=${location.lat}&lng=${location.lng}&days=${days}${tripDestination ? `&tripDestination=${encodeURIComponent(tripDestination)}` : ''}`),
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
                    throw new Error(`${responseNames[i]} API returned ${responses[i].status}: ${errorText}`);
                  }
                }
              } else {
                if (!weatherResponse.ok) {
                  const errorText = await weatherResponse.text();
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

          backgroundResults = results;

          // Get traffic predictions
          const trafficData = await getTrafficPredictions(
            locationsForDb.map(loc => ({
              id: loc.id,
              name: loc.name,
              lat: loc.lat,
              lng: loc.lng,
              time: loc.time,
            })),
            tripDateStr,
            tripDestination
          );

          backgroundTrafficData = trafficData;

          // Generate executive report
          const reportResult = await generateReport({
            results,
              tripDate: tripDateStr,
            trafficData,
              emailContent: null,
              leadPassengerName,
              vehicleInfo,
              passengerCount,
              tripDestination,
              passengerNames,
              driverNotes: editedDriverNotes || driverNotes, // Use edited notes if available
          });

          if (!reportResult.success) {
            throw new Error(reportResult.error || 'Failed to generate executive report');
          }

          backgroundReportData = reportResult.data;
          backgroundCompleted = true;
        } catch (err) {
          backgroundError = err as Error;
          backgroundCompleted = true;
        }
      };

      // Start background process (runs in parallel with animation)
      runBackgroundProcess();

      // Wait for both animation and background process to complete
      // Wait for minimum animation duration (at least 10 seconds for all steps)
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Wait for background process if still running
      while (!backgroundCompleted) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Check for errors
      if (backgroundError) {
        throw backgroundError;
      }

      // Update database with new locations and all other fields
      const updateData: any = {
        locations: locationsForDb,
        trip_results: backgroundResults,
        traffic_predictions: backgroundTrafficData,
        executive_report: backgroundReportData,
        trip_notes: editedDriverNotes || driverNotes || null, // Update with edited notes if available
        updated_at: new Date().toISOString(),
        version: (currentVersion || 0) + 1,
      };

      // Update trip date if changed
      if (editingTripDate) {
        updateData.trip_date = tripDateStr;
      }

      // Update non-location fields if they have values (preserve existing if not changed)
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

      const { error: updateError } = await supabase
        .from('trips')
        .update(updateData)
        .eq('id', tripId);

      if (updateError) {
        console.error('❌ [UPDATE] Supabase error:', updateError);
        console.error('❌ [UPDATE] Update data:', JSON.stringify(updateData, null, 2));
        throw updateError;
      }

      // Reload page to show updated data
      window.location.reload();

    } catch (error) {
      console.error('❌ [UPDATE] Error updating route:', error);
      setIsRegenerating(false);
      setRegenerationSteps(prev => prev.map(step =>
        step.status === 'loading' ? { ...step, status: 'error' as const } : step
      ));
      alert(`Failed to update route: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
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

  // Live Trip helper functions - returns current time in trip destination timezone
  const getCurrentTripTime = (): Date => {
    // Get current time in trip destination timezone
    const timezone = getDestinationTimezone(tripDestination);
    const now = new Date();

    // Format current time in destination timezone and parse it back
    const timeString = now.toLocaleTimeString('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const [hours, minutes] = timeString.split(':').map(Number);
    const localTime = new Date();
    localTime.setHours(hours, minutes, 0, 0);

    return localTime;
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

  // Check if 15 minutes have passed since drop-off time
  const isTripCompleted = (): boolean => {
    if (!tripData?.tripDate || !tripData?.locations || tripData.locations.length === 0) {
      return false;
    }

    const now = new Date();
    const tripDateTime = new Date(tripData.tripDate);

    // Get drop-off time (last location)
    const lastLocation = tripData.locations[tripData.locations.length - 1];
    const timeValue = lastLocation.time;

    // Parse time - can be string "HH:MM" or decimal number (e.g., 14.5 for 14:30)
    let hours = 0;
    let minutes = 0;

    if (typeof timeValue === 'string') {
      const timeParts = timeValue.split(':');
      hours = parseInt(timeParts[0]) || 0;
      minutes = parseInt(timeParts[1]) || 0;
    } else if (typeof timeValue === 'number') {
      hours = Math.floor(timeValue);
      minutes = Math.round((timeValue % 1) * 60);
    } else {
      const parsed = parseFloat(String(timeValue)) || 0;
      hours = Math.floor(parsed);
      minutes = Math.round((parsed % 1) * 60);
    }

    // Calculate drop-off datetime
    const dropoffDate = new Date(tripDateTime);
    dropoffDate.setHours(hours, minutes, 0, 0);

    // Check if 15 minutes have passed since drop-off
    const fifteenMinutesAfter = new Date(dropoffDate.getTime() + 15 * 60 * 1000);

    return now >= fifteenMinutesAfter;
  };



  const handleSaveNotes = async () => {
    if (!tripId) return;

    // Security check: Only owners can save notes
    if (!isOwner) {
      return;
    }

    try {
      setIsSavingNotes(true);

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

      // First check if the trip exists
      const { data: existingTrip, error: fetchError } = await supabase
        .from('trips')
        .select('id')
        .eq('id', tripId)
        .single();

      if (fetchError) {
        return;
      }

      if (!existingTrip) {
        return;
      }

      const { error: updateError } = await supabase
        .from('trips')
        .update(updateData)
        .eq('id', tripId);

      if (updateError) {
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
      // Error saving notes
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Load trip from database and initialize state
  useTripLoading({
    tripId,
    user,
    isAuthenticated,
    authLoading,
    onTripDataLoaded: setTripData,
    onLocationDisplayNamesLoaded: setLocationDisplayNames,
    onRoleDetermined: (roleInfo) => {
      setIsOwner(roleInfo.isOwner);
      setIsGuestCreator(roleInfo.isGuestCreator);
      setIsGuestCreatedTrip(roleInfo.isGuestCreatedTrip);
    },
    onMetadataLoaded: (metadata) => {
      setDriverNotes(metadata.driverNotes);
      setEditedDriverNotes(metadata.editedDriverNotes);
      setLeadPassengerName(metadata.leadPassengerName);
      setVehicleInfo(metadata.vehicleInfo);
      setPassengerCount(metadata.passengerCount);
      setTripDestination(metadata.tripDestination);
      setPassengerNames(metadata.passengerNames);
      setCurrentVersion(metadata.currentVersion);
      setTripStatus(metadata.tripStatus);
      setDriverEmail(metadata.driverEmail);
    },
    onValidatedDriverEmailSet: setValidatedDriverEmail,
    onOriginalDriverEmailSet: (email) => {
      originalDriverEmailRef.current = email;
    },
    onOwnershipChecked: () => setOwnershipChecked(true),
    onLoadingChange: setLoading,
    onError: setError,
    originalDriverEmailRef: originalDriverEmailRef as React.RefObject<string | null>,
  });

  // Consolidate all role flags into a single role system
  const userRole = useUserRole({
    isOwner,
    isGuestCreator,
    isGuestCreatedTrip,
    isDriverView,
    driverToken,
    ownershipChecked,
  });

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);


  // Track previous locations to detect changes
  const prevLocationsRef = useRef<string>('');

  // Clear Chauffs quotes when trip locations actually change
  useEffect(() => {
    if (tripData?.locations) {
      const locationsKey = JSON.stringify(tripData.locations.map((loc: any) => ({
        name: loc.name,
        lat: loc.lat,
        lng: loc.lng,
        time: loc.time,
      })));

      // Only clear if locations have actually changed
      if (prevLocationsRef.current && prevLocationsRef.current !== locationsKey) {
        setDrivaniaQuotes(null);
        setDrivaniaError(null);
        setDrivaniaServiceType(null);
      }

      prevLocationsRef.current = locationsKey;
    }
  }, [tripData?.locations, tripData?.tripDate]);


  // Guest signup handled by useGuestActions hook

  const handleDeleteTrip = async () => {
    if (!user?.id || !tripId) {
      setError('Unable to delete trip: missing user or trip information');
      return;
    }

    if (!confirm('Are you sure you want to delete this trip? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingTrip(true);
      setDeleteSuccess(null);
      setError(null);

      const response = await fetch('/api/delete-trip', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tripId,
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete trip');
      }

      setDeleteSuccess('Trip deleted successfully');
      
      // Redirect to my trips after a short delay
      setTimeout(() => {
        router.push('/my-trips');
      }, 1500);
    } catch (err) {
      console.error('Error deleting trip:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete trip');
    } finally {
      setDeletingTrip(false);
    }
  };

  const handlePlanNewTrip = () => {
    // Check if user is authenticated - if not, show signup modal
    if (!isAuthenticated) {
      setShowSignupModal(true);
      return;
    }

    // Redirect to home for new trip
    router.push('/');
  };


  const handleStatusToggle = () => {
    if (!tripId || updatingStatus) return;

    // Block modals when viewing via quote request link
    if (quoteParam === 'true') {
      return;
    }

    // Check if user is the assigned driver (not owner)
    const isAssignedDriver = !isOwner && driverEmail && quoteEmail &&
      driverEmail.toLowerCase().trim() === quoteEmail.toLowerCase().trim();

    // DRIVER FLOW: Assigned driver clicking to confirm pending trip (with or without token)
    // Don't require authentication for assigned drivers - they can use token to accept/reject
    if ((isAssignedDriver || (driverToken && validatedDriverEmail)) && tripStatus === 'pending') {
      // If driver has token and no quote exists, show message asking to quote first
      if (driverToken && myQuotes.length === 0) {
        alert('Please submit a quote for this trip before confirming. Use the quote form above to provide your pricing.');
        return;
      }
      // If driver has token and action already taken, show assignment info modal
      if (driverToken && !canTakeAction) {
        setShowDriverAssignmentInfoModal(true);
        return;
      }
      // If driver has already responded, don't show modal again
      if (driverResponseStatus) {
        return;
      }
      setShowDriverAcceptRejectModal(true);
      return;
    }

    // Check if user is authenticated - if not, show signup modal (only for non-driver flows)
    if (!isAuthenticated) {
      setShowSignupModal(true);
      return;
    }

    // OWNER FLOW: Block non-owners who aren't the assigned driver
    if (!isOwner) return;

    // Block status toggle for Chauffs bookings
    if (driverEmail === 'drivania' && tripStatus === 'booked') {
      return;
    }

    // If trip is rejected, allow user to request quotes or assign driver again
    // Rejected behaves like "not confirmed" - service is not secured
    if (tripStatus === 'rejected') {
      setAssignOnlyMode(true);
      setShowDriverModal(true);
      return;
    }

    const newStatus = tripStatus === 'confirmed' ? 'not confirmed' : 'confirmed';

    // If confirming without a driver, show popup requiring driver assignment
    if (newStatus === 'confirmed' && !driverEmail) {
      setShowConfirmDriverRequiredModal(true);
      return;
    }

    // Otherwise, show confirmation modal
    setPendingStatus(newStatus);
    setStatusModalSuccess(null);
    setResendingConfirmation(false);
    setCancellingTrip(false);
    setShowStatusModal(true);
  };

  // Status change handlers handled by useTripActions hook

  // Quote fetching and subscriptions handled by useQuotes hook

  // Subscribe to trip status changes (for real-time updates)
  useRealtimeTripUpdates({
    tripId,
    isOwner,
    tripStatus,
    driverEmail,
    onStatusUpdate: setTripStatus,
    onDriverUpdate: setDriverEmail,
  });

  // Trip actions (driver management, status updates)
  const {
    driverSuggestions,
    filteredDriverSuggestions,
    showDriverSuggestions,
    setShowDriverSuggestions,
    settingDriver,
    manualDriverEmail,
    manualDriverError,
    setManualDriverEmail,
    setManualDriverError,
    handleSetDriver,
    handleManualDriverInputChange,
    handleManualDriverInputFocus,
    handleSelectDriverSuggestion,
    updatingStatus,
    sendingStatusNotification,
    handleConfirmStatusChange,
    sendStatusChangeNotification,
  } = useTripActions({
    tripId,
    isOwner,
    loading,
    userId: user?.id,
    tripStatus,
    driverEmail,
    pendingStatus,
    assignOnlyMode,
    onStatusUpdate: setTripStatus,
    onDriverUpdate: setDriverEmail,
    onPendingStatusClear: () => setPendingStatus(null),
    onStatusModalClose: () => setShowStatusModal(false),
    onDriverModalClose: () => setShowDriverModal(false),
    onAssignOnlyModeChange: setAssignOnlyMode,
  });

  // Quote submission and management
  const {
    quoteDriverName,
    quotePrice,
    quoteCurrency,
    quoteEmailError,
    quotePriceError,
    submittingQuote,
    quoteSuccess,
    quoteSuccessMessage,
    setQuoteDriverName,
    setQuotePrice,
    setQuoteCurrency,
    setQuoteEmailError,
    setQuotePriceError,
    setQuoteSuccess,
    setQuoteSuccessMessage,
    showUpdateQuoteModal,
    updateQuotePrice,
    updateQuotePriceError,
    updatingQuote,
    setShowUpdateQuoteModal,
    setUpdateQuotePrice,
    setUpdateQuotePriceError,
    sendingQuoteRequest,
    quoteRequestError,
    quoteRequestSuccess,
    setQuoteRequestError,
    setQuoteRequestSuccess,
    handleSubmitQuote,
    handleOpenUpdateQuote,
    handleUpdateQuote,
    handleSendQuoteRequest,
  } = useQuoteSubmission({
    tripId,
    isOwner,
    driverEmail,
    quoteEmail,
    allocateDriverEmail,
    myQuotes,
    fetchMyQuotes,
    onQuoteEmailSet: setQuoteEmail,
    onManualDriverEmailSet: setManualDriverEmail,
    onAllocateDriverEmailSet: setAllocateDriverEmail,
    sentDriverEmails,
    onSentDriverEmailsSet: setSentDriverEmails,
  });

  // Driver actions (confirm/reject trip)
  const {
    confirmingTrip,
    rejectingTrip,
    handleDriverConfirmTrip,
    handleDriverRejectTrip,
  } = useDriverActions({
    tripId,
    driverToken,
    isAuthenticated,
    canTakeAction,
    validatedDriverEmail,
    quoteEmail,
    myQuotes,
    onTripStatusUpdate: setTripStatus,
    onDriverResponseStatusUpdate: setDriverResponseStatus,
    onDriverEmailUpdate: setDriverEmail,
    onQuoteSuccessUpdate: setQuoteSuccess,
    onQuoteSuccessMessageUpdate: setQuoteSuccessMessage,
    onShowSignupModal: () => setShowSignupModal(true),
    onShowDriverAssignmentInfoModal: () => setShowDriverAssignmentInfoModal(true),
    onShowDriverConfirmDialogClose: () => setShowDriverConfirmDialog(false),
    onShowDriverAcceptRejectModalClose: () => setShowDriverAcceptRejectModal(false),
    onShowDriverRejectDialogClose: () => setShowDriverRejectDialog(false),
  });

  // Location management (name editing, saving)
  const {
    editingLocationId,
    editingLocationName,
    setEditingLocationId,
    setEditingLocationName,
    handleSaveLocationName,
  } = useLocationManagement({
    tripId,
    isOwner,
    tripData,
    driverNotes,
    editedDriverNotes,
    onTripDataUpdate: setTripData,
    onLocationDisplayNamesUpdate: (updater) => setLocationDisplayNames(updater),
  });

  // Guest actions (signup, account linking)
  const {
    guestSignupPassword,
    guestSignupError,
    guestSignupLoading,
    guestSignupSuccess,
    setGuestSignupPassword,
    setGuestSignupError,
    setGuestSignupSuccess,
    handleGuestSignup,
  } = useGuestActions({
    tripData,
    signUp,
  });

  // Notifications (driver notifications, update notifications)
  const {
    notifyingDriver,
    notificationSuccess,
    notificationError,
    sendingUpdateNotification,
    showUpdateNotificationModal,
    setNotificationSuccess,
    setNotificationError,
    setSendingUpdateNotification,
    setShowUpdateNotificationModal,
    handleNotifyDriver,
    handleUpdateNotificationResponse,
  } = useNotifications({
    tripId,
    isOwner,
    driverEmail,
  });

  // Quote submission handlers handled by useQuoteSubmission hook

  const handleDrivaniaQuote = async () => {
    if (!tripId || loadingDrivaniaQuote) {
      setDrivaniaError('Trip ID is required');
      return;
    }

    // Reset errors and state
    setDrivaniaError(null);
    setDrivaniaQuotes(null);
    setLoadingDrivaniaQuote(true);

    try {
      // Fetch the latest trip data from the database to ensure we use the most recent data
      const { data: latestTripData, error: fetchError } = await supabase
        .from('trips')
        .select('locations, trip_date, passenger_count')
        .eq('id', tripId)
        .single();

      if (fetchError) {
        setDrivaniaError('Failed to load trip data. Please try again.');
        return;
      }

      if (!latestTripData) {
        setDrivaniaError('Trip not found');
        return;
      }

      // Parse locations if stored as JSON string
      let latestLocations = latestTripData.locations;
      if (typeof latestLocations === 'string') {
        try {
          latestLocations = JSON.parse(latestLocations);
        } catch (e) {
          setDrivaniaError('Invalid trip data format');
          return;
        }
      }

      if (!latestLocations || !Array.isArray(latestLocations) || latestLocations.length < 2) {
        setDrivaniaError('Trip must have at least 2 locations (pickup and dropoff)');
        return;
      }

      // Type assertion and ensure all locations have required fields
      const typedLocations = latestLocations.map((loc: any, idx: number) => ({
        id: loc.id || `location-${idx + 1}`, // Ensure id is always present
        name: loc.name || '',
        fullAddress: loc.fullAddress,
        formattedAddress: loc.formattedAddress,
        address: loc.address,
        lat: loc.lat || 0,
        lng: loc.lng || 0,
        time: loc.time || '12:00',
        displayName: loc.displayName,
        flightNumber: loc.flightNumber,
        flightDirection: loc.flightDirection,
      })) as Array<{
        id: string;
        name: string;
        fullAddress?: string;
        formattedAddress?: string;
        address?: string;
        displayName?: string;
        lat: number;
        lng: number;
        time: string;
        flightNumber?: string;
        flightDirection?: 'arrival' | 'departure';
      }>;


      // Compare with previous tripData if available
      if (tripData?.locations) {
        const oldPickup = tripData.locations[0];
        const oldDropoff = tripData.locations[tripData.locations.length - 1];
        const newPickup = typedLocations[0];
        const newDropoff = typedLocations[typedLocations.length - 1];

        const pickupChanged = oldPickup?.lat !== newPickup?.lat ||
          oldPickup?.lng !== newPickup?.lng ||
          oldPickup?.time !== newPickup?.time ||
          oldPickup?.name !== newPickup?.name;

        const dropoffChanged = oldDropoff?.lat !== newDropoff?.lat ||
          oldDropoff?.lng !== newDropoff?.lng ||
          oldDropoff?.time !== newDropoff?.time ||
          oldDropoff?.name !== newDropoff?.name;

        if (!pickupChanged && !dropoffChanged) {
          // Pickup and dropoff coordinates/times unchanged
        }
      }

      // Update local tripData state with latest data
      if (tripData) {
        setTripData({
          ...tripData,
          locations: typedLocations,
          tripDate: latestTripData.trip_date || tripData.tripDate,
          passengerCount: latestTripData.passenger_count || tripData.passengerCount,
        });
      }

      // Determine service type based on number of locations
      const serviceType: 'one-way' | 'hourly' = typedLocations.length > 2 ? 'hourly' : 'one-way';
      setDrivaniaServiceType(serviceType);

      // Get passenger count from latest data or state or default to 1
      const passengerCountValue = latestTripData.passenger_count || passengerCount || 1;

      // Get trip date from latest data or fallback
      const tripDateValue = latestTripData.trip_date || tripData?.tripDate || new Date().toISOString().split('T')[0];

      // Prepare the exact payload that will be sent
      const quotePayload = {
        locations: typedLocations.map((loc) => ({
          name: loc.name,
          lat: loc.lat,
          lng: loc.lng,
          time: loc.time,
        })),
        tripDate: tripDateValue,
        passengerCount: passengerCountValue,
        serviceType: serviceType,
      };


      const response = await fetch('/api/drivania/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quotePayload),
      });

      const result = await response.json();


      if (result.success) {
        // Service ID comparison
        if (drivaniaQuotes?.service_id && result.data?.service_id) {
          const sameServiceId = drivaniaQuotes.service_id === result.data.service_id;
        }

        setDrivaniaQuotes(result.data);
        setDrivaniaServiceType(result.serviceType);
      } else {
        const errorMsg = result.error || result.message || 'Failed to get quote from Chauffs';
        // Check if error contains PEAK_PERIOD and provide user-friendly message
        if (errorMsg.includes('PEAK_PERIOD') || errorMsg.includes('Peak period')) {
          setDrivaniaError('We are expecting a high demand for this day, and online booking is not available. Please contact us at info@drivania.com and we will assist you.');
        } else {
          setDrivaniaError(errorMsg);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to request quote from Chauffs. Please try again.';
      // Check if error contains PEAK_PERIOD and provide user-friendly message
      if (errorMsg.includes('PEAK_PERIOD') || errorMsg.includes('Peak period')) {
        setDrivaniaError('We are expecting a high demand for this day, and online booking is not available. Please contact us at info@drivania.com and we will assist you.');
      } else {
        setDrivaniaError(errorMsg);
      }
    } finally {
      setLoadingDrivaniaQuote(false);
    }
  };

  // Fetch Chauffs quotes on page load for owners (to show lowest price in button)
  // Called immediately when tripData loads (parallel to report generation)
  // Also refetches when locations change (tripData?.locations in dependency array)
  useEffect(() => {
    // Early returns
    if (!tripId || !isOwner || !ownershipChecked || loading || loadingDrivaniaQuote) return;
    
    // Only fetch if trip is not cancelled/booked and not already assigned to Chauffs
    if (tripStatus === 'cancelled' || tripStatus === 'booked' || driverEmail === 'drivania') return;
    
    // Validate locations exist before calling (handleDrivaniaQuote will fetch fresh data from DB)
    if (!tripData?.locations || tripData.locations.length < 2) return;

    // Fetch quotes silently in the background
    // Note: Removed drivaniaQuotes check to allow refetching when locations change
    handleDrivaniaQuote();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, isOwner, ownershipChecked, loading, tripStatus, driverEmail, tripData?.locations]);

  const handleModifyTrip = () => {
    // For now, just redirect to home
    // Future: could pre-fill form with current trip data
    router.push('/');
  };

  // Driver confirm/reject handlers handled by useDriverActions hook

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


  // Preview modal handlers
  const { handleApplyPreview } = usePreviewApplication({
    previewLocations,
    previewDriverNotes,
    previewNonLocationFields,
    tripData,
    driverNotes,
    setEditingLocations,
    setEditedDriverNotes,
    setDriverNotes,
    setLeadPassengerName,
    setVehicleInfo,
    setPassengerCount,
    setTripDestination,
    setShowPreviewModal,
    handleSaveRouteEdits,
  });

  const handleEditManually = () => {
    // Set editingLocations with preview data (pre-filled)
    setEditingLocations(previewLocations);
    // Update driver notes
    if (previewDriverNotes !== driverNotes) {
      setEditedDriverNotes(previewDriverNotes);
    }
    // Pre-fill non-location fields in manual form
    if (previewNonLocationFields.leadPassengerName) {
      setLeadPassengerName(previewNonLocationFields.leadPassengerName);
    }
    if (previewNonLocationFields.vehicleInfo) {
      setVehicleInfo(previewNonLocationFields.vehicleInfo);
    }
    if (previewNonLocationFields.passengerCount) {
      setPassengerCount(previewNonLocationFields.passengerCount);
    }
    if (previewNonLocationFields.tripDestination) {
      setTripDestination(previewNonLocationFields.tripDestination);
    }
    // Close preview modal
    setShowPreviewModal(false);
    // Open edit route modal
    setShowEditRouteModal(true);
  };

  const handleCancelPreview = () => {
    setShowPreviewModal(false);
    setPreviewLocations([]);
    setPreviewChanges({ removed: [], modified: [], added: [] });
    setPreviewDriverNotes('');
    setPreviewNonLocationFields({});
    setOriginalValues({});
    setIsRegenerating(false);
  };


  const { handleExtractUpdates } = useUpdateExtraction({
    updateText,
    tripData,
    tripDestination,
    driverNotes,
    leadPassengerName,
    vehicleInfo,
    passengerCount,
    isAuthenticated,
    isOwner,
    isGuestCreator,
    setIsExtracting,
    setError,
    setUpdateProgress,
    setExtractedUpdates,
    setPreviewLocations,
    setPreviewChanges,
    setPreviewDriverNotes,
    setPreviewNonLocationFields,
    setOriginalValues,
    setLeadPassengerName,
    setVehicleInfo,
    setPassengerCount,
    setTripDestination,
    setShowPreviewModal,
    setShowSignupModal,
    updateProgress,
  });

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
            formattedAddress: loc.formattedAddress || loc.fullAddress || '', // Never fall back to name (purpose)
            address: loc.name,
            time: loc.time,
            purpose: loc.name,
            lat: loc.lat,
            lng: loc.lng,
            fullAddress: loc.fullAddress || '', // Never fall back to name (purpose)
          };
        });
      }
    } else if (comparison.locations && Array.isArray(comparison.locations)) {
      comparison.locations.forEach((locChange: any) => {
        // GUARD: Skip invalid location changes
        if (!locChange || typeof locChange !== 'object') {
          return;
        }

        if (!locChange.action) {
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
              return; // Skip this location
            }

            // GUARD: Ensure lat/lng exist and are numbers (allow 0 for now, existing logic handles it)
            if (finalLoc.lat === undefined || finalLoc.lng === undefined) {
              return; // Skip this location
            }

            // FIX: Validate and fix ID for added locations
            if (!finalLoc.id || finalLoc.id === 'currentLocation.id' || finalLoc.id === 'extractedLocation.id' || finalLoc.id.includes('Location.id')) {
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
              // Always prefer fullAddress, never fall back to name (purpose)
              finalLoc.formattedAddress = locChange.extractedLocation.formattedAddress ||
                locChange.extractedLocation.location ||
                finalLoc.fullAddress ||
                finalLoc.address;
              // Never use finalLoc.name as it contains purpose, not address
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
              // Fallback: Use current location if available
              if (currentLoc) {
                finalLocationsMap[locChange.currentIndex] = currentLoc;
              }
              return; // Skip to next location
            }

            // GUARD: Ensure lat/lng exist (allow 0 for now, existing logic handles it)
            if (finalLoc.lat === undefined || finalLoc.lng === undefined) {
              // Fallback: Use current location if available
              if (currentLoc) {
                finalLocationsMap[locChange.currentIndex] = currentLoc;
              }
              return; // Skip to next location
            }

            // FIX: Validate and fix ID if AI returned literal string instead of actual value
            if (!finalLoc.id || finalLoc.id === 'currentLocation.id' || finalLoc.id === 'extractedLocation.id' || finalLoc.id.includes('Location.id')) {
              finalLoc.id = currentLoc?.id || `location-${locChange.currentIndex}-${Date.now()}`;
            }

            // FIX: Preserve address fields for time-only changes (prevent address corruption)
            if (locChange.changes?.timeChanged && !locChange.changes?.addressChanged && currentLoc) {
              finalLoc.fullAddress = currentLoc.fullAddress || finalLoc.fullAddress;
              finalLoc.formattedAddress = currentLoc.formattedAddress || finalLoc.formattedAddress;
              finalLoc.address = currentLoc.address || finalLoc.address;
              // Reconstruct name with preserved address
              if (finalLoc.purpose && currentLoc.fullAddress) {
                finalLoc.name = `${finalLoc.purpose}, ${currentLoc.fullAddress}`;
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
              const beforeFullAddress = finalLoc.fullAddress;
              finalLoc.fullAddress = locChange.extractedLocation.formattedAddress ||
                locChange.extractedLocation.location ||
                finalLoc.address ||
                finalLoc.name;
              if (finalLoc.fullAddress !== beforeFullAddress) {
                // Check if address is just city name
                if (finalLoc.fullAddress && finalLoc.fullAddress.toLowerCase() === (tripDestination || '').toLowerCase()) {
                }
              }
            }
            if (!finalLoc.formattedAddress && locChange.extractedLocation) {
              const beforeFormattedAddress = finalLoc.formattedAddress;
              finalLoc.formattedAddress = locChange.extractedLocation.formattedAddress ||
                locChange.extractedLocation.location ||
                finalLoc.address ||
                finalLoc.name;
              if (finalLoc.formattedAddress !== beforeFormattedAddress) {
                if (finalLoc.formattedAddress && finalLoc.formattedAddress.toLowerCase() === (tripDestination || '').toLowerCase()) {
                }
              }
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
            const currentFullAddress = currentLoc?.fullAddress;
            const fullAddress = timeOnlyChange && currentFullAddress
              ? currentFullAddress
              : (locChange.extractedLocation.formattedAddress ||
                locChange.extractedLocation.location ||
                locChange.currentLocation.address ||
                currentFullAddress ||
                locChange.currentLocation.name);
            // Diagnostic logging for address assignment
            if (fullAddress && fullAddress.toLowerCase() === (tripDestination || '').toLowerCase()) {
            }

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
              formattedAddress: currentLoc.formattedAddress || currentLoc.fullAddress || currentLoc.address || '', // Never fall back to name (purpose)
              address: currentLoc.name,
              time: currentLoc.time,
              purpose: currentLoc.name,
              lat: currentLoc.lat,
              lng: currentLoc.lng,
              fullAddress: currentLoc.fullAddress || currentLoc.formattedAddress || currentLoc.address || currentLoc.name,
            };
          } else if (locChange.finalLocation) {
            // Fallback to finalLocation only if currentLoc doesn't exist
            const finalLoc = locChange.finalLocation;
            // Ensure formattedAddress is set for proper display
            if (!finalLoc.formattedAddress) {
              // Always prefer fullAddress, never fall back to name (purpose)
              finalLoc.formattedAddress = finalLoc.fullAddress || finalLoc.address;
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
        }
      });
    }

    // CRITICAL FIX: Ensure ALL current locations are preserved if not explicitly removed
    // This handles cases where the AI comparison might miss some unchanged locations
    if (tripData?.locations && tripData.locations.length > 0) {
      tripData.locations.forEach((currentLoc: any, idx: number) => {
        // Skip if explicitly removed
        if (removedIndices.has(idx)) {
          return;
        }

        // If this location index doesn't exist in finalLocationsMap yet, add it
        if (finalLocationsMap[idx] === undefined) {
          finalLocationsMap[idx] = {
            id: currentLoc.id,
            name: currentLoc.name,
            formattedAddress: currentLoc.formattedAddress || currentLoc.fullAddress || currentLoc.address || currentLoc.name,
            address: currentLoc.name,
            time: currentLoc.time,
            purpose: currentLoc.name,
            lat: currentLoc.lat,
            lng: currentLoc.lng,
            fullAddress: currentLoc.fullAddress || currentLoc.formattedAddress || currentLoc.address || currentLoc.name,
          };
        }
        // Also ensure existing entries have valid coordinates
        else if (finalLocationsMap[idx] && (!finalLocationsMap[idx].lat || !finalLocationsMap[idx].lng || finalLocationsMap[idx].lat === 0 || finalLocationsMap[idx].lng === 0)) {
          const beforeLat = finalLocationsMap[idx].lat;
          const beforeLng = finalLocationsMap[idx].lng;
          finalLocationsMap[idx].lat = currentLoc.lat;
          finalLocationsMap[idx].lng = currentLoc.lng;
        } else if (finalLocationsMap[idx]) {
          // Log coordinate state even if not restoring
        }
      });
    }

    // Sort final locations by index and add to diff
    const sortedIndices = Object.keys(finalLocationsMap)
      .map(k => parseInt(k))
      .filter(idx => !isNaN(idx))
      .sort((a, b) => a - b);

    diff.finalLocations = sortedIndices.map(idx => {
      const loc = finalLocationsMap[idx];
      // Log each location's state
      // Check for issues
      if (loc.lat === 0 && loc.lng === 0) {
      }
      if (loc.fullAddress && loc.fullAddress.toLowerCase() === (tripDestination || '').toLowerCase()) {
      }
      return loc;
    });

    // FIX: Ensure unique IDs in final locations array (prevent React duplicate key errors)
    const usedIds = new Set<string>();
    diff.finalLocations = diff.finalLocations.map((loc: any, idx: number) => {
      if (usedIds.has(loc.id)) {
        const newId = `location-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return { ...loc, id: newId };
      }
      usedIds.add(loc.id);
      return loc;
    });

    // If no locations in final (shouldn't happen, but fallback), preserve all current locations
    if (diff.finalLocations.length === 0 && tripData?.locations && tripData.locations.length > 0) {
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


      const days = 7; // Fixed period for trip planning

      // Get city configuration for conditional API calls
      const cityConfig = getCityConfig(tripDestination);

      // Fetch data for all locations in parallel
      // Step 4 is already set to loading from handleRegenerateDirectly
      setRegenerationProgress(55);
      setRegenerationStep(`Fetching data for ${validLocations.length} location(s)...`);
      const results = await Promise.all(
        validLocations.map(async (location) => {

          const tempDistrictId = `custom-${Date.now()}-${location.id}`;

          // Universal APIs (always called)
          const universalCalls = [
            fetch(`/api/weather?district=${tempDistrictId}&lat=${location.lat}&lng=${location.lng}&days=${days}${tripDestination ? `&tripDestination=${encodeURIComponent(tripDestination)}` : ''}`),
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
                throw new Error(`${responseNames[i]} API returned ${responses[i].status}: ${errorText}`);
              }
            }
          } else {
            // For non-London, only check weather API
            if (!weatherResponse.ok) {
              const errorText = await weatherResponse.text();
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
      setRegenerationProgress(70);
      setRegenerationStep('Calculating traffic predictions...');
      setRegenerationSteps(prev => prev.map(s =>
        s.id === '4' ? { ...s, status: 'completed' as const } :
          s.id === '5' ? { ...s, status: 'loading' as const } : s
      ));
      let trafficData = null;
      try {
        trafficData = await getTrafficPredictions(validLocations, tripDateStr, tripDestination);
      } catch (trafficError) {
        trafficData = {
          success: false,
          error: 'Failed to get traffic predictions',
        };
      }

      // Generate executive report
      setRegenerationProgress(80);
      setRegenerationStep('Generating executive report...');
      setRegenerationSteps(prev => prev.map(s =>
        s.id === '5' ? { ...s, status: 'completed' as const } :
          s.id === '6' ? { ...s, status: 'loading' as const } : s
      ));
      let executiveReportData = null;

      const reportResult = await generateReport({
        results,
            tripDate: tripDateStr,
        trafficData,
            emailContent: updateText || null,
            leadPassengerName: leadPassengerName || null,
            vehicleInfo: vehicleInfo || null,
            passengerCount: passengerCount || 1,
            tripDestination: tripDestination || null,
            passengerNames: passengerNames || [],
            driverNotes: editedDriverNotes || driverNotes || null,
        });

      if (reportResult.success && reportResult.data) {
          executiveReportData = reportResult.data;
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
        return loc;
      });

      locationsWithCoordinates.forEach((loc, idx) => {
      });

      const updateData: any = {
        trip_date: tripDateStr,
        locations: locationsWithCoordinates as any,
        trip_results: results as any,
        traffic_predictions: trafficPredictionsForDb as any,
        executive_report: executiveReportData as any,
        trip_notes: editedDriverNotes || driverNotes || null,
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
        s.id === '6' ? { ...s, status: 'completed' as const } :
          s.id === '7' ? { ...s, status: 'loading' as const } : s
      ));
      const { data: updatedTrip, error: updateError } = await supabase
        .from('trips')
        .update(updateData)
        .eq('id', tripId)
        .select()
        .single();

      if (updateError || !updatedTrip) {
        throw new Error(`Failed to update trip: ${updateError?.message || 'Unknown error'}`);
      }


      setRegenerationProgress(100);
      setRegenerationStep('Update complete!');
      setRegenerationSteps(prev => prev.map(s => s.id === '7' ? { ...s, status: 'completed' as const } : s));

      // Cleanup: Clear update text and states
      setUpdateText('');
      setComparisonDiff(null);
      setExtractedUpdates(null);
      setUpdateProgress({ step: '', error: null, canRetry: false });

      // Small delay to show completion, then handle next steps
      setTimeout(() => {
        setIsRegenerating(false);

        // Show notification modal if driver is set
        if (driverEmail) {
          setTimeout(() => {
            setShowUpdateNotificationModal(true);
          }, 500); // Increased delay for modal transition
        } else {
          // No driver, just reload
          window.location.reload();
        }
      }, 1000); // Increased to show "Update complete!" clearly
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate report');
      setIsRegenerating(false);
    }
  };

  // Direct regeneration handler (called from handleExtractUpdates, skipping preview)
  const { handleRegenerateDirectly } = useTripRegeneration({
    tripData,
    tripDestination,
    driverNotes,
    leadPassengerName,
    vehicleInfo,
    passengerCount,
    setError,
    setIsRegenerating,
    setRegenerationStep,
    setRegenerationProgress,
    setRegenerationSteps,
    performTripAnalysisUpdate,
  });

  // Show loading state until ownership is checked AND role is fully determined
  // This prevents glitching where QuoteFormSection shows briefly for owners
  if (loading || !ownershipChecked || userRole.role === null) {
    return (
      <div className="min-h-screen bg-background">
        {/* Don't render QuoteFormSection until role is fully determined */}
        <LoadingState ownershipChecked={ownershipChecked} isOwner={isOwner} />
      </div>
    );
  }

  if (error || !tripData || !tripData.tripResults) {
    return <ErrorState error={error} />;
  }


  const { tripDate, tripResults, trafficPredictions, executiveReport } = tripData;

  return (
    <div className="min-h-screen bg-background">
      {/* Quote Form Section - Sticky Bar - Shows for:
          1. Guests invited to submit quotes
          2. Any non-owner viewer (but not guest creators or guest-created trips)
          3. Drivers accessing via token (isDriverView && driverToken) */}
      <QuoteFormSection
        scrollY={scrollY}
        canSubmitQuote={userRole.canSubmitQuote}
        isDriverView={isDriverView}
        driverToken={driverToken}
        quoteEmail={quoteEmail}
        quoteDriverName={quoteDriverName}
        quotePrice={quotePrice}
        quoteCurrency={quoteCurrency}
        quoteEmailError={quoteEmailError}
        quotePriceError={quotePriceError}
        submittingQuote={submittingQuote}
        myQuotes={myQuotes}
        isEmailFromUrl={isEmailFromUrl}
        onEmailChange={setQuoteEmail}
        onDriverNameChange={setQuoteDriverName}
        onPriceChange={setQuotePrice}
        onCurrencyChange={setQuoteCurrency}
        onSubmit={handleSubmitQuote}
      />

      {/* Update Quote Modal */}
      <UpdateQuoteModal
        open={showUpdateQuoteModal}
        onOpenChange={setShowUpdateQuoteModal}
        myQuotes={myQuotes}
        updateQuotePrice={updateQuotePrice}
        updateQuotePriceError={updateQuotePriceError}
        updatingQuote={updatingQuote}
        onUpdateQuotePriceChange={setUpdateQuotePrice}
        onUpdateQuote={handleUpdateQuote}
        onDismiss={() => {
                setShowUpdateQuoteModal(false);
                setUpdateQuotePrice('');
                setUpdateQuotePriceError(null);
              }}
      />

      {/* Update Trip Section - Sticky Bar - Only show for owners and guest creators */}
      <UpdateTripSection
        updateText={updateText}
        setUpdateText={setUpdateText}
        isExtracting={isExtracting}
        isRegenerating={isRegenerating}
        updateProgress={updateProgress}
        updateTextareaRef={updateTextareaRef}
        handleExtractUpdates={handleExtractUpdates}
        scrollY={scrollY}
        canUpdateTrip={userRole.canUpdateTrip}
      />

      {/* Booking Success Modal */}
      <Dialog open={showBookingSuccess} onOpenChange={setShowBookingSuccess}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Booking Confirmed!
            </DialogTitle>
            <DialogDescription className="text-base text-foreground pt-2">
              Your booking has been confirmed! You will receive a confirmation email in your inbox.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setShowBookingSuccess(false)}
              className="w-full sm:w-auto"
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <div className="container mx-auto px-4 pt-32 pb-8">

        {/* Loading State Modal - Full Screen Overlay (Same as Homepage) */}
        <RegenerationLoadingModal
          isRegenerating={isRegenerating}
          regenerationProgress={regenerationProgress}
          regenerationSteps={regenerationSteps}
          error={error}
          onClose={() => {
            setError(null);
            setIsRegenerating(false);
          }}
        />

        {/* Preview Modal - REMOVED: Flow now goes directly from comparison to regeneration */}

        {/* Results Section */}
        <div className="mb-8">


          {/* Service Introduction */}
          <TripSummarySection
              leadPassengerName={leadPassengerName}
              passengerCount={passengerCount}
              tripDate={tripDate}
              tripDestination={tripDestination}
              locations={locations}
              vehicleInfo={vehicleInfo}
              driverNotes={driverNotes}
              mapLocations={mapLocations}
              trafficPredictions={trafficPredictions}
              tripStatus={tripStatus}
              driverResponseStatus={driverResponseStatus}
              driverEmail={driverEmail}
              originalDriverEmail={originalDriverEmailRef.current}
              quotes={quotes}
              sentDriverEmails={sentDriverEmails}
              isOwner={isOwner}
              quoteEmail={quoteEmail}
              driverToken={driverToken}
              validatedDriverEmail={validatedDriverEmail}
              updatingStatus={updatingStatus}
              isDriverView={isDriverView}
              quoteParam={quoteParam}
              isAuthenticated={isAuthenticated}
              tripId={tripId}
              theme={theme as 'light' | 'dark' | undefined}
              mounted={mounted}
              onStatusToggle={handleStatusToggle}
              onShowDriverModal={() => setShowDriverModal(true)}
              onShowMapModal={() => setShowMapModal(true)}
              onShowSignupModal={() => setShowSignupModal(true)}
              lowestDrivaniaPrice={lowestDrivaniaPrice}
              drivaniaCurrency={drivaniaCurrency}
              lowestExtraHourPrice={lowestExtraHourPrice}
              loadingDrivaniaQuote={loadingDrivaniaQuote}
            />

          {/* Trip Locations - Card View */}
          {!showChronologicalView && (
            <LocationCardSection
              locations={locations}
              tripDate={tripDate}
              trafficPredictions={trafficPredictions}
              driverNotes={driverNotes}
              tripData={tripData}
              passengerCount={passengerCount}
              tripDestination={tripDestination}
              quoteParam={quoteParam}
              isAuthenticated={isAuthenticated}
              isOwner={isOwner}
              isTripCompleted={isTripCompleted}
              isTripWithinOneHour={isTripWithinOneHour}
              findClosestLocation={findClosestLocation}
              onShowSignupModal={() => setShowSignupModal(true)}
              onShowEditRouteModal={() => setShowEditRouteModal(true)}
              onShowMapModal={() => setShowMapModal(true)}
              onSetEditingLocations={setEditingLocations}
              onSetEditingTripDate={setEditingTripDate}
              onSetPassengerCount={setPassengerCount}
              onSetTripDestination={setTripDestination}
              onShowChronologicalView={() => setShowChronologicalView(true)}
            />
          )}

          {/* Chronological Journey Flow */}
          {showChronologicalView && (
            <ChronologicalView
              tripResults={tripResults}
              tripDate={tripDate}
              tripDestination={tripDestination}
              trafficPredictions={trafficPredictions}
              isOwner={isOwner}
              locationDisplayNames={locationDisplayNames}
              editingLocationId={editingLocationId}
              editingLocationName={editingLocationName}
              expandedLocations={expandedLocations}
              expandedRoutes={expandedRoutes}
              driverNotes={driverNotes}
              onEditLocationName={handleEditLocationName}
              onSaveLocationName={handleSaveLocationName}
              onKeyPress={handleKeyPress}
              onToggleLocationExpansion={toggleLocationExpansion}
              onToggleRouteExpansion={toggleRouteExpansion}
              onEditingLocationNameChange={setEditingLocationName}
              onClose={() => setShowChronologicalView(false)}
            />
          )}

          {/* Important Information */}
          {executiveReport?.importantInformation && (
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
                  {(() => {
                    // Split by multiple delimiters: newlines, semicolons, periods followed by space, or bullet points
                    const notes = executiveReport.importantInformation || '';
                    // First, try splitting by newlines (most common)
                    let points = notes.split(/\n+/);

                    // If no newlines found, try splitting by semicolons
                    if (points.length === 1 && notes.includes(';')) {
                      points = notes.split(/;+/);
                    }

                    // If still single item, try splitting by periods followed by space (sentence boundaries)
                    if (points.length === 1 && notes.includes('. ')) {
                      points = notes.split(/\.\s+/).filter((p: string) => p.length > 0);
                    }

                    // Clean up each point: trim, remove leading bullets, and filter empty
                    const cleanedPoints = points
                      .map((point: string) => point.trim())
                      .map((point: string) => point.replace(/^[-•*]\s*/, ''))
                      .filter((point: string) => point.length > 0);

                    return cleanedPoints.map((point: string, index: number) => (
                      <div key={index} className="flex items-start gap-2 mb-0.5">
                        <span className="text-muted-foreground mt-0.5">·</span>
                        <span>{point}</span>
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Exceptional Information */}
          {executiveReport?.exceptionalInformation && (
            <Card className="mb-6 shadow-none bg-[#9e2622] dark:bg-[#9e2622] border-[#9e2622] dark:border-[#9e2622]">
              <CardContent className="px-3 py-1 pl-6">
                <div className="mb-3">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="#f60000">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Important remarks
                  </h3>
                </div>
                <div className="text-lg leading-snug text-white/95">
                  {(() => {
                    // Split by multiple delimiters: newlines, semicolons, periods followed by space, or bullet points
                    const notes = executiveReport.exceptionalInformation || '';
                    // First, try splitting by newlines (most common)
                    let points = notes.split(/\n+/);

                    // If no newlines found, try splitting by semicolons
                    if (points.length === 1 && notes.includes(';')) {
                      points = notes.split(/;+/);
                    }

                    // If still single item, try splitting by periods followed by space (sentence boundaries)
                    if (points.length === 1 && notes.includes('. ')) {
                      points = notes.split(/\.\s+/).filter((p: string) => p.length > 0);
                    }

                    // Clean up each point: trim, remove leading bullets, and filter empty
                    const cleanedPoints = points
                      .map((point: string) => point.trim())
                      .map((point: string) => point.replace(/^[-•*]\s*/, ''))
                      .filter((point: string) => point.length > 0);

                    return cleanedPoints.map((point: string, index: number) => (
                      <div key={index} className="flex items-start gap-2 mb-0.5">
                        <span className="text-white mt-0.5">·</span>
                        <span>{point}</span>
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risk Score and Recommendations */}
          {executiveReport && (
            <div className="space-y-4 mb-6">
              {/* Top row: Risk Score (33%) and Top Disruptor (66%) */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                {/* Risk Score - 33% width */}
                <Card className="bg-primary dark:bg-[#1f1f21] w-full sm:w-1/3 flex-shrink-0">
                  <CardContent className="px-3 sm:px-4 py-3 sm:py-4 pl-4 sm:pl-6">
                    <h4 className="text-lg sm:text-xl font-semibold text-primary-foreground dark:text-card-foreground mb-3 sm:mb-2">
                      Risk score
                    </h4>
                    <div className="bg-card border border-border rounded-md p-3 sm:p-4 text-center">
                      <div
                        className="text-4xl sm:text-5xl font-bold mb-1"
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
                      <div className="text-xs sm:text-sm text-muted-foreground font-medium mb-2">
                        out of 10
                      </div>
                      <div
                        className="text-xs sm:text-sm font-semibold tracking-wide px-3 py-1.5 sm:py-1 rounded"
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

                {/* Top Disruptor - fills remaining space */}
                <Card className="bg-primary dark:bg-[#1f1f21] w-full sm:flex-1">
                  <CardContent className="px-3 sm:px-4 py-3 sm:py-4 pl-4 sm:pl-6">
                    <h4 className="text-lg sm:text-xl font-semibold text-primary-foreground dark:text-card-foreground mb-2 sm:mb-3">
                      Top Disruptor
                    </h4>
                    <p className="text-base sm:text-lg text-primary-foreground/80 dark:text-muted-foreground leading-snug break-words">
                      {executiveReport.topDisruptor}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Bottom row: Recommendations for the Driver - full width */}
              <Card className="shadow-none">
                <CardContent className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 pl-4 sm:pl-6">
                  <div className="mb-3">
                    <h4 className="text-lg sm:text-xl font-semibold text-card-foreground">Recommendations for the Driver</h4>
                  </div>
                  <div className="text-base sm:text-lg leading-snug">
                    {executiveReport.recommendations.map((rec: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 mb-1 sm:mb-0.5">
                        <svg className="w-4 h-4 text-card-foreground mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span className="break-words">{rec}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Executive Report */}
          {executiveReport && (
            <>




            </>
          )}

        </div>

        {/* Request Quotes from Drivers - Now only in modal */}
        {
          false && (
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
          )
        }

        {/* Quotes Table - Now only in modal */}
        {
          false && (
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
                              className={`border-b hover:bg-secondary/50 dark:hover:bg-[#181a23] transition-colors ${isDriver ? 'bg-[#3ea34b]/10 border-[#3ea34b]/30' : ''
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
          )
        }

        {/* Driver Confirmation Card - Token validation error */}
        {
          !isOwner && tokenValidationError && (
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
          )
        }


        {/* Driver Confirmation Card - Email-based Flow (Old flow for backward compatibility) */}
        {
          !isOwner && !isDriverView && tripStatus === 'pending' && driverEmail && quoteEmail &&
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
          )
        }

        {/* Quote Submission Form - REMOVED - Now sticky at top for non-owners */}


        {/* Success message after signup */}
        {
          guestSignupSuccess && (
            <Alert className="mb-8 bg-[#3ea34b]/10 border-[#3ea34b]/30">
              <AlertDescription className="text-[#3ea34b] text-center">
                ✅ Account created successfully! This trip is now saved to your account. Refreshing...
              </AlertDescription>
            </Alert>
          )
        }

        {/* Footer Navigation */}
        <div className="py-8">
          <div className="flex flex-wrap justify-end gap-3 items-center">
            {isOwner && (
              <button
                onClick={handleDeleteTrip}
                disabled={deletingTrip || loading}
                className="text-sm text-destructive hover:text-destructive/80 underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingTrip ? 'Deleting...' : 'Delete trip'}
              </button>
            )}
            <Button
              onClick={handlePlanNewTrip}
              variant="default"
              size="lg"
              className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
            >
              Plan new trip
            </Button>
          </div>
        </div>
      </div >

      {/* Driver & Quotes Modal */}
      <DriverQuotesModal
        open={showDriverModal}
        onClose={() => setShowDriverModal(false)}
        assignOnlyMode={assignOnlyMode}
        onAssignOnlyModeChange={setAssignOnlyMode}
        tripStatus={tripStatus}
        tripId={tripId}
        isOwner={isOwner}
        driverEmail={driverEmail}
        manualDriverEmail={manualDriverEmail}
        manualDriverError={manualDriverError}
        allocateDriverEmailError={allocateDriverEmailError}
        showDriverSuggestions={showDriverSuggestions}
        driverSuggestions={driverSuggestions}
        filteredDriverSuggestions={filteredDriverSuggestions}
        onManualDriverInputChange={handleManualDriverInputChange}
        onManualDriverInputFocus={handleManualDriverInputFocus}
        onSelectDriverSuggestion={handleSelectDriverSuggestion}
        settingDriver={settingDriver}
        sendingQuoteRequest={sendingQuoteRequest}
        quoteRequestSuccess={quoteRequestSuccess}
        quoteRequestError={quoteRequestError}
        quotes={quotes}
        loadingQuotes={loadingQuotes}
        sentDriverEmails={sentDriverEmails}
        onShowFlowAModal={(email) => {
          setSelectedQuoteDriver(email);
          setShowFlowAModal(true);
        }}
        onShowFlowBModal={(email) => {
          setDirectAssignDriver(email);
                              setShowFlowBModal(true);
                            }}
        onSendQuoteRequest={handleSendQuoteRequest}
        onCloseDriverSuggestions={() => setShowDriverSuggestions(false)}
        lowestDrivaniaPrice={lowestDrivaniaPrice}
        drivaniaCurrency={drivaniaCurrency}
        lowestExtraHourPrice={lowestExtraHourPrice}
        loadingDrivaniaQuote={loadingDrivaniaQuote}
        vehicleInfo={vehicleInfo}
        driverNotes={driverNotes}
        passengerCount={passengerCount}
        tripDestination={tripDestination}
        leadPassengerName={leadPassengerName}
        tripDate={tripData?.tripDate || ''}
        locations={locations}
      />

      {/* Status Change Confirmation Modal */}
      <StatusChangeModal
        open={showStatusModal}
        onOpenChange={setShowStatusModal}
        driverEmail={driverEmail}
        tripStatus={tripStatus}
        tripId={tripId}
        tripDate={tripDate}
        leadPassengerName={leadPassengerName}
        statusModalSuccess={statusModalSuccess}
        resendingConfirmation={resendingConfirmation}
        cancellingTrip={cancellingTrip}
        onClose={() => {
                  setShowStatusModal(false);
                  setPendingStatus(null);
                  setStatusModalSuccess(null);
                  setResendingConfirmation(false);
                  setCancellingTrip(false);
                }}
        onStatusUpdate={setTripStatus}
        onDriverEmailUpdate={setDriverEmail}
        onStatusModalSuccessUpdate={setStatusModalSuccess}
        onResendingConfirmationUpdate={setResendingConfirmation}
        onCancellingTripUpdate={setCancellingTrip}
      />

      {/* Signup Modal - Shown when non-authenticated users try to use features */}
      <GuestSignupModal
        open={showSignupModal}
        onOpenChange={setShowSignupModal}
        userEmail={tripData?.userEmail || null}
        guestSignupPassword={guestSignupPassword}
        guestSignupError={guestSignupError}
        guestSignupLoading={guestSignupLoading}
        guestSignupSuccess={guestSignupSuccess}
        onPasswordChange={setGuestSignupPassword}
        onSubmit={handleGuestSignup}
      />

      {/* Flow A Confirmation Modal - Selecting driver from quotes */}
      <FlowAModal
        open={showFlowAModal}
        onOpenChange={setShowFlowAModal}
        isAuthenticated={isAuthenticated}
        selectedQuoteDriver={selectedQuoteDriver}
        settingDriver={settingDriver}
        tripId={tripId}
        onDismiss={() => {
                setShowFlowAModal(false);
                setSelectedQuoteDriver(null);
              }}
        onShowSignup={() => setShowSignupModal(true)}
        onSetDriver={handleSetDriver}
        onStatusUpdate={setTripStatus}
        onCloseDriverModal={() => setShowDriverModal(false)}
        onError={setManualDriverError}
      />

      {/* Flow B Confirmation Modal - Direct driver assignment */}
      <FlowBModal
        open={showFlowBModal}
        onOpenChange={setShowFlowBModal}
        directAssignDriver={directAssignDriver}
        settingDriver={settingDriver}
        tripId={tripId}
        onDismiss={() => {
                setShowFlowBModal(false);
                setDirectAssignDriver(null);
              }}
        onSetDriver={handleSetDriver}
        onStatusUpdate={setTripStatus}
        onCloseDriverModal={() => setShowDriverModal(false)}
        onCloseAssignOnlyMode={() => setAssignOnlyMode(false)}
        onClearDirectAssignDriver={() => setDirectAssignDriver(null)}
        onClearManualDriverEmail={() => setManualDriverEmail('')}
        onError={setManualDriverError}
      />

      {/* Booking Preview Modal - Removed: Now handled on /booking/[tripId] page */}

      {/* Driver Confirmation Dialog */}
      <DriverConfirmDialog
        open={showDriverConfirmDialog}
        onOpenChange={setShowDriverConfirmDialog}
        confirmingTrip={confirmingTrip}
        onConfirm={handleDriverConfirmTrip}
      />

      <DriverAcceptRejectModal
        open={showDriverAcceptRejectModal}
        onOpenChange={setShowDriverAcceptRejectModal}
        confirmingTrip={confirmingTrip}
        rejectingTrip={rejectingTrip}
        onAccept={handleDriverConfirmTrip}
        onReject={handleDriverRejectTrip}
      />

      {/* Driver Assignment Info Modal - Shows when driver clicks confirmation with token but action already taken */}
      <DriverAssignmentInfoModal
        open={showDriverAssignmentInfoModal}
        onOpenChange={setShowDriverAssignmentInfoModal}
        tripStatus={tripStatus}
        validatedDriverEmail={validatedDriverEmail}
        tokenMessage={tokenMessage}
      />

      {/* Driver Rejection Dialog */}
      <DriverRejectDialog
        open={showDriverRejectDialog}
        onOpenChange={setShowDriverRejectDialog}
        rejectingTrip={rejectingTrip}
        onReject={handleDriverRejectTrip}
      />

      {/* Route View Map Modal */}
      <RouteViewMapModal
        open={showMapModal}
        onClose={() => setShowMapModal(false)}
        mapLocations={mapLocations}
                    tripDestination={tripDestination}
                  />

      {/* Trip Update Notification Modal */}
      <UpdateNotificationModal
        open={showUpdateNotificationModal}
        onOpenChange={setShowUpdateNotificationModal}
        sendingUpdateNotification={sendingUpdateNotification}
        onResponse={handleUpdateNotificationResponse}
      />

      {/* Confirm Driver Required Modal */}
      <ConfirmDriverRequiredModal
        open={showConfirmDriverRequiredModal}
        onOpenChange={setShowConfirmDriverRequiredModal}
        onAssignDriver={() => setShowDriverModal(true)}
      />

      {/* Edit Route Modal */}
      <EditRouteModal
        open={showEditRouteModal}
        onOpenChange={setShowEditRouteModal}
        editingTripDate={editingTripDate}
        editingLocations={editingLocations}
        editingExtractedIndex={editingExtractedIndex}
        editingExtractedField={editingExtractedField}
        leadPassengerName={leadPassengerName}
        passengerCount={passengerCount}
        vehicleInfo={vehicleInfo}
        tripDestination={tripDestination}
        tripDataDestination={tripData?.tripDestination || null}
        editedDriverNotes={editedDriverNotes}
        isRegenerating={isRegenerating}
        onTripDateChange={setEditingTripDate}
        onLocationsChange={setEditingLocations}
        onEditingIndexChange={setEditingExtractedIndex}
        onEditingFieldChange={setEditingExtractedField}
        onLeadPassengerNameChange={setLeadPassengerName}
        onPassengerCountChange={setPassengerCount}
        onVehicleInfoChange={setVehicleInfo}
        onEditedDriverNotesChange={setEditedDriverNotes}
                      onLocationSelect={handleEditLocationSelect}
                      onTimeChange={handleEditTimeChange}
        onLocationRemove={handleEditLocationRemove}
        onAddLocation={handleAddEditLocation}
        onDragEnd={handleEditRouteDragEnd}
        onSave={handleSaveRouteEdits}
        sensors={editRouteSensors}
      />

      {/* Preview Modal for AI-Assisted Updates */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Review changes</DialogTitle>
            <DialogDescription>
              Review the changes extracted from your update. You can apply them, edit manually, or cancel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Removed Locations */}
            {previewChanges.removed.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Removed locations</h3>
                {previewChanges.removed.map((removed, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-md border bg-muted/30 border-border line-through opacity-60"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {removed.index === 0 ? 'Pickup' : removed.index === (tripData?.locations?.length || 0) - 1 ? 'Dropoff' : `Stop ${removed.index + 1}`}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded">
                        Removed
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">{removed.location.name || removed.location.displayName || '(empty)'}</div>
                      <div className="text-xs text-muted-foreground">Time: {removed.location.time || '(empty)'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Updated Locations List - Only show modified or added locations */}
            {(previewChanges.modified.length > 0 || previewChanges.added.length > 0) && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Updated locations</h3>
                {previewLocations.map((loc, idx) => {
                  const isModified = previewChanges.modified.includes(idx);
                  const isAdded = previewChanges.added.includes(idx);

                  // Only show modified or added locations
                  if (!isModified && !isAdded) {
                    return null;
                  }

                  // Find original location for comparison using the mapping from calculateChanges
                  const originalLoc = previewChanges.originalLocationMap?.get(idx);

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-md border bg-muted/30 border-border"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-medium text-muted-foreground">
                              {idx === 0 ? 'Pickup' : idx === previewLocations.length - 1 ? 'Dropoff' : `Stop ${idx + 1}`}
                            </span>
                            {isModified && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground rounded">
                                Modified
                              </span>
                            )}
                            {isAdded && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground rounded">
                                New
                              </span>
                            )}
                          </div>

                          <div className="space-y-2">
                            {/* Location Name/Address */}
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">Location:</div>
                              {isModified && originalLoc ? (
                                <div className="space-y-1">
                                  <div className="text-sm text-muted-foreground line-through">{originalLoc.name || originalLoc.displayName || '(empty)'}</div>
                                  <div className="text-sm font-medium text-foreground">{loc.purpose || loc.location || loc.formattedAddress}</div>
                                </div>
                              ) : (
                                <div className="text-sm font-medium text-foreground">{loc.purpose || loc.location || loc.formattedAddress}</div>
                              )}
                              {loc.formattedAddress && loc.formattedAddress !== (loc.purpose || loc.location) && (
                                <div className="text-xs text-muted-foreground mt-1">{loc.formattedAddress}</div>
                              )}
                            </div>

                            {/* Time */}
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">Time:</div>
                              {isModified && originalLoc ? (
                                <div className="space-y-1">
                                  <div className="text-sm text-muted-foreground line-through">{originalLoc.time || '(empty)'}</div>
                                  <div className="text-sm font-medium text-foreground">{loc.time}</div>
                                </div>
                              ) : (
                                <div className="text-sm font-medium text-foreground">{loc.time}</div>
                              )}
                            </div>

                            {/* Address details if location changed */}
                            {isModified && originalLoc && (
                              (originalLoc.name || originalLoc.displayName) !== (loc.formattedAddress || loc.location || loc.purpose) && (
                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">Address:</div>
                                  <div className="space-y-1">
                                    <div className="text-sm text-muted-foreground line-through">{originalLoc.name || originalLoc.displayName || '(empty)'}</div>
                                    <div className="text-sm text-foreground">{loc.formattedAddress || loc.location || '(empty)'}</div>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Non-Location Field Changes */}
            {(previewNonLocationFields.leadPassengerName ||
              previewNonLocationFields.vehicleInfo ||
              previewNonLocationFields.passengerCount ||
              previewNonLocationFields.tripDestination) && (
                <div className="p-4 bg-muted/30 border border-border rounded-md">
                  <div className="text-sm font-semibold text-foreground mb-3">Trip details updated</div>
                  <div className="space-y-2 text-sm">
                    {previewNonLocationFields.leadPassengerName && (
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-foreground min-w-[140px]">Passenger name:</span>
                        <div className="flex-1">
                          <div className="text-muted-foreground line-through">{originalValues.leadPassengerName || '(empty)'}</div>
                          <div className="text-foreground font-medium">{previewNonLocationFields.leadPassengerName}</div>
                        </div>
                      </div>
                    )}
                    {previewNonLocationFields.passengerCount && (
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-foreground min-w-[140px]">Passenger count:</span>
                        <div className="flex-1">
                          <div className="text-muted-foreground line-through">{originalValues.passengerCount || 1}</div>
                          <div className="text-foreground font-medium">{previewNonLocationFields.passengerCount}</div>
                        </div>
                      </div>
                    )}
                    {previewNonLocationFields.vehicleInfo && (
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-foreground min-w-[140px]">Vehicle:</span>
                        <div className="flex-1">
                          <div className="text-muted-foreground line-through">{originalValues.vehicleInfo || '(empty)'}</div>
                          <div className="text-foreground font-medium">{previewNonLocationFields.vehicleInfo}</div>
                        </div>
                      </div>
                    )}
                    {previewNonLocationFields.tripDestination && (
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-foreground min-w-[140px]">Trip destination:</span>
                        <div className="flex-1">
                          <div className="text-muted-foreground line-through">{originalValues.tripDestination || '(empty)'}</div>
                          <div className="text-foreground font-medium">{previewNonLocationFields.tripDestination}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* Trip Notes Changes */}
            {previewDriverNotes && previewDriverNotes !== originalValues.driverNotes && (
              <div className="p-4 bg-muted/30 border border-border rounded-md">
                <div className="text-sm font-semibold text-foreground mb-3">Trip notes updated</div>
                <div className="space-y-2">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Previous:</div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap line-through">{originalValues.driverNotes || '(empty)'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">New:</div>
                    <div className="text-sm text-foreground whitespace-pre-wrap">{previewDriverNotes}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={handleCancelPreview}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleEditManually}
            >
              Edit manually
            </Button>
            <Button
              onClick={handleApplyPreview}
              className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
            >
              Apply changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}




