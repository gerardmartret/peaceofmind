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
              <div key={result.locationId} className="rounded-md p-6 border-2 border-primary text-primary-foreground" style={{ backgroundColor: '#1F253D' }}>
                {/* Header with Full Address */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      {numberToLetter(index + 1)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-primary-foreground">
                        {result.locationName.split(',')[0]}
                      </h3>
                      <p className="text-sm text-primary-foreground/80">
                        {result.locationName}
                      </p>
                      <p className="text-xs text-primary-foreground/70">
                        {result.time} • {tripDate}
                      </p>
                    </div>
                  </div>
                </div>

                {/* All Information Cards - Responsive Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {/* Personal Safety */}
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
                    <h4 className="font-bold text-primary-foreground mb-2">Personal Safety</h4>
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

                  {/* Weather */}
                  <div className="bg-background/20 border-2 border-background/30 rounded-md p-3">
                    <h4 className="font-bold text-primary-foreground mb-2">Weather</h4>
                    <div className="flex items-center gap-2 mb-2">
                      {/* Weather Icon based on conditions */}
                      {(() => {
                        const rainyDays = result.data.weather.summary.rainyDays;
                        const avgTemp = result.data.weather.summary.avgMaxTemp;
                        
                        // Determine weather icon
                        if (avgTemp < 0) {
                          // Snow
                          return (
                            <svg className="w-6 h-6 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v20M17 7l-5-5-5 5M17 17l-5 5-5-5M2 12h20M7 7l5 5 5-5M7 17l5-5 5 5" />
                            </svg>
                          );
                        } else if (rainyDays >= 5) {
                          // Heavy rain
                          return (
                            <svg className="w-6 h-6 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17l-1 4M12 17v4M16 17l1 4" />
                            </svg>
                          );
                        } else if (rainyDays >= 2) {
                          // Light rain
                          return (
                            <svg className="w-6 h-6 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 17v4M16 17l1 4" />
                            </svg>
                          );
                        } else if (rainyDays >= 1) {
                          // Cloudy
                          return (
                            <svg className="w-6 h-6 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                            </svg>
                          );
                        } else {
                          // Sunny
                          return (
                            <svg className="w-6 h-6 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                          );
                        }
                      })()}
                      <div className="flex-1">
                        <div className="text-lg font-bold text-primary-foreground">
                          {result.data.weather.summary.avgMaxTemp}°C
                        </div>
                        <div className="text-xs text-primary-foreground/80">
                          {result.data.weather.summary.rainyDays > 0 
                            ? `${result.data.weather.summary.rainyDays} rainy days`
                            : 'Clear'}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {result.data.weather.forecast.slice(0, 2).map((day: any, idx: number) => (
                        <div key={idx} className="text-xs text-primary-foreground/70">
                          {day.minTemp}°-{day.maxTemp}°C
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cafes */}
                  <div className="bg-background/20 border-2 border-background/30 rounded-md p-3">
                    <h4 className="font-bold text-primary-foreground mb-2">Cafes</h4>
                    <div className="text-lg font-bold text-primary-foreground mb-1">
                      {result.data.cafes?.summary.total || 0} nearby
                    </div>
                    <div className="text-xs text-primary-foreground/80 mb-2">
                      Avg rating: {result.data.cafes?.summary.averageRating || 0}/5
                    </div>
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

                  {/* Parking */}
                  <div className="bg-background/20 border-2 border-background/30 rounded-md p-3">
                    <h4 className="font-bold text-primary-foreground mb-2">Parking</h4>
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

                  {/* Upcoming Disruptive Events */}
                  <div className="bg-background/20 border-2 border-background/30 rounded-md p-3">
                    <h4 className="font-bold text-primary-foreground mb-3">Upcoming Disruptive Events</h4>
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

                </div>
              </div>

              {/* Route Card (after each location except the last) */}
              {index < tripResults.length - 1 && trafficPredictions?.success && trafficPredictions.data[index] && (
                <div 
                  className="bg-card rounded-md p-6 border-2 border-border"
                >
                  {/* Route Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl font-bold text-card-foreground">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
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
                    <div className="bg-destructive/20 rounded-lg p-4">
                      <div className="text-sm text-destructive mb-1">Traffic Delay</div>
                      <div className="text-2xl font-bold text-destructive">
                        +{trafficPredictions.data[index].minutes - trafficPredictions.data[index].minutesNoTraffic} min
                      </div>
                    </div>
                  </div>

                  {/* Route Details */}
                  <div className="bg-secondary/30 rounded-lg p-4">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-semibold text-card-foreground">{trafficPredictions.data[index].originName.split(',')[0]}</span>
                      {' → '}
                      <span className="font-semibold text-card-foreground">{trafficPredictions.data[index].destinationName.split(',')[0]}</span>
                    </div>
                    {trafficPredictions.data[index].busyMinutes && (
                      <div className="text-sm text-destructive mt-2">
                        Busy traffic expected: +{trafficPredictions.data[index].busyMinutes - trafficPredictions.data[index].minutesNoTraffic} min additional delay
                      </div>
                    )}
                  </div>

                  {/* Road Closures */}
                  {result.data.disruptions.disruptions.length > 0 && (
                    <div className="bg-secondary/30 rounded-lg p-4 mt-4">
                      <div className="text-sm font-semibold mb-2 text-card-foreground">Road Closures</div>
                      <div className="space-y-2">
                        {result.data.disruptions.disruptions.slice(0, 2).map((disruption: any, idx: number) => (
                          <div key={idx} className="text-xs text-muted-foreground">
                            <div className="font-semibold text-card-foreground">{disruption.location.substring(0, 40)}...</div>
                            <div className="text-destructive">{disruption.severity}</div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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


