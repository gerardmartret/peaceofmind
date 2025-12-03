import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Car, Maximize2 } from 'lucide-react';
import GoogleTripMap from '@/components/GoogleTripMap';
import { TripStatusButton } from './TripStatusButton';
import { determineVehicleType, extractCarInfo } from '../utils/vehicle-detection-helpers';
import { getDisplayVehicle } from '@/lib/vehicle-helpers';
import { getLondonLocalTime } from '../utils/time-helpers';

interface TripSummarySectionProps {
  // Trip data
  leadPassengerName: string;
  passengerCount: number;
  tripDate: string;
  tripDestination: string;
  locations: Array<{ id?: string; name?: string; time: string; [key: string]: any }>;
  vehicleInfo: string;
  driverNotes: string;
  mapLocations: Array<{ id: string; name: string; lat: number; lng: number; time: string; safetyScore?: number }>;
  trafficPredictions: { success: boolean; data: Array<{ distance?: string | number; [key: string]: any }>; totalDistance?: string } | null;
  
  // Status and permissions
  tripStatus: string;
  driverResponseStatus: 'accepted' | 'rejected' | null;
  driverEmail: string | null;
  originalDriverEmail: string | null;
  quotes: Array<any>;
  sentDriverEmails: Array<any>;
  isOwner: boolean;
  quoteEmail: string;
  driverToken: string | null;
  validatedDriverEmail: string | null;
  updatingStatus: boolean;
  isDriverView: boolean;
  quoteParam: string | null;
  isAuthenticated: boolean;
  isLiveMode: boolean;
  
  // UI state
  theme: 'light' | 'dark' | undefined;
  mounted: boolean;
  
  // Handlers
  onStatusToggle: () => void;
  onShowDriverModal: () => void;
  onShowMapModal: () => void;
  onShowSignupModal: () => void;
}

