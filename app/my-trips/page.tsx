'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { normalizeTripLocations } from '@/app/results/[id]/utils/location-helpers';
import { determineVehicleType, extractCarInfo } from '@/app/results/[id]/utils/vehicle-detection-helpers';
import { getDisplayVehicle } from '@/lib/vehicle-helpers';

interface Trip {
  id: string;
  trip_date: string;
  created_at: string | null;
  locations: any;
  passenger_count: number | null;
  trip_destination: string | null;
  lead_passenger_name: string | null;
  vehicle: string | null;
  trip_notes: string | null;
  status: string;
  driver: string | null;
}

interface Quote {
  id: string;
  trip_id: string;
  email: string;
  price: number;
  currency: string;
}

export default function MyTripsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'drivania' | 'other-drivers'>('drivania');
  const [drivaniaSearchText, setDrivaniaSearchText] = useState('');
  const [otherDriversSearchText, setOtherDriversSearchText] = useState('');
  const [selectedOtherDriversStatus, setSelectedOtherDriversStatus] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());

  // Handle theme mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Fetch user's trips and quotes
  useEffect(() => {
    async function fetchTrips() {
      if (!user?.id) return;

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('trips')
          .select('id, trip_date, created_at, locations, passenger_count, trip_destination, lead_passenger_name, vehicle, trip_notes, status, driver')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching trips:', error);
          setError('Failed to load trips. Please try again.');
        } else {
          const normalizedData = (data || []).map((trip) => ({
            ...trip,
            locations: normalizeTripLocations(trip.locations),
          }));
          setTrips(normalizedData);

          // Fetch quotes for confirmed trips, pending trips with assigned drivers, and booked trips with Drivania
          const tripsWithQuotes = normalizedData.filter(trip => 
            ((trip.status === 'confirmed' || trip.status === 'pending') && trip.driver) ||
            (trip.status === 'booked' && trip.driver === 'drivania')
          );
          if (tripsWithQuotes.length > 0) {
            const tripIds = tripsWithQuotes.map(trip => trip.id);
            const { data: quotesData, error: quotesError } = await supabase
              .from('quotes')
              .select('id, trip_id, email, price, currency')
              .in('trip_id', tripIds);

            if (!quotesError && quotesData) {
              // Create a map of quotes by trip_id and driver email
              const quotesMap = new Map<string, Quote>();
              tripsWithQuotes.forEach(trip => {
                // For Drivania bookings, find quote with email 'drivania'
                // For other trips, find quote matching the driver email
                const quote = quotesData.find(q => 
                  q.trip_id === trip.id && 
                  (trip.driver === 'drivania' ? q.email === 'drivania' : q.email === trip.driver)
                );
                if (quote) {
                  quotesMap.set(trip.id, quote);
                }
              });
              setQuotes(quotesMap);
            }
          }
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    }

    if (isAuthenticated && user) {
      fetchTrips();
    }
  }, [user, isAuthenticated]);

  // Show loading state while checking auth
  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  // Get trip location count
  const getLocationCount = (locations: any) => {
    try {
      if (Array.isArray(locations)) {
        return locations.length;
      }
      return 0;
    } catch {
      return 0;
    }
  };

  // Get vehicle image path (matching TripSummarySection logic)
  const getVehicleImagePath = (trip: Trip): string => {
    const vehicleInfo = trip.vehicle || '';
    const driverNotes = trip.trip_notes || '';
    const passengerCount = trip.passenger_count || 1;
    
    // Check if it's a Maybach S-Class - should use S-Class image instead of Phantom
    const vehicleText = (vehicleInfo || driverNotes || '').toLowerCase();
    const isMaybachSClass = 
      /(?:mercedes|merc)\s*maybach\s*s(?:[\s-]*class)?/i.test(vehicleText) ||
      /maybach\s*(?:mercedes|merc)\s*s(?:[\s-]*class)?/i.test(vehicleText);
    
    // Determine vehicle type
    const vehicleType = determineVehicleType(vehicleInfo, driverNotes, passengerCount);
    
    // If it's Maybach S-Class, use S-Class image
    if (isMaybachSClass) {
      return mounted && theme === 'light' ? "/Vehicles/light-brief-sclass-web.png" : "/Vehicles/dark-brief-sclass-web.webp";
    }
    
    // Otherwise, use normal logic (default to dark if theme is undefined or not mounted)
    const isLight = mounted && theme === 'light';
    return vehicleType === 'van' 
      ? (isLight ? "/Vehicles/light-brief-vclass-web.png" : "/Vehicles/dark-brief-vclass-web.webp")
      : vehicleType === 'minibus' 
        ? (isLight ? "/Vehicles/light-brief-sprinter-web.png" : "/Vehicles/dark-brief-sprinter-web.webp")
        : vehicleType === 'suv' 
          ? (isLight ? "/Vehicles/light-brief-escalade-web.png" : "/Vehicles/dark-brief-escalade-web.webp")
          : vehicleType === 'signature-sedan'
            ? (isLight ? "/Vehicles/light-brief-phantom-web.png" : "/Vehicles/dark-brief-phantom.webp")
            : vehicleType === 'premium-sedan'
              ? (isLight ? "/Vehicles/light-brief-sclass-web.png" : "/Vehicles/dark-brief-sclass.webp")
              : (isLight ? "/Vehicles/light-brief-eclass-web.png" : "/Vehicles/dark-brief-eclass-web.webp");
  };

  // Get status badge variant and text (matching TripStatusButton logic)
  const getStatusBadge = (trip: Trip) => {
    const status = trip.status || 'not confirmed';
    
    // Determine variant based on status
    const getVariant = (): 'confirmed' | 'pending' | 'not-confirmed' | 'cancelled' | 'rejected' | 'request-quote-style' => {
      if (status === 'cancelled') {
        return 'cancelled';
      }
      if (status === 'not confirmed') {
        return 'request-quote-style';
      }
      if (status === 'rejected') {
        return 'rejected';
      }
      if (status === 'confirmed' || status === 'booked') {
        return 'confirmed';
      }
      if (status === 'pending') {
        return 'pending';
      }
      return 'request-quote-style';
    };

    // Get button text
    const getText = (): string => {
      if (status === 'cancelled') {
        return 'Cancelled';
      }
      if (status === 'rejected') {
        return 'Rejected';
      }
      if (status === 'confirmed') {
        return 'Confirmed';
      }
      if (status === 'booked') {
        return 'Booked with Drivania™';
      }
      if (status === 'pending') {
        return 'Pending';
      }
      return 'Not confirmed';
    };

    return {
      variant: getVariant(),
      text: getText(),
    };
  };

  // Generate trip name matching the report format
  const generateTripName = (trip: Trip) => {
    // Calculate trip duration from locations (matching TripSummarySection logic)
    const calculateTripDuration = (): string => {
      if (trip.locations && Array.isArray(trip.locations) && trip.locations.length >= 2) {
        const pickupTime = parseInt(trip.locations[0]?.time) || 0;
        const dropoffTime = parseInt(trip.locations[trip.locations.length - 1]?.time) || 0;
        const duration = dropoffTime - pickupTime;

        if (duration > 0) {
          const hours = Math.floor(duration);
          return `${hours}h`;
        }
        return '0h';
      }
      return '0h';
    };

    const tripDuration = calculateTripDuration();
    const passengerName = trip.lead_passenger_name || 'Passenger';
    const passengerCount = trip.passenger_count || 1;
    const tripDestination = trip.trip_destination || 'London';

    // Match the exact format from TripSummarySection: {leadPassengerName || 'Passenger'} (x{passengerCount || 1}) {tripDuration} in {tripDestination || 'London'}
    return `${passengerName} (x${passengerCount}) ${tripDuration} in ${tripDestination}`;
  };

  // Filter trips by tab, search text, and status (for other drivers tab)
  const filterTripsByTabAndSearch = (tripList: Trip[], tab: 'drivania' | 'other-drivers', searchText: string, statusFilter?: string | null): Trip[] => {
    // First filter by tab
    let filtered = tripList.filter((trip) => {
      if (tab === 'drivania') {
        return trip.status === 'booked';
      } else {
        return trip.status !== 'booked';
      }
    });

    // Filter by status if provided (for other drivers tab)
    if (tab === 'other-drivers' && statusFilter) {
      filtered = filtered.filter((trip) => (trip.status || 'not confirmed') === statusFilter);
    }

    // Then filter by search text if provided
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter((trip) => {
        const passengerName = (trip.lead_passenger_name || '').toLowerCase();
        const tripDate = trip.trip_date ? new Date(trip.trip_date).toLocaleDateString('en-GB').toLowerCase() : '';
        const destination = (trip.trip_destination || '').toLowerCase();
        const tripName = generateTripName(trip).toLowerCase();
        
        // Check if search text matches any of these fields
        return passengerName.includes(searchLower) ||
               tripDate.includes(searchLower) ||
               destination.includes(searchLower) ||
               tripName.includes(searchLower);
      });
    }

    return filtered;
  };

  // Get unique statuses from other drivers trips (excluding 'booked')
  const getOtherDriversStatuses = (): string[] => {
    const statuses = new Set<string>();
    trips.forEach((trip) => {
      if (trip.status !== 'booked') {
        statuses.add(trip.status || 'not confirmed');
      }
    });
    
    // Define the desired order
    const statusOrder: { [key: string]: number } = {
      'not confirmed': 0,
      'confirmed': 1,
      'pending': 2,
      'cancelled': 3,
      'rejected': 4,
    };
    
    return Array.from(statuses).sort((a, b) => {
      const orderA = statusOrder[a] ?? 999;
      const orderB = statusOrder[b] ?? 999;
      return orderA - orderB;
    });
  };

  const renderTripCards = (tripList: Trip[], showPrice: boolean = false) => (
    <div className="flex flex-col gap-4 sm:gap-6">
      {tripList.map((trip) => {
        const quote = showPrice && (trip.status === 'confirmed' || trip.status === 'pending') ? quotes.get(trip.id) : null;
        const drivaniaQuote = trip.status === 'booked' && trip.driver === 'drivania' ? quotes.get(trip.id) : null;
        const formatPrice = (price: number, currency: string) => {
          const formattedNumber = new Intl.NumberFormat('en-GB', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(price);
          return `${formattedNumber} ${currency || 'GBP'}`;
        };

        return (
          <Link key={trip.id} href={`/results/${trip.id}`} className="block">
            <Card className="relative cursor-pointer shadow-none">
              <CardHeader className="px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 pb-3 sm:pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base sm:text-lg font-semibold break-words">
                      {generateTripName(trip)}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2 sm:mt-3">
                      <svg className="w-4 h-4 flex-shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="hidden sm:inline text-xs sm:text-sm font-normal text-muted-foreground">
                        Trip date{' '}
                      </span>
                      <span className="text-sm sm:text-base font-semibold text-foreground sm:ml-1">
                        {trip.trip_date ? new Date(trip.trip_date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        }) : 'N/A'}
                      </span>
                    </div>
                    {mounted && (
                      <div className="flex items-end gap-3 sm:gap-6 pt-3 sm:pt-4">
                        <img
                          src={getVehicleImagePath(trip)}
                          alt="Vehicle"
                          className="h-[60px] sm:h-[102px] md:h-[119px] w-auto flex-shrink-0"
                        />
                        <div className="flex flex-col gap-2 pb-1 min-w-0">
                          {/* Passenger Count */}
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 flex-shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span className="hidden sm:inline text-xs sm:text-sm font-normal text-muted-foreground truncate">
                              Number of Passengers{' '}
                            </span>
                            <span className="text-sm sm:text-base font-semibold text-foreground sm:ml-1">
                              {trip.passenger_count || 1}
                            </span>
                          </div>
                          {/* Vehicle */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            {(() => {
                              const vehicleInfo = trip.vehicle || '';
                              const driverNotes = trip.trip_notes || '';
                              const passengerCount = trip.passenger_count || 1;
                              const vehicleType = determineVehicleType(vehicleInfo, driverNotes, passengerCount);
                              
                              // Get vehicle display name matching TripSummarySection logic
                              const getVehicleDisplayName = (): string => {
                                // If signature sedan, check if specific brand/model was mentioned
                                if (vehicleType === 'signature-sedan') {
                                  const requestedVehicle = vehicleInfo || extractCarInfo(driverNotes) || '';
                                  const vehicleText = (vehicleInfo || driverNotes || '').toLowerCase();
                                  
                                  // Check if specific luxury models are mentioned
                                  const hasSpecificModel = 
                                    /(?:mercedes|merc)\s*maybach\s*s/i.test(vehicleText) ||
                                    /rolls\s*royce\s*ghost/i.test(vehicleText) ||
                                    /rolls\s*royce\s*phantom/i.test(vehicleText);
                                  
                                  // If specific model mentioned, show it; otherwise show "Signature Sedan"
                                  if (hasSpecificModel && requestedVehicle) {
                                    return getDisplayVehicle(requestedVehicle, passengerCount);
                                  } else {
                                    return 'Signature Sedan';
                                  }
                                }
                                
                                // First, try to get vehicle from vehicleInfo field or driverNotes
                                const requestedVehicle = vehicleInfo || extractCarInfo(driverNotes);

                                // Use the helper to determine what to display:
                                // - If vehicle is empty or not in whitelist, show auto-selected vehicle
                                // - If vehicle is in whitelist, show that vehicle
                                return getDisplayVehicle(requestedVehicle, passengerCount);
                              };
                              
                              const vehicleDisplayName = getVehicleDisplayName();
                              
                              return (
                                <>
                                  <svg className="w-4 h-4 flex-shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                                  </svg>
                                  <span className="hidden sm:inline text-xs sm:text-sm font-normal text-muted-foreground truncate">
                                    Vehicle{' '}
                                  </span>
                                  <span className="text-sm sm:text-base font-semibold text-foreground sm:ml-1">
                                    {vehicleDisplayName}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-row sm:flex-col items-start sm:items-end gap-2 sm:gap-3 flex-shrink-0">
                    {(() => {
                      const statusBadge = getStatusBadge(trip);
                      // Determine colors based on variant (matching FlowHoverButton)
                      const colors = statusBadge.variant === 'confirmed' 
                        ? {
                            bg: 'bg-[#3ea34b]',
                            border: 'border-[#3ea34b]',
                            text: 'text-white',
                          }
                        : statusBadge.variant === 'pending'
                        ? {
                            bg: 'bg-[#e77500]',
                            border: 'border-[#e77500]',
                            text: 'text-white',
                          }
                        : statusBadge.variant === 'cancelled'
                        ? {
                            bg: 'bg-[#9e201b]',
                            border: 'border-[#9e201b]',
                            text: 'text-white',
                          }
                        : statusBadge.variant === 'rejected'
                        ? {
                            bg: 'bg-black dark:bg-black',
                            border: 'border-black dark:border-black',
                            text: 'text-white',
                          }
                        : statusBadge.variant === 'request-quote-style'
                        ? {
                            bg: 'bg-background dark:bg-input/30',
                            border: 'border-border dark:border-input',
                            text: 'text-foreground',
                          }
                        : {
                            bg: 'bg-[#9e201b]',
                            border: 'border-[#9e201b]',
                            text: 'text-white',
                          };
                      
                      const shadowClass = statusBadge.variant === 'request-quote-style' ? 'shadow-xs' : '';
                      
                      return (
                        <>
                          <div
                            className={`relative z-0 flex items-center justify-center gap-2 overflow-hidden 
                              border ${colors.border} ${colors.bg} ${shadowClass}
                              h-9 sm:h-10 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md ${colors.text} cursor-pointer whitespace-nowrap`}
                          >
                            <span className="truncate">{statusBadge.text}</span>
                          </div>
                          {showPrice && quote && (
                            <div className="text-base sm:text-lg font-medium text-foreground whitespace-nowrap">
                              {formatPrice(quote.price, quote.currency)}
                            </div>
                          )}
                          {(trip.status === 'booked' && trip.driver === 'drivania') && drivaniaQuote && (
                            <div className="text-base sm:text-lg font-medium text-foreground whitespace-nowrap">
                              {formatPrice(drivaniaQuote.price, drivaniaQuote.currency)}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </CardHeader>
              {mounted && (
                <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-6 flex items-center gap-2 text-[#05060A] dark:text-white font-medium text-xs sm:text-sm">
                  <span className="hidden sm:inline">View trip</span>
                  <span className="sm:hidden">View</span>
                  <svg
                    className="w-3 h-3 sm:w-4 sm:h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              )}
            </Card>
          </Link>
        );
      })}
    </div>
  );

  // Get trips for each tab
  const drivaniaTrips = filterTripsByTabAndSearch(trips, 'drivania', drivaniaSearchText);
  const otherDriversTrips = filterTripsByTabAndSearch(trips, 'other-drivers', otherDriversSearchText, selectedOtherDriversStatus);

  return (
    <div className="min-h-screen bg-background pt-8 pb-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-medium text-foreground">My trips</h1>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'drivania' | 'other-drivers')} className="mb-6">
          <TabsList className="bg-muted dark:bg-input/30 dark:border dark:border-input">
            <TabsTrigger value="drivania" className="dark:data-[state=active]:bg-[#05060A]">Drivania™ Bookings</TabsTrigger>
            <TabsTrigger value="other-drivers" className="dark:data-[state=active]:bg-[#05060A]">Other trips</TabsTrigger>
          </TabsList>
          
          <TabsContent value="drivania" className="mt-6">
            <div className="mb-6">
              <Input
                value={drivaniaSearchText}
                onChange={(event) => setDrivaniaSearchText(event.target.value)}
                placeholder="Search trips..."
                className="w-full"
              />
            </div>
            {drivaniaTrips.length > 0 && renderTripCards(drivaniaTrips, false)}
            {drivaniaTrips.length === 0 && !loading && (
              <Card>
                <CardContent className="py-12 text-center">
                  <h3 className="text-lg font-semibold mb-2">No trips found</h3>
                  <p className="text-muted-foreground">
                    {drivaniaSearchText.trim() 
                      ? 'No trips match your search. Try a different search term.'
                      : 'No trips booked with Drivania yet.'}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="other-drivers" className="mt-6">
            <div className="mb-6 space-y-4">
              <Input
                value={otherDriversSearchText}
                onChange={(event) => setOtherDriversSearchText(event.target.value)}
                placeholder="Search trips..."
                className="w-full"
              />
              
              {/* Status Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={selectedOtherDriversStatus === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedOtherDriversStatus(null)}
                  className="text-sm"
                >
                  All
                </Button>
                {getOtherDriversStatuses().map((status) => {
                  const statusBadge = getStatusBadge({ status } as Trip);
                  
                  return (
                    <Button
                      key={status}
                      variant={selectedOtherDriversStatus === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedOtherDriversStatus(status)}
                      className="text-sm"
                    >
                      {statusBadge.text}
                    </Button>
                  );
                })}
              </div>
            </div>
            {otherDriversTrips.length > 0 && renderTripCards(otherDriversTrips, true)}
            {otherDriversTrips.length === 0 && !loading && (
              <Card>
                <CardContent className="py-12 text-center">
                  <h3 className="text-lg font-semibold mb-2">No trips found</h3>
                  <p className="text-muted-foreground">
                    {otherDriversSearchText.trim() || selectedOtherDriversStatus
                      ? 'No trips match your filters. Try adjusting your search or status filter.'
                      : 'No other trips yet.'}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your trips...</p>
          </div>
        )}

        {/* Empty state when no trips at all */}
        {!loading && trips.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              <h3 className="text-lg font-semibold mb-2">No trips yet</h3>
              <p className="text-muted-foreground mb-6">
                Start by creating your first trip analysis
              </p>
              <Link href="/">
                <Button>Create your first trip</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Back to Home Button */}
        {!loading && trips.length > 0 && (
          <div className="mt-8 text-center">
            <Link href="/">
              <Button variant="outline">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create new trip
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

