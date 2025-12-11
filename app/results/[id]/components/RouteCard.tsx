'use client';

import React from 'react';
import GoogleTripMap from '@/components/GoogleTripMap';
import { getLondonLocalTime } from '../utils/time-helpers';
import { calculateTimelineRealism, calculateCombinedScheduleRisk } from '../utils/risk-helpers';
import { numberToLetter } from '@/lib/helpers/string-helpers';

interface RouteCardProps {
  index: number;
  tripResults: Array<{
    locationId: string;
    locationName: string;
    time: string;
    data: {
      weather: { coordinates: { lat: number; lng: number } };
      crime: { safetyScore: number };
      disruptions?: {
        disruptions: Array<{
          location: string;
          severity: string;
        }>;
      };
    };
  }>;
  trafficPredictions: {
    success: boolean;
    data: Array<{
      minutes: number;
      minutesNoTraffic: number;
      busyMinutes?: number;
      distance: string;
    }>;
  };
  tripDate: string;
  tripDestination: string;
  expandedRoutes: { [key: string]: boolean };
  onToggleExpansion: (routeId: string) => void;
}

export function RouteCard({
  index,
  tripResults,
  trafficPredictions,
  tripDate,
  tripDestination,
  expandedRoutes,
  onToggleExpansion,
}: RouteCardProps) {
  if (index >= tripResults.length - 1) return null;
  if (!trafficPredictions?.success || !trafficPredictions.data || !trafficPredictions.data[index]) return null;

  // Calculate timeline realism for this route leg
  const legLocations = [
    { time: tripResults[index].time },
    { time: tripResults[index + 1].time }
  ];
  const timelineRealism = calculateTimelineRealism(legLocations, trafficPredictions, tripDate);
  const legRealism = timelineRealism.find(r => r.legIndex === index);

  // Calculate traffic delay
  const leg = trafficPredictions.data[index];
  const trafficDelay = Math.max(0, (leg.minutes || 0) - (leg.minutesNoTraffic || 0));

  // Calculate combined schedule risk
  const combinedRisk = calculateCombinedScheduleRisk(
    trafficDelay,
    legRealism?.realismLevel || null,
    legRealism?.userExpectedMinutes || 0,
    leg.minutes || 0
  );

  const routeId = `route-${index}`;
  const isExpanded = expandedRoutes[routeId] || false;

  return (
    <div className="flex items-start gap-3 sm:gap-4">
      <div className="flex-shrink-0 w-24 sm:w-32 text-right relative">
        {/* Timeline Dot for Route */}
        <div className="absolute left-2 top-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-card border-2 border-border flex items-center justify-center z-10">
          <span className="text-sm sm:text-base font-bold text-card-foreground">→</span>
        </div>
        <div className="text-sm sm:text-base font-bold text-foreground ml-5 sm:ml-6">
          {getLondonLocalTime(tripResults[index].time)}
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground ml-1 sm:ml-2">
          Route
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-card rounded-md p-4 sm:p-8 border border-border/40">
          {/* Route Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-lg sm:text-2xl font-bold text-card-foreground flex items-center gap-1 sm:gap-2">
                <span className="hidden sm:inline">Route: </span>
                <span>{numberToLetter(index + 1)}</span>
                <span className="inline-block text-base sm:text-lg">→</span>
                <span>{numberToLetter(index + 2)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div
                className="px-4 py-2 rounded-lg font-semibold"
                style={{
                  backgroundColor: combinedRisk.color,
                  color: '#FFFFFF'
                }}
                title={combinedRisk.reason}
              >
                {combinedRisk.label}
              </div>

              {/* Expand/Collapse Button */}
              <button
                onClick={() => onToggleExpansion(routeId)}
                className="p-2 hover:bg-secondary/50 dark:hover:bg-[#181a23] rounded transition-colors"
                title={isExpanded ? "Collapse details" : "Expand details"}
              >
                <svg
                  className={`w-5 h-5 text-card-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
            className={`overflow-hidden transition-all duration-500 ease-in-out ${!isExpanded ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
              }`}
          >
            <div className="flex items-center justify-between text-sm text-muted-foreground py-3">
              <div className="flex items-center gap-4">
                {trafficPredictions.data[index] && (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="text-card-foreground font-medium">Time:</span>
                      <span>{trafficPredictions.data[index].minutes || 0} min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-card-foreground font-medium">Distance:</span>
                      <span>{trafficPredictions.data[index].distance || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-card-foreground font-medium">Delay:</span>
                      <span>-{Math.max(0, (trafficPredictions.data[index].minutes || 0) - (trafficPredictions.data[index].minutesNoTraffic || 0))} min</span>
                    </div>
                  </>
                )}
              </div>
              <div className="text-xs text-muted-foreground/60">
                Click to expand
              </div>
            </div>
          </div>

          {/* Expanded Details */}
          <div
            className={`overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
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
                    tripDestination={tripDestination}
                    locations={[
                      {
                        id: tripResults[index].locationId,
                        name: tripResults[index].locationName,
                        lat: tripResults[index].data.weather.coordinates.lat,
                        lng: tripResults[index].data.weather.coordinates.lng,
                        time: tripResults[index].time,
                        safetyScore: tripResults[index].data.crime.safetyScore,
                      },
                      {
                        id: tripResults[index + 1].locationId,
                        name: tripResults[index + 1].locationName,
                        lat: tripResults[index + 1].data.weather.coordinates.lat,
                        lng: tripResults[index + 1].data.weather.coordinates.lng,
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
                  {legRealism && legRealism.realismLevel !== 'realistic' && (
                    <div className={`mt-3 pt-3 border-t border-border/30 ${legRealism.realismLevel === 'unrealistic'
                      ? 'text-[#9e201b]'
                      : 'text-[#db7304]'
                      }`}>
                      <div className="text-sm font-medium mb-1">
                        {legRealism.message}
                      </div>
                      <div className="text-xs opacity-80">
                        Your timeline: {legRealism.userExpectedMinutes} min • Estimated travel: {legRealism.googleCalculatedMinutes} min
                        {legRealism.differenceMinutes < 0 && (
                          <span> • Gap: {Math.abs(legRealism.differenceMinutes)} min short</span>
                        )}
                      </div>
                    </div>
                  )}
                  {trafficPredictions?.data?.[index]?.busyMinutes && (
                    <div className="text-sm text-destructive mt-3 pt-3 border-t border-border/30">
                      Busy traffic expected: -{Math.max(0, (trafficPredictions.data[index].busyMinutes || 0) - (trafficPredictions.data[index].minutesNoTraffic || 0))} min additional delay
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
                      const leg = trafficPredictions?.data?.[index];
                      if (!leg) return 'rgba(128, 128, 128, 0.2)';
                      const delay = Math.max(0, (leg.minutes || 0) - (leg.minutesNoTraffic || 0));
                      if (delay < 5) return 'rgba(62, 163, 75, 0.2)';
                      if (delay < 10) return 'rgba(219, 115, 4, 0.2)';
                      return 'rgba(158, 32, 27, 0.2)';
                    })()
                  }}
                >
                  <div
                    className="text-sm mb-1"
                    style={{
                      color: (() => {
                        const leg = trafficPredictions?.data?.[index];
                        if (!leg) return '#808080';
                        const delay = Math.max(0, (leg.minutes || 0) - (leg.minutesNoTraffic || 0));
                        if (delay < 5) return '#3ea34b';
                        if (delay < 10) return '#db7304';
                        return '#9e201b';
                      })()
                    }}
                  >
                    Traffic Delay
                  </div>
                  <div
                    className="text-2xl font-bold"
                    style={{
                      color: (() => {
                        const leg = trafficPredictions?.data?.[index];
                        if (!leg) return '#808080';
                        const delay = Math.max(0, (leg.minutes || 0) - (leg.minutesNoTraffic || 0));
                        if (delay < 5) return '#3ea34b';
                        if (delay < 10) return '#db7304';
                        return '#9e201b';
                      })()
                    }}
                  >
                    -{(() => {
                      const leg = trafficPredictions?.data?.[index];
                      if (!leg) return '0';
                      return Math.max(0, (leg.minutes || 0) - (leg.minutesNoTraffic || 0));
                    })()} min
                  </div>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Travel Time</div>
                  <div className="text-2xl font-bold text-card-foreground">
                    {trafficPredictions?.data?.[index]?.minutes || 0} min
                  </div>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Distance</div>
                  <div className="text-2xl font-bold text-card-foreground">
                    {trafficPredictions?.data?.[index]?.distance || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Road Closures */}
              {tripResults[index].data?.disruptions?.disruptions && tripResults[index].data.disruptions.disruptions.length > 0 && (
                <div className="bg-secondary/30 rounded-lg p-4 mt-4">
                  <div className="text-sm font-semibold mb-3 text-card-foreground">Road Closures</div>
                  <div className="space-y-2 mb-3">
                    {tripResults[index].data.disruptions.disruptions.slice(0, 2).map((disruption: any, idx: number) => (
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
  );
}

