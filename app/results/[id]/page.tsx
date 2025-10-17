'use client';

import { useState, useEffect } from 'react';
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
            <div className="bg-card rounded-3xl shadow-2xl p-8 mb-6 border-4 border-border">
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
          <div className="bg-card border border-border rounded-2xl shadow-xl p-6 mb-6">
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

          {/* Traffic Predictions */}
          {trafficPredictions && trafficPredictions.success && (
            <div className="bg-primary rounded-2xl shadow-xl p-6 mb-6 text-primary-foreground">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                Traffic Predictions
                <span className="text-sm font-normal opacity-80">(Historical-based)</span>
              </h2>
              
              {/* Warning Message */}
              {trafficPredictions.warning && (
                <div className="bg-destructive/20 border border-destructive/30 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2 text-destructive-foreground">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Time Adjustment Notice</span>
                  </div>
                  <p className="opacity-90 text-sm mt-2">{trafficPredictions.warning}</p>
                </div>
              )}

              {/* Summary Stats */}
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="bg-background/20 rounded-lg p-4">
                  <div className="text-2xl font-bold">{trafficPredictions.totalDistance}</div>
                  <div className="opacity-80 text-sm">Total Distance</div>
                </div>
                <div className="bg-background/20 rounded-lg p-4">
                  <div className="text-2xl font-bold">{trafficPredictions.totalMinutes} min</div>
                  <div className="opacity-80 text-sm">With Traffic</div>
                </div>
                <div className="bg-background/20 rounded-lg p-4">
                  <div className="text-2xl font-bold">
                    +{trafficPredictions.totalMinutes - trafficPredictions.totalMinutesNoTraffic} min
                  </div>
                  <div className="opacity-80 text-sm">Traffic Delay</div>
                </div>
              </div>

              {/* Route Legs */}
              <div className="space-y-3">
                <h3 className="font-semibold opacity-90">Route Breakdown:</h3>
                {trafficPredictions.data.map((leg: any, index: number) => (
                  <div key={index} className="bg-background/10 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold">{leg.leg}</div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{leg.minutes} min</div>
                        <div className="text-xs opacity-80">{leg.distance}</div>
                      </div>
                    </div>
                    <div className="text-sm opacity-90">
                      {leg.originName.split(',')[0]} → {leg.destinationName.split(',')[0]}
                    </div>
                    {leg.busyMinutes && (
                      <div className="text-xs text-destructive mt-1">
                        Busy traffic expected: +{leg.busyMinutes - leg.minutesNoTraffic} min delay
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trip Risk Breakdown */}
          <TripRiskBreakdown 
            tripResults={tripResults}
            trafficPredictions={trafficPredictions}
            tripDate={tripDate}
          />

          {/* Location Reports */}
          <div className="space-y-6">
            {tripResults.map((result, index) => (
              <div key={result.locationId} className="bg-card rounded-2xl shadow-xl p-6 border-2 border-border">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      {numberToLetter(index + 1)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-card-foreground">
                        {result.locationName.split(',')[0]}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {result.time} • {tripDate}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-4">
                  <div className="bg-background rounded-lg p-3 shadow border-l-4 border-primary">
                    <div className="text-sm font-medium mb-1 text-muted-foreground">Crime</div>
                    <div className="text-xl font-bold text-foreground">
                      {result.data.crime.summary.totalCrimes.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-background rounded-lg p-3 shadow border-l-4 border-destructive/70">
                    <div className="text-sm font-medium mb-1 text-muted-foreground">Disruptions</div>
                    <div className="text-xl font-bold text-foreground">
                      {result.data.disruptions.analysis.total}
                    </div>
                  </div>
                  <div className="bg-background rounded-lg p-3 shadow border-l-4 border-primary/70">
                    <div className="text-sm font-medium mb-1 text-muted-foreground">Avg Temp</div>
                    <div className="text-xl font-bold text-foreground">
                      {result.data.weather.summary.avgMaxTemp}°C
                    </div>
                  </div>
                  <div className="bg-background rounded-lg p-3 shadow border-l-4 border-primary/50">
                    <div className="text-sm font-medium mb-1 text-muted-foreground">Rain Days</div>
                    <div className="text-xl font-bold text-foreground">
                      {result.data.weather.summary.rainyDays}
                    </div>
                  </div>
                  <div className="bg-background rounded-lg p-3 shadow border-l-4 border-primary/60">
                    <div className="text-sm font-medium mb-1 text-muted-foreground">Events</div>
                    <div className="text-xl font-bold text-foreground">
                      {result.data.events.summary.total}
                    </div>
                  </div>
                  <div className={`bg-background rounded-lg p-3 shadow border-l-4 ${
                    result.data.parking.parkingRiskScore >= 7 ? 'border-destructive' : 
                    result.data.parking.parkingRiskScore >= 4 ? 'border-destructive/50' : 
                    'border-ring'
                  }`}>
                    <div className="text-sm font-medium mb-1 text-muted-foreground">Parking</div>
                    <div className="text-xl font-bold text-foreground">
                      {result.data.parking.parkingRiskScore}/10
                    </div>
                  </div>
                  <div className="bg-background rounded-lg p-3 shadow border-l-4 border-ring/70">
                    <div className="text-sm font-medium mb-1 text-muted-foreground">Cafes</div>
                    <div className="text-xl font-bold text-foreground">
                      {result.data.cafes?.summary.total || 0}
                    </div>
                  </div>
                </div>

                {/* Detailed Breakdown */}
                <div className="grid lg:grid-cols-6 gap-4">
                  {/* Crime */}
                  <div className="bg-background border border-border rounded-lg p-4 shadow">
                    <h4 className="text-sm font-bold mb-2 text-foreground">
                      Top Crimes
                    </h4>
                    <div className="space-y-2">
                      {result.data.crime.summary.topCategories.slice(0, 3).map((cat, idx) => (
                        <div key={idx}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{cat.category}</span>
                            <span className="font-bold text-foreground">{cat.count}</span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full"
                              style={{ width: `${cat.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Traffic */}
                  <div className="bg-background border border-border rounded-lg p-4 shadow">
                    <h4 className="text-sm font-bold mb-2 text-foreground">
                      Traffic
                    </h4>
                    <div className="space-y-2">
                      {result.data.disruptions.disruptions.slice(0, 2).map((disruption: any, idx: number) => (
                        <div key={idx} className="bg-secondary rounded p-2 border border-border">
                          <div className="text-xs font-semibold text-foreground leading-tight">
                            {disruption.location.substring(0, 30)}...
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {disruption.severity}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Weather */}
                  <div className="bg-background border border-border rounded-lg p-4 shadow">
                    <h4 className="text-sm font-bold mb-2 text-foreground">
                      Weather
                    </h4>
                    <div className="space-y-2">
                      {result.data.weather.forecast.slice(0, 2).map((day: any, idx: number) => {
                        return (
                          <div key={idx} className="bg-secondary rounded p-2 border border-border">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground">
                                {day.minTemp}°-{day.maxTemp}°C
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Events */}
                  <div className="bg-background border border-border rounded-lg p-4 shadow">
                    <h4 className="text-sm font-bold mb-2 text-foreground">
                      Events
                      <span className="text-xs font-normal text-muted-foreground ml-2">AI</span>
                    </h4>
                    {result.data.events.summary.total > 0 ? (
                      <div className="space-y-2">
                        {result.data.events.events.slice(0, 3).map((event: any, idx: number) => {
                          const severityColor = event.severity === 'high' ? 'destructive' : event.severity === 'medium' ? 'destructive/70' : 'destructive/50';
                          return (
                            <div key={idx} className="bg-secondary rounded p-2 border border-border">
                              <div className="flex items-start gap-1">
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold text-foreground leading-tight">
                                    {event.title.substring(0, 35)}...
                                  </div>
                                  <div className={`text-xs mt-1 text-${severityColor} font-medium`}>
                                    {event.severity.toUpperCase()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground text-center py-4">
                        No significant events found
                      </div>
                    )}
                  </div>

                  {/* Parking */}
                  <div className="bg-background border border-border rounded-lg p-4 shadow">
                    <h4 className="text-sm font-bold mb-2 text-foreground">
                      Parking
                    </h4>
                    {result.data.parking.summary.totalNearby > 0 ? (
                      <div className="space-y-2">
                        {/* CPZ Warning */}
                        {result.data.parking.cpzInfo.inCPZ && (
                          <div className="bg-destructive/10 rounded p-2 border border-destructive mb-2">
                            <div className="text-xs font-semibold text-destructive flex items-center gap-1">
                              CPZ Zone
                            </div>
                            <div className="text-xs text-destructive/80 mt-1">
                              {result.data.parking.cpzInfo.operatingHours}
                            </div>
                            <div className="text-xs text-destructive/70 mt-1">
                              {result.data.parking.cpzInfo.chargeInfo}
                            </div>
                          </div>
                        )}
                        
                        {/* Car Parks */}
                        {result.data.parking.carParks.slice(0, 3).map((carPark: any, idx: number) => (
                          <div key={idx} className="bg-secondary rounded p-2 border border-border">
                            <div className="text-xs font-semibold text-foreground leading-tight">
                              {carPark.name.substring(0, 30)}{carPark.name.length > 30 ? '...' : ''}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                              <span>{Math.round(carPark.distance)}m</span>
                              {carPark.totalSpaces && (
                                <span>{carPark.totalSpaces} spaces</span>
                              )}
                            </div>
                            {carPark.facilities && carPark.facilities.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {carPark.facilities.slice(0, 2).join(', ')}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Summary */}
                        <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
                          {result.data.parking.summary.totalNearby} car parks within 1km
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground text-center py-4">
                        Limited parking nearby
                      </div>
                    )}
                  </div>

                  {/* Top Cafes */}
                  <div className="bg-background border border-border rounded-lg p-4 shadow">
                    <h4 className="text-sm font-bold mb-2 text-foreground">
                      Top Cafes
                      <span className="text-xs font-normal text-muted-foreground ml-2">(~5 min walk)</span>
                    </h4>
                    {result.data.cafes?.summary.total > 0 ? (
                      <div className="space-y-2">
                        {/* Cafes */}
                        {result.data.cafes.cafes.slice(0, 3).map((cafe: any, idx: number) => (
                          <div key={idx} className="bg-ring/10 rounded p-2 border border-ring">
                            <div className="text-xs font-semibold text-foreground leading-tight">
                              {cafe.name.substring(0, 30)}{cafe.name.length > 30 ? '...' : ''}
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-ring font-bold">
                                  {cafe.rating} stars
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  ({cafe.userRatingsTotal})
                                </span>
                              </div>
                              {cafe.priceLevel > 0 && (
                                <span className="text-xs font-bold text-ring">
                                  {'$'.repeat(cafe.priceLevel)}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {Math.round(cafe.distance)}m away
                            </div>
                          </div>
                        ))}

                        {/* Summary */}
                        <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
                          Avg rating: {result.data.cafes.summary.averageRating} stars
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground text-center py-4">
                        No cafes found within 250m
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
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

