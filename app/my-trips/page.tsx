'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
}

const normalizeTripLocations = (rawLocations: any): any[] => {
  if (!rawLocations) return [];

  if (Array.isArray(rawLocations)) {
    return rawLocations;
  }

  if (typeof rawLocations === 'string') {
    try {
      const parsed = JSON.parse(rawLocations);
      if (Array.isArray(parsed)) return parsed;
    } catch (error) {
      console.error('❌ Failed to parse trip locations JSON:', error);
    }
  }

  return [];
};

type SearchCriteria = {
  passengerName?: string;
  tripDate?: string;
  location?: string;
};

export default function MyTripsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Trip[] | null>(null);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria | null>(null);

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
          .select('id, trip_date, created_at, locations, passenger_count, trip_destination, lead_passenger_name, vehicle, trip_notes')
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

  // Generate one-sentence trip description from available data
  const generateTripName = (trip: Trip) => {
    // Try to extract passenger name from trip_notes or special_remarks
    const extractPassengerName = (text: string | null): string | null => {
      if (!text) return null;

      // Look for common patterns like "Mr. Smith", "John Doe", "Client: Name", etc.
      const patterns = [
        /(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
        /(?:Client|Passenger|Guest|VIP):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
        /(?:for|with|picking up|collecting)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
        /(?:passenger|client)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
        /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/, // First word if capitalized
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:trip|journey|transfer|pickup)/, // Name followed by trip words
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const name = match[1].trim();
          // Filter out common false positives
          const falsePositives = ['VIP', 'Business', 'Client', 'Passenger', 'Guest', 'Meeting', 'Conference', 'Appointment'];
          if (!falsePositives.includes(name)) {
            return name;
          }
        }
      }
      return null;
    };

    // Try to get passenger name from various fields
    // Note: passenger_names column doesn't exist in DB, so extract from trip_notes or use lead_passenger_name
    const passengerName = trip.lead_passenger_name || extractPassengerName(trip.trip_notes);

    // Get location count for context
    const locationCount = getLocationCount(trip.locations);
    const locationText = locationCount === 1 ? '1 location' : `${locationCount} locations`;

    // Try to get purpose keywords for context
    const getPurposeKeywords = (text: string | null): string | null => {
      if (!text) return null;

      // Look for common business/personal keywords
      const keywords = [
        'meeting', 'conference', 'appointment', 'interview', 'lunch', 'dinner',
        'airport', 'hotel', 'office', 'client', 'business', 'personal',
        'wedding', 'event', 'celebration', 'shopping', 'medical', 'transfer'
      ];

      const lowerText = text.toLowerCase();
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          return keyword.charAt(0).toUpperCase() + keyword.slice(1);
        }
      }
      return null;
    };

    const purposeKeyword = getPurposeKeywords(trip.trip_notes) ||
      (trip.trip_destination ? `to ${trip.trip_destination}` : null);

    // Generate one-sentence description based on available data
    // ALWAYS prioritize passenger name when available
    if (passengerName && purposeKeyword) {
      return `${passengerName} ${purposeKeyword.toLowerCase()} trip with ${locationText}`;
    } else if (passengerName) {
      return `${passengerName} trip with ${locationText}`;
    } else if (purposeKeyword) {
      return `${purposeKeyword} trip with ${locationText}`;
    } else if (trip.trip_destination) {
      return `Trip to ${trip.trip_destination} with ${locationText}`;
    }

    // Fallback to date-based description
    const date = new Date(trip.trip_date);
    const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return `Trip on ${dateStr} with ${locationText}`;
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
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">
                    {generateTripName(trip)}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Created on: {formatDate(trip.created_at)}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span>{getLocationCount(trip.locations)} locations</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Trip date:{' '}
                  <span className="font-medium text-foreground">
                    {trip.trip_date ? new Date(trip.trip_date).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    }) : 'N/A'}
                  </span>
                </div>
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

