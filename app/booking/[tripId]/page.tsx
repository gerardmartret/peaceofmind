'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import { bookingPreviewInitialState, requiredFields, type BookingPreviewFieldKey } from '@/app/results/[id]/constants';
import { normalizeMatchKey, matchesDriverToVehicle, vehicleKey } from '@/app/results/[id]/utils/vehicle-helpers';
import type { DriverRecord } from '@/app/results/[id]/types';

export default function BookingPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.tripId as string;
  const { user, loading: authLoading } = useAuth();

  // Trip data state
  const [tripData, setTripData] = useState<any>(null);
  const [loadingTripData, setLoadingTripData] = useState(true);
  const [tripError, setTripError] = useState<string | null>(null);

  // Drivania quote state
  const [loadingDrivaniaQuote, setLoadingDrivaniaQuote] = useState<boolean>(false);
  const [drivaniaQuotes, setDrivaniaQuotes] = useState<any>(null);
  const [drivaniaError, setDrivaniaError] = useState<string | null>(null);
  const [drivaniaServiceType, setDrivaniaServiceType] = useState<'one-way' | 'hourly' | null>(null);
  const [showOtherVehicles, setShowOtherVehicles] = useState<boolean>(false);

  // Vehicle selection state
  const [selectedDrivaniaVehicle, setSelectedDrivaniaVehicle] = useState<any>(null);
  const [vehicleSelections, setVehicleSelections] = useState<Record<string, { isVehicleSelected: boolean; selectedDriverIds: string[] }>>({});

  // Matching drivers state
  const [matchingDrivers, setMatchingDrivers] = useState<DriverRecord[]>([]);
  const [loadingMatchingDrivers, setLoadingMatchingDrivers] = useState<boolean>(false);
  const [matchingDriversError, setMatchingDriversError] = useState<string | null>(null);

  // Booking form state
  const [bookingPreviewFields, setBookingPreviewFields] = useState(bookingPreviewInitialState);
  const [missingFields, setMissingFields] = useState<Set<BookingPreviewFieldKey>>(new Set());
  const [bookingSubmissionState, setBookingSubmissionState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [bookingSubmissionMessage, setBookingSubmissionMessage] = useState<string>('');
  const [processingTimer, setProcessingTimer] = useState<NodeJS.Timeout | null>(null);

  // Load trip data
  useEffect(() => {
    const loadTripData = async () => {
      if (!tripId) {
        setTripError('Trip ID is required');
        setLoadingTripData(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('id', tripId)
          .single();

        if (error) throw error;

        if (!data) {
          setTripError('Trip not found');
          setLoadingTripData(false);
          return;
        }

        // Parse locations if stored as JSON string
        let locations = data.locations;
        if (typeof locations === 'string') {
          try {
            locations = JSON.parse(locations);
          } catch (e) {
            console.error('Failed to parse locations JSON:', e);
            setTripError('Invalid trip data format');
            setLoadingTripData(false);
            return;
          }
        }

        setTripData({
          ...data,
          locations,
        });
        setLoadingTripData(false);
      } catch (err: any) {
        console.error('Error loading trip data:', err);
        setTripError(err.message || 'Failed to load trip data');
        setLoadingTripData(false);
      }
    };

    loadTripData();
  }, [tripId]);

  // Fetch Drivania quotes when trip data is loaded
  // Called immediately when tripData loads (optimized for speed)
  useEffect(() => {
    // Early returns
    if (!tripData || loadingDrivaniaQuote || drivaniaQuotes) return;
    
    // Validate locations exist before calling
    if (!tripData.locations || !Array.isArray(tripData.locations) || tripData.locations.length < 2) return;

    const fetchDrivaniaQuote = async () => {
      setDrivaniaError(null);
      setLoadingDrivaniaQuote(true);

      try {
        const locations = tripData.locations;
        if (!locations || !Array.isArray(locations) || locations.length < 2) {
          setDrivaniaError('Trip must have at least 2 locations (pickup and dropoff)');
          setLoadingDrivaniaQuote(false);
          return;
        }

        // Type assertion and ensure all locations have required fields
        const typedLocations = locations.map((loc: any, idx: number) => ({
          id: loc.id || `location-${idx + 1}`,
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

        // Determine service type based on number of locations
        const serviceType: 'one-way' | 'hourly' = typedLocations.length > 2 ? 'hourly' : 'one-way';
        setDrivaniaServiceType(serviceType);

        // Get passenger count and trip date
        const passengerCountValue = tripData.passenger_count || 1;
        const tripDateValue = tripData.trip_date || new Date().toISOString().split('T')[0];

        // Prepare the payload
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
          setDrivaniaQuotes(result.data);
          setDrivaniaServiceType(result.serviceType);
        } else {
          setDrivaniaError(result.error || result.message || 'Failed to get quote from Drivania');
        }
      } catch (err) {
        console.error('Error requesting Drivania quote:', err);
        setDrivaniaError('Failed to request quote from Drivania. Please try again.');
      } finally {
        setLoadingDrivaniaQuote(false);
      }
    };

    fetchDrivaniaQuote();
  }, [tripData, loadingDrivaniaQuote, drivaniaQuotes]);

  // Fetch matching drivers
  const tripDestination = tripData?.trip_destination || '';
  const driverDestinationForDrivers = useMemo(() => {
    return (tripDestination || '').trim();
  }, [tripDestination]);

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
        console.error('Error fetching matching drivers:', err);
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

  // Vehicle filtering logic
  const preferredVehicleHint = tripData?.vehicle_info || tripData?.preferred_vehicle;
  const matchesPreferredVehicle = useMemo(() => {
    if (!preferredVehicleHint) return () => false;
    const normalizedHint = normalizeMatchKey(preferredVehicleHint);
    return (vehicle: any) => {
      const normalizedType = normalizeMatchKey(vehicle.vehicle_type);
      const normalizedLevel = normalizeMatchKey(vehicle.level_of_service);
      return (
        normalizedType.includes(normalizedHint) ||
        normalizedHint.includes(normalizedType) ||
        normalizedLevel.includes(normalizedHint) ||
        normalizedHint.includes(normalizedLevel)
      );
    };
  }, [preferredVehicleHint]);

  const preferredVehicles = useMemo(() => {
    if (!drivaniaQuotes?.quotes?.vehicles || !preferredVehicleHint) {
      return [];
    }
    return drivaniaQuotes.quotes.vehicles.filter(matchesPreferredVehicle);
  }, [drivaniaQuotes, preferredVehicleHint, matchesPreferredVehicle]);

  const displayVehicles = useMemo(() => {
    if (preferredVehicles.length > 0) {
      return preferredVehicles;
    }
    return drivaniaQuotes?.quotes?.vehicles || [];
  }, [preferredVehicles, drivaniaQuotes]);

  const otherVehicles = useMemo(() => {
    if (!drivaniaQuotes?.quotes?.vehicles || preferredVehicles.length === 0) {
      return [];
    }
    const preferredKeys = new Set(preferredVehicles.map((vehicle: any) => vehicleKey(vehicle)));
    return drivaniaQuotes.quotes.vehicles.filter(
      (vehicle: any) => !preferredKeys.has(vehicleKey(vehicle))
    );
  }, [drivaniaQuotes, preferredVehicles]);

  useEffect(() => {
    setShowOtherVehicles(false);
  }, [preferredVehicles]);

  // Handle vehicle selection
  const handleVehicleSelect = (vehicle: any) => {
    const pickup = tripData?.locations?.[0];
    const dropoff = tripData?.locations?.[tripData.locations.length - 1];

    setSelectedDrivaniaVehicle(vehicle);
    setBookingPreviewFields(prev => ({
      ...prev,
      passengerName: tripData?.lead_passenger_name || '',
      contactEmail: tripData?.user_email || '',
      contactPhone: prev.contactPhone,
      flightNumber: pickup?.flightNumber || '',
      flightDirection: tripDestination || pickup?.flightDirection || '',
      passengerCount: tripData?.passenger_count || 1,
      pickupTime: pickup?.time || '',
      dropoffTime: dropoff?.time || '',
      notes: tripData?.driver_notes || '',
    }));
    setMissingFields(new Set());
    setBookingSubmissionState('idle');
    setBookingSubmissionMessage('');
  };

  // Handle booking field changes
  const handleBookingFieldChange = (field: BookingPreviewFieldKey, value: string | number) => {
    setBookingPreviewFields(prev => ({
      ...prev,
      [field]: value,
    }));
    if (missingFields.has(field)) {
      setMissingFields((prev) => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    }
  };

  // Handle booking submission
  const handleBookNow = async () => {
    if (!selectedDrivaniaVehicle) return;

    const missing = requiredFields.filter((field) => {
      const value = bookingPreviewFields[field];
      if (typeof value === 'number') {
        return value === null || value === undefined;
      }
      return !value || value.toString().trim() === '';
    });

    if (missing.length > 0) {
      setMissingFields(new Set(missing));
      return;
    }

    setBookingSubmissionState('loading');
    setBookingSubmissionMessage('We are processing your booking');

    const payload = {
      service_id: drivaniaQuotes?.service_id,
      vehicle_id: selectedDrivaniaVehicle.vehicle_id,
      passenger_name: bookingPreviewFields.passengerName,
      contact_email: bookingPreviewFields.contactEmail,
      contact_phone: bookingPreviewFields.contactPhone,
      notes: bookingPreviewFields.notes,
      child_seats: bookingPreviewFields.childSeats || 0,
      flight_number: bookingPreviewFields.flightNumber,
      flight_direction: bookingPreviewFields.flightDirection,
      pickup_location: tripData?.locations?.[0],
      trip_id: tripId,
    };

    if (processingTimer) {
      clearTimeout(processingTimer);
    }

    try {
      const serviceResponse = await fetch('/api/drivania/create-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const serviceResult = await serviceResponse.json();

      if (serviceResult.success) {
        // Update trip status to "booked" and assign driver to "drivania"
        try {
          const statusResponse = await fetch('/api/update-trip-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tripId: tripId,
              status: 'booked',
              driver: 'drivania',
            }),
          });

          const statusResult = await statusResponse.json();
          if (statusResult.success) {
            console.log('Trip status updated to "booked"');
          }
        } catch (statusErr) {
          console.error('Error updating trip status:', statusErr);
        }

        setBookingSubmissionMessage('Your booking has been created with Drivania successfully.');
        setMissingFields(new Set());
        const timer = setTimeout(() => {
          setBookingSubmissionState('success');
          setProcessingTimer(null);
        }, 5000);
        setProcessingTimer(timer);
      } else {
        setBookingSubmissionState('idle');
        setBookingSubmissionMessage(serviceResult.error || 'Failed to create service with Drivania');
      }
    } catch (err) {
      console.error('Booking submission error', err);
      setBookingSubmissionState('idle');
      setBookingSubmissionMessage('Failed to create service with Drivania. Please try again.');
    }
  };

  // Render vehicle card
  const renderVehicleCard = (vehicle: any, index: number) => {
    const normalizedVehicleType = normalizeMatchKey(vehicle.vehicle_type);
    const vehicleDrivers = normalizedVehicleType
      ? matchingDrivers.filter((driver) =>
          matchesDriverToVehicle(
            driver.vehicle_type,
            driver.level_of_service,
            vehicle.vehicle_type,
            vehicle.level_of_service,
          )
        )
      : [];

    const vehicleId = vehicle.vehicle_id || `${vehicle.vehicle_type}-${index}`;
    const selection = vehicleSelections[vehicleId] || { isVehicleSelected: true, selectedDriverIds: [] };

    const basePrice = vehicle.sale_price?.price || 0;
    let extraFare = 0;

    const driverCount = selection.selectedDriverIds.length;
    if (driverCount === 1) {
      extraFare = basePrice * 0.2;
    } else if (driverCount === 2) {
      extraFare = basePrice * 0.15;
    } else if (driverCount === 3) {
      extraFare = basePrice * 0.1;
    } else if (driverCount === 4) {
      extraFare = basePrice * 0.05;
    } else if (driverCount >= 5) {
      extraFare = 0;
    }

    const totalPrice = basePrice + extraFare;
    const isSelected = selectedDrivaniaVehicle?.vehicle_id === vehicle.vehicle_id;

    return (
      <Card key={vehicle.vehicle_id || `${vehicle.vehicle_type}-${index}`} className="shadow-none w-full">
        <CardContent className="flex flex-col gap-6 py-6">
          <div
            onClick={() => handleVehicleSelect(vehicle)}
            className={`p-5 flex gap-4 border-2 rounded-md cursor-pointer transition-all ${
              isSelected
                ? 'border-primary bg-primary/10 dark:bg-primary/20 ring-2 ring-primary/30 dark:ring-primary/40 shadow-md dark:shadow-primary/20'
                : 'border-border hover:border-primary/50 dark:hover:border-primary/40'
            }`}
          >
            {vehicle.vehicle_image && (
              <div className="h-32 w-32 flex-shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted/60">
                <img
                  src={vehicle.vehicle_image}
                  alt={vehicle.vehicle_type}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className="flex flex-1 flex-col gap-3">
              <div>
                <h4 className="text-lg font-semibold text-card-foreground">
                  {vehicle.vehicle_type}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {vehicle.level_of_service}
                </p>
              </div>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <div className="flex gap-4 text-xs">
                  {vehicle.max_seating_capacity != null && (
                    <span>Seats: {vehicle.max_seating_capacity}</span>
                  )}
                  {vehicle.max_cargo_capacity != null && (
                    <span>Cargo: {vehicle.max_cargo_capacity}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {vehicleDrivers.length > 0 && (
            <div className="p-5 border border-border rounded-md">
              <div className="text-xs text-muted-foreground space-y-3">
                <p className="uppercase tracking-wider text-[10px] font-semibold text-muted-foreground/80">
                  Or select individual drivers
                </p>
                <div className="flex flex-wrap gap-2">
                  {vehicleDrivers.map((driver) => {
                    const isDriverSelected = selection.selectedDriverIds.includes(driver.id);
                    return (
                      <div
                        key={driver.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setVehicleSelections((prev) => {
                            const current = prev[vehicleId] || { isVehicleSelected: false, selectedDriverIds: [] };
                            const isSelected = current.selectedDriverIds.includes(driver.id);
                            return {
                              ...prev,
                              [vehicleId]: {
                                ...current,
                                isVehicleSelected: false,
                                selectedDriverIds: isSelected
                                  ? current.selectedDriverIds.filter((id) => id !== driver.id)
                                  : [...current.selectedDriverIds, driver.id],
                              },
                            };
                          });
                        }}
                        className={`flex items-center gap-3 rounded-md border-2 px-3 py-2 cursor-pointer transition-all ${
                          isDriverSelected
                            ? 'border-primary bg-primary/10 dark:bg-primary/20 ring-2 ring-primary/30 dark:ring-primary/40 shadow-md dark:shadow-primary/20'
                            : 'border-border/60 bg-muted/60 hover:border-primary/50 dark:hover:border-primary/40'
                        }`}
                      >
                        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-muted/70">
                          {driver.image_url ? (
                            <img
                              src={driver.image_url}
                              alt={driver.first_name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              onError={(event) => {
                                (event.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase text-muted-foreground">
                              ?
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-[11px] text-muted-foreground">
                          <p className="text-sm font-semibold text-card-foreground truncate">
                            {driver.first_name}
                          </p>
                          <p className="truncate">
                            {driver.vehicle_type || 'Vehicle'}
                            {driver.vehicle_type && driver.destination ? ' • ' : ''}
                            {driver.destination}
                          </p>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
                            Supabase driver
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 text-sm text-muted-foreground px-5">
            <div className="flex items-center justify-between text-card-foreground font-semibold">
              <span>Fare</span>
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {drivaniaQuotes?.currency_code
                    ? `${drivaniaQuotes.currency_code} ${basePrice.toFixed(2)}`
                    : basePrice.toFixed(2)}
                </span>
                {selection.isVehicleSelected && (
                  <span className="text-xs text-muted-foreground">(Discounted fare)</span>
                )}
              </div>
            </div>
            {selection.selectedDriverIds.length > 0 && extraFare > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Extra fare</span>
                <span>
                  {drivaniaQuotes?.currency_code
                    ? `${drivaniaQuotes.currency_code} ${extraFare.toFixed(2)}`
                    : extraFare.toFixed(2)}
                </span>
              </div>
            )}
            {selection.selectedDriverIds.length > 0 && (
              <div className="flex items-center justify-between text-card-foreground font-semibold border-t border-border pt-2">
                <span>Total</span>
                <span className="text-lg">
                  {drivaniaQuotes?.currency_code
                    ? `${drivaniaQuotes.currency_code} ${totalPrice.toFixed(2)}`
                    : totalPrice.toFixed(2)}
                </span>
              </div>
            )}
            {vehicle.extra_hour && (
              <div className="text-xs text-muted-foreground">
                Extra hour: {vehicle.extra_hour.toFixed(2)} {drivaniaQuotes?.currency_code}
              </div>
            )}
            <Button
              size="sm"
              type="button"
              className="w-full bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
              onClick={() => {
                const vehicleWithTotal = {
                  ...vehicle,
                  sale_price: {
                    ...vehicle.sale_price,
                    price: totalPrice,
                  },
                };
                handleVehicleSelect(vehicleWithTotal);
              }}
            >
              {isSelected ? 'Selected' : 'Select Vehicle'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const highlightMissing = (field: BookingPreviewFieldKey) =>
    missingFields.has(field) ? 'border-destructive/70 bg-destructive/10 text-destructive' : '';

  // Loading state
  if (authLoading || loadingTripData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (tripError || !tripData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Trip Not Found</h2>
            <p className="text-muted-foreground mb-6">
              {tripError || 'This trip could not be found.'}
            </p>
            <Button onClick={() => router.push('/')}>Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push(`/results/${tripId}`)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Trip Report
          </Button>
          <h1 className="text-3xl font-bold">Book Your Trip</h1>
          <p className="text-muted-foreground mt-2">
            Select a vehicle and complete your booking details
          </p>
        </div>

        {/* Success Message */}
        {bookingSubmissionState === 'success' && (
          <Alert className="mb-6 bg-green-500/10 border-green-500/30">
            <AlertDescription className="text-green-700 dark:text-green-400">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold">{bookingSubmissionMessage}</span>
              </div>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push(`/results/${tripId}`)}
              >
                Return to Trip Report
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {bookingSubmissionState === 'loading' && (
          <Alert className="mb-6">
            <AlertDescription className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
              {bookingSubmissionMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Error Message */}
        {bookingSubmissionState === 'idle' && bookingSubmissionMessage && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{bookingSubmissionMessage}</AlertDescription>
          </Alert>
        )}

        {/* Drivania Quotes Section */}
        <div className="mb-8">
          {drivaniaError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{drivaniaError}</AlertDescription>
            </Alert>
          )}

          {loadingDrivaniaQuote ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mr-3"></div>
              <span className="text-muted-foreground">Loading Drivania quotes...</span>
            </div>
          ) : drivaniaQuotes && drivaniaQuotes.quotes?.vehicles ? (
            <div className="space-y-6">
              <div className="text-2xl font-semibold text-card-foreground">
                Exclusive rates from Drivania
              </div>
              {preferredVehicleHint && !preferredVehicles.length && (
                <p className="text-sm text-muted-foreground">
                  Preferred vehicle ("{preferredVehicleHint}") not found; showing all available options.
                </p>
              )}
              <div className="space-y-4">
                {displayVehicles.map(renderVehicleCard)}
              </div>
              {preferredVehicles.length > 0 && otherVehicles.length > 0 && (
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowOtherVehicles(prev => !prev)}
                  >
                    {showOtherVehicles ? 'Hide other vehicles' : 'Show other vehicles'}
                  </Button>
                  {showOtherVehicles && (
                    <div className="space-y-4">
                      {otherVehicles.map(renderVehicleCard)}
                    </div>
                  )}
                </div>
              )}
              {drivaniaQuotes.service_id && (
                <div className="mt-4 text-xs text-muted-foreground">
                  Service ID: {drivaniaQuotes.service_id}
                  {drivaniaQuotes.expiration && (
                    <span className="ml-4">
                      Expires: {new Date(drivaniaQuotes.expiration).toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : drivaniaQuotes && drivaniaQuotes.quotes?.unavailable_reason ? (
            <Alert className="mb-4">
              <AlertDescription>
                Quote unavailable: {drivaniaQuotes.quotes.unavailable_reason}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        {/* Booking Form */}
        {selectedDrivaniaVehicle && bookingSubmissionState !== 'success' && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <h2 className="text-2xl font-semibold mb-6">Booking Details</h2>

              {/* Selected Vehicle Info */}
              <div className="rounded-md border border-border bg-muted/40 p-4 mb-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground uppercase tracking-wide">Selected vehicle</p>
                    <p className="text-lg font-semibold text-card-foreground">{selectedDrivaniaVehicle.vehicle_type}</p>
                    {selectedDrivaniaVehicle.level_of_service && (
                      <p className="text-xs text-muted-foreground">{selectedDrivaniaVehicle.level_of_service}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Estimated fare</p>
                    <p className="text-2xl font-bold text-card-foreground">
                      {drivaniaQuotes?.currency_code
                        ? `${drivaniaQuotes.currency_code} ${selectedDrivaniaVehicle.sale_price?.price?.toFixed(2) || 'N/A'}`
                        : selectedDrivaniaVehicle.sale_price?.price?.toFixed(2) || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Booking Form Fields */}
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Passenger name
                    <Input
                      className={`mt-2 w-full border border-border rounded-md px-3 py-2 ${highlightMissing('passengerName')}`}
                      value={bookingPreviewFields.passengerName}
                      onChange={(e) => handleBookingFieldChange('passengerName', e.target.value)}
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Contact email
                    <Input
                      className={`mt-2 w-full border border-border rounded-md px-3 py-2 ${highlightMissing('contactEmail')}`}
                      value={bookingPreviewFields.contactEmail}
                      onChange={(e) => handleBookingFieldChange('contactEmail', e.target.value)}
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Contact phone
                    <Input
                      className="mt-2 w-full border border-border rounded-md px-3 py-2"
                      value={bookingPreviewFields.contactPhone}
                      onChange={(e) => handleBookingFieldChange('contactPhone', e.target.value)}
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Flight number
                    <Input
                      className="mt-2 w-full border border-border rounded-md px-3 py-2"
                      value={bookingPreviewFields.flightNumber}
                      onChange={(e) => handleBookingFieldChange('flightNumber', e.target.value)}
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Flight direction
                    <Input
                      className={`mt-2 w-full border border-border rounded-md px-3 py-2 ${highlightMissing('flightDirection')}`}
                      value={bookingPreviewFields.flightDirection}
                      onChange={(e) => handleBookingFieldChange('flightDirection', e.target.value)}
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Passenger count
                    <Input
                      type="number"
                      min={1}
                      className="mt-2 w-full border border-border rounded-md px-3 py-2"
                      value={bookingPreviewFields.passengerCount}
                      onChange={(e) => handleBookingFieldChange('passengerCount', Number(e.target.value))}
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Child seats
                    <Input
                      type="number"
                      min={0}
                      className="mt-2 w-full border border-border rounded-md px-3 py-2"
                      value={bookingPreviewFields.childSeats}
                      onChange={(e) => handleBookingFieldChange('childSeats', Number(e.target.value))}
                    />
                  </label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">
                      Pickup time
                      <Input
                        className={`mt-2 w-full border border-border rounded-md px-3 py-2 ${highlightMissing('pickupTime')}`}
                        value={bookingPreviewFields.pickupTime}
                        onChange={(e) => handleBookingFieldChange('pickupTime', e.target.value)}
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase text-muted-foreground">
                      Dropoff time
                      <Input
                        className={`mt-2 w-full border border-border rounded-md px-3 py-2 ${highlightMissing('dropoffTime')}`}
                        value={bookingPreviewFields.dropoffTime}
                        onChange={(e) => handleBookingFieldChange('dropoffTime', e.target.value)}
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Notes</label>
                  <textarea
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={3}
                    value={bookingPreviewFields.notes}
                    onChange={(e) => handleBookingFieldChange('notes', e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleBookNow}
                  className="w-full bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] transition-transform duration-150 ease-in-out hover:-translate-y-0.5 hover:shadow-lg"
                  disabled={bookingSubmissionState === 'loading'}
                >
                  {bookingSubmissionState === 'loading' ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    'Book Now'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

