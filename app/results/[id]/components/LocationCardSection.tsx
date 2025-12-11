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
  isOwner: boolean;
  
  // Functions
  isTripCompleted: () => boolean;
  isTripWithinOneHour: () => boolean;
  findClosestLocation: () => number;
  
  // Handlers
  onShowSignupModal: () => void;
  onShowEditRouteModal: () => void;
  onShowMapModal: () => void;
  onSetEditingLocations: (locations: any[]) => void;
  onSetEditingTripDate: (date: Date) => void;
  onSetPassengerCount: (count: number) => void;
  onSetTripDestination: (destination: string) => void;
  onShowChronologicalView: () => void;
}

export const LocationCardSection: React.FC<LocationCardSectionProps> = ({
  locations,
  tripDate,
  trafficPredictions,
  driverNotes,
  tripData,
  passengerCount,
  tripDestination,
  quoteParam,
  isAuthenticated,
  isOwner,
  isTripCompleted,
  isTripWithinOneHour,
  findClosestLocation,
  onShowSignupModal,
  onShowEditRouteModal,
  onShowMapModal,
  onSetEditingLocations,
  onSetEditingTripDate,
  onSetPassengerCount,
  onSetTripDestination,
  onShowChronologicalView,
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
    // Guard: Ensure locations is an array
    if (!Array.isArray(locations) || locations.length === 0) {
      console.error('❌ [LocationCardSection] locations is not an array or is empty:', locations);
      return;
    }
    
    onSetEditingLocations(locations.map((loc, idx) => ({
      location: loc.fullAddress || loc.formattedAddress || loc.address || loc.name,
      formattedAddress: loc.fullAddress || loc.formattedAddress || loc.address || '', // Never fall back to name (purpose)
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


  const now = new Date();
  const tripDateTime = new Date(tripDate);
  const oneHourBefore = new Date(tripDateTime.getTime() - 60 * 60 * 1000);
  const isLiveTripActive = now >= oneHourBefore;
  const tripCompleted = isTripCompleted();

  return (
    <Card className="mb-6 shadow-none">
      <CardContent className="px-3 sm:px-4 md:px-6 pt-3 pb-4 sm:pb-6">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <h3
            className={`text-lg sm:text-xl font-semibold text-card-foreground flex items-center gap-2 ${
              tripCompleted
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer hover:text-primary transition-colors'
            }`}
            onClick={() => {
              if (!tripCompleted) {
                onShowChronologicalView();
              }
            }}
          >
            <span>Trip Locations</span>
            {!tripCompleted && (
              <span className="text-xs sm:text-sm text-muted-foreground font-normal">
                (click to expand)
              </span>
            )}
          </h3>

          {/* Action Buttons - Right Side */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* Edit trip Button - Only shown to owners */}
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
                onClick={handleEditTrip}
              >
                <span className="hidden sm:inline">Edit trip</span>
                <span className="sm:hidden">Edit</span>
              </Button>
            )}

            {/* View Map Button */}
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 sm:gap-2 p-2 sm:px-3"
              onClick={onShowMapModal}
              aria-label="View map"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span className="hidden sm:inline">Map</span>
            </Button>
          </div>
        </div>
        
        <div className="relative">
          {/* Connecting Line */}
          <div
            className="absolute w-px bg-primary/30 left-[0.625rem] sm:left-3"
            style={{
              height: `${(locations.length - 1) * 4.5}rem - 1.5rem`,
              top: '0.75rem'
            }}
          ></div>

          {/* Transparent Line After Drop-off */}
          <div
            className="absolute w-px bg-transparent left-[0.625rem] sm:left-3"
            style={{
              height: '1.5rem',
              top: `${(locations.length - 1) * 4.5}rem`
            }}
          ></div>

          <div className="space-y-3 sm:space-y-4">
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
                  isTripCompleted={isTripCompleted}
                  isTripWithinOneHour={isTripWithinOneHour}
                  findClosestLocation={findClosestLocation}
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

