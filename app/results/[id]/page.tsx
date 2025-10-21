'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import GoogleTripMap from '@/components/GoogleTripMap';
import TripRiskBreakdown from '@/components/TripRiskBreakdown';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';

// Helper function to convert numbers to letters (1 -> A, 2 -> B, etc.)
const numberToLetter = (num: number): string => {
  return String.fromCharCode(64 + num); // 65 is 'A' in ASCII
};

interface CrimeData {
  district: string;
  coordinates: { lat: number; lng: number };
  crimes: any[];
  summary: {
    totalCrimes: number;
    topCategories: Array<{ category: string; count: number; percentage: number }>;
    byOutcome: Record<string, number>;
    month: string;
  };
  safetyScore: number;
}

interface DisruptionData {
  district: string;
  timeframe: string;
  isAreaFiltered: boolean;
  disruptions: any[];
  analysis: {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    active: number;
    upcoming: number;
  };
}

interface WeatherData {
  district: string;
  coordinates: { lat: number; lng: number };
  forecast: Array<{
    date: string;
    maxTemp: number;
    minTemp: number;
    precipitation: number;
    precipitationProb: number;
    weatherCode: number;
    weatherDescription: string;
    windSpeed: number;
  }>;
  summary: {
    avgMaxTemp: number;
    avgMinTemp: number;
    totalPrecipitation: number;
    rainyDays: number;
    maxWindSpeed: number;
  };
}

interface EventData {
  location: string;
  coordinates: { lat: number; lng: number };
  date: string;
  events: Array<{
    title: string;
    description: string;
    date?: string;
    severity: 'high' | 'medium' | 'low';
    type: 'strike' | 'protest' | 'festival' | 'construction' | 'other';
  }>;
  summary: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    highSeverity: number;
  };
}

interface ParkingData {
  location: string;
  coordinates: { lat: number; lng: number };
  carParks: Array<{
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    distance: number;
    totalSpaces?: number;
    operatingHours?: string;
    facilities: string[];
    type: string;
  }>;
  cpzInfo: {
    inCPZ: boolean;
    zone?: string;
    zoneName?: string;
    borough?: string;
    operatingHours?: string;
    operatingDays?: string;
    restrictions?: string;
    chargeInfo?: string;
  };
  parkingRiskScore: number;
  summary: {
    totalNearby: number;
    averageDistance: number;
    hasStationParking: boolean;
    cpzWarning: boolean;
  };
}

interface CafeData {
  location: string;
  coordinates: { lat: number; lng: number };
  cafes: Array<{
    id: string;
    name: string;
    address: string;
    rating: number;
    userRatingsTotal: number;
    priceLevel: number;
    distance?: number;
    lat: number;
    lng: number;
    types: string[];
    businessStatus?: string;
  }>;
  summary: {
    total: number;
    averageRating: number;
    averageDistance: number;
  };
}

interface EmergencyServicesData {
  location: string;
  coordinates: { lat: number; lng: number };
  policeStation?: {
    id: string;
    name: string;
    address: string;
    distance: number;
    lat: number;
    lng: number;
    type: 'police';
  };
  hospital?: {
    id: string;
    name: string;
    address: string;
    distance: number;
    lat: number;
    lng: number;
    type: 'hospital';
  };
}

interface CombinedData {
  crime: CrimeData;
  disruptions: DisruptionData;
  weather: WeatherData;
  events: EventData;
  parking: ParkingData;
  cafes: CafeData;
  emergencyServices?: EmergencyServicesData;
}

