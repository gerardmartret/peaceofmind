'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
// Heavy libraries loaded dynamically when needed
// import mammoth from 'mammoth';
// import * as XLSX from 'xlsx';
import GoogleLocationSearch from '@/components/GoogleLocationSearch';
import GoogleTripMap from '@/components/GoogleTripMap';
import { SortableLocationItem } from '@/components/trip/SortableLocationItem';
import { SortableExtractedLocationItem } from '@/components/trip/SortableExtractedLocationItem';
import DestinationCarousel from '@/components/DestinationCarousel';
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
import { getCityConfig, createMockResponse, MOCK_DATA, isValidTripDestination, normalizeTripDestination } from '@/lib/city-helpers';
import { getDisplayVehicle } from '@/lib/vehicle-helpers';
import { numberToLetter } from '@/lib/helpers/string-helpers';
import { formatLocationDisplay } from '@/lib/helpers/location-formatters';
import { formatDateLocal, calculateDaysFromDates } from '@/lib/helpers/date-helpers';
import { generateLoadingSteps } from '@/lib/helpers/loading-steps';
import { hasUnknownOrMissingValues } from '@/lib/validation/trip-validation';
import { safeJsonParse } from '@/lib/helpers/api-helpers';
import { getSafetyColor, getSafetyBg, getSafetyLabel } from '@/lib/helpers/safety-helpers';
import { getTimeLabel } from '@/lib/helpers/time-helpers';
import { londonDistricts } from '@/lib/constants/districts';
import { generateReport } from '@/lib/services/report-service';
import { debug } from '@/lib/debug';
import { WhyChauffsSection } from '@/components/homepage/WhyChauffsSection';
import { HowItWorksSection } from '@/components/homepage/HowItWorksSection';
import { DemoSection } from '@/components/homepage/DemoSection';
import { CTASection } from '@/components/homepage/CTASection';
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
} from '@dnd-kit/sortable';
import type { CombinedData } from '@/lib/types/trip.types';



