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
import { Car, Calendar as CalendarIcon, Maximize2 } from 'lucide-react';
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
import { safeJsonParse } from '@/lib/helpers/api-helpers';
import type {
  SortableEditLocationItemProps,
  TripData,
  DriverRecord,
} from './types';
import { formatTimeForPicker, getDestinationLocalTime, getLondonLocalTime } from './utils/time-helpers';
import { normalizeTripLocations, isAirportLocation } from './utils/location-helpers';
import { normalizeVehicleText, normalizeMatchKey, matchesDriverToVehicle, vehicleKey } from './utils/vehicle-helpers';
import { formatPriceDisplay, parsePriceInput } from './utils/price-helpers';
import { calculateCombinedScheduleRisk, calculateTimelineRealism } from './utils/risk-helpers';
import { extractFlightNumbers, extractServiceIntroduction } from './utils/extraction-helpers';
import { isValidTransition } from './utils/validation-helpers';
import { determineVehicleType, extractCarInfo } from './utils/vehicle-detection-helpers';
import { stripEmailMetadata, detectUnchangedFields, mapExtractedToManualForm, calculateChanges } from './utils/update-helpers';
import { usePreviewApplication } from './hooks/usePreviewApplication';
import { useUpdateExtraction } from './hooks/useUpdateExtraction';
import { useTripRegeneration } from './hooks/useTripRegeneration';
import { bookingPreviewInitialState, requiredFields, CURRENCY_OPTIONS, type BookingPreviewFieldKey } from './constants';
import { QuoteFormSection } from './components/QuoteFormSection';
import { RouteCard } from './components/RouteCard';
import { LocationDetailCard } from './components/LocationDetailCard';
import { TripSummarySection } from './components/TripSummarySection';
import { LocationCardSection } from './components/LocationCardSection';

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
              value={formatTimeForPicker(location.time)}
              onChange={(value) => {
                console.log('✅ [TimePicker] onChange triggered:', value, 'for index:', index);
                onTimeChange(index, value);
              }}
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
  const locations = React.useMemo(() => normalizeTripLocations(tripData?.locations), [tripData?.locations]);

  const quoteFormRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [ownershipChecked, setOwnershipChecked] = useState<boolean>(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editingLocationName, setEditingLocationName] = useState<string>('');
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
  const [confirmingTrip, setConfirmingTrip] = useState<boolean>(false);
  const [showDriverAcceptRejectModal, setShowDriverAcceptRejectModal] = useState<boolean>(false);
  const [driverResponseStatus, setDriverResponseStatus] = useState<'accepted' | 'rejected' | null>(null);

  // Driver token authentication (magic link)
  const [driverToken, setDriverToken] = useState<string | null>(null);
  const [validatedDriverEmail, setValidatedDriverEmail] = useState<string | null>(null);
  const [isDriverView, setIsDriverView] = useState<boolean>(false);
  const [tokenValidationError, setTokenValidationError] = useState<string | null>(null);
  const [tokenAlreadyUsed, setTokenAlreadyUsed] = useState<boolean>(false);
  const [tokenMessage, setTokenMessage] = useState<string | null>(null);
  const [canTakeAction, setCanTakeAction] = useState<boolean>(false);
  const [rejectingTrip, setRejectingTrip] = useState<boolean>(false);
  const [showDriverAssignmentInfoModal, setShowDriverAssignmentInfoModal] = useState<boolean>(false);

  // Map modal state
  const [showMapModal, setShowMapModal] = useState<boolean>(false);

  // Edit route modal state
  const [showEditRouteModal, setShowEditRouteModal] = useState<boolean>(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
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
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);
  const [activeLocationIndex, setActiveLocationIndex] = useState<number | null>(null);
  const [liveTripInterval, setLiveTripInterval] = useState<NodeJS.Timeout | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());


  // Trip status state
  const [tripStatus, setTripStatus] = useState<string>('not confirmed');
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [showConfirmDriverRequiredModal, setShowConfirmDriverRequiredModal] = useState<boolean>(false);
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
    driver_name: string | null;
    price: number;
    currency: string;
    created_at: string;
  }>>([]);
  const [loadingQuotes, setLoadingQuotes] = useState<boolean>(false);
  const [quoteEmail, setQuoteEmail] = useState<string>('');
  const [quoteDriverName, setQuoteDriverName] = useState<string>('');
  const [quotePrice, setQuotePrice] = useState<string>('');
  const [quoteCurrency, setQuoteCurrency] = useState<string>('USD');
  const [quoteEmailError, setQuoteEmailError] = useState<string | null>(null);
  const [quotePriceError, setQuotePriceError] = useState<string | null>(null);
  const [submittingQuote, setSubmittingQuote] = useState<boolean>(false);
  const [quoteSuccess, setQuoteSuccess] = useState<boolean>(false);
  const [quoteSuccessMessage, setQuoteSuccessMessage] = useState<string>('Quote submitted successfully!');
  const [showUpdateQuoteModal, setShowUpdateQuoteModal] = useState<boolean>(false);
  const [updateQuotePrice, setUpdateQuotePrice] = useState<string>('');
  const [updateQuotePriceError, setUpdateQuotePriceError] = useState<string | null>(null);
  const [updatingQuote, setUpdatingQuote] = useState<boolean>(false);

  // Driver's own quotes (only their submissions)
  const [myQuotes, setMyQuotes] = useState<Array<{
    id: string;
    email: string;
    driver_name: string | null;
    price: number;
    currency: string;
    created_at: string;
  }>>([]);
  const [loadingMyQuotes, setLoadingMyQuotes] = useState<boolean>(false);

  // Driver state
  const [driverEmail, setDriverEmail] = useState<string | null>(null);
  // Store original driver email from database to check activity even if state changes
  const originalDriverEmailRef = useRef<string | null>(null);
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

  // Drivania quote state
  const [loadingDrivaniaQuote, setLoadingDrivaniaQuote] = useState<boolean>(false);
  const [drivaniaQuotes, setDrivaniaQuotes] = useState<any>(null);
  const [drivaniaError, setDrivaniaError] = useState<string | null>(null);
  const [drivaniaServiceType, setDrivaniaServiceType] = useState<'one-way' | 'hourly' | null>(null);
  const [showOtherVehicles, setShowOtherVehicles] = useState<boolean>(false);
  const [selectedDrivaniaVehicle, setSelectedDrivaniaVehicle] = useState<any>(null);
  const [showBookingPreview, setShowBookingPreview] = useState<boolean>(false);
  const [matchingDrivers, setMatchingDrivers] = useState<DriverRecord[]>([]);
  const [loadingMatchingDrivers, setLoadingMatchingDrivers] = useState<boolean>(false);
  const [matchingDriversError, setMatchingDriversError] = useState<string | null>(null);
  // Track selection state for each vehicle: { vehicleId: { isVehicleSelected: boolean, selectedDriverIds: string[] } }
  const [vehicleSelections, setVehicleSelections] = useState<Record<string, { isVehicleSelected: boolean; selectedDriverIds: string[] }>>({});
  const [bookingPreviewFields, setBookingPreviewFields] = useState(bookingPreviewInitialState);
  const [missingFields, setMissingFields] = useState<Set<BookingPreviewFieldKey>>(new Set());
  const [bookingSubmissionState, setBookingSubmissionState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [bookingSubmissionMessage, setBookingSubmissionMessage] = useState<string>('');
  const [processingTimer, setProcessingTimer] = useState<NodeJS.Timeout | null>(null);

  // Guest signup state
  const [isGuestCreator, setIsGuestCreator] = useState<boolean>(false);
  const [isGuestCreatedTrip, setIsGuestCreatedTrip] = useState<boolean>(false);
  const [guestSignupPassword, setGuestSignupPassword] = useState<string>('');
  const [guestSignupError, setGuestSignupError] = useState<string | null>(null);
  const [guestSignupLoading, setGuestSignupLoading] = useState<boolean>(false);
  const [guestSignupSuccess, setGuestSignupSuccess] = useState<boolean>(false);
  const [showSignupModal, setShowSignupModal] = useState<boolean>(false);

  // Scroll position state for sticky update bar
  const [scrollY, setScrollY] = useState(0);


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

  const highlightMissing = (field: BookingPreviewFieldKey) =>
    missingFields.has(field) ? 'border-destructive/70 bg-destructive/10 text-destructive' : '';


  const preferredVehicleHint = React.useMemo(() => {
    return vehicleInfo?.trim() || driverNotes?.trim() || '';
  }, [vehicleInfo, driverNotes]);



  const matchesPreferredVehicle = React.useCallback((vehicle: any): boolean => {
    if (!preferredVehicleHint) return false;
    const hintNormalized = normalizeVehicleText(preferredVehicleHint);
    const hintWords = hintNormalized.split(/\s+/).filter(Boolean);
    const vehicleText = [
      vehicle.vehicle_type,
      vehicle.level_of_service,
      vehicle.vehicle_examples,
    ]
      .map(normalizeVehicleText)
      .join(' ');

    if (!vehicleText) {
      return false;
    }

    if (hintWords.length === 0) {
      return vehicleText.includes(hintNormalized);
    }

    return hintWords.every((word) => vehicleText.includes(word));
  }, [preferredVehicleHint]);

  useEffect(() => {
    return () => {
      if (processingTimer) {
        clearTimeout(processingTimer);
      }
    };
  }, [processingTimer]);

  const preferredVehicles = React.useMemo(() => {
    if (!drivaniaQuotes?.quotes?.vehicles || !preferredVehicleHint) {
      return [];
    }
    return drivaniaQuotes.quotes.vehicles.filter(matchesPreferredVehicle);
  }, [drivaniaQuotes, preferredVehicleHint, matchesPreferredVehicle]);

  const displayVehicles = React.useMemo(() => {
    if (preferredVehicles.length > 0) {
      return preferredVehicles;
    }
    return drivaniaQuotes?.quotes?.vehicles || [];
  }, [preferredVehicles, drivaniaQuotes]);


  const otherVehicles = React.useMemo(() => {
    if (!drivaniaQuotes?.quotes?.vehicles || preferredVehicles.length === 0) {
      return [];
    }
    const preferredKeys = new Set(preferredVehicles.map((vehicle: any) => vehicleKey(vehicle)));
    return drivaniaQuotes.quotes.vehicles.filter(
      (vehicle: any) => !preferredKeys.has(vehicleKey(vehicle))
    );
  }, [drivaniaQuotes, preferredVehicles]);

  const driverDestinationForDrivers = React.useMemo(() => {
    return (tripDestination || tripData?.tripDestination || '').trim();
  }, [tripDestination, tripData?.tripDestination]);

  useEffect(() => {
    let active = true;

    if (!driverDestinationForDrivers) {
      setMatchingDrivers([]);
      setMatchingDriversError(null);
      setLoadingMatchingDrivers(false);
      return;
    }

    const sanitizedDestination = driverDestinationForDrivers.replace(/[%_]/g, '').trim();
    const destinationPattern = `%${sanitizedDestination}%`;

    const fetchDrivers = async () => {
      setLoadingMatchingDrivers(true);
      setMatchingDriversError(null);

      try {
        const { data, error } = await supabase
          .from('drivers')
          .select('*')
          .ilike('destination', destinationPattern);

        if (!active) return;

        if (error) {
          throw error;
        }

        setMatchingDrivers(data || []);
      } catch (err) {
        console.error('❌ Error fetching matching drivers:', err);
        if (active) {
          setMatchingDrivers([]);
          setMatchingDriversError('Unable to load available drivers.');
        }
      } finally {
        if (active) {
          setLoadingMatchingDrivers(false);
        }
      }
    };

    fetchDrivers();

    return () => {
      active = false;
    };
  }, [driverDestinationForDrivers]);

  useEffect(() => {
    setShowOtherVehicles(false);
  }, [preferredVehicles]);

  // Removed booking preview functions - now handled on booking page
  // openBookingPreview, handleBookingFieldChange, handleReturnToReport, handleBookNow moved to /booking/[tripId]/page.tsx

  // Removed renderVehicleCard function - now handled on booking page

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
        // Update current time in trip destination timezone
        setCurrentTime(getCurrentTripTime());
        // Auto-stop live mode if trip is completed
        if (isTripCompleted()) {
          stopLiveTrip();
        }
      }, 1000); // Update every second

      return () => clearInterval(timeInterval);
    }
  }, [isLiveMode, tripDestination]);

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

  // Scroll to quote form if coming from quote request email and pre-fill email
  const quoteParam = searchParams.get('quote');
  const emailParam = searchParams.get('email');
  const [isEmailFromUrl, setIsEmailFromUrl] = useState<boolean>(false);

  useEffect(() => {
    if (quoteParam === 'true' && !isOwner && !isGuestCreator && !isGuestCreatedTrip && !loading && quoteFormRef.current) {
      // Wait a bit for page to fully render, then scroll
      setTimeout(() => {
        quoteFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
    }

    // Pre-fill email from URL parameter if present
    if (emailParam && quoteParam === 'true' && !isOwner) {
      const decodedEmail = decodeURIComponent(emailParam);
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(decodedEmail)) {
        setQuoteEmail(decodedEmail);
        setIsEmailFromUrl(true);
        console.log('📧 Email pre-filled from URL:', decodedEmail);
      }
    }
  }, [quoteParam, emailParam, isOwner, isGuestCreator, isGuestCreatedTrip, loading]);

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
            hasMessage: !!result.message,
            driverEmail: result.driverEmail
          });

          // Determine canTakeAction explicitly - be very explicit about the logic
          // API returns canTakeAction: true when trip is pending and token not used
          // If API doesn't return it, calculate it ourselves as fallback
          let canTakeActionValue: boolean;
          if (result.canTakeAction !== undefined && result.canTakeAction !== null) {
            // Use explicit value from API (handle both boolean true and string "true")
            canTakeActionValue = result.canTakeAction === true || result.canTakeAction === 'true';
          } else {
            // Fallback: calculate based on trip status and token usage
            canTakeActionValue = result.tripStatus === 'pending' && !result.tokenUsed;
          }
          console.log('🎯 Setting canTakeAction to:', canTakeActionValue, {
            fromAPI: result.canTakeAction,
            calculated: result.tripStatus === 'pending' && !result.tokenUsed,
            tripStatus: result.tripStatus,
            tokenUsed: result.tokenUsed
          });

          setValidatedDriverEmail(result.driverEmail);
          setIsDriverView(true);
          setQuoteEmail(result.driverEmail); // Pre-fill email for convenience
          setTokenValidationError(null);
          setTokenAlreadyUsed(result.tokenUsed || false);
          setTokenMessage(result.message || null);
          setCanTakeAction(canTakeActionValue);
          
          // Initialize driver response status based on trip status
          if (result.tripStatus === 'confirmed') {
            setDriverResponseStatus('accepted');
          } else if (result.tripStatus === 'rejected') {
            setDriverResponseStatus('rejected');
          } else {
            setDriverResponseStatus(null);
          }
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




  // Function to extract flight numbers from driver notes
  const extractFlightNumbers = (notes: string): { [locationName: string]: string[] } => {
    if (!notes) return {};

    console.log('🔍 [DEBUG] extractFlightNumbers - Input notes:', notes);

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

      // Save to database - preserve trip_notes if they've been edited
      const updateData: any = { locations: updatedLocations };
      // Preserve current edited trip notes if they exist (user may have edited but not saved yet)
      // Always preserve editedDriverNotes if it's different from the original driverNotes
      // This handles cases where user edits notes but hasn't clicked "Save" on the notes field yet
      if (editedDriverNotes !== undefined && editedDriverNotes !== driverNotes) {
        updateData.trip_notes = editedDriverNotes || null; // Allow empty string to be saved
        console.log('💾 [SAVE-LOCATION] Preserving unsaved trip notes:', editedDriverNotes);
      } else if (driverNotes !== undefined) {
        // If no edits, preserve the current driverNotes to prevent accidental loss
        updateData.trip_notes = driverNotes || null;
        console.log('💾 [SAVE-LOCATION] Preserving current trip notes:', driverNotes);
      }

      console.log('💾 [SAVE-LOCATION] Updating trip with:', {
        locations: updatedLocations.length,
        trip_notes: updateData.trip_notes ? 'preserved' : 'unchanged'
      });

      const { error: updateError } = await supabase
        .from('trips')
        .update(updateData)
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

  // Generate regeneration steps (same as home page generateLoadingSteps)
  const generateRegenerationSteps = (locations: any[], tripDestination?: string) => {
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

  // Edit route modal handlers
  const handleEditRouteDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setEditingLocations((items) => {
        const oldIndex = items.findIndex((item) => (item.placeId || `fallback-${items.indexOf(item)}`) === active.id);
        const newIndex = items.findIndex((item) => (item.placeId || `fallback-${items.indexOf(item)}`) === over.id);

        // Store the times in their current positions before reordering
        const timesByPosition = items.map(item => item.time);

        // Reorder the locations
        const reorderedItems = arrayMove(items, oldIndex, newIndex);

        // Reassign times based on new positions (times stay with positions, not locations)
        const itemsWithSwappedTimes = reorderedItems.map((item, index) => ({
          ...item,
          time: timesByPosition[index]
        }));

        console.log(`🔄 Edit route: Location reordered ${oldIndex + 1} → ${newIndex + 1}`);
        console.log(`   Time swapped: ${items[oldIndex].time} ↔ ${items[newIndex].time}`);

        return itemsWithSwappedTimes;
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

  const handleSaveRouteEdits = async (locationsToUse?: any[]) => {
    try {
      console.log('💾 Saving route edits and regenerating...');

      // Use provided locations or fall back to editingLocations
      // This avoids React state timing issues when called immediately after setState
      const locations = locationsToUse || editingLocations;

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

      console.log(`🚀 [EDIT-ROUTE] Regenerating for ${validLocations.length} locations`);

      // Get city configuration
      const cityConfig = getCityConfig(tripDestination);
      console.log(`🌍 [EDIT-ROUTE] City: ${cityConfig.cityName} (London APIs ${cityConfig.isLondon ? 'ENABLED' : 'DISABLED'})`);

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
              console.log(`\n🔍 [EDIT-ROUTE] Fetching data for: ${location.name} at ${location.time}`);

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
              driverNotes: editedDriverNotes || driverNotes, // Use edited notes if available
            }),
          });

          const reportData = await reportResponse.json();

          if (!reportData.success) {
            throw new Error('Failed to generate executive report');
          }

          backgroundReportData = reportData.data;
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
        locations: JSON.stringify(locationsForDb),
        trip_results: JSON.stringify(backgroundResults),
        traffic_predictions: JSON.stringify(backgroundTrafficData),
        executive_report: JSON.stringify(backgroundReportData),
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
        throw updateError;
      }

      console.log('✅ [EDIT-ROUTE] Route updated successfully!');

      // Reload page to show updated data
      window.location.reload();

    } catch (error) {
      console.error('❌ [EDIT-ROUTE] Error saving route edits:', error);
      setIsRegenerating(false);
      setRegenerationSteps(prev => prev.map(step =>
        step.status === 'loading' ? { ...step, status: 'error' as const } : step
      ));
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

        // Check if trip was created by a guest (user_id is null)
        if (!tripUserId) {
          setIsGuestCreatedTrip(true);
          console.log('👤 Trip was created by a guest user');
        } else {
          setIsGuestCreatedTrip(false);
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

        const normalizedLocations = normalizeTripLocations(data.locations);

        if (normalizedLocations.length === 0 && data.locations) {
          console.warn('⚠️ Locations normalized to empty array:', data.locations);
        }

        const locationsArray = normalizedLocations;

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
        const status = data.status || 'not confirmed';
        setTripStatus(status); // Load trip status
        setDriverEmail(data.driver || null); // Load driver email
        setValidatedDriverEmail(data.driver || null); // Set validated driver email for display
        originalDriverEmailRef.current = data.driver || null; // Store original driver email for activity check
        
        // Initialize driver response status if trip is already confirmed/rejected and driver is assigned
        // This will be updated when driver token is validated or when driver confirms/rejects
        if (data.driver && (status === 'confirmed' || status === 'rejected')) {
          // We'll set this properly after token validation or when driver actions are taken
          // For now, leave it null and let the handlers set it
        }

        // Populate location display names from database
        const displayNames: { [key: string]: string } = {};
        tripData.locations.forEach((loc: any) => {
          // Use the location name (which is now the purpose) as the display name
          if (loc.name) {
            displayNames[loc.id] = loc.name;
          }
        });
        setLocationDisplayNames(displayNames);

        // Password protection removed - all users can access reports

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

  // Track previous locations to detect changes
  const prevLocationsRef = useRef<string>('');

  // Clear Drivania quotes when trip locations actually change
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
        console.log('🔄 Trip locations changed - clearing old Drivania quotes');
        setDrivaniaQuotes(null);
        setDrivaniaError(null);
        setDrivaniaServiceType(null);
      }

      prevLocationsRef.current = locationsKey;
    }
  }, [tripData?.locations, tripData?.tripDate]);

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
      console.log('🚗 [DRIVER] Assigned driver clicked confirmation button, opening accept/reject modal');
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

    // Block status toggle for Drivania bookings
    if (driverEmail === 'drivania' && tripStatus === 'booked') {
      console.log('🚫 Cannot change status for Drivania bookings');
      return;
    }

    // If trip is rejected, allow user to request quotes or assign driver again
    // Rejected behaves like "not confirmed" - service is not secured
    if (tripStatus === 'rejected') {
      console.log('🔄 Trip was rejected, opening driver modal for new assignment');
      setAssignOnlyMode(true);
      setShowDriverModal(true);
      return;
    }

    const newStatus = tripStatus === 'confirmed' ? 'not confirmed' : 'confirmed';

    // If confirming without a driver, show popup requiring driver assignment
    if (newStatus === 'confirmed' && !driverEmail) {
      console.log('🚗 [STATUS] No driver assigned, showing confirmation popup');
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
        const errorText = await response.text();
        console.error('❌ Failed to fetch quotes:', response.status, response.statusText);
        console.error('   Response body:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          console.error('   Error details:', errorJson);
        } catch {
          // Not JSON, just log the text
        }
        return;
      }

      const result = await response.json();

      if (result.success) {
        // Deduplicate quotes: show only the latest quote per driver email
        const quotesArray = result.quotes || [];
        const quoteMap = new Map<string, typeof quotesArray[0]>();

        // Since quotes are already ordered by created_at DESC, first occurrence per email is the latest
        quotesArray.forEach((quote: any) => {
          const emailKey = quote.email.toLowerCase().trim();
          if (!quoteMap.has(emailKey)) {
            quoteMap.set(emailKey, quote);
          }
        });

        const deduplicatedQuotes = Array.from(quoteMap.values());
        setQuotes(deduplicatedQuotes);
        console.log(`✅ Fetched ${quotesArray.length} quotes, showing ${deduplicatedQuotes.length} unique driver quotes`);
      } else {
        console.error('❌ Failed to fetch quotes:', result.error);
        if (result.details) {
          console.error('   Error details:', result.details);
        }
      }
    } catch (err) {
      console.error('❌ Error fetching quotes:', err);
      if (err instanceof Error) {
        console.error('   Error message:', err.message);
        console.error('   Error stack:', err.stack);
      }
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
        // Get only the latest quote (first in array since ordered by created_at DESC)
        const quotesArray = result.quotes || [];
        setMyQuotes(quotesArray);
        // Set quoteEmail if not already set and we have a quote
        if (quotesArray.length > 0 && !quoteEmail) {
          setQuoteEmail(quotesArray[0].email);
        }
        console.log(`✅ Fetched ${quotesArray.length} of my quotes, using latest: ${quotesArray[0] ? `${quotesArray[0].currency} ${quotesArray[0].price}` : 'none'}`);
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
    if (!tripId || !isOwner || loading || !ownershipChecked) return;

    console.log('🔄 Setting up realtime subscription for quote updates');

    const quotesChannel = supabase
      .channel(`quotes-${tripId}-${Date.now()}`) // Add timestamp to ensure unique channel
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
          console.log('📊 Event type:', payload.eventType);
          console.log('📊 New/Updated quote:', payload.new);
          // Refresh quotes when any change occurs
          // Use a small delay to ensure database consistency
          setTimeout(() => {
            console.log('🔄 Refreshing quotes after realtime update...');
            fetchQuotes();
          }, 200);
        }
      )
      .subscribe((status, err) => {
        console.log('🔄 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to quote updates for trip:', tripId);
        } else if (status === 'CHANNEL_ERROR') {
          // Handle channel errors gracefully - connection issues are common and not critical
          if (err) {
            console.warn('⚠️ Channel subscription error (non-critical):', err.message || err);
          } else {
            console.warn('⚠️ Channel subscription error (connection issue)');
          }
        } else if (status === 'TIMED_OUT') {
          console.warn('⚠️ Subscription timed out, retrying...');
        } else if (status === 'CLOSED') {
          console.log('🔄 Subscription closed');
        }
      });

    return () => {
      console.log('🔄 Cleaning up quotes subscription');
      try {
        supabase.removeChannel(quotesChannel);
      } catch (error) {
        // Silently handle cleanup errors - channel may already be closed
        console.debug('Channel cleanup:', error);
      }
    };
  }, [tripId, isOwner, loading, ownershipChecked, fetchQuotes]);

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

    // Validate price - parse the formatted price (remove commas)
    const priceNum = parseFloat(parsePriceInput(quotePrice));
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
          driverName: quoteDriverName.trim() || null,
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

  // Handle opening update quote modal
  const handleOpenUpdateQuote = () => {
    // Check if driver is assigned - prevent updates if assigned
    if (driverEmail) {
      setQuoteEmailError('Quote cannot be updated - driver already assigned');
      return;
    }

    const latestQuote = myQuotes[0];
    if (latestQuote) {
      setUpdateQuotePrice('');
      setUpdateQuotePriceError(null);
      setShowUpdateQuoteModal(true);
    }
  };

  // Handle updating quote
  const handleUpdateQuote = async () => {
    // Check if driver is assigned - prevent updates if assigned
    if (driverEmail) {
      setUpdateQuotePriceError('Quote cannot be updated - driver already assigned');
      return;
    }

    setUpdateQuotePriceError(null);

    // Validate price
    const priceNum = parseFloat(updateQuotePrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setUpdateQuotePriceError('Please enter a valid price greater than 0');
      return;
    }

    const latestQuote = myQuotes[0];
    if (!latestQuote) {
      setUpdateQuotePriceError('No existing quote found');
      return;
    }

    setUpdatingQuote(true);

    try {
      const response = await fetch('/api/submit-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: tripId,
          email: quoteEmail.trim() || latestQuote.email,
          price: priceNum,
          currency: latestQuote.currency, // Lock to original currency
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Quote updated successfully');
        setShowUpdateQuoteModal(false);
        setUpdateQuotePrice('');
        setQuoteSuccessMessage('Quote updated successfully! The trip owner will see your updated offer.');
        setQuoteSuccess(true);

        // Refresh driver's quotes to show the new latest quote
        await fetchMyQuotes(quoteEmail.trim() || latestQuote.email);

        // Hide success message after 5 seconds
        setTimeout(() => setQuoteSuccess(false), 5000);
      } else {
        setUpdateQuotePriceError(result.error || 'Failed to update quote');
      }
    } catch (error) {
      setUpdateQuotePriceError('Failed to update quote. Please try again.');
    } finally {
      setUpdatingQuote(false);
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
      console.log('🔄 Fetching latest trip data for Drivania quote...');
      const { data: latestTripData, error: fetchError } = await supabase
        .from('trips')
        .select('locations, trip_date, passenger_count')
        .eq('id', tripId)
        .single();

      if (fetchError) {
        console.error('❌ Error fetching latest trip data:', fetchError);
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
          console.error('❌ Failed to parse locations JSON:', e);
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
        lat: loc.lat || 0,
        lng: loc.lng || 0,
        time: loc.time || '12:00',
        displayName: loc.displayName,
        flightNumber: loc.flightNumber,
        flightDirection: loc.flightDirection,
      })) as Array<{
        id: string;
        name: string;
        displayName?: string;
        lat: number;
        lng: number;
        time: string;
        flightNumber?: string;
        flightDirection?: 'arrival' | 'departure';
      }>;

      // Log detailed location data for debugging
      console.log('📍 Latest locations from database:', {
        count: typedLocations.length,
        locations: typedLocations.map((loc, idx: number) => ({
          index: idx,
          name: loc.name,
          lat: loc.lat,
          lng: loc.lng,
          time: loc.time,
        })),
        pickup: {
          name: typedLocations[0]?.name,
          lat: typedLocations[0]?.lat,
          lng: typedLocations[0]?.lng,
          time: typedLocations[0]?.time,
        },
        dropoff: {
          name: typedLocations[typedLocations.length - 1]?.name,
          lat: typedLocations[typedLocations.length - 1]?.lat,
          lng: typedLocations[typedLocations.length - 1]?.lng,
          time: typedLocations[typedLocations.length - 1]?.time,
        },
      });

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

        console.log('🔄 Location comparison:', {
          pickupChanged,
          dropoffChanged,
          oldPickup: oldPickup ? { lat: oldPickup.lat, lng: oldPickup.lng, time: oldPickup.time, name: oldPickup.name } : null,
          newPickup: newPickup ? { lat: newPickup.lat, lng: newPickup.lng, time: newPickup.time, name: newPickup.name } : null,
          oldDropoff: oldDropoff ? { lat: oldDropoff.lat, lng: oldDropoff.lng, time: oldDropoff.time, name: oldDropoff.name } : null,
          newDropoff: newDropoff ? { lat: newDropoff.lat, lng: newDropoff.lng, time: newDropoff.time, name: newDropoff.name } : null,
        });

        if (!pickupChanged && !dropoffChanged) {
          console.log('⚠️ WARNING: Pickup and dropoff coordinates/times unchanged. Drivania will return the same quote even if intermediate stops changed.');
          console.log('💡 Note: Drivania API only uses pickup and dropoff for quote calculation. Intermediate stops are not included.');
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

      console.log('📤 Sending Drivania quote request with latest trip data:', {
        locationsCount: typedLocations.length,
        serviceType,
        passengerCount: passengerCountValue,
        tripDate: tripDateValue,
        payload: quotePayload,
      });

      const response = await fetch('/api/drivania/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quotePayload),
      });

      const result = await response.json();

      console.log('📥 Drivania quote response:', {
        success: result.success,
        serviceId: result.data?.service_id,
        vehicleCount: result.data?.quotes?.vehicles?.length || 0,
        distance: result.data?.distance,
        driveTime: result.data?.drive_time,
        currency: result.data?.currency_code,
        error: result.error,
      });

      if (result.success) {
        // Log the received quote data for comparison
        if (drivaniaQuotes?.service_id && result.data?.service_id) {
          const sameServiceId = drivaniaQuotes.service_id === result.data.service_id;
          console.log('🔄 Service ID comparison:', {
            previous: drivaniaQuotes.service_id,
            current: result.data.service_id,
            same: sameServiceId,
            warning: sameServiceId ? '⚠️ Same service_id - Drivania may have returned cached quote' : '✅ New service_id - fresh quote',
          });
        }

        setDrivaniaQuotes(result.data);
        setDrivaniaServiceType(result.serviceType);
      } else {
        setDrivaniaError(result.error || result.message || 'Failed to get quote from Drivania');
      }
    } catch (err) {
      console.error('❌ Error requesting Drivania quote:', err);
      setDrivaniaError('Failed to request quote from Drivania. Please try again.');
    } finally {
      setLoadingDrivaniaQuote(false);
    }
  };

  // Removed auto-fetch Drivania quotes - now handled on booking page

  const handleModifyTrip = () => {
    // For now, just redirect to home
    // Future: could pre-fill form with current trip data
    router.push('/');
  };

  // Handler for driver to confirm a pending trip
  const handleDriverConfirmTrip = async () => {
    // Don't require authentication for assigned drivers - they can use token to accept/reject
    // Only check authentication if not using token
    if (!driverToken && !isAuthenticated) {
      setShowSignupModal(true);
      return;
    }

    if (!tripId || confirmingTrip) return;

    // If driver has token and action already taken, show assignment info modal instead
    if (driverToken && !canTakeAction) {
      setShowDriverAssignmentInfoModal(true);
      return;
    }

    // If driver has token and no quote exists, show message asking to quote first
    if (driverToken && myQuotes.length === 0) {
      alert('Please submit a quote for this trip before confirming. Use the quote form above to provide your pricing.');
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
        setShowDriverAcceptRejectModal(false);
        // Update local state immediately
        setTripStatus('confirmed');
        setDriverResponseStatus('accepted');
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
        setShowDriverAcceptRejectModal(false);
        // Update local state immediately
        setTripStatus('rejected');
        setDriverResponseStatus('rejected');
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
    console.log('✏️ [PREVIEW] Opening manual edit form...');
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
    console.log('❌ [PREVIEW] Cancelling changes...');
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
    console.log(`🔍 [TRANSFORM-DIAG] Starting transformation of comparison result`);
    console.log(`   - Current trip has ${tripData?.locations?.length || 0} locations`);
    console.log(`   - Comparison has ${comparison.locations?.length || 0} location changes`);
    console.log(`   - Trip destination: "${tripDestination}"`);

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
          console.warn('⚠️ Skipping invalid location change (not an object):', locChange);
          return;
        }

        if (!locChange.action) {
          console.warn('⚠️ Skipping location change without action:', locChange);
          return;
        }

        if (locChange.action === 'removed') {
          console.log(`🗑️ [REMOVAL-DIAG] Removing location at index ${locChange.currentIndex}: "${locChange.currentLocation?.name || locChange.currentLocation?.address || 'Unknown'}"`);
          console.log(`   - fullAddress: "${locChange.currentLocation?.fullAddress || 'MISSING'}"`);
          console.log(`   - coordinates: (${locChange.currentLocation?.lat || 0}, ${locChange.currentLocation?.lng || 0})`);
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
              const beforeFullAddress = finalLoc.fullAddress;
              finalLoc.fullAddress = locChange.extractedLocation.formattedAddress ||
                locChange.extractedLocation.location ||
                finalLoc.address ||
                finalLoc.name;
              if (finalLoc.fullAddress !== beforeFullAddress) {
                console.log(`🔍 [ADDRESS-DIAG] Location ${locChange.currentIndex} fullAddress set: "${beforeFullAddress}" → "${finalLoc.fullAddress}" (source: ${locChange.extractedLocation.formattedAddress ? 'formattedAddress' : locChange.extractedLocation.location ? 'location' : finalLoc.address ? 'address' : 'name'})`);
                // Check if address is just city name
                if (finalLoc.fullAddress && finalLoc.fullAddress.toLowerCase() === (tripDestination || '').toLowerCase()) {
                  console.warn(`⚠️ [ADDRESS-DIAG] WARNING: Location ${locChange.currentIndex} fullAddress is just city name "${finalLoc.fullAddress}" - this might be a fallback issue!`);
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
                console.log(`🔍 [ADDRESS-DIAG] Location ${locChange.currentIndex} formattedAddress set: "${beforeFormattedAddress}" → "${finalLoc.formattedAddress}"`);
                if (finalLoc.formattedAddress && finalLoc.formattedAddress.toLowerCase() === (tripDestination || '').toLowerCase()) {
                  console.warn(`⚠️ [ADDRESS-DIAG] WARNING: Location ${locChange.currentIndex} formattedAddress is just city name "${finalLoc.formattedAddress}" - this might be a fallback issue!`);
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
            const currentFullAddress = (currentLoc as any)?.fullAddress;
            const fullAddress = timeOnlyChange && currentFullAddress
              ? currentFullAddress
              : (locChange.extractedLocation.formattedAddress ||
                locChange.extractedLocation.location ||
                locChange.currentLocation.address ||
                currentFullAddress ||
                locChange.currentLocation.name);
            // Diagnostic logging for address assignment
            if (fullAddress && fullAddress.toLowerCase() === (tripDestination || '').toLowerCase()) {
              console.warn(`⚠️ [ADDRESS-DIAG] Location ${locChange.currentIndex} fullAddress resolved to just city name "${fullAddress}"`);
              console.warn(`   - timeOnlyChange: ${timeOnlyChange}, currentFullAddress: "${currentFullAddress}"`);
              console.warn(`   - extractedLocation.formattedAddress: "${locChange.extractedLocation.formattedAddress}"`);
              console.warn(`   - extractedLocation.location: "${locChange.extractedLocation.location}"`);
              console.warn(`   - currentLocation.address: "${locChange.currentLocation.address}"`);
              console.warn(`   - currentLocation.name: "${locChange.currentLocation.name}"`);
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
              formattedAddress: (currentLoc as any).formattedAddress || (currentLoc as any).fullAddress || '', // Never fall back to name (purpose)
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
          const beforeLat = finalLocationsMap[idx].lat;
          const beforeLng = finalLocationsMap[idx].lng;
          console.log(`🔄 [COORD-DIAG] Restoring coordinates for location at index ${idx}: ${currentLoc.name}`);
          console.log(`   - Before: (${beforeLat}, ${beforeLng}) → After: (${currentLoc.lat}, ${currentLoc.lng})`);
          finalLocationsMap[idx].lat = currentLoc.lat;
          finalLocationsMap[idx].lng = currentLoc.lng;
        } else if (finalLocationsMap[idx]) {
          // Log coordinate state even if not restoring
          console.log(`🔍 [COORD-DIAG] Location ${idx} "${currentLoc.name}" has coordinates: (${finalLocationsMap[idx].lat}, ${finalLocationsMap[idx].lng})`);
        }
      });
    }

    // Sort final locations by index and add to diff
    const sortedIndices = Object.keys(finalLocationsMap)
      .map(k => parseInt(k))
      .filter(idx => !isNaN(idx))
      .sort((a, b) => a - b);

    console.log(`🔍 [FINAL-LOCATIONS-DIAG] Building final locations array from ${sortedIndices.length} indices`);
    diff.finalLocations = sortedIndices.map(idx => {
      const loc = finalLocationsMap[idx];
      // Log each location's state
      console.log(`   [${idx}] "${loc.name}" - coords: (${loc.lat}, ${loc.lng}), fullAddress: "${loc.fullAddress || 'MISSING'}", formattedAddress: "${loc.formattedAddress || 'MISSING'}"`);
      // Check for issues
      if (loc.lat === 0 && loc.lng === 0) {
        console.warn(`   ⚠️ [${idx}] Location has invalid coordinates (0, 0)!`);
      }
      if (loc.fullAddress && loc.fullAddress.toLowerCase() === (tripDestination || '').toLowerCase()) {
        console.warn(`   ⚠️ [${idx}] Location fullAddress is just city name "${loc.fullAddress}"!`);
      }
      return loc;
    });

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
      // Step 4 is already set to loading from handleRegenerateDirectly
      setRegenerationProgress(55);
      setRegenerationStep(`Fetching data for ${validLocations.length} location(s)...`);
      const results = await Promise.all(
        validLocations.map(async (location) => {
          console.log(`\n🔍 Fetching data for Location ${numberToLetter(validLocations.indexOf(location) + 1)}: ${location.name} at ${location.time}`);

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
      setRegenerationProgress(70);
      setRegenerationStep('Calculating traffic predictions...');
      setRegenerationSteps(prev => prev.map(s =>
        s.id === '4' ? { ...s, status: 'completed' as const } :
          s.id === '5' ? { ...s, status: 'loading' as const } : s
      ));
      console.log('🚦 Fetching traffic predictions...');
      let trafficData = null;
      try {
        trafficData = await getTrafficPredictions(validLocations, tripDateStr, tripDestination);
      } catch (trafficError) {
        console.error('❌ Traffic prediction error:', trafficError);
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
            driverNotes: editedDriverNotes || driverNotes || null,
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
      console.log(`💾 Updating trip ${tripId} with version ${updateData.version}...`);
      const { data: updatedTrip, error: updateError } = await supabase
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

  // Show loading state until ownership is checked
  if (loading || !ownershipChecked) {
    return (
      <div className="min-h-screen bg-background">
        {/* Show sticky quote form even during loading if ownership is checked and user is not owner (but not for guest creators or guest-created trips)
            Also show for drivers accessing via token (isDriverView && driverToken) */}
        {ownershipChecked && !isOwner && !isGuestCreator && !isGuestCreatedTrip && (!isDriverView || (isDriverView && driverToken)) && (
          <div
            className={`fixed left-0 right-0 bg-background transition-all duration-300 ${scrollY > 0 ? 'top-0 z-[60]' : 'top-[57px] z-40'
              }`}
          >
          <div className="container mx-auto px-4 pt-8 pb-3">
            <div className={`rounded-md pl-6 pr-4 py-3 bg-primary dark:bg-[#1f1f21] border ${myQuotes.length === 0 && (!quotePrice || quotePrice.trim() === '') ? 'border-[#e77500]' : 'border-border'}`}>
              {/* Always show the same structure - fields are disabled when quote exists */}
              <form onSubmit={handleSubmitQuote} className="flex gap-3 items-start">
                <label className="flex-1">
                  <span className="block text-sm text-white font-medium mb-1">Driver email</span>
                  <Input
                    id="quote-email-loading"
                    type="email"
                    value={myQuotes.length > 0 ? (quoteEmail || myQuotes[0].email) : quoteEmail}
                    onChange={(e) => {
                      if (myQuotes.length === 0 && !isEmailFromUrl && !(isDriverView && !!driverToken)) {
                        setQuoteEmail(e.target.value);
                      }
                    }}
                    placeholder="your.email@company.com"
                    disabled={myQuotes.length > 0 || submittingQuote || isEmailFromUrl || (isDriverView && !!driverToken)}
                    readOnly={myQuotes.length > 0 || isEmailFromUrl || (isDriverView && !!driverToken)}
                    className={`h-[44px] border-border bg-background dark:bg-input/30 text-foreground placeholder:text-muted-foreground/60 dark:hover:bg-[#323236] transition-colors ${quoteEmailError ? 'border-destructive' : ''} ${(myQuotes.length > 0 || isEmailFromUrl || (isDriverView && !!driverToken)) ? 'cursor-not-allowed opacity-75' : ''}`}
                  />
                  {quoteEmailError && (
                    <p className="text-xs text-destructive mt-1">{quoteEmailError}</p>
                  )}
                </label>

                <label className="flex-[1.5]">
                  <span className="block text-sm text-white font-medium mb-1">Driver name</span>
                  <Input
                    id="quote-driver-name-loading"
                    type="text"
                    value={myQuotes.length > 0 ? (myQuotes[0].driver_name || 'N/A') : quoteDriverName}
                    onChange={(e) => {
                      if (myQuotes.length === 0) {
                        setQuoteDriverName(e.target.value);
                      }
                    }}
                    placeholder="John Doe"
                    disabled={myQuotes.length > 0 || submittingQuote}
                    readOnly={myQuotes.length > 0}
                    className={`h-[44px] border-border bg-background dark:bg-input/30 text-foreground placeholder:text-muted-foreground/60 dark:hover:bg-[#323236] transition-colors ${myQuotes.length > 0 ? 'cursor-not-allowed opacity-75' : ''}`}
                  />
                </label>

                <label className="w-[120px]">
                  <span className="block text-sm text-white font-medium mb-1">Total</span>
                  <Input
                    id="quote-price-loading"
                    type="text"
                    value={myQuotes.length > 0 ? `${myQuotes[0].currency} ${myQuotes[0].price.toFixed(2)}` : (quotePrice ? formatPriceDisplay(quotePrice) : '')}
                    onChange={(e) => {
                      if (myQuotes.length === 0) {
                        const parsed = parsePriceInput(e.target.value);
                        setQuotePrice(parsed);
                      }
                    }}
                    placeholder="100.00"
                    disabled={myQuotes.length > 0 || submittingQuote}
                    readOnly={myQuotes.length > 0}
                    className={`h-[44px] border-border bg-background dark:bg-input/30 text-foreground placeholder:text-muted-foreground/60 dark:hover:bg-[#323236] transition-colors ${quotePriceError ? 'border-destructive' : ''} ${myQuotes.length > 0 ? 'cursor-not-allowed opacity-75' : ''}`}
                  />
                  {quotePriceError && (
                    <p className="text-xs text-destructive mt-1">{quotePriceError}</p>
                  )}
                </label>

                <label className="w-[110px]">
                  <span className="block text-sm text-white font-medium mb-1">Currency</span>
                  <select
                    id="quote-currency-loading"
                    value={myQuotes.length > 0 ? myQuotes[0].currency : quoteCurrency}
                    onChange={(e) => {
                      if (myQuotes.length === 0) {
                        setQuoteCurrency(e.target.value);
                      }
                    }}
                    disabled={myQuotes.length > 0 || submittingQuote}
                    className={`w-full h-[44px] pl-3 pr-3 rounded-md border border-border bg-background dark:bg-input/30 text-sm text-foreground dark:hover:bg-[#323236] transition-colors appearance-none focus:outline-none focus:ring-0 ${myQuotes.length > 0 ? 'cursor-not-allowed opacity-75' : ''}`}
                  >
                    {CURRENCY_OPTIONS.map(currency => (
                      <option key={currency} value={currency}>{currency}</option>
                    ))}
                  </select>
                </label>

                <label className="w-[110px]">
                  <span className="block text-sm text-white font-medium mb-1">&nbsp;</span>
                  {myQuotes.length > 0 ? (
                    <Button
                      type="button"
                      disabled={true}
                      className="w-full h-[44px] bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] cursor-not-allowed opacity-50"
                    >
                      Submitted
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={submittingQuote || !quoteEmail || !quotePrice}
                      className="w-full h-[44px] bg-[#E5E7EF] text-[#05060A] hover:bg-[#E5E7EF]/90"
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
                  )}
                </label>
              </form>
            </div>
          </div>
          </div>
        )}

        {/* Loading spinner */}
        <div className={`flex items-center justify-center ${ownershipChecked && !isOwner ? 'pt-32' : ''} min-h-screen`}>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Loading your trip brief...
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


  const { tripDate, tripResults, trafficPredictions, executiveReport } = tripData;

  return (
    <div className="min-h-screen bg-background">
      {/* Quote Form Section - Sticky Bar - Shows for:
          1. Guests invited to submit quotes
          2. Any non-owner viewer (but not guest creators or guest-created trips)
          3. Drivers accessing via token (isDriverView && driverToken) */}
      <QuoteFormSection
        scrollY={scrollY}
        isOwner={isOwner}
        isGuestCreator={isGuestCreator}
        isGuestCreatedTrip={isGuestCreatedTrip}
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
      <Dialog open={showUpdateQuoteModal} onOpenChange={setShowUpdateQuoteModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update quote</DialogTitle>
            <DialogDescription>
              You're about to update the previous price. The trip owner will see your updated offer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {myQuotes[0] && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Previous price</label>
                  <div className="px-3 py-2 rounded-md border border-border bg-muted/50">
                    <p className="text-sm font-medium">
                      {myQuotes[0].currency} {myQuotes[0].price.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="update-quote-price" className="text-sm font-medium">
                    New price
                  </label>
                  <Input
                    id="update-quote-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={updateQuotePrice}
                    onChange={(e) => setUpdateQuotePrice(e.target.value)}
                    placeholder="Enter new price"
                    disabled={updatingQuote}
                    className={`h-[44px] ${updateQuotePriceError ? 'border-destructive' : ''}`}
                  />
                  {updateQuotePriceError && (
                    <p className="text-xs text-destructive">{updateQuotePriceError}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Currency</label>
                  <div className="px-3 py-2 rounded-md border border-border bg-muted/50">
                    <p className="text-sm font-medium">{myQuotes[0].currency}</p>
                    <p className="text-xs text-muted-foreground mt-1">Currency cannot be changed</p>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowUpdateQuoteModal(false);
                setUpdateQuotePrice('');
                setUpdateQuotePriceError(null);
              }}
              disabled={updatingQuote}
            >
              Dismiss
            </Button>
            <Button
              onClick={handleUpdateQuote}
              disabled={updatingQuote || !updateQuotePrice}
              className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] hover:bg-[#05060A]/90 dark:hover:bg-[#E5E7EF]/90"
            >
              {updatingQuote ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Updating...
                </>
              ) : (
                'Update'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Trip Section - Sticky Bar - Only show for owners and guest creators */}
      {(isOwner || isGuestCreator) && !isLiveMode && !isRegenerating && (
        <div
          className={`fixed left-0 right-0 bg-background transition-all duration-300 ${scrollY > 0 ? 'top-0 z-[60]' : 'top-[57px] z-40'
            }`}
        >
          <div className="container mx-auto px-4 pt-8 pb-3">

            <div className="rounded-md px-6 py-3 bg-primary dark:bg-[#1f1f21] border border-border">
              <label className="block text-sm font-medium text-primary-foreground dark:text-card-foreground mb-3">Trip update</label>
              <div className="flex gap-4 items-start">
                <div className="flex-1 relative">
                  <textarea
                    ref={updateTextareaRef}
                    id="update-text"
                    value={updateText}
                    onChange={(e) => setUpdateText(e.target.value)}
                    placeholder={isExtracting && updateProgress.step && !updateProgress.error ? `${updateProgress.step}...` : "Any changes to this trip? Tell updates to the AI planner to paste your email here."}
                    className="w-full min-h-[51px] h-[51px] px-3 py-3 rounded-md border border-border bg-background dark:bg-input/30 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:border-ring resize-none overflow-y-auto dark:hover:bg-[#323236] transition-colors dark:focus-visible:border-[#323236]"
                    disabled={isExtracting || isRegenerating}
                  />
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Update Trip Button */}
                  <Button
                    variant="default"
                    className="flex items-center gap-2 h-[51px] bg-[#E5E7EF] text-[#05060A] hover:bg-[#E5E7EF]/90"
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
                      'Update'
                    )}
                  </Button>
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
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
                      <h3 className="text-xl font-semibold mb-1">Updating trip</h3>
                      <p className="text-sm text-muted-foreground">
                        {regenerationSteps.filter(s => s.status === 'completed').length} of {regenerationSteps.length} steps completed
                      </p>
                    </div>
                  </div>

                  {/* Steps Carousel - Exact Homepage Animation */}
                  <div className="relative h-[200px] overflow-hidden flex items-center justify-center">
                    {regenerationProgress >= 100 ? (
                      // Completion View - Show redirect message
                      <div className="w-full animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
                        <div className="flex flex-col items-center justify-center gap-3 mt-8">
                          <svg className="animate-spin h-12 w-12 text-muted-foreground" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <h3 className="text-lg font-semibold text-card-foreground">Redirecting to brief</h3>
                        </div>
                      </div>
                    ) : (
                      // Carousel View - Show current and previous steps only
                      regenerationSteps.map((step, index) => {
                        const isActive = step.status === 'loading';
                        const isCompleted = step.status === 'completed';
                        const isPending = step.status === 'pending';

                        // Calculate position relative to active step
                        const activeIndex = regenerationSteps.findIndex(s => s.status === 'loading');

                        // If no active step (all completed), don't render any steps
                        if (activeIndex === -1) {
                          return null;
                        }

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
                              className={`flex items-start gap-4 p-4 rounded-lg border ${isActive
                                ? 'border-[#05060A] dark:border-[#E5E7EF] bg-[#05060A]/10 dark:bg-[#E5E7EF]/10'
                                : isCompleted
                                  ? 'border-green-500/30 bg-green-500/5'
                                  : 'border-border bg-muted/30'
                                }`}
                            >
                              {/* Status Icon */}
                              <div className="flex-shrink-0 mt-0.5" style={{ isolation: 'isolate' }}>
                                {isPending && (
                                  <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30"></div>
                                )}
                                {isActive && (
                                  <div
                                    className="w-6 h-6 rounded-full border-2 border-[#05060A] border-t-transparent"
                                    style={{
                                      animation: 'spin 1s linear infinite',
                                      willChange: 'transform'
                                    }}
                                  ></div>
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

                {/* Error Display */}
                {error && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-semibold">❌ Error during update</p>
                        <p className="text-sm">{error}</p>
                        <Button
                          onClick={() => {
                            setError(null);
                            setIsRegenerating(false);
                            // User can retry by clicking Update again
                          }}
                          variant="outline"
                          size="sm"
                          className="mt-2"
                        >
                          Close
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Preview Modal - REMOVED: Flow now goes directly from comparison to regeneration */}

        {/* Results Section */}
        <div className="mb-8">


          {/* Service Introduction */}
          {!isLiveMode && (
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
              isLiveMode={isLiveMode}
              tripId={tripId}
              theme={theme as 'light' | 'dark' | undefined}
              mounted={mounted}
              onStatusToggle={handleStatusToggle}
              onShowDriverModal={() => setShowDriverModal(true)}
              onShowMapModal={() => setShowMapModal(true)}
              onShowSignupModal={() => setShowSignupModal(true)}
            />
          )}

          {/* Trip Locations */}
          {!isLiveMode && (
            <LocationCardSection
              locations={locations}
              tripDate={tripDate}
              trafficPredictions={trafficPredictions}
              driverNotes={driverNotes}
              isLiveMode={isLiveMode}
              activeLocationIndex={activeLocationIndex}
              tripData={tripData}
              passengerCount={passengerCount}
              tripDestination={tripDestination}
              quoteParam={quoteParam}
              isAuthenticated={isAuthenticated}
              isTripCompleted={isTripCompleted}
              isTripWithinOneHour={isTripWithinOneHour}
              findClosestLocation={findClosestLocation}
              startLiveTrip={startLiveTrip}
              stopLiveTrip={stopLiveTrip}
              onShowSignupModal={() => setShowSignupModal(true)}
              onShowEditRouteModal={() => setShowEditRouteModal(true)}
              onShowMapModal={() => setShowMapModal(true)}
              onSetEditingLocations={setEditingLocations}
              onSetEditingTripDate={setEditingTripDate}
              onSetPassengerCount={setPassengerCount}
              onSetTripDestination={setTripDestination}
            />
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
          {!isLiveMode && executiveReport?.exceptionalInformation && (
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

                {/* Top Disruptor - fills remaining space */}
                <Card className="bg-primary dark:bg-[#1f1f21] flex-1">
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
                        <svg className="w-4 h-4 text-card-foreground mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
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
                  <LocationDetailCard
                    index={index}
                    result={result}
                    tripDate={tripDate}
                    tripResultsLength={tripResults.length}
                    isOwner={isOwner}
                    isLiveMode={isLiveMode}
                    activeLocationIndex={activeLocationIndex}
                    locationDisplayNames={locationDisplayNames}
                    editingLocationId={editingLocationId}
                    editingLocationName={editingLocationName}
                    expandedLocations={expandedLocations}
                    driverNotes={driverNotes}
                    onEditLocationName={handleEditLocationName}
                    onSaveLocationName={handleSaveLocationName}
                    onKeyPress={handleKeyPress}
                    onToggleExpansion={toggleLocationExpansion}
                    onEditingLocationNameChange={setEditingLocationName}
                  />

                  {/* Route Card (after each location except the last) */}
                  {index < tripResults.length - 1 && (
                    <RouteCard
                      index={index}
                      tripResults={tripResults}
                      trafficPredictions={trafficPredictions}
                      tripDate={tripDate}
                      tripDestination={tripDestination}
                      expandedRoutes={expandedRoutes}
                      onToggleExpansion={toggleRouteExpansion}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
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
          <div className="flex flex-wrap justify-end gap-3">
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
      {
        showDriverModal && (
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

                        {/* Assign Driver - Show alongside Request quote when not in assign-only mode */}
                        {!assignOnlyMode && (
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
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Assigning...
                              </>
                            ) : (
                              'Assign driver'
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

                {/* Book with Drivania Section - Link to booking page */}
                {isOwner && !assignOnlyMode && driverEmail !== 'drivania' && (
                  <div className="mb-8">
                    <div className="rounded-md border border-border bg-muted/40 p-6 text-center">
                      <h3 className="text-lg font-semibold text-card-foreground mb-2">
                        Book with Drivania
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Get instant quotes and book your trip with our partner Drivania
                      </p>
                      <Button
                        onClick={() => {
                          setShowDriverModal(false);
                          router.push(`/booking/${tripId}`);
                        }}
                        className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                      >
                        Book a trip
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

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

      {/* Signup Modal - Shown when non-authenticated users try to use features */}
      <Dialog open={showSignupModal} onOpenChange={setShowSignupModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">
              Chauffs is free - start saving time now.
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Benefits Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Unlimited trips</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Instant fixed pricing</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Pick your driver</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Edit trips instantly</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Billed in seconds</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Secure payments</span>
              </div>
            </div>

            {/* Signup Form */}
            <form onSubmit={handleGuestSignup} className="space-y-4">
              <div>
                <label htmlFor="modal-guest-email" className="block text-sm font-medium mb-2">
                  Email address
                </label>
                <Input
                  id="modal-guest-email"
                  type="email"
                  value={tripData?.userEmail || ''}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div>
                <label htmlFor="modal-guest-password" className="block text-sm font-medium mb-2">
                  Create password
                </label>
                <Input
                  id="modal-guest-password"
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
                    Create account and save trip
                  </>
                )}
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground">
              Already have an account? <a href="/login" className="text-primary hover:underline dark:text-white">Log in here</a>
            </p>
          </div>
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
          {/* Flow A is for Supabase driver assignment - Drivania quotes should not be shown here */}
          {/* (Drivania quotes are only relevant when booking with Drivania, not when assigning Supabase drivers) */}
          <DialogFooter className="justify-start">
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
                // Check if user is authenticated - if not, show signup modal
                if (!isAuthenticated) {
                  setShowFlowAModal(false);
                  setShowSignupModal(true);
                  return;
                }

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

                    // Note: Email is automatically sent by /api/set-driver route, no need to send here

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
          <DialogFooter className="justify-start">
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

                    // Note: Email is automatically sent by /api/set-driver route, no need to send here

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

      {/* Booking Preview Modal - Removed: Now handled on /booking/[tripId] page */}

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

      {/* Driver Accept/Reject Modal - Shows when driver clicks "Accept trip" button */}
      <Dialog open={showDriverAcceptRejectModal} onOpenChange={setShowDriverAcceptRejectModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader className="relative">
            <button
              onClick={() => setShowDriverAcceptRejectModal(false)}
              disabled={confirmingTrip || rejectingTrip}
              className="absolute right-0 top-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="sr-only">Close</span>
            </button>
            <DialogTitle>Accept or reject trip</DialogTitle>
            <DialogDescription>
              You've been assigned as the driver to this trip
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
                  You can accept or reject this trip assignment.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  If you accept, the trip status will change to Confirmed. If you reject, the trip owner will be notified.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={async () => {
                setShowDriverAcceptRejectModal(false);
                await handleDriverRejectTrip();
              }}
              disabled={confirmingTrip || rejectingTrip}
            >
              {rejectingTrip ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Rejecting...
                </>
              ) : (
                'Reject trip'
              )}
            </Button>
            <Button
              onClick={async () => {
                setShowDriverAcceptRejectModal(false);
                await handleDriverConfirmTrip();
              }}
              disabled={confirmingTrip || rejectingTrip}
              className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] hover:bg-[#05060A]/90 dark:hover:bg-[#E5E7EF]/90"
            >
              {confirmingTrip ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Accepting...
                </>
              ) : (
                'Accept trip'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Driver Assignment Info Modal - Shows when driver clicks confirmation with token but action already taken */}
      <Dialog open={showDriverAssignmentInfoModal} onOpenChange={setShowDriverAssignmentInfoModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Trip status update</DialogTitle>
            <DialogDescription>
              You've already responded to this trip
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert className={`mb-4 ${tripStatus === 'confirmed' || tripStatus === 'booked'
              ? 'bg-[#3ea34b]/10 border-[#3ea34b]/30'
              : tripStatus === 'rejected'
                ? 'bg-red-500/10 border-red-500/30'
                : tripStatus === 'cancelled'
                  ? 'bg-gray-500/10 border-gray-500/30'
                  : 'bg-blue-500/10 border-blue-500/30'
              }`}>
              <AlertDescription className={`font-medium ${tripStatus === 'confirmed' || tripStatus === 'booked'
                ? 'text-[#3ea34b]'
                : tripStatus === 'rejected'
                  ? 'text-red-600'
                  : tripStatus === 'cancelled'
                    ? 'text-gray-600'
                    : 'text-blue-600'
                }`}>
                {tripStatus === 'confirmed' && '✅ You have confirmed this trip'}
                {tripStatus === 'booked' && '✅ This trip has been booked'}
                {tripStatus === 'rejected' && '❌ You have rejected this trip'}
                {tripStatus === 'cancelled' && '🚫 This trip has been cancelled'}
                {tokenMessage && !['confirmed', 'booked', 'rejected', 'cancelled'].includes(tripStatus) && `ℹ️ ${tokenMessage}`}
              </AlertDescription>
            </Alert>

            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm mb-3">
                <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-muted-foreground">Assigned to:</span>
                <span className="font-medium">{validatedDriverEmail === 'drivania' ? 'Drivania' : validatedDriverEmail}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {tripStatus === 'confirmed' && 'The trip owner has been notified of your acceptance.'}
                {tripStatus === 'booked' && 'Your booking request has been sent to Drivania.'}
                {tripStatus === 'rejected' && 'The trip owner has been notified that you declined.'}
                {tripStatus === 'cancelled' && 'The trip owner has cancelled this trip.'}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowDriverAssignmentInfoModal(false)}
              className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
            >
              Close
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
      {
        showMapModal && (
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
                    locations={mapLocations}
                    height="100%"
                    compact={false}
                    tripDestination={tripDestination}
                  />
                </div>
              </div>
            </div>
          </div>
        )
      }

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

      {/* Confirm Driver Required Modal */}
      <Dialog open={showConfirmDriverRequiredModal} onOpenChange={setShowConfirmDriverRequiredModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Driver required</DialogTitle>
            <DialogDescription>
              To confirm the trip, a driver must be assigned.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDriverRequiredModal(false)}
            >
              Dismiss
            </Button>
            <Button
              onClick={() => {
                setShowConfirmDriverRequiredModal(false);
                setShowDriverModal(true);
              }}
              className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] hover:bg-[#05060A]/90 dark:hover:bg-[#E5E7EF]/90"
            >
              Assign driver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Route Modal */}
      <Dialog open={showEditRouteModal} onOpenChange={setShowEditRouteModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between mb-4">
              <DialogTitle>Manual Form</DialogTitle>
              <Button
                onClick={() => setShowEditRouteModal(false)}
                variant="outline"
                size="sm"
              >
                ← Back
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Trip Details - Passenger Name, Number of Passengers, Vehicle, Trip Destination */}
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
                        type="button"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-background",
                          !editingTripDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editingTripDate ? format(editingTripDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 z-[100]"
                      align="start"
                      sideOffset={4}
                    >
                      <Calendar
                        mode="single"
                        selected={editingTripDate}
                        onSelect={(date) => {
                          if (date) {
                            setEditingTripDate(date);
                            setDatePickerOpen(false);
                          }
                        }}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          // Disable past dates - allow today or later
                          return date < today;
                        }}
                        defaultMonth={editingTripDate || new Date()}
                        showOutsideDays={false}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Trip Destination - spans 2 columns - READ-ONLY (for visualization only) */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-primary-foreground dark:text-card-foreground mb-2">
                    Trip destination
                  </label>
                  <Input
                    value={tripDestination || tripData?.tripDestination || ''}
                    readOnly
                    disabled
                    className="bg-muted/50 border-border rounded-md h-9 text-foreground cursor-not-allowed"
                    placeholder="No destination set"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Trip destination cannot be changed</p>
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
            <div className="mt-4">
              <Button
                onClick={handleAddEditLocation}
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
                value={editedDriverNotes || ''}
                onChange={(e) => setEditedDriverNotes(e.target.value)}
                placeholder="Additional notes, contact info, special instructions, etc."
                rows={6}
                className="w-full bg-background dark:bg-input/30 border-border rounded-md p-2 text-sm text-foreground dark:hover:bg-[#323236] transition-colors border resize-y focus:outline-none focus-visible:border-ring dark:focus-visible:border-[#323236]"
              />
            </div>
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
              onClick={() => handleSaveRouteEdits()}
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
                'Update trip'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal for AI-Assisted Updates */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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




