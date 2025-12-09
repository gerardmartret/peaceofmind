import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FlowHoverButton } from '@/components/ui/flow-hover-button';
import { Car, Maximize2, Loader2 } from 'lucide-react';
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
  tripId: string;
  
  // UI state
  theme: 'light' | 'dark' | undefined;
  mounted: boolean;
  
  // Handlers
  onStatusToggle: () => void;
  onShowDriverModal: () => void;
  onShowMapModal: () => void;
  onShowSignupModal: () => void;
  
  // Drivania quote info
  lowestDrivaniaPrice: number | null;
  drivaniaCurrency: string | null;
  lowestExtraHourPrice: number | null;
  loadingDrivaniaQuote: boolean;
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
  tripId,
  theme,
  mounted,
  onStatusToggle,
  onShowDriverModal,
  onShowMapModal,
  onShowSignupModal,
  lowestDrivaniaPrice,
  drivaniaCurrency,
  lowestExtraHourPrice,
  loadingDrivaniaQuote,
}) => {
  const router = useRouter();
  const numberOfPassengers = passengerCount || 1;
  const vehicleType = determineVehicleType(vehicleInfo, driverNotes, numberOfPassengers, tripDestination);

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
      return theme === 'light' ? "/Vehicles/light-brief-sclass-web.png" : "/Vehicles/dark-brief-sclass-web.png";
    }
    
    // Otherwise, use normal logic (default to dark if theme is undefined)
    const isLight = theme === 'light';
    return vehicleType === 'van' 
      ? (isLight ? "/Vehicles/light-brief-vclass-web.png" : "/Vehicles/dark-brief-vclass-web.png")
      : vehicleType === 'minibus' 
        ? (isLight ? "/Vehicles/light-brief-sprinter-web.png" : "/Vehicles/dark-brief-sprinter-web.png")
        : vehicleType === 'luxury-suv'
          ? (isLight ? "/Vehicles/light-brief-range-web.png" : "/Vehicles/dark-brief-range-web.png")
          : vehicleType === 'suv' 
            ? (isLight ? "/Vehicles/light-brief-escalade-web.png" : "/Vehicles/dark-brief-escalade-web.png")
            : vehicleType === 'signature-sedan'
              ? (isLight ? "/Vehicles/light-brief-phantom-web.png" : "/Vehicles/dark-brief-phantom-web.png")
              : vehicleType === 'premium-sedan'
                ? (isLight ? "/Vehicles/light-brief-sclass-web.png" : "/Vehicles/dark-brief-sclass-web.png")
                : vehicleType === 'comfort-sedan'
                  ? (isLight ? "/Vehicles/light-brief-camry-web.png" : "/Vehicles/dark-brief-camry-web.png")
                  : (isLight ? "/Vehicles/light-brief-eclass-web.png" : "/Vehicles/dark-brief-eclass-web.png");
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
      <div className="mb-6 bg-card rounded-lg p-4 sm:p-6 lg:p-8 shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 lg:gap-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-normal text-card-foreground mb-4 sm:mb-5 leading-tight break-words">
              {leadPassengerName || 'Passenger'} (x{passengerCount || 1}) {tripDuration} in {tripDestination || 'London'}
            </h2>
            <div className="flex items-center gap-2 sm:gap-3 mb-1.5">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-card-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs sm:text-sm font-normal text-card-foreground">
                Trip Date{' '}
                <span className="text-base sm:text-lg lg:text-xl font-semibold ml-1 sm:ml-2">
                  {new Date(tripDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-card-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-xs sm:text-sm font-normal text-card-foreground">
                Number of Passengers{' '}
                <span className="text-base sm:text-lg lg:text-xl font-semibold ml-1 sm:ml-2">
                  {passengerCount || 1}
                </span>
              </span>
            </div>
            {/* Status and Assign Driver buttons - Show for owners and drivers with token */}
            {(isOwner || (driverToken && validatedDriverEmail)) && (
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-5">
                {((tripStatus !== 'not confirmed' && tripStatus !== 'pending' && tripStatus !== 'confirmed' && !(tripStatus === 'booked' && driverEmail === 'drivania')) || (driverToken && validatedDriverEmail && tripStatus === 'pending')) ? (
                  <div className="relative inline-block">
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
                ) : null}
                    {!(isDriverView && driverToken) && quoteParam !== 'true' && !(tripStatus === 'booked' && driverEmail === 'drivania') && (
                        <div className="relative inline-block">
                          <Button
                            variant="outline"
                      className={`h-10 ${tripStatus === 'cancelled'
                              ? 'border !border-gray-400 opacity-50 cursor-not-allowed'
                              : driverEmail && tripStatus === 'pending'
                                ? 'border !border-[#e77500] hover:bg-[#e77500]/10'
                                : driverEmail
                                  ? ''
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
                            {mounted && (
                              <>
                                {driverEmail ? (
                                  <img
                                    src={theme === 'dark' ? "/driver-dark.png" : "/driver-light.png"}
                                    alt="Driver"
                                    className="w-4 h-4"
                                  />
                                ) : (
                                  <img
                                    src={theme === 'dark' ? "/driver-fav-light.svg" : "/driver-fav-dark.svg"}
                                    alt="Driver"
                                    className="w-4 h-4"
                                  />
                                )}
                              </>
                            )}
                            {tripStatus === 'cancelled' ? 'Driver released' : driverEmail && tripStatus === 'pending' ? 'Driver requested' : driverEmail && (tripStatus === 'confirmed' || tripStatus === 'booked') ? 'Driver assigned' : driverEmail ? 'Driver assigned' : quotes.length > 0 ? 'Quoted' : sentDriverEmails.length > 0 ? 'Quote requested' : 'Assign my own driver'}
                          </Button>
                          {/* Show badge for quotes when no driver assigned */}
                          {quotes.length > 0 && !driverEmail && tripStatus !== 'cancelled' && (
                            <span className="absolute -top-2 -right-2 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold text-white bg-[#9e201b] rounded-full animate-pulse">
                              {quotes.length}
                            </span>
                          )}
                        </div>
                )}
              </div>
            )}
          </div>
          <div className="flex-shrink-0 flex flex-col items-stretch sm:items-end gap-3 w-full sm:w-auto">
            {/* Show status badge for booked Drivania trips at top right (consistent with other reports) */}
            {tripStatus === 'booked' && driverEmail === 'drivania' && (
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
            )}
            {/* Show confirmation button with driver quote when driver is selected, otherwise show Book with Drivania */}
            {isOwner && tripStatus !== 'booked' && driverEmail !== 'drivania' && !(isDriverView && driverToken) && quoteParam !== 'true' && (
              <div className="w-full sm:w-[220px] flex flex-col items-stretch sm:items-end gap-2">
                {driverEmail ? (
                  <>
                    <div className="w-full">
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
                        className="w-full !h-auto !px-4 sm:!px-6 !py-3 sm:!py-3.5 !text-base sm:!text-lg lg:!text-xl !font-medium min-h-[48px] sm:min-h-[52px] rounded-lg"
                      />
                    </div>
                    {(() => {
                      const driverQuote = quotes.find((q: any) => q.email.toLowerCase() === driverEmail.toLowerCase());
                      return driverQuote ? (
                        <div className="flex flex-col items-end gap-1">
                          <div className="text-2xl font-semibold text-foreground text-right">
                            {(() => {
                              const formattedNumber = new Intl.NumberFormat('en-GB', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(driverQuote.price);
                              return `${formattedNumber} ${driverQuote.currency || 'USD'}`;
                            })()}
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </>
                ) : (
                  <>
                    <FlowHoverButton
                      onClick={() => {
                        if (!isAuthenticated) {
                          onShowSignupModal();
                          return;
                        }
                        router.push(`/booking/${tripId}`);
                      }}
                      disabled={loadingDrivaniaQuote}
                      variant="rejected"
                      className="w-full !h-auto disabled:opacity-70 disabled:cursor-not-allowed !px-4 sm:!px-6 !py-3 sm:!py-3.5 !text-base sm:!text-lg lg:!text-xl !font-medium min-h-[48px] sm:min-h-[52px] rounded-lg !bg-[#05060A] dark:!bg-[#E5E7EF] !border-[#05060A] dark:!border-[#E5E7EF] !text-white dark:!text-[#05060A] hover:!bg-[#05060A]/90 dark:hover:!bg-[#E5E7EF]/90 before:!bg-[#05060A]/80 dark:before:!bg-[#E5E7EF]/80"
                    >
                      {loadingDrivaniaQuote ? (
                        <span className="flex items-center justify-center gap-2 text-sm sm:text-base lg:text-lg">
                          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                          <span className="hidden sm:inline">Quoting trip</span>
                          <span className="sm:hidden">Quoting...</span>
                        </span>
                      ) : (
                        <span className="text-[1.15rem] sm:text-[1.29375rem] lg:text-[1.4375rem]">Book Now</span>
                      )}
                    </FlowHoverButton>
                    {!loadingDrivaniaQuote && lowestDrivaniaPrice !== null && (
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-2xl font-semibold text-foreground text-right">
                          {(() => {
                            const formattedNumber = new Intl.NumberFormat('en-GB', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(lowestDrivaniaPrice);
                            return `${formattedNumber} ${drivaniaCurrency || 'USD'}`;
                          })()}
                        </div>
                        {lowestExtraHourPrice !== null && (
                          <div className="text-sm font-medium text-muted-foreground text-right">
                            {(() => {
                              const formattedNumber = new Intl.NumberFormat('en-GB', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(lowestExtraHourPrice);
                              return `${formattedNumber} ${drivaniaCurrency || 'USD'} per extra hour`;
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vehicle Image - Show for sedan or SUV services */}
      {vehicleType && (
        <div className="-mt-4 sm:-mt-6 lg:-mt-8">
          <Card className="shadow-none border-none mb-6">
            <CardContent className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-4 gap-y-4 lg:gap-y-0">
                {/* Left Column - Vehicle Box (spans 2 columns) */}
                <Card className="shadow-none lg:col-span-2 -my-0">
                  <CardContent className="pl-2 sm:pl-4 lg:pl-0 pr-2 sm:pr-4 lg:pr-5 pt-4 sm:pt-6 lg:pt-0 pb-4 sm:pb-6 lg:pb-0 relative flex items-center">

                    {/* Vehicle Image and Info */}
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 lg:gap-6 items-center sm:items-center w-full m-0">
                      {/* Vehicle Image */}
                      <img
                        src={getVehicleImagePath()}
                        alt={getVehicleAltText()}
                        className="h-[120px] sm:h-[160px] md:h-[180px] lg:h-[216px] w-auto flex-shrink-0 pl-0 sm:pl-2 lg:pl-[10px]"
                      />

                      {/* Vehicle Info */}
                      <div className="flex flex-col flex-1 min-w-0 pb-0 mt-0 sm:mt-0 lg:mt-32 text-center sm:text-left">
                        <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3 mb-2">
                          <Car className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs sm:text-sm text-muted-foreground font-medium">Vehicle</span>
                        </div>
                        <p className="text-xl sm:text-2xl md:text-3xl font-semibold text-card-foreground break-words">
                          {getVehicleDisplayName()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Right Column - Map Box (1 column) */}
                <div className="block relative mt-4 lg:mt-0 lg:col-span-1">
                  <div className="h-[250px] sm:h-[300px] lg:h-full lg:min-h-[200px] rounded-lg overflow-hidden border border-border">
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

