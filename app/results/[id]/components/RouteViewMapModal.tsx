/**
 * RouteViewMapModal Component
 * 
 * Full-screen modal for viewing the trip route on a map.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import GoogleTripMap from '@/components/GoogleTripMap';

export interface TripLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  time: string;
  safetyScore?: number;
  flightNumber?: string;
  flightDirection?: 'arrival' | 'departure';
}

export interface RouteViewMapModalProps {
  open: boolean;
  onClose: () => void;
  mapLocations: TripLocation[];
  tripDestination: string | null;
}

export function RouteViewMapModal({
  open,
  onClose,
  mapLocations,
  tripDestination,
}: RouteViewMapModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-0 sm:p-4">
      <div className="bg-card dark:bg-[#1f1f21] rounded-none sm:rounded-lg shadow-xl w-full h-full sm:h-[90vh] sm:max-w-6xl flex flex-col border border-border/40">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-semibold">Route View</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">View your trip route on the map</p>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="flex-shrink-0 ml-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="w-full h-full">
            <GoogleTripMap
              locations={mapLocations}
              height="100%"
              compact={false}
              tripDestination={tripDestination || undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

