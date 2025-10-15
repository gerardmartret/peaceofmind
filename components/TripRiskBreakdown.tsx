'use client';

interface LocationRisk {
  locationId: string;
  locationName: string;
  time: string;
  safety: {
    score: number;
    level: 'low' | 'medium' | 'high';
    crimes: number;
    topCrimes: Array<{ category: string; count: number; percentage: number }>;
  };
  weather: {
    level: 'low' | 'medium' | 'high';
    temp: { min: number; max: number };
    precipitation: number;
    rainyDays: number;
    windSpeed: number;
  };
  disruptions: {
    level: 'low' | 'medium' | 'high';
    total: number;
    moderate: number;
    active: number;
  };
  events: {
    level: 'low' | 'medium' | 'high';
    total: number;
    highSeverity: number;
  };
}

interface RouteRisk {
  leg: string;
  origin: string;
  destination: string;
  travelTime: number;
  distance: string;
  trafficDelay: number;
  level: 'low' | 'medium' | 'high';
}

interface TripRiskBreakdownProps {
  locations: LocationRisk[];
  routes: RouteRisk[];
  tripDate: string;
}

function getRiskColor(level: 'low' | 'medium' | 'high') {
  switch (level) {
    case 'low': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20';
    case 'medium': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20';
    case 'high': return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20';
  }
}

function getRiskIcon(level: 'low' | 'medium' | 'high') {
  switch (level) {
    case 'low': return '✅';
    case 'medium': return '⚠️';
    case 'high': return '🚨';
  }
}

function calculateRiskLevel(score: number, thresholds: { low: number; medium: number }): 'low' | 'medium' | 'high' {
  if (score >= thresholds.low) return 'low';
  if (score >= thresholds.medium) return 'medium';
  return 'high';
}

function calculateLocationRisks(locationData: any): {
  safety: { score: number; level: 'low' | 'medium' | 'high'; crimes: number; topCrimes: any[] };
  weather: { level: 'low' | 'medium' | 'high'; temp: { min: number; max: number }; precipitation: number; rainyDays: number; windSpeed: number };
  disruptions: { level: 'low' | 'medium' | 'high'; total: number; moderate: number; active: number };
  events: { level: 'low' | 'medium' | 'high'; total: number; highSeverity: number };
} {
  // Add safety checks for data structure
  if (!locationData || !locationData.crime || !locationData.weather || !locationData.disruptions || !locationData.events) {
    console.error('❌ Missing location data:', locationData);
    return {
      safety: { score: 0, level: 'high', crimes: 0, topCrimes: [] },
      weather: { level: 'high', temp: { min: 0, max: 0 }, precipitation: 0, rainyDays: 0, windSpeed: 0 },
      disruptions: { level: 'high', total: 0, moderate: 0, active: 0 },
      events: { level: 'high', total: 0, highSeverity: 0 },
    };
  }

  // Safety risk (inverted - higher safety score = lower risk)
  const safetyScore = locationData.crime.safetyScore || 0;
  const totalCrimes = locationData.crime.summary?.totalCrimes || 0;
  const safetyLevel = calculateRiskLevel(100 - safetyScore, { low: 70, medium: 50 });
  
  // Weather risk
  const weatherRisk = (() => {
    const rainyDays = locationData.weather.summary?.rainyDays || 0;
    const windSpeed = locationData.weather.summary?.maxWindSpeed || 0;
    const precipitation = locationData.weather.summary?.totalPrecipitation || 0;
    
    let score = 0;
    if (rainyDays >= 3) score += 3;
    else if (rainyDays >= 1) score += 1;
    
    if (windSpeed >= 20) score += 2;
    else if (windSpeed >= 15) score += 1;
    
    if (precipitation >= 20) score += 2;
    else if (precipitation >= 10) score += 1;
    
    return calculateRiskLevel(score, { low: 2, medium: 4 });
  })();
  
  // Disruption risk
  const disruptionTotal = locationData.disruptions.analysis?.total || 0;
  const disruptionLevel = calculateRiskLevel(disruptionTotal, { low: 5, medium: 15 });
  
  // Event risk
  const eventHighSeverity = locationData.events.summary?.highSeverity || 0;
  const eventLevel = calculateRiskLevel(eventHighSeverity, { low: 0, medium: 1 });
  
  return {
    safety: {
      score: safetyScore,
      level: safetyLevel,
      crimes: totalCrimes,
      topCrimes: locationData.crime.summary?.topCategories?.slice(0, 3) || [],
    },
    weather: {
      level: weatherRisk,
      temp: {
        min: locationData.weather.summary?.avgMinTemp || 0,
        max: locationData.weather.summary?.avgMaxTemp || 0,
      },
      precipitation: locationData.weather.summary?.totalPrecipitation || 0,
      rainyDays: locationData.weather.summary?.rainyDays || 0,
      windSpeed: locationData.weather.summary?.maxWindSpeed || 0,
    },
    disruptions: {
      level: disruptionLevel,
      total: disruptionTotal,
      moderate: locationData.disruptions.analysis?.bySeverity?.['Moderate'] || 0,
      active: locationData.disruptions.analysis?.active || 0,
    },
    events: {
      level: eventLevel,
      total: locationData.events.summary?.total || 0,
      highSeverity: eventHighSeverity,
    },
  };
}

