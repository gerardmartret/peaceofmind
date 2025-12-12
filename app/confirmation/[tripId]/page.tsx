'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { debug } from '@/lib/debug';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft } from 'lucide-react';
import { bookingPreviewInitialState, requiredFields, type BookingPreviewFieldKey } from '@/app/results/[id]/constants';
import { ConfirmationSummaryCard } from './components/ConfirmationSummaryCard';
import { BookingForm } from './components/BookingForm';
import { useTripData } from '@/app/booking/[tripId]/hooks/useTripData';
import { useBookingForm } from './hooks/useBookingForm';
import { LoadingState } from '@/app/booking/[tripId]/components/LoadingState';
import { ErrorState } from '@/app/booking/[tripId]/components/ErrorState';

export default function ConfirmationPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.tripId as string;
  const { loading: authLoading } = useAuth();

  // Load trip data using shared hook
  const {
    tripData,
    loadingTripData,
    tripError,
    isOwner,
    ownershipChecked,
    authLoading: authLoadingFromHook,
  } = useTripData(tripId);

  // Chauffs quote state
  const [loadingDrivaniaQuote, setLoadingDrivaniaQuote] = useState<boolean>(false);
  const [drivaniaQuotes, setDrivaniaQuotes] = useState<any>(null);
  const [drivaniaError, setDrivaniaError] = useState<string | null>(null);
  const [selectedDrivaniaVehicle, setSelectedDrivaniaVehicle] = useState<any>(null);

  // Booking form state
  const {
    bookingPreviewFields,
    setBookingPreviewFields,
    missingFields,
    setMissingFields,
    phoneError,
    setPhoneError,
    leadPassengerEmailError,
    setLeadPassengerEmailError,
    handleBookingFieldChange,
    validatePhone,
    validateLeadPassengerEmail,
    getPhoneFieldClassName,
    highlightMissing,
  } = useBookingForm();

  const [bookingSubmissionState, setBookingSubmissionState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [bookingSubmissionMessage, setBookingSubmissionMessage] = useState<string>('');
  const [hasStoredVehicle, setHasStoredVehicle] = useState<boolean | null>(null);

  // Redirect to booking page if no vehicle is stored in sessionStorage - check early to prevent glitch
  useEffect(() => {
    if (!authLoadingFromHook && typeof window !== 'undefined') {
      const storedVehicle = sessionStorage.getItem(`selectedVehicle_${tripId}`);
      setHasStoredVehicle(!!storedVehicle);
      if (!storedVehicle) {
        router.replace(`/booking/${tripId}`);
      }
    }
  }, [tripId, router, authLoadingFromHook]);

  // Fetch Chauffs quotes when trip data is loaded
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
          fullAddress: loc.fullAddress || loc.formattedAddress || loc.name, // Prefer fullAddress, fallback to formattedAddress or name
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

        // Prepare the payload - include fullAddress
        const quotePayload = {
          locations: typedLocations.map((loc: any) => ({
            name: loc.name,
            fullAddress: loc.fullAddress || loc.name, // Use fullAddress if available, fallback to name
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
                  debug.log('Vehicle found in matching service_id quotes:', {
                    vehicleId: vehicle.vehicle_id,
                    serviceId: currentServiceId,
                    message: 'Using vehicle from fresh quotes with matching service_id'
                  });
                } else {
                  // Service ID matches but vehicle not found - use stored vehicle
                  vehicle = storedVehicle;
                  debug.log('Using stored vehicle (service_id matches):', {
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
                  debug.warn('Vehicle not found in new quotes:', {
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
                
                debug.log('Vehicle found in new quotes by type/level:', {
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
                leadPassengerEmail: prev.leadPassengerEmail || '', // Don't auto-fill, user must provide
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
              debug.error('Failed to parse stored vehicle data', e);
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
          setDrivaniaError(result.error || result.message || 'Failed to get quote from Chauffs');
        }
      } catch (err) {
        setDrivaniaError('Failed to request quote from Chauffs. Please try again.');
      } finally {
        setLoadingDrivaniaQuote(false);
      }
    };

    fetchDrivaniaQuote();
  }, [tripData, loadingDrivaniaQuote, drivaniaQuotes, tripId, router]);


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
            fullAddress: loc.fullAddress || loc.formattedAddress || loc.name, // Prefer fullAddress, fallback to formattedAddress or name
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
            locations: typedLocations.map((loc: any) => ({
              name: loc.name,
              fullAddress: loc.fullAddress || loc.name, // Use fullAddress if available, fallback to name
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
          debug.error('Failed to refresh quotes:', err);
          return false;
        }
      }
    }
    return true; // Quotes are still valid
  };

  // Handle booking submission
  const handleBookNow = async () => {
    if (!selectedDrivaniaVehicle) return;

    // Validate phone number
    const phoneValidationError = validatePhone(bookingPreviewFields.contactPhone);
    if (phoneValidationError) {
      setPhoneError(phoneValidationError);
      setBookingSubmissionState('idle');
      return;
    }

    // Validate lead passenger email
    const emailValidationError = validateLeadPassengerEmail(bookingPreviewFields.leadPassengerEmail);
    if (emailValidationError) {
      setLeadPassengerEmailError(emailValidationError);
      setBookingSubmissionState('idle');
      return;
    }

    setPhoneError(null);
    setLeadPassengerEmailError(null);
    setBookingSubmissionState('loading');

    // Refresh quotes if expired before submitting
    const quotesValid = await refreshQuotesIfNeeded();
    if (!quotesValid) {
      setBookingSubmissionState('idle');
      setBookingSubmissionMessage('Quotes have expired. Please refresh the page and try again.');
      return;
    }

    // Get data from tripData for fields that are no longer in the form
    const pickup = tripData?.locations?.[0];
    const dropoff = tripData?.locations?.[tripData.locations.length - 1];
    
    const payload = {
      service_id: drivaniaQuotes?.service_id,
      vehicle_id: selectedDrivaniaVehicle.vehicle_id,
      passenger_name: tripData?.lead_passenger_name || '',
      contact_email: tripData?.user_email || '', // Chauffs account email for contact
      lead_passenger_email: bookingPreviewFields.leadPassengerEmail, // Lead passenger email
      contact_phone: bookingPreviewFields.contactPhone,
      notes: bookingPreviewFields.notes,
      child_seats: bookingPreviewFields.childSeats || 0,
      flight_number: bookingPreviewFields.flightNumber,
      flight_direction: tripData?.trip_destination || pickup?.flightDirection || '',
      pickup_location: pickup,
      trip_id: tripId,
    };

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

        // Store success message in sessionStorage to show on results page
        sessionStorage.setItem(`bookingSuccess_${tripId}`, 'true');
        
        // Redirect to results page immediately
        router.push(`/results/${tripId}`);
      } else {
        setBookingSubmissionState('idle');
        // Check if error is about expired quotes
        if (serviceResult.error?.includes('cannot be confirmed') || serviceResult.error?.includes('service_ID')) {
          setBookingSubmissionMessage('Quotes have expired. Please refresh the page and try again.');
        } else {
          // Check if error is phone-related
          const errorMessage = serviceResult.error || 'Failed to create service with Chauffs';
          if (errorMessage.toLowerCase().includes('contact_phone') || 
              errorMessage.toLowerCase().includes('phone') ||
              errorMessage.toLowerCase().includes('sms')) {
            // Convert technical error messages to user-friendly ones
            let friendlyMessage = errorMessage;
            if (errorMessage.toLowerCase().includes('contact_phone is required') || 
                errorMessage.toLowerCase().includes('phone is required')) {
              friendlyMessage = 'Phone number is required';
            } else if (errorMessage.toLowerCase().includes('invalid phone number')) {
              // Extract the phone number from error if present
              const phoneMatch = errorMessage.match(/invalid phone number\s+([^\s]+)/i);
              if (phoneMatch) {
                friendlyMessage = `Please enter a valid phone number with country code (e.g., +1234567890)`;
              } else {
                friendlyMessage = 'Please enter a valid phone number with country code (e.g., +1234567890)';
              }
            } else if (errorMessage.toLowerCase().includes('phone')) {
              friendlyMessage = 'Please enter a valid phone number with country code';
            }
            setPhoneError(friendlyMessage);
            setBookingSubmissionMessage('');
          } else {
            setBookingSubmissionMessage(errorMessage);
          }
        }
      }
    } catch (err) {
      setBookingSubmissionState('idle');
      setBookingSubmissionMessage('Failed to create service with Chauffs. Please try again.');
    }
  };



  // Loading state - wait for auth and ownership check
  if (authLoadingFromHook || loadingTripData || !ownershipChecked || hasStoredVehicle === null) {
    return <LoadingState />;
  }

  // Error state
  if (tripError || !tripData) {
    return (
      <ErrorState
        title="Trip Not Found"
        message={tripError || 'This trip could not be found.'}
        actionLabel="Go to Home"
        onAction={() => router.push('/')}
      />
    );
  }

  // Ownership check - redirect if not owner (shouldn't reach here due to redirect in useEffect, but safety check)
  if (!isOwner) {
    return (
      <ErrorState
        title="Access Denied"
        message="Only trip owners can access the confirmation page."
        actionLabel="View Trip Report"
        onAction={() => router.push(`/results/${tripId}`)}
      />
    );
  }

  // Transform selectedDrivaniaVehicle to match BookingSummaryCard Vehicle interface
  const summaryVehicle = selectedDrivaniaVehicle ? {
    vehicle_type: selectedDrivaniaVehicle.vehicle_type,
    level_of_service: selectedDrivaniaVehicle.level_of_service || '',
    vehicle_image: selectedDrivaniaVehicle.vehicle_image,
    max_seating_capacity: selectedDrivaniaVehicle.max_seating_capacity,
    sale_price: selectedDrivaniaVehicle.sale_price,
  } : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Confirm Your Reservation</h1>
        </div>

        {/* Error Message */}
        {bookingSubmissionState === 'idle' && bookingSubmissionMessage && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{bookingSubmissionMessage}</AlertDescription>
          </Alert>
        )}

        {/* Loading Chauffs Quote */}
        {loadingDrivaniaQuote && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mr-3"></div>
            <span className="text-muted-foreground">Loading booking details...</span>
          </div>
        )}

        {/* Chauffs Error */}
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

        {/* Two Column Layout */}
        {selectedDrivaniaVehicle && bookingSubmissionState !== 'success' && (
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 sm:gap-6">
            {/* Left Column - 70% */}
            <div className="lg:col-span-7 order-2 lg:order-1">
              <BookingForm
                bookingFields={bookingPreviewFields}
                missingFields={missingFields}
                phoneError={phoneError}
                leadPassengerEmailError={leadPassengerEmailError}
                onFieldChange={handleBookingFieldChange}
                getPhoneFieldClassName={getPhoneFieldClassName}
                highlightMissing={highlightMissing}
              />
              
              {/* Back Button */}
              <Button
                variant="ghost"
                onClick={() => router.push(`/booking/${tripId}`)}
                className="mb-4"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Vehicle Selection
              </Button>
            </div>

            {/* Right Column - 30% */}
            <div className="lg:col-span-3 order-1 lg:order-2">
              <div className="lg:sticky lg:top-8">
                <ConfirmationSummaryCard
                  selectedVehicle={summaryVehicle}
                  tripData={tripData}
                  currencyCode={drivaniaQuotes?.currency_code}
                  onBookNow={handleBookNow}
                  buttonLabel="Book this trip"
                  buttonDisabled={bookingSubmissionState === 'loading'}
                  buttonLoading={bookingSubmissionState === 'loading'}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
