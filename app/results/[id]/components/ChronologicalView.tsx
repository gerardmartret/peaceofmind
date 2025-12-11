/**
 * ChronologicalView Component
 * 
 * Displays trip locations and routes in chronological order with a vertical timeline.
 * Shows LocationDetailCard for each location and RouteCard between locations.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { LocationDetailCard } from './LocationDetailCard';
import { RouteCard } from './RouteCard';

export interface ChronologicalViewProps {
  tripResults: Array<{
    locationId: string;
    locationName: string;
    time: string;
    data: any;
    [key: string]: any;
  }>;
  tripDate: string;
  tripDestination: string | null;
  trafficPredictions: {
    success: boolean;
    data: Array<{
      minutes: number;
      minutesNoTraffic: number;
      busyMinutes?: number;
      distance: string;
      [key: string]: any;
    }>;
  } | null;
  isOwner: boolean;
  locationDisplayNames: { [key: string]: string };
  editingLocationId: string | null;
  editingLocationName: string;
  expandedLocations: { [key: string]: boolean };
  expandedRoutes: { [key: string]: boolean };
  driverNotes: string;
  onEditLocationName: (locationId: string, currentName: string) => void;
  onSaveLocationName: (locationId: string) => void;
  onKeyPress: (e: React.KeyboardEvent, locationId: string) => void;
  onToggleLocationExpansion: (locationId: string) => void;
  onToggleRouteExpansion: (routeId: string) => void;
  onEditingLocationNameChange: (value: string) => void;
  onClose: () => void;
}

export function ChronologicalView({
  tripResults,
  tripDate,
  tripDestination,
  trafficPredictions,
  isOwner,
  locationDisplayNames,
  editingLocationId,
  editingLocationName,
  expandedLocations,
  expandedRoutes,
  driverNotes,
  onEditLocationName,
  onSaveLocationName,
  onKeyPress,
  onToggleLocationExpansion,
  onToggleRouteExpansion,
  onEditingLocationNameChange,
  onClose,
}: ChronologicalViewProps) {
  return (
    <div className="relative space-y-4 sm:space-y-6 px-4 sm:px-0" style={{ overflowAnchor: 'none' }}>
      {/* Back Button - Top Right */}
      <div className="sticky top-16 sm:top-20 mb-4 sm:mb-6 flex justify-end z-20">
        <Button
          onClick={onClose}
          size="lg"
          className="flex items-center gap-2 bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] hover:bg-[#05060A]/90 dark:hover:bg-[#E5E7EF]/90 text-sm sm:text-base"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="hidden sm:inline">Back</span>
        </Button>
      </div>

      {/* Connecting Line - Responsive positioning to align with timeline dots */}
      <div className="hidden sm:block absolute left-6 w-0.5 bg-border" style={{ top: '4rem', bottom: 0 }}></div>
      <div className="sm:hidden absolute left-4 w-0.5 bg-border" style={{ top: '3.5rem', bottom: 0 }}></div>

      {/* Location and Route Cards */}
      {tripResults.map((result, index) => (
        <React.Fragment key={result.locationId}>
          <LocationDetailCard
            index={index}
            tripDestination={tripDestination}
            result={result}
            tripDate={tripDate}
            tripResultsLength={tripResults.length}
            isOwner={isOwner}
            locationDisplayNames={locationDisplayNames}
            editingLocationId={editingLocationId}
            editingLocationName={editingLocationName}
            expandedLocations={expandedLocations}
            driverNotes={driverNotes}
            onEditLocationName={onEditLocationName}
            onSaveLocationName={onSaveLocationName}
            onKeyPress={onKeyPress}
            onToggleExpansion={onToggleLocationExpansion}
            onEditingLocationNameChange={onEditingLocationNameChange}
          />

          {/* Route Card (after each location except the last) */}
          {index < tripResults.length - 1 && trafficPredictions && (
            <RouteCard
              index={index}
              tripResults={tripResults}
              trafficPredictions={trafficPredictions}
              tripDate={tripDate}
              tripDestination={tripDestination || ''}
              expandedRoutes={expandedRoutes}
              onToggleExpansion={onToggleRouteExpansion}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

