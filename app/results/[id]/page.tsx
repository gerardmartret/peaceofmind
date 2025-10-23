'use client';

import React, { useState, useEffect, useRef } from 'react';
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
    displayName?: string; // Custom user-defined name
    lat: number;
    lng: number;
    time: string;
  }>;
  tripResults: Array<{
    locationId: string;
    locationName: string;
    fullAddress?: string;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [locationDisplayNames, setLocationDisplayNames] = useState<{[key: string]: string}>({});
  const [expandedLocations, setExpandedLocations] = useState<{[key: string]: boolean}>({});
  const [expandedRoutes, setExpandedRoutes] = useState<{[key: string]: boolean}>({});
  const [driverNotes, setDriverNotes] = useState<string>('');
  const [tripPurpose, setTripPurpose] = useState<string>('');
  const [specialRemarks, setSpecialRemarks] = useState<string>('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [showNotesSuccess, setShowNotesSuccess] = useState(false);

  const handleEditLocationName = (locationId: string, currentName: string) => {
    setEditingLocationId(locationId);
    // Get the current display name or use the first part of the full address
    const currentDisplayName = locationDisplayNames[locationId] || currentName.split(',')[0];
    setEditingLocationName(currentDisplayName);
    
    // Select all text in the input field after it's rendered
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.select();
      }
    }, 0);
  };

  const handleSaveLocationName = async (locationId: string) => {
    if (!editingLocationName.trim() || !tripData) {
      setEditingLocationId(null);
      setEditingLocationName('');
      return;
    }

    try {
      // Update the locations array with the new display name
      const updatedLocations = tripData.locations.map(loc => 
        loc.id === locationId 
          ? { ...loc, displayName: editingLocationName.trim() }
          : loc
      );

      // Save to database
      const { error: updateError } = await supabase
        .from('trips')
        .update({ locations: updatedLocations })
        .eq('id', tripId);

      if (updateError) {
        console.error('Error saving location name:', updateError);
        setEditingLocationId(null);
        setEditingLocationName('');
        return;
      }

      // Update local state
      setTripData({
        ...tripData,
        locations: updatedLocations
      });

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

  const handleSaveNotes = async () => {
    if (!tripId) return;

    try {
      setIsSavingNotes(true);
      
      console.log('Saving notes with values:', {
        driverNotes,
        tripPurpose,
        specialRemarks,
        tripId
      });
      
      const updateData: any = {
        driver_notes: driverNotes
      };
      
      // Only include new fields if they have values
      if (tripPurpose) {
        updateData.trip_purpose = tripPurpose;
      }
      if (specialRemarks) {
        updateData.special_remarks = specialRemarks;
      }
      
      console.log('Update data:', updateData);
      
      // First check if the trip exists
      const { data: existingTrip, error: fetchError } = await supabase
        .from('trips')
        .select('id')
        .eq('id', tripId)
        .single();
        
      if (fetchError) {
        console.error('Error fetching trip:', fetchError);
        return;
      }
      
      if (!existingTrip) {
        console.error('Trip not found with ID:', tripId);
        return;
      }
      
      const { error: updateError } = await supabase
        .from('trips')
        .update(updateData)
        .eq('id', tripId);

      if (updateError) {
        console.error('Error saving notes:', updateError);
        console.error('Update data:', updateData);
        console.error('Trip ID:', tripId);
        return;
      }

      setIsEditingNotes(false);
      setShowNotesSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setShowNotesSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      setIsSavingNotes(false);
    }
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
        setDriverNotes(data.driver_notes || '');
        setTripPurpose(data.trip_purpose || '');
        setSpecialRemarks(data.special_remarks || '');
        
        // Populate location display names from database
        const displayNames: {[key: string]: string} = {};
        tripData.locations.forEach((loc: any) => {
          // Use the location name (which is now the purpose) as the display name
          if (loc.name) {
            displayNames[loc.id] = loc.name;
          }
        });
        setLocationDisplayNames(displayNames);
        
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
            <>
              {/* Notes for the Driver */}
              <div className="rounded-md p-6 border-2 border-border bg-card mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-card-foreground">
                    Notes for the Driver
                  </h3>
                  <div className="flex items-center gap-2">
                    {showNotesSuccess && (
                      <div className="flex items-center gap-2 text-sm font-medium animate-fadeIn" style={{ color: '#18815A' }}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Saved successfully!</span>
                      </div>
                    )}
                    {!isEditingNotes ? (
                      <Button
                        onClick={() => setIsEditingNotes(true)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Edit
                      </Button>
                    ) : (
                      <Button
                        onClick={handleSaveNotes}
                        disabled={isSavingNotes}
                        size="sm"
                        className="flex items-center gap-2"
                        style={{ backgroundColor: '#18815A', color: '#FFFFFF' }}
                      >
                        {isSavingNotes ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Save
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Two Subboxes */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Trip Purpose & Expectations */}
                  <div className="bg-background/20 border-2 border-background/30 rounded-md p-4">
                    <h4 className="text-base font-bold text-card-foreground mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Operational Details
                    </h4>
                    {isEditingNotes ? (
                      <textarea
                        value={tripPurpose}
                        onChange={(e) => setTripPurpose(e.target.value)}
                        placeholder="Describe operational details: service requirements, timing constraints, client expectations, and protocols the driver needs to know..."
                        className="w-full min-h-[100px] p-3 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y text-sm"
                      />
                    ) : (
                      <div className="min-h-[100px] p-3 rounded-md border border-border bg-background/50">
                        {tripPurpose ? (
                          <p className="text-muted-foreground whitespace-pre-wrap text-sm">{tripPurpose}</p>
                        ) : (
                          <p className="text-muted-foreground/50 italic text-sm">No operational details specified yet.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Special Remarks */}
                  <div className="bg-background/20 border-2 border-background/30 rounded-md p-4">
                    <h4 className="text-base font-bold text-card-foreground mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      Special Remarks
                    </h4>
                    {isEditingNotes ? (
                      <textarea
                        value={specialRemarks}
                        onChange={(e) => setSpecialRemarks(e.target.value)}
                        placeholder="Add any special instructions, sensitivities, or important details for the driver..."
                        className="w-full min-h-[100px] p-3 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y text-sm"
                      />
                    ) : (
                      <div className="min-h-[100px] p-3 rounded-md border border-border bg-background/50">
                        {specialRemarks ? (
                          <p className="text-muted-foreground whitespace-pre-wrap text-sm">{specialRemarks}</p>
                        ) : (
                          <p className="text-muted-foreground/50 italic text-sm">No special remarks added yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Potential Trip Disruptions */}
              <div className="rounded-md p-6 border-2 border-primary text-primary-foreground mb-6" style={{ backgroundColor: '#05060A' }}>
                <h3 className="text-lg font-bold text-primary-foreground mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Potential Trip Disruptions
                </h3>

                {/* 3 Subboxes */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-background/20 border-2 border-background/30 rounded-md p-4">
                    <h4 className="text-base font-bold text-primary-foreground mb-3">
                      Top Disruptor
                    </h4>
                    <p className="text-sm text-primary-foreground/70 leading-relaxed">
                  {executiveReport.topDisruptor}
                </p>
              </div>
                  <div className="bg-background/20 border-2 border-background/30 rounded-md p-4">
                    <h4 className="text-base font-bold text-primary-foreground mb-3">
                    Driving Risks
                    </h4>
                  <ul className="space-y-2">
                    {executiveReport.routeDisruptions.drivingRisks.map((risk: string, idx: number) => (
                        <li key={idx} className="text-sm text-primary-foreground/70 flex items-start gap-2">
                          <span className="text-primary-foreground flex-shrink-0 mt-1">▸</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                  <div className="bg-background/20 border-2 border-background/30 rounded-md p-4">
                    <h4 className="text-base font-bold text-primary-foreground mb-3">
                      Other Disruptions
                    </h4>
                  <ul className="space-y-2">
                    {executiveReport.routeDisruptions.externalDisruptions.map((disruption: string, idx: number) => (
                        <li key={idx} className="text-sm text-primary-foreground/70 flex items-start gap-2">
                          <span className="text-primary-foreground flex-shrink-0 mt-1">▸</span>
                        <span>{disruption}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

              {/* Risk Summary with Trip Risk Score */}
              <div className="rounded-md p-6 border-2 border-border bg-card mb-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Risk Summary Text */}
                  <div className="lg:col-span-2">
                    <h3 className="text-lg font-bold text-card-foreground mb-3">
                      Risks Summary
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {executiveReport.riskScoreExplanation}
                    </p>
                  </div>
                  
                  {/* Trip Risk Score */}
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <div 
                        className="text-6xl font-bold mb-2"
                        style={{
                          color: (() => {
                            const riskScore = Math.max(0, executiveReport.tripRiskScore);
                            if (riskScore <= 3) return '#18815A'; // Success green - light bg
                            if (riskScore <= 6) return '#D97706'; // Warning orange - light bg
                            return '#B22E2E'; // Error red - light bg
                          })()
                        }}
                      >
                        {Math.max(0, executiveReport.tripRiskScore)}
                        <span className="text-3xl opacity-80">/10</span>
                      </div>
                      <div 
                        className="text-sm font-semibold tracking-wide"
                        style={{
                          color: (() => {
                            const riskScore = Math.max(0, executiveReport.tripRiskScore);
                            if (riskScore <= 3) return '#18815A'; // Success green - light bg
                            if (riskScore <= 6) return '#D97706'; // Warning orange - light bg
                            return '#B22E2E'; // Error red - light bg
                          })()
                        }}
                      >
                        {Math.max(0, executiveReport.tripRiskScore) <= 3 ? 'LOW RISK' :
                         Math.max(0, executiveReport.tripRiskScore) <= 6 ? 'MODERATE RISK' :
                         Math.max(0, executiveReport.tripRiskScore) <= 8 ? 'HIGH RISK' : 'CRITICAL RISK'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendations for the Driver */}
              <div className="rounded-xl p-6 mb-6" style={{ backgroundColor: '#05060A' }}>
                <h3 className="text-xl font-bold text-white mb-4">
                  Recommendations for the Driver
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
            </>
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
              <div key={result.locationId} className="rounded-md p-3 border-2 border-primary text-primary-foreground" style={{ backgroundColor: '#05060A' }}>
                {/* Header with Full Address */}
                <div className="flex items-center justify-between mb-2 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="relative" style={{ width: '30px', height: '35px' }}>
                      <svg 
                        viewBox="0 0 24 24" 
                        fill="white" 
                        stroke="#05060A" 
                        strokeWidth="1.5"
                        style={{ width: '100%', height: '100%' }}
                      >
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: '4px' }}>
                        <span className="font-bold text-xs" style={{ color: '#05060A' }}>
                          {numberToLetter(index + 1)}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      
                       {/* Editable Location Name */}
                      {editingLocationId === result.locationId ? (
                        <Input
                          ref={inputRef}
                          value={editingLocationName}
                          onChange={(e) => setEditingLocationName(e.target.value)}
                          onKeyDown={(e) => handleKeyPress(e, result.locationId)}
                          onBlur={() => handleSaveLocationName(result.locationId)}
                           className="text-base font-semibold bg-background/20 border-primary-foreground/30 text-primary-foreground mt-1 mb-1"
                           placeholder="Enter location name"
                          autoFocus
                        />
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                           <p className="text-base font-semibold text-primary-foreground">
                             {locationDisplayNames[result.locationId] || `Stop ${index + 1}`}
                          </p>
                          <button
                             onClick={() => handleEditLocationName(result.locationId, `Stop ${index + 1}`)}
                            className="p-1 hover:bg-background/20 rounded transition-colors"
                             title="Edit location name"
                          >
                            <svg className="w-4 h-4 text-primary-foreground/70 hover:text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        </div>
                      )}
                      
                      {/* Full Address */}
                      <p className="text-xs text-primary-foreground/70 mt-1">
                        {result.fullAddress || result.locationName}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Safety, Cafes, Parking Info */}
                    <div className="flex items-center gap-4 text-xs text-primary-foreground/80">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span>Safety: {result.data.crime.safetyScore}/100</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span>{result.data.cafes?.summary.total || 0} Cafes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                        <span>{result.data.parking?.carParks?.length || 0} Parking</span>
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


                {/* All Information Cards - Single Row - Only when expanded */}
                <div 
                  className={`overflow-hidden transition-all duration-500 ease-in-out ${
                    expandedLocations[result.locationId] ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                  {/* Traveller Safety */}
                  <div 
                    className="border-2 rounded-md p-3"
                      style={{
                        backgroundColor: (() => {
                          const safetyScore = result.data.crime.safetyScore;
                          if (safetyScore >= 60) return '#45C48A'; // Success green - dark bg
                          if (safetyScore >= 40) return '#F7A733'; // Warning orange - dark bg
                          return '#E05A5A'; // Error red - dark bg
                        })(),
                        borderColor: (() => {
                          const safetyScore = result.data.crime.safetyScore;
                          if (safetyScore >= 60) return '#45C48A';
                          if (safetyScore >= 40) return '#F7A733';
                          return '#E05A5A';
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
                      <div className="text-xs text-primary-foreground/70">No events found</div>
                    )}
                  </div>

                  {/* Nearby Cafes & Parking */}
                  <div className="bg-background/20 border-2 border-background/30 rounded-md p-3">
                    <h4 className="font-bold text-primary-foreground mb-3">Nearby Cafes & Parking</h4>
                    
                    {/* Cafes Section */}
                    <div className="mb-4">
                      <h5 className="text-sm font-semibold text-primary-foreground mb-2">Cafes</h5>
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
                            .slice(0, 2)
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
                                  <div className="text-xs font-medium" style={{ color: '#45C48A' }}>
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
                                  {Math.round(cafe.distance)}m away
                                    </div>
                                </div>
                              </div>
                            );
                          })
                      ) : (
                        <div className="text-xs text-primary-foreground/70">No cafes found</div>
                      )}
                    </div>
                  </div>

                    {/* Parking Section */}
                    <div>
                      <h5 className="text-sm font-semibold text-primary-foreground mb-2">Parking</h5>
                      <div className="text-xs text-primary-foreground/80 mb-2">
                      {result.data.parking?.cpzInfo?.inCPZ ? 'CPZ Zone - Charges Apply' :
                       (result.data.parking?.parkingRiskScore || 5) >= 7 ? 'Limited Street Parking' : 'Good Parking Options'}
                    </div>
                    <div className="space-y-2">
                      {result.data.parking?.carParks && result.data.parking.carParks.length > 0 ? (
                          result.data.parking.carParks.slice(0, 2).map((carPark: any, idx: number) => (
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
                          <div className="text-xs text-primary-foreground/70">No parking data available</div>
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
                            if (delay < 5) return '#45C48A'; // Success green - dark bg (white text)
                            if (delay < 10) return '#F7A733'; // Warning orange - dark bg (white text)
                            return '#E05A5A'; // Error red - dark bg (white text)
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
                            if (delay < 5) return '#18815A'; // Success green - light bg
                            if (delay < 10) return '#D97706'; // Warning orange - light bg
                            return '#B22E2E'; // Error red - light bg
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
                            if (delay < 5) return '#18815A'; // Success green - light bg
                            if (delay < 10) return '#D97706'; // Warning orange - light bg
                            return '#B22E2E'; // Error red - light bg
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
                    button.style.color = '#18815A'; // Success green - light bg
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
              className="text-white"
              style={{ backgroundColor: '#05060A' }}
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