interface TripData {
  tripDate: string;
  userEmail: string;
  locations: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    time: string;
  }>;
  tripResults: Array<{
    locationId: string;
    locationName: string;
    time: string;
    data: CombinedData;
  }>;
  trafficPredictions: any;
  executiveReport: any;
}

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;
  const [tripData, setTripData] = useState<TripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editingLocationName, setEditingLocationName] = useState<string>('');
  const [locationDisplayNames, setLocationDisplayNames] = useState<{[key: string]: string}>({});
  const [expandedLocations, setExpandedLocations] = useState<{[key: string]: boolean}>({});
  const [expandedRoutes, setExpandedRoutes] = useState<{[key: string]: boolean}>({});

  const handleEditLocationName = (locationId: string, currentName: string) => {
    setEditingLocationId(locationId);
    // Get the current display name or use the first part of the full address
    const currentDisplayName = locationDisplayNames[locationId] || currentName.split(',')[0];
    setEditingLocationName(currentDisplayName);
  };

  const handleSaveLocationName = async (locationId: string) => {
    if (!editingLocationName.trim()) {
      setEditingLocationId(null);
      setEditingLocationName('');
      return;
    }

    try {
      // Update only the display name, keep the original full address unchanged
      setLocationDisplayNames(prev => ({
        ...prev,
        [locationId]: editingLocationName.trim()
      }));

      setEditingLocationId(null);
      setEditingLocationName('');
    } catch (error) {
      console.error('Error saving location name:', error);
      setEditingLocationId(null);
      setEditingLocationName('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, locationId: string) => {
    if (e.key === 'Enter') {
      handleSaveLocationName(locationId);
    } else if (e.key === 'Escape') {
      setEditingLocationId(null);
      setEditingLocationName('');
    }
  };

  const toggleLocationExpansion = (locationId: string) => {
    setExpandedLocations(prev => ({
      ...prev,
      [locationId]: !prev[locationId]
    }));
  };

  const toggleRouteExpansion = (routeId: string) => {
    setExpandedRoutes(prev => ({
      ...prev,
      [routeId]: !prev[routeId]
    }));
  };

  useEffect(() => {
    async function loadTripFromDatabase() {
      if (!tripId) {
        console.log('⚠️ No trip ID provided');
        router.push('/');
        return;
      }

      try {
        console.log(`📡 Loading trip from database: ${tripId}`);
        
        const { data, error: fetchError } = await supabase
          .from('trips')
          .select('*')
          .eq('id', tripId)
          .single();

        if (fetchError) {
          console.error('❌ Error loading trip:', fetchError);
          setError('Trip not found');
          setLoading(false);
          return;
        }

        if (!data) {
          console.log('⚠️ Trip not found in database');
          setError('Trip not found');
          setLoading(false);
          return;
        }

        console.log('✅ Trip loaded from database');
        
        // Transform database data to match expected TripData format
        const tripData: TripData = {
          tripDate: data.trip_date,
          userEmail: data.user_email,
          locations: data.locations as any,
          tripResults: data.trip_results as any,
          trafficPredictions: data.traffic_predictions as any,
          executiveReport: data.executive_report as any,
        };

        setTripData(tripData);
        setLoading(false);
      } catch (err) {
        console.error('❌ Unexpected error:', err);
        setError('Failed to load trip');
        setLoading(false);
      }
    }

    loadTripFromDatabase();
  }, [tripId, router]);

  const handlePlanNewTrip = () => {
    // Redirect to home for new trip
    router.push('/');
  };

  const handleModifyTrip = () => {
    // For now, just redirect to home
    // Future: could pre-fill form with current trip data
    router.push('/');
  };

  const getSafetyColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Loading Your Trip Analysis...
          </h2>
          <div className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-muted-foreground">Please wait...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !tripData || !tripData.tripResults) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="p-8 text-center">
          <h2 className="text-2xl font-bold text-card-foreground mb-4">
            Trip Not Found
          </h2>
          <p className="text-muted-foreground mb-6">
            {error || 'This trip analysis could not be found. It may have been deleted or the link is incorrect.'}
          </p>
          <Button
            onClick={() => router.push('/')}
            size="lg"
          >
            Go to Home
          </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { tripDate, locations, tripResults, trafficPredictions, executiveReport } = tripData;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header with Navigation */}

        {/* Results Section */}
        <div className="mb-8">
          {/* Executive Report */}
          {executiveReport && (
            <div className="bg-card rounded-md p-8 mb-6 border-2 border-border">
              {/* Trip Risk Score and Risk Score Explanation */}
              <div className="rounded-xl p-6 mb-6" style={{ backgroundColor: '#05060A' }}>
                <div className="grid gap-6" style={{ gridTemplateColumns: '3fr 1fr' }}>
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-white mb-3">
                      Risks Summary
                    </h3>
                    <p className="text-white/80 leading-relaxed">
                      {executiveReport.riskScoreExplanation}
                    </p>
                  </div>
                  <div 
                    className="text-center rounded-md p-6"
                    style={{
                      backgroundColor: (() => {
                        const riskScore = Math.max(0, executiveReport.tripRiskScore);
                        if (riskScore <= 3) return '#18815A'; // Green for low risk
                        if (riskScore <= 6) return '#D4915C'; // Orange for moderate risk
                        return '#AD5252'; // Red for high/critical risk
                      })(),
                      color: 'white'
                    }}
                  >
                    <div className="text-sm text-white/80 mb-1">Trip Risk Score</div>
                    <div className="text-6xl font-bold text-white">
                      {Math.max(0, executiveReport.tripRiskScore)}
                      <span className="text-3xl text-white/80">/10</span>
                    </div>
                    <div className="text-xs font-semibold mt-1 text-white">
                      {Math.max(0, executiveReport.tripRiskScore) <= 3 ? 'LOW RISK' :
                       Math.max(0, executiveReport.tripRiskScore) <= 6 ? 'MODERATE RISK' :
                       Math.max(0, executiveReport.tripRiskScore) <= 8 ? 'HIGH RISK' : 'CRITICAL RISK'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Map View */}
              <div className="mb-6" style={{ overflowAnchor: 'auto' }}>
                <h2 className="text-xl font-bold text-card-foreground mb-4 flex items-center gap-2">
                  Your Trip Map
                  <span className="text-sm font-normal text-muted-foreground">({tripResults.length} location{tripResults.length > 1 ? 's' : ''})</span>
                </h2>
                <div style={{ transform: 'translate3d(0,0,0)', backfaceVisibility: 'hidden', perspective: '1000px' }}>
                <GoogleTripMap 
                  locations={tripResults.map((result, index) => {
                    const location = locations.find(l => l.id === result.locationId);
                    return {
                      id: result.locationId,
                      name: result.locationName,
                      lat: location?.lat || 0,
                      lng: location?.lng || 0,
                      time: result.time,
                      safetyScore: result.data.crime.safetyScore,
                    };
                  })}
                />
                </div>
              </div>

              {/* Top Disruptor */}
              <div className="rounded-md p-6 border-2 border-border bg-card mb-6">
                <h3 className="text-lg font-bold text-card-foreground mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Potential Trip Disruptor
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {executiveReport.topDisruptor}
                </p>
              </div>



              {/* Recommendations */}
              <div className="rounded-xl p-6 mb-6" style={{ backgroundColor: '#05060A' }}>
                <h3 className="text-xl font-bold text-white mb-4">
                  Recommendations
                </h3>
                <ul className="space-y-3">
                  {executiveReport.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white">
                        {idx + 1}
                      </span>
                      <span className="text-white/95 leading-relaxed">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Route Disruptions */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="rounded-md p-6 border-2 border-border bg-card">
                  <h3 className="text-lg font-bold text-card-foreground mb-3">
                    Driving Risks
                  </h3>
                  <ul className="space-y-2">
                    {executiveReport.routeDisruptions.drivingRisks.map((risk: string, idx: number) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-card-foreground flex-shrink-0 mt-1">▸</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-md p-6 border-2 border-border bg-card">
                  <h3 className="text-lg font-bold text-card-foreground mb-3">
                    External Disruptions
                  </h3>
                  <ul className="space-y-2">
                    {executiveReport.routeDisruptions.externalDisruptions.map((disruption: string, idx: number) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-card-foreground flex-shrink-0 mt-1">▸</span>
                        <span>{disruption}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Chronological Journey Flow */}
          <div className="relative space-y-6" style={{ overflowAnchor: 'none' }}>
            {/* Connecting Line */}
            <div className="absolute left-6 top-3 bottom-0 w-0.5 bg-border"></div>
              {tripResults.map((result, index) => (
                <React.Fragment key={result.locationId}>
                {/* Location Hour Display */}
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-32 text-right relative">
                    {/* Timeline Dot for Location */}
                    <div className="absolute left-2 top-0 w-8 h-8 rounded-full bg-primary border-2 border-background flex items-center justify-center z-10">
                      <span className="text-base font-bold text-primary-foreground">{numberToLetter(index + 1)}</span>
                    </div>
                    <div className="text-base font-bold text-foreground ml-6">
                      {result.time}H
                    </div>
                    <div className="text-sm text-muted-foreground ml-2">
                      {index === 0 ? 'Pick up' : index === tripResults.length - 1 ? 'Drop off' : 'Resume'}
                    </div>
                  </div>
                <div className="flex-1">
                  <div key={result.locationId} className="rounded-md p-6 border-2 border-primary text-primary-foreground" style={{ backgroundColor: '#05060A' }}>
                {/* Header with Full Address */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-border" style={{ borderBottomWidth: '0.5px' }}>
                  <div className="flex items-center gap-3">
                    <div className="relative" style={{ width: '40px', height: '50px' }}>
                      <svg 
                        viewBox="0 0 24 24" 
                        fill="white" 
                        stroke="#05060A" 
                        strokeWidth="1.5"
                        style={{ width: '100%', height: '100%' }}
                      >
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: '6px' }}>
                        <span className="font-bold text-sm" style={{ color: '#05060A' }}>
                          {numberToLetter(index + 1)}
                        </span>
                      </div>
                    </div>
                     <div className="flex-1">
                      
                      {/* Editable Shortcut Name */}
                      {editingLocationId === result.locationId ? (
                        <Input
                          value={editingLocationName}
                          onChange={(e) => setEditingLocationName(e.target.value)}
                          onKeyDown={(e) => handleKeyPress(e, result.locationId)}
                          onBlur={() => handleSaveLocationName(result.locationId)}
                          className="text-base font-semibold bg-background/20 border-primary-foreground/30 text-primary-foreground mt-1 mb-1"
                          placeholder="Enter location shortcut"
                          autoFocus
                        />
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-base font-semibold text-primary-foreground">
                            {locationDisplayNames[result.locationId] || result.locationName.split(',')[0]}
                          </p>
                          <button
                            onClick={() => handleEditLocationName(result.locationId, result.locationName)}
                            className="flex items-center gap-1 px-2 py-1 hover:bg-background/20 rounded transition-colors"
                            title="Edit location shortcut"
                          >
                            <svg className="w-3 h-3 text-primary-foreground/70 hover:text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span className="text-xs text-primary-foreground/70 hover:text-primary-foreground">Edit name</span>
                          </button>
                        </div>
                      )}
                      
                      {/* Full Address */}
                      <p className="text-xs text-primary-foreground/70 mt-1">
                        {result.locationName}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Weather - Top Right */}
                    <div className="flex items-center gap-3">
                      {/* Weather Icon based on conditions */}
                      {(() => {
                        const rainyDays = result.data.weather.summary.rainyDays;
                        const avgTemp = result.data.weather.summary.avgMaxTemp;
                        
                        // Determine weather icon
                        if (avgTemp < 0) {
                          // Snow
                          return (
                            <svg className="w-8 h-8 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v20M17 7l-5-5-5 5M17 17l-5 5-5-5M2 12h20M7 7l5 5 5-5M7 17l5-5 5 5" />
                            </svg>
                          );
                        } else if (rainyDays >= 5) {
                          // Heavy rain
                          return (
                            <svg className="w-8 h-8 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17l-1 4M12 17v4M16 17l1 4" />
                            </svg>
                          );
                        } else if (rainyDays >= 2) {
                          // Light rain
                          return (
                            <svg className="w-8 h-8 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 17v4M16 17l1 4" />
                            </svg>
                          );
                        } else if (rainyDays >= 1) {
                          // Cloudy
                          return (
                            <svg className="w-8 h-8 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                            </svg>
                          );
                        } else {
                          // Sunny
                          return (
                            <svg className="w-8 h-8 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                          );
                        }
                      })()}
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary-foreground">
                          {result.data.weather.summary.avgMaxTemp}°C
                        </div>
                        <div className="text-sm text-primary-foreground/80">
                          {result.data.weather.summary.rainyDays > 0 
                            ? `${result.data.weather.summary.rainyDays} rainy days`
                            : 'Clear'}
                        </div>
                      </div>
                    </div>

                    {/* Expand/Collapse Button */}
                    <button
                      onClick={() => toggleLocationExpansion(result.locationId)}
                      className="p-2 hover:bg-background/20 rounded transition-colors"
                      title={expandedLocations[result.locationId] ? "Collapse details" : "Expand details"}
                    >
                      <svg 
                        className={`w-5 h-5 text-primary-foreground transition-transform ${expandedLocations[result.locationId] ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Collapsed Summary - Always Visible */}
                <div 
                  className={`overflow-hidden transition-all duration-500 ease-in-out ${
                    !expandedLocations[result.locationId] ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="flex items-center justify-between text-sm text-primary-foreground/80 py-2">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span>Safety: {result.data.crime.safetyScore}/100</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span>{result.data.cafes?.summary.total || 0} Cafes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                        <span>{result.data.parking?.carParks?.length || 0} Parking</span>
                      </div>
                    </div>
                    <div className="text-xs text-primary-foreground/60">
                      Click to expand for full details
                    </div>
                  </div>
                </div>

                {/* All Information Cards - Single Row - Only when expanded */}
                <div 
                  className={`overflow-hidden transition-all duration-500 ease-in-out ${
                    expandedLocations[result.locationId] ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                  {/* Traveller Safety */}
                  <div 
                    className="border-2 rounded-md p-3"
                    style={{
                      backgroundColor: (() => {
                        const safetyScore = result.data.crime.safetyScore;
                        if (safetyScore >= 60) return '#18815A'; // Brand green for safe
                        if (safetyScore >= 40) return '#D4915C'; // Professional elegant orange for moderate
                        return '#AD5252'; // Brand red for dangerous
                      })(),
                      borderColor: (() => {
                        const safetyScore = result.data.crime.safetyScore;
                        if (safetyScore >= 60) return '#18815A';
                        if (safetyScore >= 40) return '#D4915C';
                        return '#AD5252';
                      })()
                    }}
                  >
                    <h4 className="font-bold text-primary-foreground mb-2">Traveller Safety</h4>
                    <div className="flex items-center gap-2 mb-2">
                      {(() => {
                        const safetyScore = result.data.crime.safetyScore;
                        if (safetyScore >= 80) {
                          return (
                            <>
                              <svg className="w-5 h-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-primary-foreground">Very Safe</div>
                                <div className="text-xs text-primary-foreground/80">Low crime area with excellent safety record</div>
                              </div>
                            </>
                          );
                        } else if (safetyScore >= 60) {
                          return (
                            <>
                              <svg className="w-5 h-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-primary-foreground">Safe</div>
                                <div className="text-xs text-primary-foreground/80">Generally safe with minimal concerns</div>
                              </div>
                            </>
                          );
                        } else if (safetyScore >= 40) {
                          return (
                            <>
                              <svg className="w-5 h-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-primary-foreground">Moderate</div>
                                <div className="text-xs text-primary-foreground/80">Mixed safety profile, stay aware</div>
                              </div>
                            </>
                          );
                        } else if (safetyScore >= 20) {
                          return (
                            <>
                              <svg className="w-5 h-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-primary-foreground">Caution Advised</div>
                                <div className="text-xs text-primary-foreground/80">Higher crime area, extra caution needed</div>
                              </div>
                            </>
                          );
                        } else {
                          return (
                            <>
                              <svg className="w-5 h-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-primary-foreground">High Alert</div>
                                <div className="text-xs text-primary-foreground/80">High crime area, avoid if possible</div>
                              </div>
                            </>
                          );
                        }
                      })()}
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-primary-foreground/80 font-medium mb-1">
                        These are the 3 most common crimes in this area. Be aware.
                      </div>
                      {result.data.crime.summary.topCategories
                        .filter(cat => !cat.category.toLowerCase().includes('other'))
                        .slice(0, 3)
                        .map((cat, idx) => (
                          <div key={idx} className="text-xs text-primary-foreground/70">
                            {(() => {
                              const category = cat.category.toLowerCase();
                              if (category.includes('violence')) return 'Violence and assault incidents';
                              if (category.includes('theft')) return 'Theft and burglary cases';
                              if (category.includes('robbery')) return 'Robbery and street crime';
                              if (category.includes('vehicle')) return 'Vehicle-related crimes';
                              if (category.includes('drug')) return 'Drug-related offenses';
                              if (category.includes('criminal damage')) return 'Criminal damage and vandalism';
                              if (category.includes('public order')) return 'Public order disturbances';
                              if (category.includes('burglary')) return 'Burglary and break-ins';
                              if (category.includes('shoplifting')) return 'Shoplifting incidents';
                              if (category.includes('anti-social')) return 'Anti-social behavior';
                              return cat.category;
                            })()}
                          </div>
                        ))}
                    </div>
                    
                    {/* Emergency Services Links */}
                    <div className="mt-3 pt-3 border-t border-primary-foreground/20 space-y-2">
                      {result.data.emergencyServices?.policeStation ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(result.data.emergencyServices.policeStation.name)}&query_place_id=${result.data.emergencyServices.policeStation.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between text-xs text-primary-foreground hover:underline"
                        >
                          <div>
                            <div className="font-medium">Closest Police Station</div>
                            <div className="text-primary-foreground/70">{Math.round(result.data.emergencyServices.policeStation.distance)}m away</div>
                          </div>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : (
                        <a
                          href={`https://www.google.com/maps/search/police+station+near+${encodeURIComponent(result.locationName)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between text-xs text-primary-foreground hover:underline"
                        >
                          <span className="font-medium">Closest Police Station</span>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}

                      {result.data.emergencyServices?.hospital ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(result.data.emergencyServices.hospital.name)}&query_place_id=${result.data.emergencyServices.hospital.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between text-xs text-primary-foreground hover:underline"
                        >
                          <div>
                            <div className="font-medium">Closest Hospital</div>
                            <div className="text-primary-foreground/70">{Math.round(result.data.emergencyServices.hospital.distance)}m away</div>
                          </div>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : (
                        <a
                          href={`https://www.google.com/maps/search/hospital+near+${encodeURIComponent(result.locationName)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between text-xs text-primary-foreground hover:underline"
                        >
                          <span className="font-medium">Closest Hospital</span>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Potential Disruptive Events */}
                  <div className="bg-background/20 border-2 border-background/30 rounded-md p-3">
                    <h4 className="font-bold text-primary-foreground mb-3">Potential Disruptive Events</h4>
                    {result.data.events.events.length > 0 ? (
                      <>
                        <div className="space-y-2 mb-3">
                          {result.data.events.events.slice(0, 3).map((event: any, idx: number) => (
                            <div key={idx} className="text-xs text-primary-foreground/80">
                              • {event.title}
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-primary-foreground/70 italic pt-2 border-t border-primary-foreground/20">
                          {result.data.events.summary.total === 1 
                            ? 'This event will be in the area. It might affect the trip. Be aware.'
                            : `These ${result.data.events.summary.total} events will be in the area. They might affect the trip. Be aware.`}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-primary-foreground/70">No upcoming events</div>
                    )}
                  </div>

                  {/* Nearby Cafes */}
                  <div className="bg-background/20 border-2 border-background/30 rounded-md p-3">
                    <h4 className="font-bold text-primary-foreground mb-2">Nearby Cafes</h4>
                    <div className="space-y-2">
                      {result.data.cafes?.cafes && result.data.cafes.cafes.length > 0 ? (
                        result.data.cafes.cafes
                          .filter((cafe: any) => {
                            // Calculate if cafe is open (location time - 20 minutes)
                            const locationTime = new Date(`${tripDate} ${result.time}`);
                            const checkTime = new Date(locationTime.getTime() - 20 * 60000); // Subtract 20 minutes
                            const currentHour = checkTime.getHours();
                            const currentMinute = checkTime.getMinutes();
                            const currentTimeMinutes = currentHour * 60 + currentMinute;
                            
                            // Simple business hours check (assuming 7 AM - 10 PM)
                            return currentTimeMinutes >= 420 && currentTimeMinutes <= 1320; // 7 AM to 10 PM
                          })
                          .slice(0, 3)
                          .map((cafe: any, idx: number) => {
                            return (
                              <div key={idx} className="text-xs text-primary-foreground/70 border-b border-background/20 pb-1 last:border-b-0">
                                <div className="flex items-center justify-between mb-1">
                                  <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cafe.name + ' ' + result.locationName.split(',')[0])}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-primary-foreground hover:text-ring transition-colors truncate"
                                  >
                                    {cafe.name.length > 20 ? cafe.name.substring(0, 20) + '...' : cafe.name}
                                  </a>
                                  <div className="text-xs font-medium" style={{ color: '#18815A' }}>
                                    Open
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1">
                                    <span className="text-ring">★</span>
                                    <span>{cafe.rating}/5</span>
                                    <span className="text-primary-foreground/60">({cafe.userRatingsTotal})</span>
                                  </div>
                                  <div className="text-xs text-primary-foreground/60">
                                    7 AM - 10 PM
                                  </div>
                                </div>
                                <div className="text-primary-foreground/60">
                                  {Math.round(cafe.distance)}m away
                                </div>
                              </div>
                            );
                          })
                      ) : (
                        <div className="text-xs text-primary-foreground/70">No cafes found</div>
                      )}
                    </div>
                  </div>

                  {/* Nearby Parking Spaces */}
                  <div className="bg-background/20 border-2 border-background/30 rounded-md p-3">
                    <h4 className="font-bold text-primary-foreground mb-2">Nearby Parking Spaces</h4>
                    <div className="text-sm font-semibold text-primary-foreground mb-1">
                      {result.data.parking?.cpzInfo?.inCPZ ? 'CPZ Zone - Charges Apply' :
                       (result.data.parking?.parkingRiskScore || 5) >= 7 ? 'Limited Street Parking' : 'Good Parking Options'}
                    </div>
                    <div className="text-xs text-primary-foreground/80 mb-2">
                      {result.data.parking?.cpzInfo?.inCPZ ? 'Controlled parking zone with time restrictions' :
                       (result.data.parking?.parkingRiskScore || 5) >= 7 ? 'Few street spaces, use car parks' : 
                       'Multiple parking options nearby'}
                    </div>
                    <div className="space-y-2">
                      {result.data.parking?.carParks && result.data.parking.carParks.length > 0 ? (
                        result.data.parking.carParks.slice(0, 3).map((carPark: any, idx: number) => (
                          <div key={idx} className="text-xs text-primary-foreground/70 border-b border-background/20 pb-1 last:border-b-0">
                            <div className="flex items-center justify-between mb-1">
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(carPark.name + ' ' + result.locationName.split(',')[0])}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-primary-foreground hover:text-ring transition-colors truncate"
                              >
                                {carPark.name.length > 20 ? carPark.name.substring(0, 20) + '...' : carPark.name}
                              </a>
                              <div className="text-xs text-primary-foreground/60">
                                {Math.round(carPark.distance)}m
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <span>{carPark.operatingHours || '24/7'}</span>
                                {carPark.totalSpaces && (
                                  <span className="text-primary-foreground/60">({carPark.totalSpaces} spaces)</span>
                                )}
                              </div>
                              <div className="text-xs text-primary-foreground/60 text-right">
                                {carPark.facilities && carPark.facilities.length > 0 
                                  ? carPark.facilities.slice(0, 2).join(', ')
                                  : 'Standard'}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        // Fallback parking recommendations based on location
                        (() => {
                          const locationName = result.locationName.toLowerCase();
                          const isCentralLondon = locationName.includes('westminster') || locationName.includes('soho') || 
                                                 locationName.includes('mayfair') || locationName.includes('covent garden') ||
                                                 locationName.includes('city of london') || locationName.includes('camden');
                          
                          // Calculate if parking is open (location time - 20 minutes)
                          const locationTime = new Date(`${tripDate} ${result.time}`);
                          const checkTime = new Date(locationTime.getTime() - 20 * 60000); // Subtract 20 minutes
                          const currentHour = checkTime.getHours();
                          const currentMinute = checkTime.getMinutes();
                          const currentTimeMinutes = currentHour * 60 + currentMinute;
                          
                          const allParkingRecommendations = isCentralLondon ? [
                            { name: 'NCP Car Park', distance: 200, hours: '24/7', spaces: '50+', facilities: 'Covered, Secure', isOpen: true },
                            { name: 'Q-Park', distance: 350, hours: '24/7', spaces: '100+', facilities: 'Accessible, EV', isOpen: true },
                            { name: 'Street Parking', distance: 0, hours: 'Mon-Sat 8:30am-6:30pm', spaces: 'Limited', facilities: 'CPZ Charges', isOpen: currentTimeMinutes >= 510 && currentTimeMinutes <= 1110 }
                          ] : [
                            { name: 'Local Car Park', distance: 150, hours: '24/7', spaces: '30+', facilities: 'Standard', isOpen: true },
                            { name: 'Shopping Centre', distance: 400, hours: 'Mon-Sat 9am-9pm', spaces: '200+', facilities: 'Free 2hrs', isOpen: currentTimeMinutes >= 540 && currentTimeMinutes <= 1260 },
                            { name: 'Street Parking', distance: 0, hours: 'Mon-Fri 8am-6pm', spaces: 'Good', facilities: 'Pay & Display', isOpen: currentTimeMinutes >= 480 && currentTimeMinutes <= 1080 }
                          ];
                          
                          // Filter to show only open parking options
                          const openParkingOptions = allParkingRecommendations.filter(parking => parking.isOpen);
                          
                          return openParkingOptions.map((parking, idx) => (
                            <div key={idx} className="text-xs text-primary-foreground/70 border-b border-background/20 pb-1 last:border-b-0">
                              <div className="flex items-center justify-between mb-1">
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parking.name + ' ' + result.locationName.split(',')[0])}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-primary-foreground hover:text-ring transition-colors truncate"
                                >
                                  {parking.name}
                                </a>
                                <div className="text-xs text-primary-foreground/60">
                                  {parking.distance > 0 ? `${parking.distance}m` : 'On-site'}
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                  <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                                  <span>{parking.hours}</span>
                                  <span className="text-primary-foreground/60">({parking.spaces})</span>
                                </div>
                                <div className="text-xs text-primary-foreground/60 text-right">
                                  {parking.facilities}
                                </div>
                              </div>
                            </div>
                          ));
                        })()
                      )}
                      {result.data.parking?.cpzInfo?.inCPZ && (
                        <div className="text-xs text-destructive-foreground border-t border-background/20 pt-1 mt-1">
                          <div className="font-semibold">CPZ: {result.data.parking.cpzInfo.zoneName || 'Controlled Zone'}</div>
                          <div>{result.data.parking.cpzInfo.operatingHours || 'Mon-Sat 8:30am-6:30pm'}</div>
                          {result.data.parking.cpzInfo.chargeInfo && (
                            <div>{result.data.parking.cpzInfo.chargeInfo}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  </div>
                </div>
              </div>
                </div>
              </div>

              {/* Route Card (after each location except the last) */}
              {index < tripResults.length - 1 && trafficPredictions?.success && trafficPredictions.data[index] && (
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-32 text-right relative">
                    {/* Timeline Dot for Route */}
                    <div className="absolute left-2 top-0 w-8 h-8 rounded-full bg-card border-2 border-border flex items-center justify-center z-10">
                      <span className="text-base font-bold text-card-foreground">→</span>
                    </div>
                    <div className="text-base font-bold text-foreground ml-6">
                      {result.time}H
                    </div>
                    <div className="text-sm text-muted-foreground ml-2">
                      Route
                    </div>
                  </div>
                  <div className="flex-1">
                    <div 
                      className="bg-card rounded-md p-6 border-2 border-border"
                    >
                  {/* Route Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl font-bold text-card-foreground flex items-center gap-2">
                        <span>Route: {numberToLetter(index + 1)}</span>
                        <span 
                          className="inline-block text-lg animate-[slideArrow_2s_ease-in-out_infinite]"
                        >
                          →
                        </span>
                        <span>{numberToLetter(index + 2)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div 
                        className="px-4 py-2 rounded-lg font-semibold"
                        style={{
                          backgroundColor: (() => {
                            const leg = trafficPredictions.data[index];
                            const delay = Math.max(0, leg.minutes - leg.minutesNoTraffic);
                            if (delay < 5) return '#18815A'; // Brand green for low
                            if (delay < 10) return '#D4915C'; // Professional orange for moderate
                            return '#AD5252'; // Brand red for high
                          })(),
                          color: '#FFFFFF'
                        }}
                      >
                        {(() => {
                          const leg = trafficPredictions.data[index];
                          const delay = Math.max(0, leg.minutes - leg.minutesNoTraffic);
                          if (delay < 5) return 'Delay Risk: Low';
                          if (delay < 10) return 'Delay Risk: Moderate';
                          return 'Delay Risk: High';
                        })()}
                      </div>
                      
                      {/* Expand/Collapse Button */}
                      <button
                        onClick={() => toggleRouteExpansion(`route-${index}`)}
                        className="p-2 hover:bg-secondary/50 rounded transition-colors"
                        title={expandedRoutes[`route-${index}`] ? "Collapse details" : "Expand details"}
                      >
                        <svg 
                          className={`w-5 h-5 text-card-foreground transition-transform ${expandedRoutes[`route-${index}`] ? 'rotate-180' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Collapsed Summary */}
                  <div 
                    className={`overflow-hidden transition-all duration-500 ease-in-out ${
                      !expandedRoutes[`route-${index}`] ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="flex items-center justify-between text-sm text-muted-foreground py-2">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <span className="text-card-foreground font-semibold">Travel Time:</span>
                          <span>{trafficPredictions.data[index].minutes} min</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-card-foreground font-semibold">Distance:</span>
                          <span>{trafficPredictions.data[index].distance}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-card-foreground font-semibold">Delay:</span>
                          <span>-{Math.max(0, trafficPredictions.data[index].minutes - trafficPredictions.data[index].minutesNoTraffic)} min</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground/60">
                        Click to expand for full details
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Details */}
                  <div 
                    className={`overflow-hidden transition-all duration-500 ease-in-out ${
                      expandedRoutes[`route-${index}`] ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="pt-2">

                  {/* Route Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Left Column - Google Maps Route Preview */}
                    <div className="rounded-lg overflow-hidden h-[200px] border border-border">
                      <GoogleTripMap 
                        height="200px"
                        compact={true}
                        locations={[
                          {
                            id: tripResults[index].locationId,
                            name: tripResults[index].locationName,
                            lat: result.data.crime.coordinates.lat,
                            lng: result.data.crime.coordinates.lng,
                            time: tripResults[index].time,
                            safetyScore: result.data.crime.safetyScore,
                          },
                          {
                            id: tripResults[index + 1].locationId,
                            name: tripResults[index + 1].locationName,
                            lat: tripResults[index + 1].data.crime.coordinates.lat,
                            lng: tripResults[index + 1].data.crime.coordinates.lng,
                            time: tripResults[index + 1].time,
                            safetyScore: tripResults[index + 1].data.crime.safetyScore,
                          }
                        ]}
                      />
                    </div>
                    
                    {/* Right Column - Address Details */}
                    <div>
                      <div className="space-y-2">
                        <div className="text-sm">
                          <span className="font-semibold text-muted-foreground">From: </span>
                          <span className="text-card-foreground">{tripResults[index].locationName}</span>
                        </div>
                        <div className="text-sm">
                          <span className="font-semibold text-muted-foreground">To: </span>
                          <span className="text-card-foreground">{tripResults[index + 1].locationName}</span>
                        </div>
                      </div>
                      {trafficPredictions.data[index].busyMinutes && (
                        <div className="text-sm text-destructive mt-3 pt-3 border-t border-border/30">
                          Busy traffic expected: -{Math.max(0, trafficPredictions.data[index].busyMinutes - trafficPredictions.data[index].minutesNoTraffic)} min additional delay
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Route Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <div 
                      className="rounded-lg p-4"
                      style={{
                        backgroundColor: (() => {
                          const delay = Math.max(0, trafficPredictions.data[index].minutes - trafficPredictions.data[index].minutesNoTraffic);
                          if (delay < 5) return 'rgba(24, 129, 90, 0.2)'; // Brand green with opacity
                          if (delay < 10) return 'rgba(212, 145, 92, 0.2)'; // Professional orange with opacity
                          return 'rgba(173, 82, 82, 0.2)'; // Brand red with opacity
                        })()
                      }}
                    >
                      <div 
                        className="text-sm mb-1"
                        style={{
                          color: (() => {
                            const delay = Math.max(0, trafficPredictions.data[index].minutes - trafficPredictions.data[index].minutesNoTraffic);
                            if (delay < 5) return '#18815A';
                            if (delay < 10) return '#D4915C';
                            return '#AD5252';
                          })()
                        }}
                      >
                        Traffic Delay
                      </div>
                      <div 
                        className="text-2xl font-bold"
                        style={{
                          color: (() => {
                            const delay = Math.max(0, trafficPredictions.data[index].minutes - trafficPredictions.data[index].minutesNoTraffic);
                            if (delay < 5) return '#18815A';
                            if (delay < 10) return '#D4915C';
                            return '#AD5252';
                          })()
                        }}
                      >
                        -{Math.max(0, trafficPredictions.data[index].minutes - trafficPredictions.data[index].minutesNoTraffic)} min
                      </div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">Travel Time</div>
                      <div className="text-2xl font-bold text-card-foreground">
                        {trafficPredictions.data[index].minutes} min
                      </div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">Distance</div>
                      <div className="text-2xl font-bold text-card-foreground">
                        {trafficPredictions.data[index].distance}
                      </div>
                    </div>
                  </div>

                  {/* Road Closures */}
                  {result.data.disruptions.disruptions.length > 0 && (
                    <div className="bg-secondary/30 rounded-lg p-4 mt-4">
                      <div className="text-sm font-semibold mb-3 text-card-foreground">Road Closures</div>
                      <div className="space-y-2 mb-3">
                        {result.data.disruptions.disruptions.slice(0, 2).map((disruption: any, idx: number) => (
                          <div key={idx} className="text-xs">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(disruption.location)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-card-foreground hover:underline flex items-center gap-1"
                            >
                              {disruption.location}
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                            <div className="text-destructive mt-1">{disruption.severity}</div>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground italic pt-2 border-t border-border/30">
                        Data from Transport for London
                      </div>
                    </div>
                  )}
                  
                    </div>
                  </div>
                    </div>
                  </div>
                </div>
              )}
              </React.Fragment>
            ))}
          </div>

        </div>

        {/* Shareable Link */}
        <div className="bg-secondary border-2 border-border rounded-md p-6 mb-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-secondary-foreground mb-1">Shareable Link</p>
              <p className="text-sm text-muted-foreground font-mono truncate">
                {typeof window !== 'undefined' ? window.location.href : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Copy this link to share with your driver
              </p>
            </div>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  navigator.clipboard.writeText(window.location.href);
                  // Visual feedback with brand green
                  const button = document.getElementById('copy-button');
                  if (button) {
                    const originalContent = button.innerHTML;
                    button.innerHTML = `
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    `;
                    button.style.color = '#18815A';
                    setTimeout(() => {
                      button.innerHTML = originalContent;
                      button.style.color = '';
                    }, 2000);
                  }
                }
              }}
              id="copy-button"
              className="flex-shrink-0 p-2 rounded-md hover:bg-background/20 transition-colors"
              title="Copy link"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="text-center py-8">
          <p className="text-lg font-medium text-foreground mb-4">
            Drivania Labs wishes you a nice trip
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            <Button
              onClick={handlePlanNewTrip}
              variant="default"
              size="lg"
              className="bg-ring hover:bg-ring/90 text-primary-foreground"
            >
              Plan New Trip
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Powered by UK Police API, TfL, Open-Meteo, OpenAI - 100% Free
          </p>
        </div>
      </div>
    </div>
  );
}


