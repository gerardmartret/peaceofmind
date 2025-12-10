'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { normalizeTripLocations } from '@/app/results/[id]/utils/location-helpers';
import { Trip, filterTripsByTabAndSearch, getOtherDriversStatuses, getStatusBadge } from './utils/trip-helpers';
import { TripCard } from './components/TripCard';

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
  const [activeTab, setActiveTab] = useState<'drivania' | 'other-drivers'>('other-drivers');
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

          // Fetch quotes for confirmed trips, pending trips with assigned drivers, and booked trips with Chauffs
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
                // For Chauffs bookings, find quote with email 'drivania'
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


  const renderTripCards = (tripList: Trip[], showPrice: boolean = false) => (
    <div className="flex flex-col gap-4 sm:gap-6">
      {tripList.map((trip) => {
        const quote = showPrice && (trip.status === 'confirmed' || trip.status === 'pending') ? (quotes.get(trip.id) ?? null) : null;
        const drivaniaQuote = trip.status === 'booked' && trip.driver === 'drivania' ? (quotes.get(trip.id) ?? null) : null;
        
        // Ensure theme is properly typed
        const themeValue = theme === 'light' || theme === 'dark' ? theme : undefined;

        return (
          <TripCard
            key={trip.id}
            trip={trip}
            quote={quote}
            drivaniaQuote={drivaniaQuote}
            showPrice={showPrice}
            theme={themeValue}
            mounted={mounted}
          />
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

        {/* Tabs - only show when there are trips */}
        {trips.length > 0 && (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'drivania' | 'other-drivers')} className="mb-6">
          <TabsList className="bg-muted dark:bg-input/30 dark:border dark:border-input">
            <TabsTrigger value="other-drivers" className="dark:data-[state=active]:bg-[#05060A]">My own drivers</TabsTrigger>
            <TabsTrigger value="drivania" className="dark:data-[state=active]:bg-[#05060A] !px-4 sm:!px-6">
              {mounted && (
                <img 
                  src={theme === 'dark' ? "/chauffs-seal-neg.png" : "/chauffs-seal-pos.png"} 
                  alt="Chauffs Trusted Driver" 
                  className="h-[11.56px] sm:h-[14.45px] w-auto mr-0.5"
                />
              )}
              Chauffs Trusted Drivers
            </TabsTrigger>
          </TabsList>
          
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
                {getOtherDriversStatuses(trips).map((status) => {
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
            {otherDriversTrips.length === 0 && !loading && trips.length > 0 && (
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
            {drivaniaTrips.length === 0 && !loading && trips.length > 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <h3 className="text-lg font-semibold mb-2">No trips found</h3>
                  <p className="text-muted-foreground">
                    {drivaniaSearchText.trim() 
                      ? 'No trips match your search. Try a different search term.'
                      : 'No trips booked with Chauffs yet.'}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
        )}

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