export default function Home() {
  const router = useRouter();
  const { isLoaded: isGoogleMapsLoaded } = useGoogleMaps();
  const { user, isAuthenticated } = useAuth();
  const { setResetToImport } = useHomepageContext();
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
  const [extractedDatePickerOpen, setExtractedDatePickerOpen] = useState(false);
  const [locations, setLocations] = useState<Array<{
    id: string;
    name: string;
    fullAddress?: string;
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
  const [savingGuestTrip, setSavingGuestTrip] = useState(false); // Loading state for guest trip save
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
  const [tripDestination, setTripDestination] = useState<string>('');
  const [availableDestinations, setAvailableDestinations] = useState<string[]>([]);
  const [loadingDestinations, setLoadingDestinations] = useState(false);
  const [passengerNames, setPassengerNames] = useState<string[]>([]);
  const [editingExtractedIndex, setEditingExtractedIndex] = useState<number | null>(null);
  const [editingExtractedField, setEditingExtractedField] = useState<'location' | 'time' | 'purpose' | null>(null);
  const [showValidationMessages, setShowValidationMessages] = useState(false);

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
          debug.error('Speech recognition error:', event.error);

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

  // Set initial textarea height based on screen size
  useEffect(() => {
    if (textareaRef.current) {
      const isMobile = window.innerWidth < 640; // sm breakpoint
      textareaRef.current.style.height = isMobile ? '120px' : '86px';
    }
  }, []);

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
          // Double-check: filter by whitelist on client side too (defense in depth)
          const filteredDestinations = (data.destinations || []).filter((dest: string) =>
            isValidTripDestination(dest)
          );
          setAvailableDestinations(filteredDestinations);
          debug.log('✅ Loaded trip destinations:', filteredDestinations);
          if (data.destinations.length !== filteredDestinations.length) {
            debug.warn('⚠️ Filtered out invalid destinations from API response');
          }
        } else {
          debug.error('❌ Failed to fetch trip destinations');
        }
      } catch (error) {
        debug.error('❌ Error fetching trip destinations:', error);
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
    setStartDate(formatDateLocal(today));
    setEndDate(formatDateLocal(futureDate));
    // No default trip date - user must explicitly select a date (tomorrow or later)

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

  const updateLocation = (id: string, data: { name: string; lat: number; lng: number; formattedAddress?: string }) => {
    setLocations(locations.map(loc =>
      loc.id === id ? { 
        ...loc, 
        name: data.name,
        lat: data.lat,
        lng: data.lng,
        fullAddress: data.formattedAddress || loc.fullAddress // Store formattedAddress as fullAddress
      } : loc
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

        debug.log(`Location reordered: ${numberToLetter(oldIndex + 1)} → ${numberToLetter(newIndex + 1)}`);
        debug.log(`Time swapped: ${items[oldIndex].time} ↔ ${items[newIndex].time}`);

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
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );


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
      debug.error('Cannot save trip: missing data or invalid email');
      return;
    }

    setSavingGuestTrip(true);
    try {
      debug.log('💾 Saving guest trip to database...');
      debug.log('   Email:', userEmail);

      // Validate email one more time
      const validation = validateBusinessEmail(userEmail);
      if (!validation.isValid) {
        setEmailError(validation.error || null);
        setSavingGuestTrip(false);
        return;
      }

      // Validate and normalize trip destination before saving
      if (pendingTripData?.trip_destination && !isValidTripDestination(pendingTripData.trip_destination)) {
        debug.error('❌ Invalid trip destination in pending trip:', pendingTripData.trip_destination);
        setError(`Invalid trip destination: "${pendingTripData.trip_destination}". Please select from the allowed destinations.`);
        setSavingGuestTrip(false);
        return;
      }

      // Normalize destination
      const normalizedDestination = normalizeTripDestination(pendingTripData?.trip_destination);

      // Update pending trip data with the actual email and normalized destination
      const tripDataWithEmail = {
        ...pendingTripData,
        user_email: userEmail.trim(),
        trip_destination: normalizedDestination,
      };

      // Use server-side API to create trip and send email atomically
      debug.log('💾 [GUEST-TRIP] Creating trip via server API...');
      debug.log('💾 [GUEST-TRIP] Trip data keys:', Object.keys(tripDataWithEmail));
      debug.log('💾 [GUEST-TRIP] Email:', userEmail.trim());
      
      let response;
      let result;
      
      try {
        response = await fetch('/api/create-guest-trip', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tripData: tripDataWithEmail,
            email: userEmail.trim(),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          debug.error('❌ [GUEST-TRIP] API response not OK:', response.status, errorText);
          throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        result = await response.json();
        debug.log('📥 [GUEST-TRIP] API response received:', { success: result.success, emailSent: result.emailSent });
      } catch (fetchError) {
        debug.error('❌ [GUEST-TRIP] Fetch error:', fetchError);
        setError('Failed to connect to server. Please check your internet connection and try again.');
        setSavingGuestTrip(false);
        return;
      }

      if (!response.ok || !result.success) {
        debug.error('❌ [GUEST-TRIP] Error creating trip:', result.error || result.details);
        setError(result.error || 'Failed to save trip. Please try again.');
        setSavingGuestTrip(false);
        return;
      }

      const tripData = result.trip;
      debug.log('✅ [GUEST-TRIP] Guest trip created successfully');
      debug.log(`🔗 Trip ID: ${tripData.id}`);
      debug.log(`📧 Guest email: ${userEmail}`);
      debug.log(`📧 [GUEST-TRIP] Email sent: ${result.emailSent ? 'YES' : 'NO'}`);
      
      // Check if email was sent - if not, show error but still allow redirect
      if (!result.emailSent) {
        const errorMsg = result.emailError || 'Email notification failed to send';
        debug.error('❌ [GUEST-TRIP] Email error:', errorMsg);
        setError(`Trip created but email notification failed: ${errorMsg}. Please check your email or contact support.`);
        setSavingGuestTrip(false);
        // Still redirect but show error
        setTimeout(() => {
          router.push(`/results/${tripData.id}`);
        }, 2000);
        return;
      }

      // Store trip ID in sessionStorage to identify guest as creator
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('guestCreatedTripId', tripData.id);
      }

      // Redirect to results page
      router.push(`/results/${tripData.id}`);
    } catch (err) {
      debug.error('Error saving guest trip:', err);
      setError('Failed to save trip. Please try again.');
      setSavingGuestTrip(false);
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

    // Set the trip date from extracted data - must be provided (validation should prevent this from being null)
    if (!extractedDate) {
      setExtractionError('Please select a trip date to continue. Date must be today or later.');
      return;
    }
    const tripDateToUse = new Date(extractedDate);

    debug.log('\n🚀 Starting analysis for EXTRACTED trip data...');
    debug.log(`📍 ${mappedLocations.length} locations mapped from extraction`);
    debug.log(`📅 Trip date: ${formatDateLocal(tripDateToUse)}`);
    if (extractedDriverSummary) {
      debug.log(`📝 Driver summary will be saved: ${extractedDriverSummary.substring(0, 50)}...`);
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
      passengerNames
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

    // Trip date must be selected (validation should prevent this from being undefined)
    if (!tripDate) {
      setError('Please select a trip date to continue. Date must be today or later.');
      return;
    }
    const tripDateToUse = tripDate;

    debug.log('\n🚀 Starting analysis for MANUAL trip data...');
    debug.log(`📍 ${validLocations.length} locations from manual form`);
    debug.log(`📅 Trip date: ${formatDateLocal(tripDateToUse)}`);

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
      passengerNames
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
      const tripDateStr = formatDateLocal(tripDateObj);

      debug.log(`🚀 [GENERATE] Starting report for ${validLocations.length} locations on ${tripDateStr}`);

      const days = 7; // Fixed period for trip planning

      // Get city configuration for conditional API calls
      const cityConfig = getCityConfig(tripDestination);
      debug.log(`🌍 [HOMEPAGE] City configuration: ${cityConfig.cityName} (London APIs ${cityConfig.isLondon ? 'ENABLED' : 'DISABLED'})`);

      // Fetch data for all locations in parallel
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

          // Parse responses with graceful fallbacks for all APIs
          let weatherData;
          if (weatherResponse.ok) {
            weatherData = await weatherResponse.json();
          } else {
            debug.warn(`⚠️ Weather API failed, using fallback data`);
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
            debug.warn(`⚠️ Crime API failed (${crimeResponse.status}), using fallback data`);
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
            debug.warn(`⚠️ Disruptions API failed, using fallback data`);
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
            debug.warn(`⚠️ Parking API failed, using fallback data`);
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
        trafficData = await getTrafficPredictions(validLocations, tripDateStr, tripDestination);
      } catch (trafficError) {
        trafficData = {
          success: false,
          error: 'Failed to get traffic predictions',
        };
      }

      // Generate executive report
      debug.log('🤖 [GENERATE] Creating executive report...');
      let executiveReportData = null;

      const reportResult = await generateReport({
        results,
            tripDate: tripDateStr,
        trafficData,
            emailContent: extractionText || null,
            leadPassengerName: leadPassengerName || null,
            vehicleInfo: vehicleInfo || null,
            passengerCount: passengerCount || 1,
            tripDestination: tripDestination || null,
            passengerNames: passengerNames || [],
            driverNotes: driverSummary || null,
        });

      if (reportResult.success && reportResult.data) {
          executiveReportData = reportResult.data;
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

      // Validate and normalize trip destination before saving
      if (tripDestination && !isValidTripDestination(tripDestination)) {
        debug.error('❌ Invalid trip destination:', tripDestination);
        setError(`Invalid trip destination: "${tripDestination}". Please select from the allowed destinations.`);
        setLoadingTrip(false);
        return;
      }

      // Normalize destination (ensures only whitelisted values are saved)
      const normalizedDestination = normalizeTripDestination(tripDestination);

      // Prepare trip data
      // Get the display vehicle (auto-selected if vehicle is empty or not in whitelist)
      const displayVehicle = getDisplayVehicle(vehicleInfo, passengerCount);

      // Ensure all locations have fullAddress (consistent storage format)
      const locationsWithFullAddress = validLocations.map(loc => ({
        ...loc,
        fullAddress: loc.fullAddress || loc.name, // Use fullAddress if available, fallback to name
      }));

      const tripInsertData: any = {
        user_email: emailToUse,
        trip_date: tripDateStr,
        locations: locationsWithFullAddress as any,
        trip_results: results as any,
        traffic_predictions: trafficData as any,
        executive_report: executiveReportData as any,
        trip_notes: driverSummary || null,
        lead_passenger_name: passengerNameForDb,
        vehicle: displayVehicle || null,
        passenger_count: passengerCount || 1,
        trip_destination: normalizedDestination,
        password: null
      };

      // Debug: Log what we're saving to database
      debug.log('💾 [FRONTEND] Database save values:');
      debug.log('   lead_passenger_name:', passengerNameForDb ? '[SET]' : '[NOT SET]');
      debug.log('   vehicle:', displayVehicle || null);
      debug.log('   passenger_count:', passengerCount || 1);
      debug.log('   trip_destination:', tripDestination || null);
      debug.log('   trip_notes:', driverSummary || null);

      // Add user_id for authenticated users
      if (isAuthenticated && user?.id) {
        tripInsertData.user_id = user.id;
      }

      // For authenticated users: Save trip immediately
      // For guest users: Store data and wait for email input
      if (isAuthenticated && user?.id) {
        debug.log('🔐 Authenticated user - saving trip to database immediately');

        // Save user to database
        const { error: userError } = await supabase
          .from('users')
          .upsert({
            email: emailToUse,
            auth_user_id: user.id,
            marketing_consent: true
          }, { onConflict: 'email' });

        if (userError) {
          debug.error('❌ Error saving user:', userError);
        }

        // Save trip to database
        const { data: tripData, error: tripError } = await supabase
          .from('trips')
          .insert(tripInsertData)
          .select()
          .single();

        if (tripError || !tripData) {
          debug.error('❌ Error saving trip:', tripError);
          throw new Error(`Failed to save trip to database: ${tripError?.message || 'Unknown error'}`);
        }

        debug.log('✅ Trip saved to database');
        debug.log(`🔗 Trip ID: ${tripData.id}`);

        // Store trip ID for navigation
        const savedTripId = tripData.id;
        setTripId(savedTripId);

        // For authenticated users: auto-redirect when complete
        debug.log('🔐 Authenticated user - will auto-redirect when animation completes');

        // Mark background process as complete
        backgroundProcessComplete = true;
        debug.log('✅ Background process complete');

        // Force progress to 100% and redirect after a short delay
        setLoadingProgress(100);

        // Wait for visual animation to complete and then redirect
        setTimeout(() => {
          debug.log('✅ Background process complete, redirecting...');
          // Small delay to show the green completion state
          setTimeout(() => {
            debug.log(`✅ [GENERATE] Complete - redirecting to report`);
            router.push(`/results/${savedTripId}`);
          }, 1000); // Show completion state for 1 second
        }, 500);
      } else {
        debug.log('👤 Guest user - storing trip data for later save (after email entry)');

        // Store the trip data to save later when guest enters email
        setPendingTripData(tripInsertData);

        // Mark background process as complete
        backgroundProcessComplete = true;
        debug.log('✅ Background process complete');
        debug.log('👤 Guest user - will show email field and View Report button');
        // For guest users, don't auto-redirect
        // They will manually click "View Report" button after entering email
      }

    } catch (err) {
      debug.error('❌ Error:', err);
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
      const days = calculateDaysFromDates(startDate, endDate);

      debug.log(`\n${'='.repeat(80)}`);
      debug.log(`🚀 Fetching data for ${selectedDistricts.length} district(s)`);
      debug.log(`📅 Date Range: ${startDate} to ${endDate} (${days} days)`);
      debug.log(`📍 Districts: ${selectedDistricts.map(id => londonDistricts.find(d => d.id === id)?.name).join(', ')}`);
      debug.log(`${'='.repeat(80)}\n`);

      // Fetch data for all selected districts in parallel
      const districtPromises = selectedDistricts.map(async (districtId) => {
        const districtName = londonDistricts.find(d => d.id === districtId)?.name || districtId;

        debug.log(`\n🔍 Fetching data for ${districtName}...`);

        const [crimeResponse, disruptionsResponse, weatherResponse] = await Promise.all([
          fetch(`/api/uk-crime?district=${districtId}`),
          fetch(`/api/tfl-disruptions?district=${districtId}&days=${days}`),
          fetch(`/api/weather?district=${districtId}&days=${Math.min(days, 16)}`) // Open-Meteo max 16 days
        ]);

        const crimeData = await crimeResponse.json();
        const disruptionsData = await disruptionsResponse.json();
        const weatherData = await weatherResponse.json();

        if (crimeData.success && disruptionsData.success && weatherData.success) {
          debug.log(`✅ ${districtName}: ${crimeData.data.summary.totalCrimes} crimes, ${disruptionsData.data.analysis.total} disruptions, ${weatherData.data.forecast.length} days forecast`);

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
      debug.error('❌ Error:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
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
      debug.error('Microphone access error:', err);
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
      const mammoth = await import('mammoth');
      const result = await mammoth.default.extractRawText({ arrayBuffer });
      const text = result.value;

      if (text.trim()) {
        setExtractionText(prev => prev + (prev ? '\n\n' : '') + text);
      } else {
        setFileError('No text found in Word document');
      }
    } catch (error) {
      debug.error('Error processing Word file:', error);
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
      const XLSX = await import('xlsx');
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
      debug.error('Error processing Excel file:', error);
      setFileError('Failed to read Excel file');
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Handle PDF file (.pdf)
  const handlePdfFile = async (file: File) => {
    try {
      setIsProcessingFile(true);
      setFileError(null);

      // Dynamically import pdfjs-dist only on client side
      const pdfjsLib = await import('pdfjs-dist');

      // Configure PDF.js worker (use local file from public folder)
      if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let extractedText = '';

      // Extract text from all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        extractedText += (extractedText ? '\n\n' : '') + pageText;
      }

      if (extractedText.trim()) {
        setExtractionText(prev => prev + (prev ? '\n\n' : '') + extractedText);
      } else {
        setFileError('No text found in PDF document');
      }
    } catch (error) {
      debug.error('Error processing PDF file:', error);
      setFileError('Failed to read PDF document');
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
      debug.error('Error transcribing audio file:', error);
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
    // Check for PDF files
    else if (fileName.endsWith('.pdf') || fileType === 'application/pdf') {
      await handlePdfFile(file);
    }
    // Check for Audio files
    else if (fileType.startsWith('audio/') ||
      fileName.match(/\.(opus|m4a|mp3|ogg|wav|aac|flac|webm)$/)) {
      await handleAudioFile(file);
    }
    else {
      setFileError('Unsupported file type. Please upload Word (.docx), Excel (.xlsx), PDF (.pdf), or Audio files.');
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
    debug.log('🚀 [EXTRACT] Starting extraction...');

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
        debug.log('❌ [EXTRACT] Failed:', data.error);
        setExtractionError(data.error || 'Failed to extract trip information.');
        return;
      }

      debug.log(`✅ [EXTRACT] Success - ${data.locations?.length || 0} locations, date: ${data.date}`);

      const extractedDestination = data.tripDestination || '';
      debug.log('📍 [EXTRACT] Extracted trip destination:', extractedDestination);

      // Check if the extracted destination is supported
      if (extractedDestination && !isValidTripDestination(extractedDestination)) {
        debug.log('❌ [EXTRACT] Unsupported city detected:', extractedDestination);
        setExtractionError('We don\'t support this city at the moment.');
        setExtractedLocations(null);
        setExtractedDate(null);
        setExtractedDriverSummary(null);
        setLeadPassengerName('');
        setVehicleInfo('');
        setPassengerCount(1);
        setTripDestination('');
        setPassengerNames([]);
        setLastExtractedText('');
        return;
      }

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
      setTripDestination(extractedDestination);
      setPassengerNames(data.passengerNames || []);
      setLastExtractedText(extractionText);
    } catch (error) {
      debug.error('❌ [EXTRACT] Error:', error);
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
  };

  // Handle resetting to initial import state (for logo click)
  const handleResetToImport = () => {
    debug.log('🏠 [FRONTEND] Resetting to initial import state...');

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
  };


  // Handle manual location edit
  const handleLocationEdit = (index: number, value: string) => {
    debug.log(`✏️ [FRONTEND] Manual location edit for index ${index}: "${value}"`);
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

      }
    }
  };

  // Handle extracted date select (for Calendar component)
  const handleExtractedDateSelect = (date: Date | undefined) => {
    if (date) {
      const dateString = formatDateLocal(date);
      setExtractedDate(dateString);
    } else {
      setExtractedDate(null);
    }
    setExtractedDatePickerOpen(false);
  };

  // Handle date edit (legacy - for direct input, kept for backward compatibility)
  const handleDateEdit = (value: string) => {
    setExtractedDate(value);
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
    }
  };

  // Handle extracted location removal
  const handleExtractedLocationRemove = (index: number) => {
    if (extractedLocations && extractedLocations.length > 1) {
      const updatedLocations = extractedLocations.filter((_, i) => i !== index);
      setExtractedLocations(updatedLocations);
    }
  };

  // Clear validation messages when form becomes valid
  useEffect(() => {
    if (showValidationMessages && !loadingTrip) {
      const isValid = extractedLocations?.every(loc => loc.verified) && !hasUnknownOrMissingValues(extractedDate, extractedLocations, tripDestination);
      if (isValid) {
        setShowValidationMessages(false);
      }
    }
  }, [extractedDate, extractedLocations, loadingTrip, showValidationMessages, tripDestination]);



  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="h-screen p-4 sm:p-8 flex items-center justify-center">
        <div className="max-w-4xl mx-auto w-full">


          {/* Tagline for Homepage - Hide when extracted info or manual form is shown */}
          {!extractedLocations && !showManualForm && (
            <div className="mb-6 sm:mb-8 text-center">
              {/* <img
                src="/chauffs-logo-new-neutral.png"
                alt="Chauffs"
                className="mx-auto h-7 w-auto mb-12"
              /> */}
              <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-[3.45rem] font-light text-[#05060A] dark:text-white leading-tight sm:leading-[1.1] px-2 sm:px-0">
                Access the world's top chauffeurs,<br className="hidden sm:block" />and book them instantly with AI
              </p>
              <p className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground mt-3 sm:mt-4 max-w-2xl mx-auto font-light leading-relaxed px-4 sm:px-0">
                Hand-pick your preferred drivers and secure their confirmation in seconds
              </p>
            </div>
          )}

          {/* Email/Text Import Section */}
          {!showManualForm && !extractedLocations && (
            <div className="mb-6 sm:mb-8 flex justify-center mt-0 sm:mt-12">
              <div className="space-y-4 w-[92%] sm:w-[85%]">
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
                      ref={textareaRef}
                      value={extractionText}
                      onChange={(e) => {
                        setExtractionText(e.target.value);
                        // Auto-resize textarea
                        const textarea = e.target;
                        textarea.style.height = 'auto';
                        textarea.style.height = Math.min(textarea.scrollHeight, 240) + 'px';
                      }}
                      placeholder="Enter your trip itinerary here"
                      className="w-full min-h-[120px] sm:min-h-[86px] max-h-[240px] p-3 pb-10 rounded-md border border-border bg-background dark:bg-input/30 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:border-ring resize-none overflow-y-auto dark:hover:bg-[#323236] transition-colors dark:focus-visible:border-[#323236]"
                    />

                    {/* Drag and Drop Overlay */}
                    {isDragging && (
                      <div className="absolute inset-0 bg-blue-500/10 border-2 border-blue-500 border-dashed rounded-md flex items-center justify-center pointer-events-none z-10">
                        <div className="text-center">
                          <svg className="w-12 h-12 mx-auto mb-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="text-sm font-medium text-blue-500">Drop file to upload</p>
                          <p className="text-xs text-muted-foreground">Word, Excel, PDF, or Audio files</p>
                        </div>
                      </div>
                    )}

                    {/* File Upload Button (Paperclip) - Lower Left */}
                    <label
                      className={`absolute left-3 bottom-5 transition-all cursor-pointer ${isProcessingFile
                        ? 'text-blue-500 opacity-100'
                        : 'text-muted-foreground opacity-60 hover:opacity-100'
                        }`}
                      title="Upload Word, Excel, PDF, or Audio file"
                    >
                      <input
                        type="file"
                        accept=".docx,.doc,.xlsx,.xls,.pdf,.opus,.m4a,.mp3,.ogg,.wav,.aac,.flac,.webm,audio/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/pdf"
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
                      className={`absolute right-3 bottom-5 transition-all ${isRecording
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
                <div className="flex items-center justify-end gap-3">
                <Button
                    onClick={() => setShowManualForm(true)}
                    variant="outline"
                    size="lg"
                  >
                    Edit manually
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
                      <span>Extract trip</span>
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
              <div className="flex items-center justify-end mb-4">
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
                    <Popover open={extractedDatePickerOpen} onOpenChange={setExtractedDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal bg-background",
                            !extractedDate && "text-muted-foreground",
                            !extractedDate && "border-[#e77500] dark:border-[#e77500]"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {extractedDate ? (() => {
                            const [year, month, day] = extractedDate.split('-').map(Number);
                            return format(new Date(year, month - 1, day), "PPP");
                          })() : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={extractedDate ? (() => {
                            const [year, month, day] = extractedDate.split('-').map(Number);
                            return new Date(year, month - 1, day);
                          })() : undefined}
                          onSelect={handleExtractedDateSelect}
                          disabled={(date) => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            // Disable past dates - allow today or later
                            return date < today;
                          }}
                          defaultMonth={new Date()}
                          showOutsideDays={false}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {!extractedDate && (
                      <p className="text-xs text-[#e77500] dark:text-[#e77500] mt-1">
                        Please select a trip date to continue
                      </p>
                    )}
                  </div>

                  {/* Trip Destination - spans 2 columns - READ-ONLY (for visualization only) */}
                  <div className="sm:col-span-2">
                    <Label className="text-primary-foreground dark:text-card-foreground font-medium text-sm mb-2 block">Trip destination</Label>
                    <Input
                      value={tripDestination || ''}
                      readOnly
                      disabled
                      className="bg-muted/50 border-border rounded-md h-9 text-foreground cursor-not-allowed"
                      placeholder="No destination set"
                    />
                  </div>

                  {/* Lead Passenger Name - spans 2 columns */}
                  <div className="sm:col-span-2">
                    <Label className="text-primary-foreground dark:text-card-foreground font-medium text-sm mb-2 block">Lead passenger name</Label>
                    <Input
                      value={leadPassengerName}
                      onChange={(e) => {
                        setLeadPassengerName(e.target.value);
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
                      }}
                      className="h-9"
                    />
                  </div>

                  {/* Vehicle - spans 1 column */}
                  <div className="sm:col-span-1">
                    <Label className="text-primary-foreground dark:text-card-foreground font-medium text-sm mb-2 block">Vehicle</Label>
                    <Input
                      value={vehicleInfo || ''}
                      onChange={(e) => {
                        setVehicleInfo(e.target.value);
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
                          showValidationMessages={showValidationMessages}
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
                  }}
                  placeholder="Additional notes, contact info, special instructions, etc."
                  rows={6}
                  className="w-full bg-background dark:bg-input/30 border-border rounded-md p-2 text-sm text-foreground dark:hover:bg-[#323236] transition-colors border resize-y focus:outline-none focus-visible:border-ring dark:focus-visible:border-[#323236]"
                />
              </div>

              {/* View Route & Create trip Buttons */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => setMapOpen(true)}
                  variant="outline"
                  size="lg"
                  className="flex-1 sm:flex-initial"
                  disabled={!extractedLocations || extractedLocations.filter(loc => loc.verified).length < 2}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  View Route
                </Button>

                <Button
                  onClick={() => {
                    const isDisabled = loadingTrip || !extractedLocations?.every(loc => loc.verified) || hasUnknownOrMissingValues(extractedDate, extractedLocations, tripDestination);
                    if (isDisabled) {
                      setShowValidationMessages(true);
                    } else {
                      setShowValidationMessages(false);
                      handleExtractedTripSubmit();
                    }
                  }}
                  disabled={loadingTrip || !extractedLocations?.every(loc => loc.verified) || hasUnknownOrMissingValues(extractedDate, extractedLocations, tripDestination)}
                  size="lg"
                  className="flex items-center gap-2 bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] ml-auto"
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
                    <>Create trip</>
                  )}
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
                            // Disable past dates - allow today or later
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
                      onValueChange={(value) => {
                        if (isValidTripDestination(value)) {
                          setTripDestination(value);
                        } else {
                          setError(`"${value}" is not an allowed destination. Please select from the list.`);
                        }
                      }}
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
                        <SelectItem key="Singapore" value="Singapore">
                          Singapore
                        </SelectItem>
                        <SelectItem key="Frankfurt" value="Frankfurt">
                          Frankfurt
                        </SelectItem>
                        <SelectItem key="Paris" value="Paris">
                          Paris
                        </SelectItem>
                        <SelectItem key="Tokyo" value="Tokyo">
                          Tokyo
                        </SelectItem>
                        <SelectItem key="Boston" value="Boston">
                          Boston
                        </SelectItem>
                        <SelectItem key="Zurich" value="Zurich">
                          Zurich
                        </SelectItem>

                        {/* Database destinations (exclude default cities, filter by whitelist) */}
                        {availableDestinations
                          .filter(dest => !['London', 'New York', 'Singapore', 'Frankfurt', 'Paris', 'Tokyo', 'Boston', 'Zurich'].includes(dest))
                          .filter(dest => isValidTripDestination(dest)) // Extra safety: filter invalid destinations
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
                    <div className={cn(
                      "space-y-4 mb-4",
                      (!tripDate || !tripDestination) && "opacity-60 pointer-events-none"
                    )}>
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
                          isDisabled={!tripDate || !tripDestination}
                          onEditStart={(id, field) => {
                            if (!tripDate || !tripDestination) {
                              return;
                            }
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
                    Locations reordered! Click "Create trip" to update the route.
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
                  disabled={!tripDate || !tripDestination}
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

              {/* View Route & Create trip Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => setMapOpen(true)}
                  variant="outline"
                  size="lg"
                  className="flex-1 sm:flex-initial"
                  disabled={locations.filter(l => l.name).length < 2}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  View Route
                </Button>

                <Button
                  onClick={handleTripSubmit}
                  disabled={loadingTrip || locations.filter(l => l.name).length === 0}
                  variant={locationsReordered ? "destructive" : "default"}
                  size="lg"
                  className={`flex-1 sm:flex-initial flex items-center gap-2 bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] ml-auto ${locationsReordered ? 'animate-pulse' : ''}`}
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
                    <>Create trip</>
                  )}
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
                          {loadingProgress >= 100 ? 'Your trip is ready' : 'Creating trip'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {loadingSteps.filter(s => s.status === 'completed').length} of {loadingSteps.length} steps completed
                        </p>
                      </div>
                    </div>

                    {/* Steps List - Carousel View or Completion View */}
                    <div className="relative h-[200px] overflow-hidden flex items-center justify-center">
                      {loadingProgress >= 100 ? (
                        // Completion View - For guests: show email field and button. For authenticated: show message
                        <div className="w-full animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
                          {isAuthenticated ? (
                            // Authenticated users: Show redirect message - positioned a bit lower in the container
                            <div className="flex flex-col items-center justify-center gap-3 mt-8">
                              <svg className="animate-spin h-12 w-12 text-muted-foreground" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              <h3 className="text-lg font-semibold text-card-foreground">Redirecting to trip</h3>
                            </div>
                          ) : (
                            // Guest users: Show email field and View Report button
                            <div className="bg-[#05060A]/10 dark:bg-[#E5E7EF]/10 border border-[#05060A] dark:border-[#E5E7EF] rounded-md p-4">
                              <div className="flex flex-col items-center space-y-4">
                                <label htmlFor="userEmail" className="block text-sm font-medium text-card-foreground text-center">
                                  Your business email (required to view trip)
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

                                {/* View driver trip Button - Only for guest users */}
                                <Button
                                  onClick={handleGuestTripSave}
                                  size="lg"
                                  className="flex items-center gap-2 bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                                  disabled={!pendingTripData || !userEmail.trim() || !!emailError || savingGuestTrip}
                                >
                                  {!pendingTripData ? (
                                    <>
                                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                      </svg>
                                      <span>Composing trip...</span>
                                    </>
                                  ) : savingGuestTrip ? (
                                    <>
                                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                      </svg>
                                      <span>Proceeding...</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                      </svg>
                                      View trip
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
                                className={`flex items-start gap-4 p-4 rounded-lg border ${isActive
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

      {/* Available in Section - Below Hero */}
      {!extractedLocations && !showManualForm && (
        <div className="w-full py-6 sm:py-8 px-4 sm:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="space-y-2 sm:space-y-3">
              <p className="text-xs sm:text-sm text-[#05060A] dark:text-white text-center font-bold">
                Available in
              </p>
              <div className="w-full">
                <DestinationCarousel />
              </div>
            </div>
          </div>
        </div>
      )}

      {!isAuthenticated && (
        <>
          <WhyChauffsSection />
          <HowItWorksSection />
          <DemoSection />
          <CTASection />
        </>
      )}
    </div>
  );
}