export const TripSummarySection: React.FC<TripSummarySectionProps> = ({
  leadPassengerName,
  passengerCount,
  tripDate,
  tripDestination,
  locations,
  vehicleInfo,
  driverNotes,
  mapLocations,
  trafficPredictions,
  tripStatus,
  driverResponseStatus,
  driverEmail,
  originalDriverEmail,
  quotes,
  sentDriverEmails,
  isOwner,
  quoteEmail,
  driverToken,
  validatedDriverEmail,
  updatingStatus,
  isDriverView,
  quoteParam,
  isAuthenticated,
  isLiveMode,
  theme,
  mounted,
  onStatusToggle,
  onShowDriverModal,
  onShowMapModal,
  onShowSignupModal,
}) => {
  const numberOfPassengers = passengerCount || 1;
  const vehicleType = determineVehicleType(vehicleInfo, driverNotes, numberOfPassengers);

  // Calculate trip duration for header
  const tripDuration = (() => {
    if (locations && locations.length >= 2) {
      const pickupTime = parseInt(locations[0]?.time) || 0;
      const dropoffTime = parseInt(locations[locations.length - 1]?.time) || 0;
      const duration = dropoffTime - pickupTime;

      if (duration > 0) {
        const hours = Math.floor(duration);
        return `${hours}h`;
      }
      return '0h';
    }
    return '0h';
  })();

  // Calculate distance from traffic predictions
  const calculateDistance = (): string => {
    // Check if traffic predictions exist and have the correct structure
    if (trafficPredictions?.success && trafficPredictions.data && Array.isArray(trafficPredictions.data) && trafficPredictions.data.length > 0) {
      // Calculate total distance from traffic predictions
      const totalKm = trafficPredictions.data.reduce((total: number, route: any) => {
        if (route.distance) {
          // Parse distance (format: "5.2 km" or just number)
          const distanceStr = typeof route.distance === 'string' ? route.distance : String(route.distance);
          const distanceKm = parseFloat(distanceStr.replace(/[^\d.]/g, ''));
          return total + (isNaN(distanceKm) ? 0 : distanceKm);
        }
        return total;
      }, 0);

      // Convert km to miles (1 km = 0.621371 miles)
      const totalMiles = totalKm * 0.621371;
      return totalMiles > 0 ? totalMiles.toFixed(1) + ' miles' : 'Calculating...';
    }

    // Fallback: try to use totalDistance from trafficPredictions if available
    if (trafficPredictions?.totalDistance) {
      const distanceStr = trafficPredictions.totalDistance;
      const distanceKm = parseFloat(distanceStr.replace(/[^\d.]/g, ''));
      if (!isNaN(distanceKm) && distanceKm > 0) {
        const totalMiles = distanceKm * 0.621371;
        return totalMiles.toFixed(1) + ' miles';
      }
    }

    return 'Calculating...';
  };

  // Calculate trip duration for card
  const calculateTripDuration = (): string => {
    if (locations && locations.length >= 2) {
      const pickupTime = parseInt(locations[0]?.time) || 0;
      const dropoffTime = parseInt(locations[locations.length - 1]?.time) || 0;
      const duration = dropoffTime - pickupTime;

      if (duration > 0) {
        const hours = Math.floor(duration);
        const minutes = Math.round((duration - hours) * 60);
        return `${hours}h ${minutes}m`;
      } else {
        return 'Same day';
      }
    }
    return 'N/A';
  };

  // Get vehicle image path
  const getVehicleImagePath = (): string => {
    // Check if it's a Maybach S-Class - should use S-Class image instead of Phantom
    const vehicleText = (vehicleInfo || driverNotes || '').toLowerCase();
    const isMaybachSClass = 
      /(?:mercedes|merc)\s*maybach\s*s(?:[\s-]*class)?/i.test(vehicleText) ||
      /maybach\s*(?:mercedes|merc)\s*s(?:[\s-]*class)?/i.test(vehicleText);
    
    // If it's Maybach S-Class, use S-Class image
    if (isMaybachSClass) {
      return theme === 'light' ? "/Vehicles/light-brief-sclass-web.png" : "/Vehicles/dark-brief-sclass-web.webp";
    }
    
    // Otherwise, use normal logic (default to dark if theme is undefined)
    const isLight = theme === 'light';
    return vehicleType === 'van' 
      ? (isLight ? "/Vehicles/light-brief-vclass-web.png" : "/Vehicles/dark-brief-vclass-web.webp")
      : vehicleType === 'minibus' 
        ? (isLight ? "/Vehicles/light-brief-sprinter-web.png" : "/Vehicles/dark-brief-sprinter-web.webp")
        : vehicleType === 'suv' 
          ? (isLight ? "/Vehicles/light-brief-escalade-web.png" : "/Vehicles/dark-brief-escalade-web.webp")
          : vehicleType === 'signature-sedan'
            ? (isLight ? "/Vehicles/light-brief-phantom-web.png" : "/Vehicles/dark-brief-phantom.webp")
            : vehicleType === 'premium-sedan'
              ? (isLight ? "/Vehicles/light-brief-sclass-web.png" : "/Vehicles/dark-brief-sclass.webp")
              : (isLight ? "/Vehicles/light-brief-eclass-web.png" : "/Vehicles/dark-brief-eclass-web.webp");
  };

  // Get vehicle display name
  const getVehicleDisplayName = (): string => {
    // If signature sedan, check if specific brand/model was mentioned
    if (vehicleType === 'signature-sedan') {
      const requestedVehicle = vehicleInfo || extractCarInfo(driverNotes) || '';
      const vehicleText = (vehicleInfo || driverNotes || '').toLowerCase();
      
      // Check if specific luxury models are mentioned
      const hasSpecificModel = 
        /(?:mercedes|merc)\s*maybach\s*s/i.test(vehicleText) ||
        /rolls\s*royce\s*ghost/i.test(vehicleText) ||
        /rolls\s*royce\s*phantom/i.test(vehicleText);
      
      // If specific model mentioned, show it; otherwise show "Signature Sedan"
      if (hasSpecificModel && requestedVehicle) {
        return getDisplayVehicle(requestedVehicle, numberOfPassengers);
      } else {
        return 'Signature Sedan';
      }
    }
    
    // First, try to get vehicle from vehicleInfo field or driverNotes
    const requestedVehicle = vehicleInfo || extractCarInfo(driverNotes);

    // Use the helper to determine what to display:
    // - If vehicle is empty or not in whitelist, show auto-selected vehicle
    // - If vehicle is in whitelist, show that vehicle
    return getDisplayVehicle(requestedVehicle, numberOfPassengers);
  };

  // Get vehicle alt text
  const getVehicleAltText = (): string => {
    return vehicleType === 'van' ? "Van Vehicle" : 
      vehicleType === 'minibus' ? "Minibus Vehicle" : 
      vehicleType === 'suv' ? "SUV Vehicle" : 
      vehicleType === 'signature-sedan' ? "Signature Sedan Vehicle" : 
      "Sedan Vehicle";
  };

  return (
    <div className="mb-6 mt-[25px]">
      {/* Trip Summary Box */}
      <div className="mb-6 bg-card rounded-lg p-8 shadow-none">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-5xl font-normal text-card-foreground mb-5 leading-tight">
              {leadPassengerName || 'Passenger'} (x{passengerCount || 1}) {tripDuration} in {tripDestination || 'London'}
            </h2>
            <div className="flex items-center gap-3 mb-3">
              <svg className="w-5 h-5 flex-shrink-0 text-card-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-normal text-card-foreground">
                Trip Date{' '}
                <span className="text-xl font-semibold ml-2">
                  {new Date(tripDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0 text-card-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-sm font-normal text-card-foreground">
                Number of Passengers{' '}
                <span className="text-xl font-semibold ml-2">
                  {passengerCount || 1}
                </span>
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-col items-end">
            <TripStatusButton
              tripStatus={tripStatus}
              driverResponseStatus={driverResponseStatus}
              driverEmail={driverEmail}
              originalDriverEmail={originalDriverEmail}
              quotes={quotes}
              sentDriverEmails={sentDriverEmails}
              isOwner={isOwner}
              quoteEmail={quoteEmail}
              driverToken={driverToken}
              validatedDriverEmail={validatedDriverEmail}
              updatingStatus={updatingStatus}
              onStatusToggle={onStatusToggle}
            />
          </div>
        </div>
      </div>

      {/* Vehicle Image - Show for sedan or SUV services */}
      {vehicleType && (
        <div className="-mt-8">
          <Card className="shadow-none border-none mb-6">
            <CardContent className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-4 gap-y-0">
                {/* Left Column - Vehicle Box (spans 2 columns) */}
                <Card className="shadow-none lg:col-span-2 -my-0">
                  <CardContent className="pl-0 pr-5 pt-0 pb-0 relative flex items-center">
                    {/* Assign Driver button - Top Right - Hide when driver accesses via token (assigned) or quote request link */}
                    {!(isDriverView && driverToken) && quoteParam !== 'true' && (
                      <div className="absolute top-3 right-5">
                        <div className="relative inline-block">
                          <Button
                            variant="outline"
                            className={`flex items-center gap-2 h-10 ${tripStatus === 'cancelled'
                              ? 'border !border-gray-400 opacity-50 cursor-not-allowed'
                              : (tripStatus === 'confirmed' || tripStatus === 'booked') && driverEmail
                                ? 'border !border-[#3ea34b] hover:bg-[#3ea34b]/10'
                                : driverEmail
                                  ? 'border !border-[#e77500] hover:bg-[#e77500]/10'
                                  : ''
                                }`}
                            onClick={() => {
                              // Check if user is authenticated - if not, show signup modal
                              if (!isAuthenticated) {
                                onShowSignupModal();
                                return;
                              }

                              if (tripStatus === 'cancelled') {
                                alert('This trip has been cancelled. Please create a new trip instead.');
                                return;
                              }
                              onShowDriverModal();
                            }}
                            disabled={tripStatus === 'cancelled' || driverEmail === 'drivania'}
                          >
                            {mounted && driverEmail && (
                              <img
                                src={theme === 'dark' ? "/driver-dark.png" : "/driver-light.png"}
                                alt="Driver"
                                className="w-4 h-4"
                              />
                            )}
                            {tripStatus === 'cancelled' ? 'Trip cancelled' : driverEmail ? 'Driver assigned' : quotes.length > 0 ? 'Quoted' : sentDriverEmails.length > 0 ? 'Quote requested' : 'Assign driver'}
                          </Button>
                          {quotes.length > 0 && !driverEmail && tripStatus !== 'cancelled' && (
                            <span className="absolute -top-2 -right-2 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold text-white bg-[#9e201b] rounded-full">
                              {quotes.length}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Vehicle Image and Info */}
                    <div className="flex gap-6 items-center w-full m-0">
                      {/* Vehicle Image on the left */}
                      <img
                        src={getVehicleImagePath()}
                        alt={getVehicleAltText()}
                        className="h-[216px] w-auto flex-shrink-0 pl-[10px]"
                      />

                      {/* Vehicle Info on the right */}
                      <div className="flex flex-col flex-1 min-w-0 pb-0 mt-32">
                        <div className="flex items-center gap-3 mb-2">
                          <Car className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm text-muted-foreground font-medium">Vehicle</span>
                        </div>
                        <p className="text-3xl font-semibold text-card-foreground break-words">
                          {getVehicleDisplayName()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Right Column - Map Box (1 column) */}
                <div className="hidden lg:block relative">
                  <div className="h-full min-h-[200px] rounded-lg overflow-hidden border border-border">
                    <GoogleTripMap
                      locations={mapLocations}
                      height="100%"
                      compact={true}
                      tripDestination={tripDestination}
                    />
                  </div>
                  {/* Expand Map Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm hover:bg-white border-gray-300 text-gray-700 hover:text-gray-900"
                    onClick={onShowMapModal}
                    aria-label="Expand map"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trip Details Cards - Single Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Pickup Time Card */}
        <Card className="shadow-none">
          <CardContent className="p-5 flex flex-col">
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-muted-foreground font-medium">Pickup Time</span>
            </div>
            <p className="text-4xl font-semibold text-card-foreground">
              {locations[0]?.time ? getLondonLocalTime(locations[0].time) : 'N/A'}
            </p>
          </CardContent>
        </Card>

        {/* Trip Duration Card */}
        <Card className="shadow-none">
          <CardContent className="p-5 flex flex-col">
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm text-muted-foreground font-medium">Trip Duration</span>
            </div>
            <p className="text-4xl font-semibold text-card-foreground">
              {calculateTripDuration()}
            </p>
          </CardContent>
        </Card>

        {/* Estimated Distance */}
        <Card className="shadow-none">
          <CardContent className="p-5 flex flex-col">
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm text-muted-foreground font-medium">Estimated Distance</span>
            </div>
            <p className="text-4xl font-semibold text-card-foreground">
              {calculateDistance()}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

