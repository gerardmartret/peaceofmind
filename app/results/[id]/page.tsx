'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import GoogleTripMap from '@/components/GoogleTripMap';
import TripRiskBreakdown from '@/components/TripRiskBreakdown';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

interface CombinedData {
  crime: CrimeData;
  disruptions: DisruptionData;
  weather: WeatherData;
  events: EventData;
  parking: ParkingData;
  cafes: CafeData;
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
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground">
              Your Trip Analysis
            </h1>
          </div>
          <p className="text-muted-foreground text-lg mb-4">
            Complete safety, traffic & weather report for {tripDate}
          </p>

          {/* Shareable Link */}
          <div className="bg-secondary border-2 border-border rounded-lg p-4 mb-4 max-w-2xl mx-auto">
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
              <Button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Link copied to clipboard!');
                  }
                }}
                size="sm"
                className="flex-shrink-0"
              >
                Copy
              </Button>
            </div>
          </div>
          
        </div>

        {/* Results Section */}
        <div className="mb-8">
          {/* Executive Report */}
          {executiveReport && (
            <div className="bg-card rounded-md p-8 mb-6 border-2 border-border">
              {/* Header */}
              <div className="flex items-center justify-between mb-6 pb-6 border-b-4 border-border">
                <div>
                  <h2 className="text-3xl font-bold text-card-foreground flex items-center gap-3">
                    Peace of Mind Report
                    <span className="text-sm font-normal text-muted-foreground bg-secondary px-3 py-1 rounded-full">AI-Powered</span>
                  </h2>
                  <p className="text-muted-foreground mt-2">
                    Executive Summary • {tripDate} • {tripResults.length} Location{tripResults.length > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">Trip Risk Score</div>
                  <div className={`text-6xl font-bold ${
                    executiveReport.tripRiskScore <= 3 ? 'text-ring' :
                    executiveReport.tripRiskScore <= 6 ? 'text-muted-foreground' :
                    executiveReport.tripRiskScore <= 8 ? 'text-destructive/80' :
                    'text-destructive'
                  }`}>
                    {executiveReport.tripRiskScore}
                    <span className="text-3xl text-muted-foreground">/10</span>
                  </div>
                  <div className={`text-xs font-semibold mt-1 ${
                    executiveReport.tripRiskScore <= 3 ? 'text-ring' :
                    executiveReport.tripRiskScore <= 6 ? 'text-muted-foreground' :
                    executiveReport.tripRiskScore <= 8 ? 'text-destructive/80' :
                    'text-destructive'
                  }`}>
                    {executiveReport.tripRiskScore <= 3 ? 'LOW RISK' :
                     executiveReport.tripRiskScore <= 6 ? 'MODERATE RISK' :
                     executiveReport.tripRiskScore <= 8 ? 'HIGH RISK' : 'CRITICAL RISK'}
                  </div>
                </div>
              </div>

              {/* Overall Summary */}
              <div className="bg-background rounded-xl p-6 mb-6 shadow-lg border-l-4 border-primary">
                <h3 className="text-lg font-bold text-foreground mb-3">
                  Executive Summary
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {executiveReport.overallSummary}
                </p>
              </div>

              {/* Key Highlights */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {executiveReport.highlights.map((highlight: any, idx: number) => (
                  <div
                    key={idx}
                    className={`rounded-xl p-4 shadow-lg border-l-4 ${
                      highlight.type === 'danger' ? 'bg-destructive/10 border-destructive' :
                      highlight.type === 'warning' ? 'bg-destructive/5 border-destructive/50' :
                      highlight.type === 'success' ? 'bg-ring/10 border-ring' :
                      'bg-secondary border-border'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <p className={`text-sm font-medium leading-snug ${
                        highlight.type === 'danger' ? 'text-destructive' :
                        highlight.type === 'warning' ? 'text-destructive/80' :
                        highlight.type === 'success' ? 'text-ring' :
                        'text-foreground'
                      }`}>
                        {highlight.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Location Analysis */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {executiveReport.locationAnalysis.map((loc: any, idx: number) => (
                  <div key={idx} className="bg-background rounded-xl p-5 shadow-lg border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-foreground flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        {loc.locationName.split(',')[0]}
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        loc.riskLevel === 'high' ? 'bg-destructive/10 text-destructive' :
                        loc.riskLevel === 'medium' ? 'bg-destructive/5 text-destructive/80' :
                        'bg-ring/10 text-ring'
                      }`}>
                        {loc.riskLevel.toUpperCase()}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {loc.keyFindings.map((finding: string, fIdx: number) => (
                        <li key={fIdx} className="text-xs text-muted-foreground leading-tight flex items-start gap-1">
                          <span className="text-primary flex-shrink-0 mt-0.5">•</span>
                          <span>{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Route Disruptions */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="bg-background rounded-xl p-5 shadow-lg border-l-4 border-destructive/70 border border-border">
                  <h3 className="text-lg font-bold text-foreground mb-3">
                    Driving Risks
                  </h3>
                  <ul className="space-y-2">
                    {executiveReport.routeDisruptions.drivingRisks.map((risk: string, idx: number) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-destructive/70 flex-shrink-0 mt-1">▸</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-background rounded-xl p-5 shadow-lg border-l-4 border-primary border border-border">
                  <h3 className="text-lg font-bold text-foreground mb-3">
                    External Disruptions
                  </h3>
                  <ul className="space-y-2">
                    {executiveReport.routeDisruptions.externalDisruptions.map((disruption: string, idx: number) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary flex-shrink-0 mt-1">▸</span>
                        <span>{disruption}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-primary rounded-xl p-6 shadow-xl text-primary-foreground">
                <h3 className="text-xl font-bold mb-4">
                  Recommendations
                </h3>
                <ul className="space-y-3">
                  {executiveReport.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-background/20 flex items-center justify-center text-sm font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-primary-foreground/95 leading-relaxed">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Map View */}
          <div className="bg-card border border-border rounded-md p-6 mb-6">
            <h2 className="text-xl font-bold text-card-foreground mb-4 flex items-center gap-2">
              Your Trip Map
              <span className="text-sm font-normal text-muted-foreground">({tripResults.length} location{tripResults.length > 1 ? 's' : ''})</span>
            </h2>
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

          {/* Chronological Journey Flow */}
          <div className="space-y-6">
            {tripResults.map((result, index) => (
              <React.Fragment key={result.locationId}>
              <div key={result.locationId} className="bg-card rounded-md p-6 border-2 border-border">
                {/* Header with Full Address */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      {numberToLetter(index + 1)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-card-foreground">
                        {result.locationName.split(',')[0]}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {result.locationName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {result.time} • {tripDate}
                      </p>
                    </div>
                  </div>
                </div>

                {/* All Information Cards - Single Row */}
                <div className="grid grid-cols-5 gap-3">
                  {/* Weather */}
                  <div className="bg-secondary border-2 border-border rounded-md p-3">
                    <h4 className="font-bold text-card-foreground mb-2">Weather</h4>
                    <div className="text-lg font-bold text-card-foreground mb-1">
                      {result.data.weather.summary.avgMaxTemp}°C
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {result.data.weather.summary.rainyDays} rainy days
                    </div>
                    <div className="space-y-1">
                      {result.data.weather.forecast.slice(0, 2).map((day: any, idx: number) => (
                        <div key={idx} className="text-xs text-muted-foreground">
                          {day.minTemp}°-{day.maxTemp}°C
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cafes */}
                  <div className="bg-secondary border-2 border-border rounded-md p-3">
                    <h4 className="font-bold text-card-foreground mb-2">Cafes</h4>
                    <div className="text-lg font-bold text-card-foreground mb-1">
                      {result.data.cafes?.summary.total || 0} nearby
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      Avg rating: {result.data.cafes?.summary.averageRating || 0}/5
                    </div>
                    <div className="space-y-1">
                      {result.data.cafes?.cafes && result.data.cafes.cafes.length > 0 ? (
                        result.data.cafes.cafes.slice(0, 2).map((cafe: any, idx: number) => (
                          <div key={idx} className="text-xs text-muted-foreground">
                            {cafe.name.substring(0, 15)}... {cafe.rating}/5
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-muted-foreground">No cafes found</div>
                      )}
                    </div>
                  </div>

                  {/* Parking */}
                  <div className="bg-secondary border-2 border-border rounded-md p-3">
                    <h4 className="font-bold text-card-foreground mb-2">Parking</h4>
                    <div className="text-lg font-bold text-card-foreground mb-1">
                      {result.data.parking.parkingRiskScore >= 7 ? 'Limited' : 
                       result.data.parking.parkingRiskScore >= 4 ? 'Moderate' : 'Good'}
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {result.data.parking.parkingRiskScore}/10 availability
                    </div>
                    <div className="space-y-1">
                      {result.data.parking.cpzInfo.inCPZ && (
                        <div className="text-xs text-destructive">
                          CPZ Zone Active
                        </div>
                      )}
                      {result.data.parking.carParks.slice(0, 2).map((carPark: any, idx: number) => (
                        <div key={idx} className="text-xs text-muted-foreground">
                          {carPark.name.substring(0, 15)}... {Math.round(carPark.distance)}m
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Events */}
                  <div className="bg-secondary border-2 border-border rounded-md p-3">
                    <h4 className="font-bold text-card-foreground mb-2">Events</h4>
                    <div className="text-lg font-bold text-card-foreground mb-1">
                      {result.data.events.summary.total} upcoming
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      AI Generated
                    </div>
                    <div className="space-y-1">
                      {result.data.events.events.length > 0 ? (
                        result.data.events.events.slice(0, 2).map((event: any, idx: number) => (
                          <div key={idx} className="text-xs text-muted-foreground">
                            {event.title.substring(0, 15)}... {event.severity.toUpperCase()}
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-muted-foreground">No events</div>
                      )}
                    </div>
                  </div>

                  {/* Crime */}
                  <div className="bg-secondary border-2 border-border rounded-md p-3">
                    <h4 className="font-bold text-card-foreground mb-2">Crime</h4>
                    <div className="text-lg font-bold text-card-foreground mb-1">
                      {result.data.crime.summary.totalCrimes.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      Total incidents
                    </div>
                    <div className="space-y-1">
                      {result.data.crime.summary.topCategories.slice(0, 2).map((cat, idx) => (
                        <div key={idx} className="text-xs text-muted-foreground">
                          {cat.category}: {cat.count}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Route Card (after each location except the last) */}
              {index < tripResults.length - 1 && trafficPredictions?.success && trafficPredictions.data[index] && (
                <div 
                  className="rounded-md p-6 border-2 border-primary text-primary-foreground"
                  style={{ backgroundColor: '#1F253D' }}
                >
                  {/* Route Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl font-bold">
                        Route: {numberToLetter(index + 1)} → {numberToLetter(index + 2)}
                      </div>
                    </div>
                    <div className={`px-4 py-2 rounded-lg font-semibold ${
                      (() => {
                        const leg = trafficPredictions.data[index];
                        const delay = leg.minutes - leg.minutesNoTraffic;
                        if (delay < 5) return 'bg-ring/20 text-ring';
                        if (delay < 10) return 'bg-destructive/20 text-destructive';
                        return 'bg-destructive/30 text-destructive';
                      })()
                    }`}>
                      {(() => {
                        const leg = trafficPredictions.data[index];
                        const delay = leg.minutes - leg.minutesNoTraffic;
                        if (delay < 5) return 'Low Risk';
                        if (delay < 10) return 'Medium Risk';
                        return 'High Risk';
                      })()}
                    </div>
                  </div>

                  {/* Route Stats */}
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-background/10 rounded-lg p-4">
                      <div className="text-sm opacity-80 mb-1">Travel Time</div>
                      <div className="text-2xl font-bold">
                        {trafficPredictions.data[index].minutes} min
                      </div>
                    </div>
                    <div className="bg-background/10 rounded-lg p-4">
                      <div className="text-sm opacity-80 mb-1">Distance</div>
                      <div className="text-2xl font-bold">
                        {trafficPredictions.data[index].distance}
                      </div>
                    </div>
                    <div className="bg-destructive/20 rounded-lg p-4">
                      <div className="text-sm text-destructive-foreground/80 mb-1">Traffic Delay</div>
                      <div className="text-2xl font-bold text-destructive-foreground">
                        +{trafficPredictions.data[index].minutes - trafficPredictions.data[index].minutesNoTraffic} min
                      </div>
                    </div>
                  </div>

                  {/* Route Details */}
                  <div className="bg-background/5 rounded-lg p-4">
                    <div className="text-sm opacity-90">
                      <span className="font-semibold">{trafficPredictions.data[index].originName.split(',')[0]}</span>
                      {' → '}
                      <span className="font-semibold">{trafficPredictions.data[index].destinationName.split(',')[0]}</span>
                    </div>
                    {trafficPredictions.data[index].busyMinutes && (
                      <div className="text-sm text-destructive-foreground/90 mt-2">
                        Busy traffic expected: +{trafficPredictions.data[index].busyMinutes - trafficPredictions.data[index].minutesNoTraffic} min additional delay
                      </div>
                    )}
                  </div>

                  {/* Road Closures */}
                  {result.data.disruptions.disruptions.length > 0 && (
                    <div className="bg-background/5 rounded-lg p-4 mt-4">
                      <div className="text-sm font-semibold mb-2">Road Closures</div>
                      <div className="space-y-2">
                        {result.data.disruptions.disruptions.slice(0, 2).map((disruption: any, idx: number) => (
                          <div key={idx} className="text-xs opacity-90">
                            <div className="font-semibold">{disruption.location.substring(0, 40)}...</div>
                            <div className="text-destructive-foreground/80">{disruption.severity}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              </React.Fragment>
            ))}
          </div>

          {/* Risk Legend */}
          <div className="bg-secondary rounded-md p-6 mt-6 border-2 border-border">
            <h3 className="text-lg font-bold text-card-foreground mb-4">Risk Level Legend</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 bg-ring/10 rounded-md p-3 border-2 border-ring/20">
                <div className="w-6 h-6 rounded-full bg-ring flex items-center justify-center">
                  <div className="text-xs font-bold text-primary-foreground">L</div>
                </div>
                <div>
                  <div className="font-semibold text-ring">Low Risk</div>
                  <div className="text-xs text-muted-foreground">Safe conditions</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-destructive/5 rounded-md p-3 border-2 border-destructive/20">
                <div className="w-6 h-6 rounded-full bg-destructive/80 flex items-center justify-center">
                  <div className="text-xs font-bold text-primary-foreground">M</div>
                </div>
                <div>
                  <div className="font-semibold text-destructive/80">Medium Risk</div>
                  <div className="text-xs text-muted-foreground">Caution advised</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-destructive/10 rounded-md p-3 border-2 border-destructive">
                <div className="w-6 h-6 rounded-full bg-destructive flex items-center justify-center">
                  <div className="text-xs font-bold text-primary-foreground">H</div>
                </div>
                <div>
                  <div className="font-semibold text-destructive">High Risk</div>
                  <div className="text-xs text-muted-foreground">Extra vigilance needed</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="text-center py-8">
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


