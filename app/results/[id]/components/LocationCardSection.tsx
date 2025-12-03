import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LocationCard } from './LocationCard';
import { calculateTimelineRealism } from '../utils/risk-helpers';

interface LocationCardSectionProps {
  locations: Array<{
    id?: string;
    name?: string;
    purpose?: string;
    formattedAddress?: string;
    fullAddress?: string;
    address?: string;
    time: string;
    [key: string]: any;
  }>;
  tripDate: string;
  trafficPredictions: { success: boolean; data: Array<any> } | null;
  driverNotes: string;
  isLiveMode: boolean;
  activeLocationIndex: number | null;
  tripData: {
    tripDate?: string;
    passengerCount?: number;
    tripDestination?: string;
    [key: string]: any;
  } | null;
  passengerCount: number;
  tripDestination: string;
  quoteParam: string | null;
  isAuthenticated: boolean;
  
  // Functions
  isTripCompleted: () => boolean;
  isTripWithinOneHour: () => boolean;
  findClosestLocation: () => number;
  startLiveTrip: () => void;
  stopLiveTrip: () => void;
  
  // Handlers
  onShowSignupModal: () => void;
  onShowEditRouteModal: () => void;
  onShowMapModal: () => void;
  onSetEditingLocations: (locations: any[]) => void;
  onSetEditingTripDate: (date: Date) => void;
  onSetPassengerCount: (count: number) => void;
  onSetTripDestination: (destination: string) => void;
}

export const LocationCardSection: React.FC<LocationCardSectionProps> = ({
  locations,
  tripDate,
  trafficPredictions,
  driverNotes,
  isLiveMode,
  activeLocationIndex,
  tripData,
  passengerCount,
  tripDestination,
  quoteParam,
  isAuthenticated,
  isTripCompleted,
  isTripWithinOneHour,
  findClosestLocation,
  startLiveTrip,
  stopLiveTrip,
  onShowSignupModal,
  onShowEditRouteModal,
  onShowMapModal,
  onSetEditingLocations,
  onSetEditingTripDate,
  onSetPassengerCount,
  onSetTripDestination,
}) => {
  // Calculate timeline realism once for all legs
  const timelineRealism = calculateTimelineRealism(locations, trafficPredictions, tripDate);

  const handleEditTrip = () => {
    // Block modals when viewing via quote request link
    if (quoteParam === 'true') {
      return;
    }

    // Check if user is authenticated - if not, show signup modal
    if (!isAuthenticated) {
      onShowSignupModal();
      return;
    }

    // Pre-fill modal with current trip data - preserve name (purpose) and fullAddress
    onSetEditingLocations(locations.map((loc, idx) => ({
      location: (loc as any).fullAddress || loc.name,
      formattedAddress: (loc as any).fullAddress || (loc as any).formattedAddress || '', // Never fall back to name (purpose)
      lat: loc.lat,
      lng: loc.lng,
      time: loc.time,
      purpose: loc.name || '', // Store original name (purpose) to preserve it
      confidence: 'high',
      verified: true,
      placeId: `stable-id-${idx}-${Date.now()}`,
    })));
    
    // Initialize editing trip date from current trip data
    if (tripData?.tripDate) {
      // Parse the date string to Date object (handle ISO format)
      try {
        const dateToSet = new Date(tripData.tripDate);
        if (!isNaN(dateToSet.getTime())) {
          onSetEditingTripDate(dateToSet);
        }
      } catch (e) {
        console.error('Error parsing trip date:', e);
      }
    }
    
    // Ensure passenger count is initialized from current trip data (default to 1 if not set)
    const initialPassengerCount = tripData?.passengerCount !== undefined && tripData.passengerCount !== null
      ? tripData.passengerCount
      : (passengerCount > 0 ? passengerCount : 1);
    onSetPassengerCount(initialPassengerCount);
    
    // Ensure trip destination is set for display
    const initialTripDestination = tripDestination || tripData?.tripDestination || '';
    if (initialTripDestination) {
      onSetTripDestination(initialTripDestination);
    }
    
    onShowEditRouteModal();
  };

  const handleTitleClick = () => {
    const tripCompleted = isTripCompleted();
    if (tripCompleted) return;
    if (isLiveMode) {
      stopLiveTrip();
    } else {
      startLiveTrip();
    }
  };

  const handleTripBreakdownClick = () => {
    const tripCompleted = isTripCompleted();
    if (tripCompleted) return;
    if (isLiveMode) {
      stopLiveTrip();
    } else {
      startLiveTrip();
    }
  };

  const now = new Date();
  const tripDateTime = new Date(tripDate);
  const oneHourBefore = new Date(tripDateTime.getTime() - 60 * 60 * 1000);
  const isLiveTripActive = now >= oneHourBefore;
  const tripCompleted = isTripCompleted();

  return (
    <Card className="mb-6 shadow-none">
      <CardContent className="px-6 pt-3 pb-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h3
            className={`text-xl font-semibold text-card-foreground ${
              tripCompleted
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer hover:text-primary transition-colors'
            }`}
            onClick={handleTitleClick}
          >
            Trip Locations
          </h3>

          {/* Action Buttons - Right Side */}
          <div className="flex items-center gap-2">
            {/* Trip Breakdown Button - Only show when live */}
            {isLiveMode && (
              <Button
                variant={tripCompleted ? "outline" : (isLiveTripActive ? "default" : "outline")}
                size="sm"
                disabled={tripCompleted}
                className={`flex items-center gap-2 ${
                  tripCompleted
                    ? 'opacity-50 cursor-not-allowed'
                    : isLiveTripActive
                      ? 'bg-[#3ea34b] text-white hover:bg-[#359840] border-[#3ea34b]'
                      : ''
                }`}
                onClick={handleTripBreakdownClick}
              >
                {tripCompleted ? (
                  <span>Completed</span>
                ) : isLiveTripActive ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                    <span>{isLiveMode ? 'Stop Live Trip' : 'Live Trip'}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Trip Breakdown
                  </>
                )}
              </Button>
            )}

            {/* Edit trip Button */}
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={handleEditTrip}
            >
              Edit trip
            </Button>

            {/* View Map Button */}
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={onShowMapModal}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </Button>
          </div>
        </div>
        
        <div className="relative">
          {/* Connecting Line */}
          <div
            className="absolute w-px bg-primary/30"
            style={{
              height: `${(locations.length - 1) * 4.5}rem - 1.5rem`,
              left: '0.75rem',
              top: '0.75rem'
            }}
          ></div>

          {/* Transparent Line After Drop-off */}
          <div
            className="absolute w-px bg-transparent"
            style={{
              height: '1.5rem',
              left: '0.75rem',
              top: `${(locations.length - 1) * 4.5}rem`
            }}
          ></div>

          <div className="space-y-3">
            {locations.map((location: any, index: number) => {
              // Find realism data for this leg
              const legRealism = timelineRealism.find(r => r.legIndex === index);

              return (
                <LocationCard
                  key={location.id || index}
                  location={location}
                  index={index}
                  totalLocations={locations.length}
                  driverNotes={driverNotes}
                  isLiveMode={isLiveMode}
                  activeLocationIndex={activeLocationIndex}
                  isTripCompleted={isTripCompleted}
                  isTripWithinOneHour={isTripWithinOneHour}
                  findClosestLocation={findClosestLocation}
                  onStartLiveTrip={startLiveTrip}
                  legRealism={legRealism || null}
                />
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

