import { useState, useEffect } from 'react';

export function useDrivaniaQuotes(tripData: any) {
  const [loadingDrivaniaQuote, setLoadingDrivaniaQuote] = useState<boolean>(false);
  const [drivaniaQuotes, setDrivaniaQuotes] = useState<any>(null);
  const [drivaniaError, setDrivaniaError] = useState<string | null>(null);
  const [drivaniaServiceType, setDrivaniaServiceType] = useState<'one-way' | 'hourly' | null>(null);

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
          setDrivaniaError(result.error || result.message || 'Failed to get quote from Chauffs');
        }
      } catch (err) {
        setDrivaniaError('Failed to request quote from Chauffs. Please try again.');
      } finally {
        setLoadingDrivaniaQuote(false);
      }
    };

    fetchDrivaniaQuote();
  }, [tripData, loadingDrivaniaQuote, drivaniaQuotes]);

  return {
    loadingDrivaniaQuote,
    drivaniaQuotes,
    drivaniaError,
    drivaniaServiceType,
  };
}
