'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft } from 'lucide-react';
import { normalizeMatchKey, matchesDriverToVehicle, vehicleKey } from '@/app/results/[id]/utils/vehicle-helpers';
import { useMatchingDrivers } from '@/app/results/[id]/hooks/useMatchingDrivers';
import { determineRole } from '@/app/results/[id]/utils/role-determination';

export default function BookingPage() {
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
  const [drivaniaServiceType, setDrivaniaServiceType] = useState<'one-way' | 'hourly' | null>(null);
  const [showOtherVehicles, setShowOtherVehicles] = useState<boolean>(false);

  // Vehicle selection state
  const [vehicleSelections, setVehicleSelections] = useState<Record<string, { isVehicleSelected: boolean; selectedDriverIds: string[] }>>({});

  // Fetch matching drivers using existing hook
  const tripDestination = tripData?.trip_destination || '';
  const { matchingDrivers, loadingMatchingDrivers, matchingDriversError } = useMatchingDrivers({
    driverDestination: tripDestination,
  });

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

        // Check ownership - only owners can access booking page
        const tripUserId = data.user_id;
        const currentUserId = user?.id || null;
        const roleInfo = determineRole(tripUserId, currentUserId, isAuthenticated, tripId);
        
        setIsOwner(roleInfo.isOwner);
        setOwnershipChecked(true);

        // Redirect non-owners to results page
        if (!roleInfo.isOwner) {
          router.push(`/results/${tripId}`);
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
        setDrivaniaError('Failed to request quote from Drivania. Please try again.');
      } finally {
        setLoadingDrivaniaQuote(false);
      }
    };

    fetchDrivaniaQuote();
  }, [tripData, loadingDrivaniaQuote, drivaniaQuotes]);


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

  // Handle vehicle selection - redirect to confirmation page
  const handleVehicleSelect = (vehicle: any) => {
    // Store vehicle data in sessionStorage along with service_id for validation
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`selectedVehicle_${tripId}`, JSON.stringify({
        vehicle_id: vehicle.vehicle_id,
        vehicle_type: vehicle.vehicle_type,
        level_of_service: vehicle.level_of_service,
        sale_price: vehicle.sale_price,
        vehicle_image: vehicle.vehicle_image,
        max_seating_capacity: vehicle.max_seating_capacity,
        max_cargo_capacity: vehicle.max_cargo_capacity,
        extra_hour: vehicle.extra_hour,
        service_id: drivaniaQuotes?.service_id, // Store service_id to validate later
      }));
    }
    router.push(`/confirmation/${tripId}`);
  };


  // Render vehicle card
  const renderVehicleCard = (vehicle: any, index: number) => {
    const normalizedVehicleType = normalizeMatchKey(vehicle.vehicle_type);
    
    // Filter and deduplicate drivers
    const vehicleDrivers = normalizedVehicleType
      ? (() => {
          // First filter by matching criteria
          const matched = matchingDrivers.filter((driver) => {
            const matches = matchesDriverToVehicle(
              driver.vehicle_type,
              driver.level_of_service,
              vehicle.vehicle_type,
              vehicle.level_of_service,
            );
            return matches;
          });
          
          // Deduplicate by first_name + vehicle_type + level_of_service
          const seen = new Set<string>();
          return matched.filter((driver) => {
            const key = `${driver.first_name}|${driver.vehicle_type}|${driver.level_of_service}`;
            if (seen.has(key)) {
              return false;
            }
            seen.add(key);
            return true;
          });
        })()
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

    return (
      <Card key={vehicle.vehicle_id || `${vehicle.vehicle_type}-${index}`} className="shadow-none w-full">
        <CardContent className="flex flex-col gap-6 py-6">
          <div
            onClick={() => handleVehicleSelect(vehicle)}
            className="p-5 flex gap-4 border-2 rounded-md cursor-pointer transition-all border-border hover:border-primary/50 dark:hover:border-primary/40"
          >
            {vehicle.vehicle_image && (
              <div className="h-32 w-32 flex-shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted/60">
                <img
                  src={vehicle.vehicle_image}
                  alt={vehicle.vehicle_type}
                  width={128}
                  height={128}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
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
                              width={48}
                              height={48}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              decoding="async"
                              fetchPriority="low"
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
              Select Vehicle
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Loading state - wait for auth and ownership check
  if (authLoading || loadingTripData || !ownershipChecked) {
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
              Only trip owners can access the booking page.
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

        {/* Drivania Quotes Section */}
        <div className="mb-8">
          {drivaniaError && (
            <Alert variant="destructive" className="mb-4">
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
                {drivaniaQuotes.quotes.unavailable_reason === 'PEAK_PERIOD' ? (
                  <>
                    We are expecting a high demand for this day, and online booking is not available. Please contact us at{' '}
                    <a href="mailto:info@drivania.com" className="underline hover:text-primary">
                      info@drivania.com
                    </a>{' '}
                    and we will assist you.
                  </>
                ) : (
                  `Quote unavailable: ${drivaniaQuotes.quotes.unavailable_reason}`
                )}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

      </div>
    </div>
  );
}

