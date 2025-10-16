'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import GoogleTripMap from '@/components/GoogleTripMap';
import TripRiskBreakdown from '@/components/TripRiskBreakdown';
import { supabase } from '@/lib/supabase';

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🗺️</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
            Loading Your Trip Analysis...
          </h2>
          <div className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-6 w-6 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-gray-600 dark:text-gray-400">Please wait...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !tripData || !tripData.tripResults) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            Trip Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || 'This trip analysis could not be found. It may have been deleted or the link is incorrect.'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-6 transition-all shadow-lg"
          >
            🏠 Go to Home
          </button>
        </div>
      </div>
    );
  }

  const { tripDate, locations, tripResults, trafficPredictions, executiveReport } = tripData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header with Navigation */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <span className="text-5xl">🇬🇧</span>
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Your Trip Analysis
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-300 text-lg mb-4">
            Complete safety, traffic & weather report for {tripDate}
          </p>

          {/* Shareable Link */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4 max-w-2xl mx-auto">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">🔗 Shareable Link</p>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-mono truncate">
                  {typeof window !== 'undefined' ? window.location.href : ''}
                </p>
              </div>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Link copied to clipboard! 📋');
                  }
                }}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 transition-all text-sm flex-shrink-0"
              >
                📋 Copy
              </button>
            </div>
          </div>
          
          {/* Navigation Buttons */}
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            <button
              onClick={handlePlanNewTrip}
              className="rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-6 transition-all shadow-lg flex items-center gap-2"
            >
              <span>🆕</span>
              Plan New Trip
            </button>
            <button
              onClick={handleModifyTrip}
              className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-6 transition-all shadow-lg flex items-center gap-2"
            >
              <span>✏️</span>
              Modify This Trip
            </button>
          </div>
        </div>

        {/* Results Section */}
        <div className="mb-8">
          {/* Executive Report */}
          {executiveReport && (
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-3xl shadow-2xl p-8 mb-6 border-4 border-slate-300 dark:border-slate-700">
              {/* Header */}
              <div className="flex items-center justify-between mb-6 pb-6 border-b-4 border-slate-300 dark:border-slate-600">
                <div>
                  <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                    <span className="text-4xl">🛡️</span>
                    Peace of Mind Report
                    <span className="text-sm font-normal text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">AI-Powered</span>
                  </h2>
                  <p className="text-slate-600 dark:text-slate-300 mt-2">
                    Executive Summary • {tripDate} • {tripResults.length} Location{tripResults.length > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Trip Risk Score</div>
                  <div className={`text-6xl font-bold ${
                    executiveReport.tripRiskScore <= 3 ? 'text-green-600 dark:text-green-400' :
                    executiveReport.tripRiskScore <= 6 ? 'text-yellow-600 dark:text-yellow-400' :
                    executiveReport.tripRiskScore <= 8 ? 'text-orange-600 dark:text-orange-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {executiveReport.tripRiskScore}
                    <span className="text-3xl text-slate-400">/10</span>
                  </div>
                  <div className={`text-xs font-semibold mt-1 ${
                    executiveReport.tripRiskScore <= 3 ? 'text-green-600 dark:text-green-400' :
                    executiveReport.tripRiskScore <= 6 ? 'text-yellow-600 dark:text-yellow-400' :
                    executiveReport.tripRiskScore <= 8 ? 'text-orange-600 dark:text-orange-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {executiveReport.tripRiskScore <= 3 ? 'LOW RISK' :
                     executiveReport.tripRiskScore <= 6 ? 'MODERATE RISK' :
                     executiveReport.tripRiskScore <= 8 ? 'HIGH RISK' : 'CRITICAL RISK'}
                  </div>
                </div>
              </div>

              {/* Overall Summary */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-6 shadow-lg border-l-4 border-blue-500">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <span>📊</span> Executive Summary
                </h3>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {executiveReport.overallSummary}
                </p>
              </div>

              {/* Key Highlights */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {executiveReport.highlights.map((highlight: any, idx: number) => (
                  <div
                    key={idx}
                    className={`rounded-xl p-4 shadow-lg border-l-4 ${
                      highlight.type === 'danger' ? 'bg-red-50 dark:bg-red-900/20 border-red-500' :
                      highlight.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500' :
                      highlight.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-500' :
                      'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xl flex-shrink-0">
                        {highlight.type === 'danger' ? '🔴' :
                         highlight.type === 'warning' ? '⚠️' :
                         highlight.type === 'success' ? '✅' : 'ℹ️'}
                      </span>
                      <p className={`text-sm font-medium leading-snug ${
                        highlight.type === 'danger' ? 'text-red-800 dark:text-red-200' :
                        highlight.type === 'warning' ? 'text-yellow-800 dark:text-yellow-200' :
                        highlight.type === 'success' ? 'text-green-800 dark:text-green-200' :
                        'text-blue-800 dark:text-blue-200'
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
                  <div key={idx} className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        {loc.locationName.split(',')[0]}
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        loc.riskLevel === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                        loc.riskLevel === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                        'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      }`}>
                        {loc.riskLevel.toUpperCase()}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {loc.keyFindings.map((finding: string, fIdx: number) => (
                        <li key={fIdx} className="text-xs text-slate-700 dark:text-slate-300 leading-tight flex items-start gap-1">
                          <span className="text-blue-500 flex-shrink-0 mt-0.5">•</span>
                          <span>{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Route Disruptions */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg border-l-4 border-orange-500">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <span>🚗</span> Driving Risks
                  </h3>
                  <ul className="space-y-2">
                    {executiveReport.routeDisruptions.drivingRisks.map((risk: string, idx: number) => (
                      <li key={idx} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <span className="text-orange-500 flex-shrink-0 mt-1">▸</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg border-l-4 border-purple-500">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <span>🚶</span> External Disruptions
                  </h3>
                  <ul className="space-y-2">
                    {executiveReport.routeDisruptions.externalDisruptions.map((disruption: string, idx: number) => (
                      <li key={idx} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <span className="text-purple-500 flex-shrink-0 mt-1">▸</span>
                        <span>{disruption}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-6 shadow-xl text-white">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span>💡</span> Recommendations
                </h3>
                <ul className="space-y-3">
                  {executiveReport.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-white/95 leading-relaxed">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Traffic Predictions */}
          {trafficPredictions && trafficPredictions.success && (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-xl p-6 mb-6 text-white">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span>🚦</span> Traffic Predictions
                <span className="text-sm font-normal text-blue-100">(Historical-based)</span>
              </h2>
              
              {/* Warning Message */}
              {trafficPredictions.warning && (
                <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2 text-yellow-200">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Time Adjustment Notice</span>
                  </div>
                  <p className="text-yellow-100 text-sm mt-2">{trafficPredictions.warning}</p>
                </div>
              )}

              {/* Summary Stats */}
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white/20 rounded-lg p-4">
                  <div className="text-2xl font-bold">{trafficPredictions.totalDistance}</div>
                  <div className="text-blue-100 text-sm">Total Distance</div>
                </div>
                <div className="bg-white/20 rounded-lg p-4">
                  <div className="text-2xl font-bold">{trafficPredictions.totalMinutes} min</div>
                  <div className="text-blue-100 text-sm">With Traffic</div>
                </div>
                <div className="bg-white/20 rounded-lg p-4">
                  <div className="text-2xl font-bold">
                    +{trafficPredictions.totalMinutes - trafficPredictions.totalMinutesNoTraffic} min
                  </div>
                  <div className="text-blue-100 text-sm">Traffic Delay</div>
                </div>
              </div>

              {/* Route Legs */}
              <div className="space-y-3">
                <h3 className="font-semibold text-blue-100">Route Breakdown:</h3>
                {trafficPredictions.data.map((leg: any, index: number) => (
                  <div key={index} className="bg-white/10 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold">{leg.leg}</div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{leg.minutes} min</div>
                        <div className="text-xs text-blue-200">{leg.distance}</div>
                      </div>
                    </div>
                    <div className="text-sm text-blue-100">
                      {leg.originName.split(',')[0]} → {leg.destinationName.split(',')[0]}
                    </div>
                    {leg.busyMinutes && (
                      <div className="text-xs text-yellow-200 mt-1">
                        ⚠️ Busy traffic expected: +{leg.busyMinutes - leg.minutesNoTraffic} min delay
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

          {/* Map View */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
              <span>🗺️</span> Your Trip Map
              <span className="text-sm font-normal text-gray-500">({tripResults.length} location{tripResults.length > 1 ? 's' : ''})</span>
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

          {/* Location Reports */}
          <div className="space-y-6">
            {tripResults.map((result, index) => (
              <div key={result.locationId} className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl p-6 border-2 border-gray-200 dark:border-gray-700">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-lg">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                        {result.locationName.split(',')[0]}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        🕐 {result.time} • 📅 {tripDate}
                      </p>
                    </div>
                  </div>
                  <div className={`text-4xl font-bold ${getSafetyColor(result.data.crime.safetyScore)}`}>
                    {result.data.crime.safetyScore}
                    <span className="text-lg text-gray-500">/100</span>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow border-l-4 border-blue-500">
                    <div className="text-xl mb-1">🚨</div>
                    <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
                      {result.data.crime.summary.totalCrimes.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Crimes</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow border-l-4 border-orange-500">
                    <div className="text-xl mb-1">🚧</div>
                    <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
                      {result.data.disruptions.analysis.total}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Disruptions</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow border-l-4 border-cyan-500">
                    <div className="text-xl mb-1">🌡️</div>
                    <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
                      {result.data.weather.summary.avgMaxTemp}°C
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Avg Temp</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow border-l-4 border-purple-500">
                    <div className="text-xl mb-1">☔</div>
                    <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
                      {result.data.weather.summary.rainyDays}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Rainy Days</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow border-l-4 border-pink-500">
                    <div className="text-xl mb-1">📰</div>
                    <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
                      {result.data.events.summary.total}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Events</div>
                  </div>
                  <div className={`bg-white dark:bg-gray-800 rounded-lg p-3 shadow border-l-4 ${
                    result.data.parking.parkingRiskScore >= 7 ? 'border-red-500' : 
                    result.data.parking.parkingRiskScore >= 4 ? 'border-yellow-500' : 
                    'border-green-500'
                  }`}>
                    <div className="text-xl mb-1">🅿️</div>
                    <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
                      {result.data.parking.parkingRiskScore}/10
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Parking Risk</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow border-l-4 border-amber-500">
                    <div className="text-xl mb-1">☕</div>
                    <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
                      {result.data.cafes?.summary.total || 0}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Top Cafes</div>
                  </div>
                </div>

                {/* Detailed Breakdown */}
                <div className="grid lg:grid-cols-6 gap-4">
                  {/* Crime */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                    <h4 className="text-sm font-bold mb-2 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <span>🚨</span> Top Crimes
                    </h4>
                    <div className="space-y-2">
                      {result.data.crime.summary.topCategories.slice(0, 3).map((cat, idx) => (
                        <div key={idx}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-700 dark:text-gray-300">{cat.category}</span>
                            <span className="font-bold text-gray-800 dark:text-gray-200">{cat.count}</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full"
                              style={{ width: `${cat.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Traffic */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                    <h4 className="text-sm font-bold mb-2 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <span>🚦</span> Traffic
                    </h4>
                    <div className="space-y-2">
                      {result.data.disruptions.disruptions.slice(0, 2).map((disruption: any, idx: number) => (
                        <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded p-2 border border-gray-200 dark:border-gray-600">
                          <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-tight">
                            {disruption.location.substring(0, 30)}...
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {disruption.severity}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Weather */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                    <h4 className="text-sm font-bold mb-2 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <span>🌤️</span> Weather
                    </h4>
                    <div className="space-y-2">
                      {result.data.weather.forecast.slice(0, 2).map((day: any, idx: number) => {
                        const weatherEmoji = day.weatherCode === 0 ? '☀️' : 
                                           day.weatherCode <= 3 ? '⛅' :
                                           day.weatherCode >= 61 && day.weatherCode <= 67 ? '🌧️' : '🌤️';
                        return (
                          <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded p-2 border border-gray-200 dark:border-gray-600">
                            <div className="flex items-center justify-between">
                              <span className="text-lg">{weatherEmoji}</span>
                              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                {day.minTemp}°-{day.maxTemp}°C
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Events */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                    <h4 className="text-sm font-bold mb-2 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <span>📰</span> Events
                      <span className="text-xs font-normal text-gray-500">AI</span>
                    </h4>
                    {result.data.events.summary.total > 0 ? (
                      <div className="space-y-2">
                        {result.data.events.events.slice(0, 3).map((event: any, idx: number) => {
                          const severityColor = event.severity === 'high' ? 'red' : event.severity === 'medium' ? 'orange' : 'yellow';
                          const typeEmoji = event.type === 'strike' ? '✊' : event.type === 'protest' ? '📢' : event.type === 'festival' ? '🎉' : '🚧';
                          return (
                            <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded p-2 border border-gray-200 dark:border-gray-600">
                              <div className="flex items-start gap-1">
                                <span className="text-sm">{typeEmoji}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-tight">
                                    {event.title.substring(0, 35)}...
                                  </div>
                                  <div className={`text-xs mt-1 text-${severityColor}-600 dark:text-${severityColor}-400 font-medium`}>
                                    {event.severity.toUpperCase()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                        No significant events found
                      </div>
                    )}
                  </div>

                  {/* Parking */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                    <h4 className="text-sm font-bold mb-2 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <span>🅿️</span> Parking
                    </h4>
                    {result.data.parking.summary.totalNearby > 0 ? (
                      <div className="space-y-2">
                        {/* CPZ Warning */}
                        {result.data.parking.cpzInfo.inCPZ && (
                          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded p-2 border border-yellow-200 dark:border-yellow-800 mb-2">
                            <div className="text-xs font-semibold text-yellow-800 dark:text-yellow-200 flex items-center gap-1">
                              ⚠️ CPZ Zone
                            </div>
                            <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                              {result.data.parking.cpzInfo.operatingHours}
                            </div>
                            <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                              {result.data.parking.cpzInfo.chargeInfo}
                            </div>
                          </div>
                        )}
                        
                        {/* Car Parks */}
                        {result.data.parking.carParks.slice(0, 3).map((carPark: any, idx: number) => (
                          <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded p-2 border border-gray-200 dark:border-gray-600">
                            <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-tight">
                              {carPark.name.substring(0, 30)}{carPark.name.length > 30 ? '...' : ''}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center justify-between">
                              <span>📍 {Math.round(carPark.distance)}m</span>
                              {carPark.totalSpaces && (
                                <span>🚗 {carPark.totalSpaces} spaces</span>
                              )}
                            </div>
                            {carPark.facilities && carPark.facilities.length > 0 && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {carPark.facilities.slice(0, 2).join(', ')}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Summary */}
                        <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2 border-t border-gray-200 dark:border-gray-600">
                          {result.data.parking.summary.totalNearby} car parks within 1km
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                        ⚠️ Limited parking nearby
                      </div>
                    )}
                  </div>

                  {/* Top Cafes */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                    <h4 className="text-sm font-bold mb-2 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <span>☕</span> Top Cafes
                      <span className="text-xs font-normal text-gray-500">(~5 min walk)</span>
                    </h4>
                    {result.data.cafes?.summary.total > 0 ? (
                      <div className="space-y-2">
                        {/* Cafes */}
                        {result.data.cafes.cafes.slice(0, 3).map((cafe: any, idx: number) => (
                          <div key={idx} className="bg-amber-50 dark:bg-amber-900/20 rounded p-2 border border-amber-200 dark:border-amber-800">
                            <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-tight">
                              {cafe.name.substring(0, 30)}{cafe.name.length > 30 ? '...' : ''}
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-amber-600 dark:text-amber-400 font-bold">
                                  {cafe.rating}⭐
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  ({cafe.userRatingsTotal})
                                </span>
                              </div>
                              {cafe.priceLevel > 0 && (
                                <span className="text-xs font-bold text-green-600 dark:text-green-400">
                                  {'$'.repeat(cafe.priceLevel)}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              📍 {Math.round(cafe.distance)}m away
                            </div>
                          </div>
                        ))}

                        {/* Summary */}
                        <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2 border-t border-gray-200 dark:border-gray-600">
                          Avg rating: {result.data.cafes.summary.averageRating}⭐
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                        ⚠️ No cafes found within 250m
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
            <button
              onClick={handlePlanNewTrip}
              className="rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-8 transition-all shadow-lg flex items-center gap-2"
            >
              <span>🆕</span>
              Plan New Trip
            </button>
            <button
              onClick={handleModifyTrip}
              className="rounded-lg border-2 border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-bold py-3 px-8 transition-all flex items-center gap-2"
            >
              <span>✏️</span>
              Modify This Trip
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Powered by UK Police API • TfL • Open-Meteo • OpenAI • 100% Free
          </p>
        </div>
      </div>
    </div>
  );
}

