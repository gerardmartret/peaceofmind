'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import { bookingPreviewInitialState, requiredFields, type BookingPreviewFieldKey } from '@/app/results/[id]/constants';
import { determineRole } from '@/app/results/[id]/utils/role-determination';

export default function ConfirmationPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.tripId as string;
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  // Trip data state
  const [tripData, setTripData] = useState<any>(null);
  const [loadingTripData, setLoadingTripData] = useState(true);
  const [tripError, setTripError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [ownershipChecked, setOwnershipChecked] = useState<boolean>(false);

  // Drivania quote state
  const [loadingDrivaniaQuote, setLoadingDrivaniaQuote] = useState<boolean>(false);
  const [drivaniaQuotes, setDrivaniaQuotes] = useState<any>(null);
  const [drivaniaError, setDrivaniaError] = useState<string | null>(null);
  const [selectedDrivaniaVehicle, setSelectedDrivaniaVehicle] = useState<any>(null);

  // Booking form state
  const [bookingPreviewFields, setBookingPreviewFields] = useState(bookingPreviewInitialState);
  const [missingFields, setMissingFields] = useState<Set<BookingPreviewFieldKey>>(new Set());
  const [bookingSubmissionState, setBookingSubmissionState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [bookingSubmissionMessage, setBookingSubmissionMessage] = useState<string>('');
  const [processingTimer, setProcessingTimer] = useState<NodeJS.Timeout | null>(null);
  const [hasStoredVehicle, setHasStoredVehicle] = useState<boolean | null>(null);

  // Redirect to booking page if no vehicle is stored in sessionStorage - check early to prevent glitch
  useEffect(() => {
    if (!authLoading && typeof window !== 'undefined') {
      const storedVehicle = sessionStorage.getItem(`selectedVehicle_${tripId}`);
      setHasStoredVehicle(!!storedVehicle);
      if (!storedVehicle) {
        router.replace(`/booking/${tripId}`);
      }
    }
  }, [tripId, router, authLoading]);

  // Load trip data and check ownership
  useEffect(() => {
    const loadTripData = async () => {
      if (!tripId) {
        setTripError('Trip ID is required');
        setLoadingTripData(false);
        return;
      }

      // Wait for auth to finish loading before checking ownership
      if (authLoading) {
        return; // Exit early, will retry when authLoading becomes false
      }

      // If authenticated but user is null, wait a bit for it to load
      if (isAuthenticated && !user) {
        await new Promise(resolve => setTimeout(resolve, 200));
        // If still null after wait, proceed anyway (shouldn't happen if authLoading is working)
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
          setOwnershipChecked(true);
          return;
        }

        // Check ownership - only owners can access confirmation page
        const tripUserId = data.user_id;
        const currentUserId = user?.id || null;
        const roleInfo = determineRole(tripUserId, currentUserId, isAuthenticated, tripId);
        
        setIsOwner(roleInfo.isOwner);
        setOwnershipChecked(true);

        // Redirect non-owners to results page
        if (!roleInfo.isOwner) {
          router.replace(`/results/${tripId}`);
          return;
        }

        // Parse locations if stored as JSON string
        let locations = data.locations;
        if (typeof locations === 'string') {
          try {
            locations = JSON.parse(locations);
          } catch (e) {
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
        setTripError(err.message || 'Failed to load trip data');
        setLoadingTripData(false);
        setOwnershipChecked(true);
      }
    };

    loadTripData();
  }, [tripId, user, isAuthenticated, authLoading, router]);

  // Fetch Drivania quotes when trip data is loaded
  useEffect(() => {
    // Early returns
    if (!tripData || loadingDrivaniaQuote || drivaniaQuotes) return;
    
    // Check if vehicle is stored in sessionStorage
    if (typeof window === 'undefined') return;
    const storedVehicle = sessionStorage.getItem(`selectedVehicle_${tripId}`);
    if (!storedVehicle) return;
    
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
          
          // Get stored vehicle from sessionStorage
          const storedVehicleStr = sessionStorage.getItem(`selectedVehicle_${tripId}`);
          if (storedVehicleStr) {
            try {
              const storedVehicle = JSON.parse(storedVehicleStr);
              const vehicleId = storedVehicle.vehicle_id;
              const storedServiceId = storedVehicle.service_id;
              const currentServiceId = result.data?.service_id;
              
              // If service_id matches, we can use the stored vehicle (it's still valid)
              // Otherwise, we need to find the vehicle in fresh quotes
              let vehicle = null;
              
              if (storedServiceId === currentServiceId) {
                // Service ID matches - stored vehicle is still valid, but use fresh quote for latest price
                if (result.data?.quotes?.vehicles) {
                  vehicle = result.data.quotes.vehicles.find(
                    (v: any) => String(v.vehicle_id) === String(vehicleId)
                  );
                }
                
                // If found by ID, use it. Otherwise fall back to stored vehicle (same service_id)
                if (vehicle) {
                  console.log('Vehicle found in matching service_id quotes:', {
                    vehicleId: vehicle.vehicle_id,
                    serviceId: currentServiceId,
                    message: 'Using vehicle from fresh quotes with matching service_id'
                  });
                } else {
                  // Service ID matches but vehicle not found - use stored vehicle
                  vehicle = storedVehicle;
                  console.log('Using stored vehicle (service_id matches):', {
                    vehicleId: vehicle.vehicle_id,
                    serviceId: currentServiceId,
                    message: 'Service ID matches, using stored vehicle'
                  });
                }
              } else {
                // Service ID changed - need to find vehicle by type/level in new quotes
                if (result.data?.quotes?.vehicles) {
                  vehicle = result.data.quotes.vehicles.find(
                    (v: any) => 
                      String(v.vehicle_id) === String(vehicleId) ||
                      (v.vehicle_type === storedVehicle.vehicle_type && 
                       v.level_of_service === storedVehicle.level_of_service)
                  );
                }
                
                if (!vehicle) {
                  console.warn('Vehicle not found in new quotes:', {
                    storedVehicleId: vehicleId,
                    storedServiceId: storedServiceId,
                    currentServiceId: currentServiceId,
                    vehicleType: storedVehicle.vehicle_type,
                    levelOfService: storedVehicle.level_of_service,
                    availableVehicles: result.data?.quotes?.vehicles?.map((v: any) => ({
                      id: v.vehicle_id,
                      type: v.vehicle_type,
                      level: v.level_of_service
                    })) || [],
                    message: 'Vehicle not found in fresh quotes - quotes may have changed'
                  });
                  setDrivaniaError(`Selected vehicle is no longer available in current quotes. Please select a vehicle again.`);
                  // Clear invalid stored vehicle
                  sessionStorage.removeItem(`selectedVehicle_${tripId}`);
                  setTimeout(() => {
                    router.replace(`/booking/${tripId}`);
                  }, 3000);
                  return;
                }
                
                console.log('Vehicle found in new quotes by type/level:', {
                  originalVehicleId: vehicleId,
                  foundVehicleId: vehicle.vehicle_id,
                  vehicleType: vehicle.vehicle_type,
                  levelOfService: vehicle.level_of_service,
                  newServiceId: currentServiceId,
                  message: 'Found matching vehicle in new quotes'
                });
              }
              
              // Use vehicle (either from fresh quotes or stored if service_id matches)
              setSelectedDrivaniaVehicle(vehicle);
              const pickup = tripData?.locations?.[0];
              const dropoff = tripData?.locations?.[tripData.locations.length - 1];
              setBookingPreviewFields(prev => ({
                ...prev,
                passengerName: tripData?.lead_passenger_name || '',
                contactEmail: tripData?.user_email || '',
                contactPhone: prev.contactPhone,
                flightNumber: pickup?.flightNumber || '',
                flightDirection: tripData?.trip_destination || pickup?.flightDirection || '',
                passengerCount: tripData?.passenger_count || 1,
                pickupTime: pickup?.time || '',
                dropoffTime: dropoff?.time || '',
                notes: tripData?.trip_notes || '',
              }));
              
              // Clear sessionStorage after using it
              sessionStorage.removeItem(`selectedVehicle_${tripId}`);
            } catch (e) {
              console.error('Failed to parse stored vehicle data', e);
              setDrivaniaError('Invalid vehicle data. Please select a vehicle again.');
              setTimeout(() => {
                router.replace(`/booking/${tripId}`);
              }, 3000);
            }
          } else {
            // No stored vehicle found
            setDrivaniaError('No vehicle selected. Please select a vehicle again.');
            setTimeout(() => {
              router.replace(`/booking/${tripId}`);
            }, 3000);
          }
        } else {
          setDrivaniaError(result.error || result.message || 'Failed to get quote from Drivania');
        }
      } catch (err) {
        setDrivaniaError('Failed to request quote from Drivania. Please try again.');
      } finally {
        setLoadingDrivaniaQuote(false);
      }
    };

    fetchDrivaniaQuote();
  }, [tripData, loadingDrivaniaQuote, drivaniaQuotes, tripId, router]);

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

  // Refresh quotes if expired
  const refreshQuotesIfNeeded = async (): Promise<boolean> => {
    if (!tripData?.locations || !Array.isArray(tripData.locations) || tripData.locations.length < 2) {
      return false;
    }

    // Check if quotes are expired
    const expirationTime = drivaniaQuotes?.expiration;
    if (expirationTime) {
      const expirationDate = new Date(expirationTime);
      const now = new Date();
      // Refresh if expired or expiring within 1 minute
      if (expirationDate <= now || expirationDate.getTime() - now.getTime() < 60000) {
        setBookingSubmissionMessage('Refreshing quotes...');
        
        try {
          const locations = tripData.locations;
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

          const serviceType: 'one-way' | 'hourly' = typedLocations.length > 2 ? 'hourly' : 'one-way';
          const passengerCountValue = tripData.passenger_count || 1;
          const tripDateValue = tripData.trip_date || new Date().toISOString().split('T')[0];

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
            
            // Find the selected vehicle in the new quotes
            const storedVehicleStr = sessionStorage.getItem(`selectedVehicle_${tripId}`);
            if (storedVehicleStr) {
              const storedVehicle = JSON.parse(storedVehicleStr);
              const vehicleId = storedVehicle.vehicle_id;
              
              const vehicle = result.data?.quotes?.vehicles?.find(
                (v: any) => String(v.vehicle_id) === String(vehicleId)
              );
              
              // CRITICAL: Only proceed if vehicle is found in fresh quotes
              // This ensures service_id and vehicle_id are from the same quote
              if (vehicle) {
                setSelectedDrivaniaVehicle(vehicle);
                return true;
              } else {
                // Vehicle not found in fresh quotes - it's no longer available
                setDrivaniaError('Selected vehicle is no longer available. Please select a vehicle again.');
                sessionStorage.removeItem(`selectedVehicle_${tripId}`);
                return false;
              }
            }
            return false;
          }
          return false;
        } catch (err) {
          console.error('Failed to refresh quotes:', err);
          return false;
        }
      }
    }
    return true; // Quotes are still valid
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

    // Refresh quotes if expired before submitting
    const quotesValid = await refreshQuotesIfNeeded();
    if (!quotesValid) {
      setBookingSubmissionState('idle');
      setBookingSubmissionMessage('Quotes have expired. Please refresh the page and try again.');
      return;
    }

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
          if (!statusResult.success) {
          }
        } catch (statusErr) {
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
        // Check if error is about expired quotes
        if (serviceResult.error?.includes('cannot be confirmed') || serviceResult.error?.includes('service_ID')) {
          setBookingSubmissionMessage('Quotes have expired. Please refresh the page and try again.');
        } else {
          setBookingSubmissionMessage(serviceResult.error || 'Failed to create service with Drivania');
        }
      }
    } catch (err) {
      setBookingSubmissionState('idle');
      setBookingSubmissionMessage('Failed to create service with Drivania. Please try again.');
    }
  };

  const highlightMissing = (field: BookingPreviewFieldKey) =>
    missingFields.has(field) ? 'border-destructive/70 bg-destructive/10 text-destructive' : '';


  // Loading state - wait for auth and ownership check
  if (authLoading || loadingTripData || !ownershipChecked || hasStoredVehicle === null) {
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

  // Ownership check - redirect if not owner (shouldn't reach here due to redirect in useEffect, but safety check)
  if (!isOwner) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
            <p className="text-muted-foreground mb-6">
              Only trip owners can access the confirmation page.
            </p>
            <Button onClick={() => router.push(`/results/${tripId}`)}>View Trip Report</Button>
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
            onClick={() => router.push(`/booking/${tripId}`)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Vehicle Selection
          </Button>
          <h1 className="text-3xl font-bold">Confirm Your Reservation</h1>
          <p className="text-muted-foreground mt-2">
            Review your booking details and send a quote to Drivania
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

        {/* Loading Drivania Quote */}
        {loadingDrivaniaQuote && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mr-3"></div>
            <span className="text-muted-foreground">Loading booking details...</span>
          </div>
        )}

        {/* Drivania Error */}
        {drivaniaError && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>
              {drivaniaError.includes('PEAK_PERIOD') || drivaniaError.includes('Peak period') ? (
                <>
                  We are expecting a high demand for this day, and online booking is not available. Please contact us at{' '}
                  <a href="mailto:info@drivania.com" className="underline hover:text-primary">
                    info@drivania.com
                  </a>{' '}
                  and we will assist you.
                </>
              ) : (
                drivaniaError
              )}
            </AlertDescription>
          </Alert>
        )}

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
