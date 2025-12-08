import React from 'react';
import { formatLocationDisplay } from '@/lib/helpers/location-formatters';
import { extractFlightNumbers } from '../utils/extraction-helpers';
import { getLondonLocalTime } from '../utils/time-helpers';
import { TimelineRealismWarning } from './TimelineRealismWarning';

interface LocationCardProps {
  location: {
    id?: string;
    name?: string;
    purpose?: string;
    formattedAddress?: string;
    fullAddress?: string;
    address?: string;
    time: string;
    [key: string]: any;
  };
  index: number;
  totalLocations: number;
  driverNotes: string;
  isTripCompleted: () => boolean;
  isTripWithinOneHour: () => boolean;
  findClosestLocation: () => number;
  legRealism?: {
    legIndex: number;
    realismLevel: 'realistic' | 'tight' | 'unrealistic';
    message: string;
  } | null;
}

export const LocationCard: React.FC<LocationCardProps> = ({
  location,
  index,
  totalLocations,
  driverNotes,
  isTripCompleted,
  isTripWithinOneHour,
  findClosestLocation,
  legRealism,
}) => {
  const isActive = !isTripCompleted() && 
    isTripWithinOneHour() && findClosestLocation() === index;

  const locationType = index === 0 
    ? 'Pickup' 
    : index === totalLocations - 1 
      ? 'Drop-off' 
      : 'Resume at';

  const handleAddressClick = () => {
    const address = location.formattedAddress || location.fullAddress || location.address || location.name || '';
    const encodedAddress = encodeURIComponent(address);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

    // Calculate center position for popup
    const width = 800;
    const height = 600;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    window.open(mapsUrl, '_blank', `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`);
  };

  // Format location display with flight numbers
  const formatLocationDisplayWithFlights = () => {
    // Always use fullAddress for display - never fall back to name (purpose)
    const fullAddr = location.formattedAddress || location.fullAddress || location.address;
    if (!fullAddr) {
      // Only if no address exists, show purpose as fallback
      return (
        <div className="text-base sm:text-lg font-semibold text-card-foreground break-words">
          {location.purpose || location.name || 'Unknown location'}
        </div>
      );
    }
    
    const { businessName, restOfAddress } = formatLocationDisplay(fullAddr);
    const flightMap = extractFlightNumbers(driverNotes);

    // Check if this location is an airport and has flight numbers
    const isAirport = businessName.toLowerCase().includes('airport') ||
      businessName.toLowerCase().includes('heathrow') ||
      businessName.toLowerCase().includes('gatwick') ||
      businessName.toLowerCase().includes('stansted') ||
      businessName.toLowerCase().includes('luton');

    let displayBusinessName = businessName;

    if (isAirport && Object.keys(flightMap).length > 0) {
      // Find matching airport in flight map
      const matchingAirport = Object.keys(flightMap).find(airport =>
        businessName.toLowerCase().includes(airport.toLowerCase().replace(' airport', ''))
      );

      if (matchingAirport && flightMap[matchingAirport].length > 0) {
        const flights = flightMap[matchingAirport].join(', ');
        displayBusinessName = `${businessName} for flight ${flights}`;
      }
    }

    // Only show purpose if it's different from the address and meaningful
    const shouldShowPurpose = location.purpose && 
      location.purpose.trim() !== '' &&
      fullAddr.toLowerCase() !== location.purpose.toLowerCase() &&
      businessName.toLowerCase() !== location.purpose.toLowerCase();

    return (
      <div>
        <div className="text-base sm:text-lg font-semibold text-card-foreground break-words">
          {displayBusinessName}
          {shouldShowPurpose && (
            <span className="block sm:inline sm:ml-1"> - {location.purpose}</span>
          )}
        </div>
        {restOfAddress && (
          <div className="text-xs sm:text-sm text-muted-foreground mt-0.5 break-words">
            {restOfAddress}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div id={`location-${index}`} className="flex items-start gap-2 sm:gap-3 relative z-10">
        <div
          className={`flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold border-2 border-background ${
            isActive
              ? 'animate-live-pulse text-white'
              : 'bg-primary text-primary-foreground'
          }`}
        >
          {String.fromCharCode(65 + index)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-0">
            <div className="w-full sm:w-28 md:w-32 flex-shrink-0">
              <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span>{locationType}</span>
                {isActive && (
                  <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold text-white bg-[#3ea34b] rounded">
                    LIVE
                  </span>
                )}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                {getLondonLocalTime(location.time)}
              </div>
            </div>
            <div className="flex-1 min-w-0 sm:ml-8 md:ml-12">
              <button
                onClick={handleAddressClick}
                className="text-left hover:text-primary transition-colors cursor-pointer block w-full"
                title={location.formattedAddress || location.fullAddress || location.address || location.name}
              >
                {formatLocationDisplayWithFlights()}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Realism Warning - Show between locations (only for tight/unrealistic) */}
      {index < totalLocations - 1 && legRealism && (
        <TimelineRealismWarning
          legRealism={legRealism}
          isTripCompleted={isTripCompleted}
        />
      )}
    </div>
  );
};

