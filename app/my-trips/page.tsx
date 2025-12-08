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
import { normalizeTripLocations } from '@/app/results/[id]/utils/location-helpers';
import { determineVehicleType, extractCarInfo } from '@/app/results/[id]/utils/vehicle-detection-helpers';

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
}

type SearchCriteria = {
  passengerName?: string;
  tripDate?: string;
  location?: string;
};

export default function MyTripsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Trip[] | null>(null);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria | null>(null);

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

  // Fetch user's trips
  useEffect(() => {
    async function fetchTrips() {
      if (!user?.id) return;

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('trips')
          .select('id, trip_date, created_at, locations, passenger_count, trip_destination, lead_passenger_name, vehicle, trip_notes, status')
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
        return 'Trip confirmed';
      }
      if (status === 'booked') {
        return 'Booked';
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

  const handleAiSearch = async () => {
    if (!searchText.trim()) {
      setSearchError('Please describe the ride you are trying to find (name, date, stop, etc.).');
      return;
    }

    setSearchLoading(true);
    setSearchError('');
    setSearchFeedback(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (sessionError || !token) {
        throw new Error('Authentication needed. Please refresh the page or log in again.');
      }

      const response = await fetch('/api/trip-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: searchText.trim() }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Trip search failed');
      }

      const payload = await response.json();
      const matches = Array.isArray(payload.matches) ? payload.matches : [];

      setSearchResults(matches);
      setSearchCriteria(payload.criteria ?? null);
      setSearchFeedback(matches.length
        ? `Found ${matches.length} trip${matches.length === 1 ? '' : 's'}`
        : 'No trips matched that description.');
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Unable to search trips right now.');
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchResults(null);
    setSearchFeedback(null);
    setSearchCriteria(null);
    setSearchError('');
  };

  const renderTripCards = (tripList: Trip[]) => (
    <div className="flex flex-col gap-6">
      {tripList.map((trip) => (
        <Link key={trip.id} href={`/results/${trip.id}`} className="block">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-primary/50">
            <CardHeader>
              <div className="flex items-start gap-4">
                {/* Vehicle Image - Left Side */}
                {mounted && (
                  <div className="flex-shrink-0 py-0">
                    <img
                      src={getVehicleImagePath(trip)}
                      alt="Vehicle"
                      className="h-[85px] sm:h-[102px] w-auto"
                    />
                  </div>
                )}
                {/* Trip Info - Middle */}
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg">
                    {generateTripName(trip)}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <svg className="w-4 h-4 flex-shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-normal text-muted-foreground">
                      Trip date{' '}
                      <span className="text-base font-semibold text-foreground ml-1">
                        {trip.trip_date ? new Date(trip.trip_date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        }) : 'N/A'}
                      </span>
                    </span>
                  </div>
                </div>
                {/* Status Badge - Right Side */}
                <div className="flex-shrink-0">
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
                          bg: 'bg-[#c41e3a]',
                          border: 'border-[#c41e3a]',
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
                      <div
                        className={`relative z-0 flex items-center justify-center gap-2 overflow-hidden 
                          border ${colors.border} ${colors.bg} ${shadowClass}
                          h-10 px-4 py-2 text-sm font-medium rounded-md ${colors.text} cursor-default`}
                      >
                        <span>{statusBadge.text}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-end">
                <div className="flex items-center gap-2 text-[#05060A] dark:text-white font-medium text-sm">
                  View report
                  <svg
                    className="w-4 h-4"
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
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );

  const searchActive = searchResults !== null;
  const displayedTrips = searchActive ? (searchResults || []) : trips;
  const hasDisplayedTrips = displayedTrips.length > 0;
  const criteriaParts = searchCriteria
    ? [
        searchCriteria.passengerName ? `passenger ${searchCriteria.passengerName}` : null,
        searchCriteria.tripDate ? `date ${searchCriteria.tripDate}` : null,
        searchCriteria.location ? `location ${searchCriteria.location}` : null,
      ].filter(Boolean)
    : [];
  const criteriaSummary = criteriaParts.join(' • ');

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-medium text-foreground mb-2">My trips</h1>
          <p className="text-muted-foreground">
            View all your driver briefs
          </p>
        </div>

        {/* AI search */}
        <div className="mb-6 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Ask for a trip by passenger, date, or stop..."
              className="flex-1"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAiSearch();
                }
              }}
            />
            <Button
              onClick={handleAiSearch}
              disabled={searchLoading}
              className="whitespace-nowrap"
            >
              {searchLoading ? 'Searching...' : 'Ask AI to find it'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Tell the AI the traveler, date or stop and we’ll look through your trips.
          </p>
          {searchFeedback && (
            <p className="text-sm text-primary">{searchFeedback}</p>
          )}
          {criteriaSummary && (
            <p className="text-xs text-muted-foreground">
              Looking for: {criteriaSummary}
            </p>
          )}
          {searchError && (
            <Alert variant="destructive">
              <AlertDescription>{searchError}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {searchActive && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {searchFeedback ?? 'Showing AI search results.'}
            </p>
            <Button variant="ghost" size="sm" onClick={clearSearch}>
              Clear search
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your trips...</p>
          </div>
        )}

        {/* Results */}
        {!loading && hasDisplayedTrips && renderTripCards(displayedTrips)}

        {!loading && !hasDisplayedTrips && (
          searchActive ? (
            <Card>
              <CardContent className="py-12 text-center">
                <h3 className="text-lg font-semibold mb-2">Nothing matched</h3>
                <p className="text-muted-foreground mb-4">
                  Try a different description or clear the AI search to see all trips.
                </p>
                <Button variant="outline" onClick={clearSearch}>
                  Clear search
                </Button>
              </CardContent>
            </Card>
          ) : (
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
          )
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