function calculateRouteRisks(trafficData: any[]): RouteRisk[] {
  return trafficData.map((leg, index) => {
    const trafficDelay = leg.minutes - leg.minutesNoTraffic;
    
    // Route risk based on traffic delay and distance
    let riskScore = 0;
    if (trafficDelay >= 15) riskScore += 3;
    else if (trafficDelay >= 8) riskScore += 2;
    else if (trafficDelay >= 3) riskScore += 1;
    
    const distanceKm = parseFloat(leg.distance.replace(' km', ''));
    if (distanceKm >= 20) riskScore += 2;
    else if (distanceKm >= 10) riskScore += 1;
    
    const level = calculateRiskLevel(riskScore, { low: 2, medium: 4 });
    
    return {
      leg: leg.leg,
      origin: leg.originName.split(',')[0],
      destination: leg.destinationName.split(',')[0],
      travelTime: leg.minutes,
      distance: leg.distance,
      trafficDelay,
      level,
    };
  });
}

export default function TripRiskBreakdown({ tripResults, trafficPredictions, tripDate }: {
  tripResults: any[];
  trafficPredictions: any;
  tripDate: string;
}) {
  if (!tripResults || tripResults.length === 0) return null;
  
  // Calculate location risks
  const locations: LocationRisk[] = tripResults.map((result, index) => {
    const risks = calculateLocationRisks(result.data);
    return {
      locationId: result.locationId,
      locationName: result.locationName,
      time: result.time,
      ...risks,
    };
  }).filter(location => location && location.safety && location.safety.crimes !== undefined);
  
  // Calculate route risks
  const routes: RouteRisk[] = trafficPredictions?.success 
    ? calculateRouteRisks(trafficPredictions.data)
    : [];
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center gap-2">
        <span>🛡️</span> Trip Risk Breakdown
        <span className="text-sm font-normal text-gray-500">({tripDate})</span>
      </h2>
      
      <div className="space-y-8">
        {/* Trip Overview */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">📍 Trip Overview</h3>
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{locations.length}</div>
              <div className="text-gray-600 dark:text-gray-400">Locations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{routes.length}</div>
              <div className="text-gray-600 dark:text-gray-400">Route Legs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {locations.length > 0 ? Math.round(locations.reduce((sum, loc) => sum + (loc.safety?.score || 0), 0) / locations.length) : 0}
              </div>
              <div className="text-gray-600 dark:text-gray-400">Avg Safety</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {routes.reduce((sum, route) => sum + route.trafficDelay, 0)} min
              </div>
              <div className="text-gray-600 dark:text-gray-400">Total Delay</div>
            </div>
          </div>
        </div>

        {/* Location-by-Location Breakdown */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">🏢 Location Analysis</h3>
          <div className="space-y-6">
            {locations.map((location, index) => (
              <div key={location.locationId} className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6">
                {/* Location Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                        {location.locationName.split(',')[0]}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        🕐 {location.time} • 📅 {tripDate}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                      {location.safety.score}
                    </div>
                    <div className="text-xs text-gray-500">Safety Score</div>
                  </div>
                </div>

                {/* Risk Categories */}
                <div className="grid md:grid-cols-4 gap-4">
                  {/* Safety Risk */}
                  <div className={`rounded-lg p-4 border-2 ${getRiskColor(location.safety.level).split(' ')[1]} ${getRiskColor(location.safety.level).split(' ')[0]}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{getRiskIcon(location.safety.level)}</span>
                      <span className="font-semibold">Safety</span>
                    </div>
                    <div className="text-sm">
                      <div>{(location.safety?.crimes || 0).toLocaleString()} crimes</div>
                      <div className="text-xs mt-1">
                        Top: {location.safety?.topCrimes?.[0]?.category || 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Weather Risk */}
                  <div className={`rounded-lg p-4 border-2 ${getRiskColor(location.weather.level).split(' ')[1]} ${getRiskColor(location.weather.level).split(' ')[0]}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{getRiskIcon(location.weather.level)}</span>
                      <span className="font-semibold">Weather</span>
                    </div>
                    <div className="text-sm">
                      <div>{location.weather.temp.min}°-{location.weather.temp.max}°C</div>
                      <div className="text-xs mt-1">
                        {location.weather.rainyDays} rainy days
                      </div>
                    </div>
                  </div>

                  {/* Disruptions Risk */}
                  <div className={`rounded-lg p-4 border-2 ${getRiskColor(location.disruptions.level).split(' ')[1]} ${getRiskColor(location.disruptions.level).split(' ')[0]}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{getRiskIcon(location.disruptions.level)}</span>
                      <span className="font-semibold">Disruptions</span>
                    </div>
                    <div className="text-sm">
                      <div>{location.disruptions.total} total</div>
                      <div className="text-xs mt-1">
                        {location.disruptions.moderate} moderate
                      </div>
                    </div>
                  </div>

                  {/* Events Risk */}
                  <div className={`rounded-lg p-4 border-2 ${getRiskColor(location.events.level).split(' ')[1]} ${getRiskColor(location.events.level).split(' ')[0]}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{getRiskIcon(location.events.level)}</span>
                      <span className="font-semibold">Events</span>
                    </div>
                    <div className="text-sm">
                      <div>{location.events.total} events</div>
                      <div className="text-xs mt-1">
                        {location.events.highSeverity} high severity
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Route Analysis */}
        {routes.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">🛣️ Route Analysis</h3>
            <div className="space-y-4">
              {routes.map((route, index) => (
                <div key={index} className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${getRiskColor(route.level)}`}>
                        {route.leg}
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                          {route.origin} → {route.destination}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          🚗 {route.travelTime} min • 📏 {route.distance}
                        </p>
                      </div>
                    </div>
                    <div className={`rounded-lg px-3 py-1 ${getRiskColor(route.level)}`}>
                      <div className="flex items-center gap-2">
                        <span>{getRiskIcon(route.level)}</span>
                        <span className="font-semibold capitalize">{route.level} Risk</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Route Details */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                      <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Travel Time</div>
                      <div className="text-lg font-bold text-blue-800 dark:text-blue-200">{route.travelTime} min</div>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                      <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">Traffic Delay</div>
                      <div className="text-lg font-bold text-orange-800 dark:text-orange-200">
                        {route.trafficDelay > 0 ? `+${route.trafficDelay}` : '0'} min
                      </div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                      <div className="text-sm text-green-600 dark:text-green-400 font-medium">Distance</div>
                      <div className="text-lg font-bold text-green-800 dark:text-green-200">{route.distance}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Legend */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Risk Level Legend</h4>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span className="font-medium text-green-600">Low Risk</span>
              <span className="text-gray-600 dark:text-gray-400">- Safe conditions</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-600">⚠️</span>
              <span className="font-medium text-yellow-600">Medium Risk</span>
              <span className="text-gray-600 dark:text-gray-400">- Caution advised</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-600">🚨</span>
              <span className="font-medium text-red-600">High Risk</span>
              <span className="text-gray-600 dark:text-gray-400">- Extra vigilance needed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
