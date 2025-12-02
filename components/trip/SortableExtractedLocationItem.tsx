'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Label } from '@/components/ui/label';
import { TimePicker } from '@/components/ui/time-picker';
import GoogleLocationSearch from '@/components/GoogleLocationSearch';
import { formatLocationDisplay } from '@/lib/helpers/location-formatters';
import { numberToLetter } from '@/lib/helpers/string-helpers';

export interface SortableExtractedLocationItemProps {
  location: {
    location: string;
    time: string;
    confidence: string;
    purpose: string;
    verified: boolean;
    formattedAddress: string;
    lat: number;
    lng: number;
    placeId: string | null;
  };
  index: number;
  totalLocations: number;
  onLocationSelect: (index: number, location: any) => void;
  onTimeChange: (index: number, time: string) => void;
  onPurposeChange: (index: number, purpose: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  editingIndex: number | null;
  editingField: 'location' | 'time' | 'purpose' | null;
  onEditStart: (index: number, field: 'location' | 'time' | 'purpose') => void;
  onEditEnd: () => void;
  tripDestination?: string; // Add trip destination for city-aware location search
  showValidationMessages?: boolean; // Show validation messages when button is clicked but disabled
}

export function SortableExtractedLocationItem({
  location,
  index,
  totalLocations,
  onLocationSelect,
  onTimeChange,
  onPurposeChange,
  onRemove,
  canRemove,
  editingIndex,
  editingField,
  onEditStart,
  onEditEnd,
  tripDestination,
  showValidationMessages = false,
}: SortableExtractedLocationItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: location.location });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Determine time label based on position
  const getTimeLabel = () => {
    if (index === 0) return 'Pickup time';
    if (index === totalLocations - 1) return 'Dropoff time';
    return 'Resume at';
  };

  // Check if location is non-specific (just city name or matches tripDestination)
  // Google Maps always provides coordinates, even for vague locations (returns city center coordinates)
  // So we check if the location text matches only the city name pattern
  const isNonSpecificLocation = () => {
    if (!tripDestination) return false;

    const locationText = (location.formattedAddress || location.location || '').toLowerCase().trim();
    const destinationText = tripDestination.toLowerCase().trim();

    // Check if location matches trip destination exactly (city name only)
    if (locationText === destinationText) return true;

    // Check if location is just the city name with optional country suffix
    // Handles formats like: "London UK", "London, UK", "london uk", "London, United Kingdom", etc.
    // Pattern: city name + optional space/comma + optional country code/name
    // When location is vague, Google Maps returns city center coordinates, so we detect by text pattern
    const cityOnlyPattern = new RegExp(`^${destinationText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s*,\\s*|\\s+)?(uk|usa|us|united\\s+kingdom|united\\s+states|france|deutschland|germany|singapore|japan|switzerland)?$`, 'i');

    if (cityOnlyPattern.test(locationText)) {
      return true;
    }

    // Check for non-specific addresses: place name + city + country WITHOUT postcode or detailed street address
    // This handles cases like "Some Place, Paris, France" where there's no postcode or street address

    // Define postcode patterns for different cities
    const postcodePatterns: { [key: string]: RegExp } = {
      'paris': /\b\d{5}\b/, // French postcodes: 5 digits (e.g., 75001, 75002)
      'london': /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}|\b(?:EC|WC|SW|SE|NW|N|E|W|W1|SW1|EC1|WC1)[0-9]{1,2}[A-Z]{0,2}\b)/i, // UK postcodes
      'new york': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes: 5 or 9 digits
      'boston': /\b\d{5}(?:-\d{4})?\b/, // US ZIP codes
      'singapore': /\b\d{6}\b/, // Singapore postcodes: 6 digits
      'frankfurt': /\b\d{5}\b/, // German postcodes: 5 digits
      'tokyo': /\b\d{3}-?\d{4}\b/, // Japanese postcodes: 3-4 digits with optional hyphen
      'zurich': /\b\d{4}\b/, // Swiss postcodes: 4 digits
    };

    const cityKey = destinationText.toLowerCase();
    const postcodePattern = postcodePatterns[cityKey];

    // Check if address contains a postcode
    const hasPostcode = postcodePattern ? postcodePattern.test(locationText) : false;

    // Check if address has street-level detail (numbers, street names like "rue", "avenue", "street", "st", "ave", etc.)
    const hasStreetDetail = /\b(\d+\s*(rue|avenue|boulevard|bd|street|st|avenue|ave|road|rd|lane|ln|drive|dr|way|path|close|plaza|place|pl|square|sq|row|court|ct|terrace|ter|gardens|gdn|park|crescent|cr|circle|cir|view|rise|heights|hill|manor|villas|walk|villa|mews|gate|quay|wharf|dock|bridge|passage|alley|mews|yards|grove|wood|green|mount|maunt|rise|down|dene|vale|end|side|corner|cross|crossing|intersection))\b/i.test(locationText);

    // Check if address contains the city name but appears to be incomplete
    // This handles cases like "Some Place, Paris, France" or "Goldman Sachs - New York, NY, USA"
    // where we have a place name + city but no specific street address
    const escapedDestination = destinationText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Check if the location text contains the city name
    const containsCity = new RegExp(escapedDestination, 'i').test(locationText);
    
    if (!containsCity) {
      return false;
    }
    
    // If it contains the city AND lacks postcode AND lacks street detail, 
    // AND it's not just the city name alone (already checked above),
    // then it's likely a non-specific location (place name + city without details)
    // This catches formats like:
    // - "Place Name, City, Country"
    // - "Place Name - City, State, Country"  
    // - "Place Name, City, State, Country"
    if (!hasPostcode && !hasStreetDetail) {
      // Additional check: make sure it's not just the city name (we already checked that above)
      // If it contains the city but has more text (place name), and lacks details, it's incomplete
      const hasPlaceName = locationText.length > destinationText.length + 5; // Rough check: has more than just city name
      if (hasPlaceName) {
        return true;
      }
    }

    return false;
  };

  const hasNonSpecificLocation = isNonSpecificLocation();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card rounded-md p-4 border border-border relative"
    >
      {/* Letter Label - Top Left */}
      <div className="absolute top-2 left-2 text-muted-foreground/40 text-xs font-normal">
        {numberToLetter(index + 1)}
      </div>

      <div className="flex items-center gap-3">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted dark:hover:bg-[#181a23] rounded transition-colors flex items-center"
          title="Drag to reorder"
        >
          <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>

        {/* Time Picker, Location Search, and Purpose */}
        <div className="flex-1 grid sm:grid-cols-[140px_1fr] gap-3">
          {/* Time Picker */}
          <div>
            <Label className="text-xs font-medium text-secondary-foreground mb-1">
              {getTimeLabel()}
            </Label>
            <div className={!location.time || location.time === 'null' || location.time === 'undefined' || location.time.trim() === '' ? 'rounded-md border border-[#e77500] dark:border-[#e77500]' : ''}>
              <TimePicker
                value={location.time}
                onChange={(value) => onTimeChange(index, value)}
                className={`h-9 ${!location.time || location.time === 'null' || location.time === 'undefined' || location.time.trim() === ''
                  ? '!bg-white dark:!bg-[#e77500]/10 border-0'
                  : ''
                  }`}
              />
            </div>
            {showValidationMessages && (!location.time || location.time === 'null' || location.time === 'undefined' || (typeof location.time === 'string' && location.time.trim() === '')) && (
              <p className="text-xs text-[#e77500] dark:text-[#e77500] mt-1">
                Insert time
              </p>
            )}
          </div>

          {/* Location and Purpose Stacked */}
          <div className="min-w-0 space-y-3">
            {/* Location Search */}
            <div>
              <Label className="text-xs font-medium text-secondary-foreground mb-1">Location</Label>
              {editingIndex === index && editingField === 'location' ? (
                <div className="editing-location" data-editing="true">
                  <GoogleLocationSearch
                    currentLocation={`${location.location} - ${location.formattedAddress || location.location}`}
                    tripDestination={tripDestination}
                    onLocationSelect={(loc) => {
                      onLocationSelect(index, loc);
                      onEditEnd();
                    }}
                  />
                </div>
              ) : (
                <div
                  className={`relative px-3 py-2 cursor-pointer hover:bg-muted dark:hover:bg-[#181a23] rounded-md border transition-colors ${hasNonSpecificLocation
                    ? 'bg-white dark:bg-[#e77500]/10 border-[#e77500] dark:border-[#e77500]'
                    : 'bg-background border-input'
                    }`}
                  onClick={() => onEditStart(index, 'location')}
                >
                  <div className="flex items-start gap-3">
                    <svg className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      {hasNonSpecificLocation ? (
                        <div className="text-sm text-card-foreground">
                          Unknown
                        </div>
                      ) : (
                        (() => {
                          const fullAddr = location.formattedAddress || location.location;
                          const { businessName, restOfAddress } = formatLocationDisplay(fullAddr);

                          return (
                            <>
                              <div className="text-sm font-semibold text-card-foreground truncate flex-shrink-0">
                                {businessName || location.location}
                              </div>
                              {restOfAddress && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {restOfAddress}
                                </div>
                              )}
                            </>
                          );
                        })()
                      )}
                    </div>
                    {hasNonSpecificLocation ? (
                      <svg className="w-4 h-4 text-[#e77500] dark:text-[#e77500] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-6 6M9 9l6 6" />
                      </svg>
                    ) : (
                      location.verified && (
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )
                    )}
                  </div>
                </div>
              )}
              {showValidationMessages && hasNonSpecificLocation && (
                <p className="text-xs text-[#e77500] dark:text-[#e77500] mt-1">
                  Please select a specific address
                </p>
              )}
            </div>

            {/* Purpose Field - Hidden */}
            {/* <div>
              <Label className="text-xs font-medium text-secondary-foreground mb-1">Purpose</Label>
              {editingIndex === index && editingField === 'purpose' ? (
                <div className="editing-purpose" data-editing="true">
                  <Input
                    value={location.purpose}
                    onChange={(e) => onPurposeChange(index, e.target.value)}
                    onBlur={onEditEnd}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onEditEnd();
                      }
                    }}
                    className="h-9"
                    autoFocus
                  />
                </div>
              ) : (
                <div 
                  className="relative h-9 flex items-center px-3 cursor-pointer hover:bg-muted dark:hover:bg-[#181a23] rounded-md border border-input bg-background transition-colors"
                  onClick={() => onEditStart(index, 'purpose')}
                >
                  <svg className="w-4 h-4 text-muted-foreground mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  <span className="flex-1 truncate text-base md:text-sm">
                    {location.purpose || 'Click to edit purpose...'}
                  </span>
                </div>
              )}
            </div> */}
          </div>
        </div>

        {/* Delete Button - Far Right */}
        {canRemove && (
          <button
            className="flex-shrink-0 p-2 text-muted-foreground hover:text-destructive transition-colors"
            onClick={() => onRemove(index)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

