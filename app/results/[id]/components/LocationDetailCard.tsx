'use client';

import React, { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { numberToLetter } from '@/lib/helpers/string-helpers';
import { formatLocationDisplay } from '@/lib/helpers/location-formatters';
import { getLondonLocalTime } from '../utils/time-helpers';
import { extractFlightNumbers } from '../utils/extraction-helpers';
import type { TripData } from '../types';

interface LocationDetailCardProps {
  index: number;
  result: {
    locationId: string;
    locationName: string;
    fullAddress?: string;
    time: string;
    data: {
      crime: {
        safetyScore: number;
        summary: {
          topCategories: Array<{ category: string }>;
        };
      };
      events: {
        events: Array<{ title: string }>;
        summary: { total: number };
      };
      cafes?: {
        cafes: Array<{
          name: string;
          rating: number;
          userRatingsTotal: number;
          distance?: number;
        }>;
        summary?: {
          total: number;
        };
      };
      parking?: {
        carParks: Array<{
          name: string;
          distance: number;
          operatingHours?: string;
          totalSpaces?: number;
          facilities?: string[];
        }>;
        cpzInfo?: {
          inCPZ: boolean;
          zoneName?: string;
          operatingHours?: string;
          chargeInfo?: string;
        };
        parkingRiskScore?: number;
      };
      emergencyServices?: {
        policeStation?: {
          name: string;
          id: string;
          distance: number;
        };
        hospital?: {
          name: string;
          id: string;
          distance: number;
        };
      };
    };
  };
  tripDate: string;
  tripResultsLength: number;
  isOwner: boolean;
  locationDisplayNames: { [key: string]: string };
  editingLocationId: string | null;
  editingLocationName: string;
  expandedLocations: { [key: string]: boolean };
  driverNotes: string;
  onEditLocationName: (locationId: string, currentName: string) => void;
  onSaveLocationName: (locationId: string) => void;
  onKeyPress: (e: React.KeyboardEvent, locationId: string) => void;
  onToggleExpansion: (locationId: string) => void;
  onEditingLocationNameChange: (value: string) => void;
}

export function LocationDetailCard({
  index,
  result,
  tripDate,
  tripResultsLength,
  isOwner,
  locationDisplayNames,
  editingLocationId,
  editingLocationName,
  expandedLocations,
  driverNotes,
  onEditLocationName,
  onSaveLocationName,
  onKeyPress,
  onToggleExpansion,
  onEditingLocationNameChange,
}: LocationDetailCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isExpanded = expandedLocations[result.locationId] || false;
  const isEditing = isOwner && editingLocationId === result.locationId;

  // Format location display with flight numbers
  const fullAddr = result.fullAddress || result.locationName;
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

  return (
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 w-32 text-right relative">
        {/* Timeline Dot for Location */}
        <div className={`absolute left-2 top-0 w-8 h-8 rounded-full border-2 border-background flex items-center justify-center z-10 bg-primary text-primary-foreground`}>
          <span className="text-base font-bold">{numberToLetter(index + 1)}</span>
        </div>
        <div className="text-base font-bold text-foreground ml-6">
          {getLondonLocalTime(result.time)}
        </div>
        <div className="text-sm text-muted-foreground ml-2">
          {index === 0 ? 'Pick up' : index === tripResultsLength - 1 ? 'Drop off' : 'Resume'}
        </div>
      </div>
      <div className="flex-1">
        <div key={result.locationId} id={`trip-breakdown-${index}`} className="rounded-md p-3 border border-border bg-background dark:bg-[#363636] text-foreground">
          {/* Header with Full Address */}
          <div className="flex items-center justify-between mb-2 pb-2">
            <div className="flex items-center gap-3">
              <div className="relative" style={{ width: '30px', height: '35px' }}>
                <svg
                  viewBox="0 0 24 24"
                  className="fill-foreground stroke-background"
                  strokeWidth="1.5"
                  style={{ width: '100%', height: '100%' }}
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: '4px' }}>
                  <span className="font-bold text-xs text-background">
                    {numberToLetter(index + 1)}
                  </span>
                </div>
              </div>
              <div className="flex-1">
                {/* Editable Location Name - Only for owners */}
                {isEditing ? (
                  <Input
                    ref={inputRef}
                    value={editingLocationName}
                    onChange={(e) => onEditingLocationNameChange(e.target.value)}
                    onKeyDown={(e) => onKeyPress(e, result.locationId)}
                    onBlur={() => onSaveLocationName(result.locationId)}
                    className="text-base font-semibold bg-background/20 border-primary-foreground/30 text-primary-foreground mt-1 mb-1"
                    placeholder="Enter location name"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-base font-semibold text-foreground">
                      {locationDisplayNames[result.locationId] || `Stop ${index + 1}`}
                    </p>
                    {/* Only show edit button for owners */}
                    {isOwner && (
                      <button
                        onClick={() => onEditLocationName(result.locationId, `Stop ${index + 1}`)}
                        className="p-1 hover:bg-muted rounded transition-colors"
                        title="Edit location name"
                      >
                        <svg className="w-4 h-4 text-muted-foreground hover:text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}

                {/* Full Address with Flight Info - Formatted */}
                <div className="mt-1">
                  <p className="text-sm font-semibold text-foreground">
                    {displayBusinessName}
                  </p>
                  {restOfAddress && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {restOfAddress}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Safety, Cafes, Parking Info */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#3ea34b]"></span>
                  <span>Safety: {result.data.crime.safetyScore}/100</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span>{result.data.cafes?.summary?.total || 0} Cafes</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  <span>{result.data.parking?.carParks?.length || 0} Parking</span>
                </div>
              </div>

              {/* Expand/Collapse Button */}
              <button
                onClick={() => onToggleExpansion(result.locationId)}
                className="p-2 hover:bg-muted rounded transition-colors"
                title={isExpanded ? "Collapse details" : "Expand details"}
              >
                <svg
                  className={`w-5 h-5 text-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
            className={`overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
              }`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
              {/* Traveller Safety */}
              <div
                className="border border-border/40 rounded-md p-3"
                style={{
                  backgroundColor: (() => {
                    const safetyScore = result.data.crime.safetyScore;
                    if (safetyScore >= 60) return '#3ea34b';
                    if (safetyScore >= 40) return '#db7304';
                    return '#9e201b';
                  })(),
                  borderColor: (() => {
                    const safetyScore = result.data.crime.safetyScore;
                    if (safetyScore >= 60) return '#3ea34b';
                    if (safetyScore >= 40) return '#db7304';
                    return '#9e201b';
                  })()
                }}
              >
                <h4 className="font-bold text-foreground mb-2">Traveller Safety</h4>
                <div className="flex items-center gap-2 mb-2">
                  {(() => {
                    const safetyScore = result.data.crime.safetyScore;
                    if (safetyScore >= 80) {
                      return (
                        <>
                          <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <div className="text-sm font-semibold text-foreground">Very Safe</div>
                            <div className="text-xs text-muted-foreground">Low crime area with excellent safety record</div>
                          </div>
                        </>
                      );
                    } else if (safetyScore >= 60) {
                      return (
                        <>
                          <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <div className="text-sm font-semibold text-foreground">Safe</div>
                            <div className="text-xs text-muted-foreground">Generally safe with minimal concerns</div>
                          </div>
                        </>
                      );
                    } else if (safetyScore >= 40) {
                      return (
                        <>
                          <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <div>
                            <div className="text-sm font-semibold text-foreground">Moderate</div>
                            <div className="text-xs text-muted-foreground">Mixed safety profile, stay aware</div>
                          </div>
                        </>
                      );
                    } else if (safetyScore >= 20) {
                      return (
                        <>
                          <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <div>
                            <div className="text-sm font-semibold text-foreground">Caution Advised</div>
                            <div className="text-xs text-muted-foreground">Higher crime area, extra caution needed</div>
                          </div>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <div className="text-sm font-semibold text-foreground">High Alert</div>
                            <div className="text-xs text-muted-foreground">High crime area, avoid if possible</div>
                          </div>
                        </>
                      );
                    }
                  })()}
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground font-medium mb-1">
                    These are the 3 most common crimes in this area. Be aware.
                  </div>
                  {result.data.crime.summary.topCategories
                    .filter(cat => !cat.category.toLowerCase().includes('other'))
                    .slice(0, 3)
                    .map((cat, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground">
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
                      className="flex items-center justify-between text-xs text-foreground hover:underline"
                    >
                      <div>
                        <div className="font-medium">Closest Police Station</div>
                        <div className="text-muted-foreground">{Math.round(result.data.emergencyServices.policeStation.distance)}m away</div>
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
                      className="flex items-center justify-between text-xs text-foreground hover:underline"
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
                      className="flex items-center justify-between text-xs text-foreground hover:underline"
                    >
                      <div>
                        <div className="font-medium">Closest Hospital</div>
                        <div className="text-muted-foreground">{Math.round(result.data.emergencyServices.hospital.distance)}m away</div>
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
                      className="flex items-center justify-between text-xs text-foreground hover:underline"
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
              <div className="bg-muted/30 border border-border rounded-md p-3">
                <h4 className="font-bold text-foreground mb-3">Potential Disruptive Events</h4>
                {result.data.events.events.length > 0 ? (
                  <>
                    <div className="space-y-2 mb-3">
                      {result.data.events.events.slice(0, 3).map((event: any, idx: number) => (
                        <div key={idx} className="text-xs text-muted-foreground">
                          • {event.title}
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground italic pt-2 border-t border-border">
                      {result.data.events.summary.total === 1
                        ? 'This event will be in the area. It might affect the trip. Be aware.'
                        : `These ${result.data.events.summary.total} events will be in the area. They might affect the trip. Be aware.`}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">No events found</div>
                )}
              </div>

              {/* Nearby Cafes & Parking */}
              <div className="bg-muted/30 border border-border rounded-md p-3">
                <h4 className="font-bold text-foreground mb-3">Nearby Cafes & Parking</h4>

                {/* Cafes Section */}
                <div className="mb-4">
                  <h5 className="text-sm font-semibold text-foreground mb-2">Cafes</h5>
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
                                <div className="text-xs font-medium text-[#3ea34b]">
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
  );
}

