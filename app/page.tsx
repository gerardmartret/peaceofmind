'use client';

import { useState } from 'react';

interface CrimeData {
  district: string;
  coordinates: { lat: number; lng: number };
  crimes: any[];
  summary: {
    totalCrimes: number;
    topCategories: Array<{ category: string; count: number; percentage: number }>;
    byOutcome: Record<string, number>;
    month: string;
  };
  safetyScore: number;
}

interface DisruptionData {
  district: string;
  timeframe: string;
  isAreaFiltered: boolean;
  disruptions: any[];
  analysis: {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    active: number;
    upcoming: number;
  };
}

interface WeatherData {
  district: string;
  coordinates: { lat: number; lng: number };
  forecast: Array<{
    date: string;
    maxTemp: number;
    minTemp: number;
    precipitation: number;
    precipitationProb: number;
    weatherCode: number;
    weatherDescription: string;
    windSpeed: number;
  }>;
  summary: {
    avgMaxTemp: number;
    avgMinTemp: number;
    totalPrecipitation: number;
    rainyDays: number;
    maxWindSpeed: number;
  };
}

interface CombinedData {
  crime: CrimeData;
  disruptions: DisruptionData;
  weather: WeatherData;
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ district: string; data: CombinedData }>>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(['westminster']);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const londonDistricts = [
    { id: 'westminster', name: 'Westminster' },
    { id: 'city-of-london', name: 'City of London' },
    { id: 'camden', name: 'Camden' },
    { id: 'islington', name: 'Islington' },
    { id: 'hackney', name: 'Hackney' },
    { id: 'tower-hamlets', name: 'Tower Hamlets' },
    { id: 'greenwich', name: 'Greenwich' },
    { id: 'lewisham', name: 'Lewisham' },
    { id: 'southwark', name: 'Southwark' },
    { id: 'lambeth', name: 'Lambeth' },
    { id: 'wandsworth', name: 'Wandsworth' },
    { id: 'hammersmith-fulham', name: 'Hammersmith & Fulham' },
    { id: 'kensington-chelsea', name: 'Kensington & Chelsea' },
    { id: 'soho', name: 'Soho' },
    { id: 'covent-garden', name: 'Covent Garden' },
    { id: 'shoreditch', name: 'Shoreditch' },
    { id: 'notting-hill', name: 'Notting Hill' },
    { id: 'brixton', name: 'Brixton' },
    { id: 'clapham', name: 'Clapham' },
    { id: 'chelsea', name: 'Chelsea' },
    { id: 'mayfair', name: 'Mayfair' },
    { id: 'canary-wharf', name: 'Canary Wharf' },
    { id: 'stratford', name: 'Stratford' },
    { id: 'wimbledon', name: 'Wimbledon' },
  ];

  // Set default date range (today to 30 days from now)
  useState(() => {
    const today = new Date();
    const futureDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(futureDate.toISOString().split('T')[0]);
  });

  const toggleDistrict = (districtId: string) => {
    if (selectedDistricts.includes(districtId)) {
      // Remove if already selected
      if (selectedDistricts.length > 1) {
        setSelectedDistricts(selectedDistricts.filter(d => d !== districtId));
      }
    } else {
      // Add to selection
      setSelectedDistricts([...selectedDistricts, districtId]);
    }
  };

  const calculateDaysFromDates = () => {
    if (!startDate || !endDate) return 30;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const fetchDistrictData = async () => {
    setLoading(true);
    setResults([]);
    setError(null);
    
    try {
      const days = calculateDaysFromDates();
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🚀 Fetching data for ${selectedDistricts.length} district(s)`);
      console.log(`📅 Date Range: ${startDate} to ${endDate} (${days} days)`);
      console.log(`📍 Districts: ${selectedDistricts.map(id => londonDistricts.find(d => d.id === id)?.name).join(', ')}`);
      console.log(`${'='.repeat(80)}\n`);
      
      // Fetch data for all selected districts in parallel
      const districtPromises = selectedDistricts.map(async (districtId) => {
        const districtName = londonDistricts.find(d => d.id === districtId)?.name || districtId;
        
        console.log(`\n🔍 Fetching data for ${districtName}...`);
        
        const [crimeResponse, disruptionsResponse, weatherResponse] = await Promise.all([
          fetch(`/api/uk-crime?district=${districtId}`),
          fetch(`/api/tfl-disruptions?district=${districtId}&days=${days}`),
          fetch(`/api/weather?district=${districtId}&days=${Math.min(days, 16)}`) // Open-Meteo max 16 days
        ]);
        
        const crimeData = await crimeResponse.json();
        const disruptionsData = await disruptionsResponse.json();
        const weatherData = await weatherResponse.json();
        
        if (crimeData.success && disruptionsData.success && weatherData.success) {
          console.log(`✅ ${districtName}: ${crimeData.data.summary.totalCrimes} crimes, ${disruptionsData.data.analysis.total} disruptions, ${weatherData.data.forecast.length} days forecast`);
          
          return {
            district: districtId,
            data: {
              crime: crimeData.data,
              disruptions: disruptionsData.data,
              weather: weatherData.data,
            },
          };
        } else {
          throw new Error(`Failed to fetch data for ${districtName}`);
        }
      });
      
      const allResults = await Promise.all(districtPromises);
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`✅ Successfully retrieved data for all ${allResults.length} district(s)!`);
      console.log(`${'='.repeat(80)}\n`);
      
      setResults(allResults);
    } catch (error) {
      console.error('❌ Error:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const getSafetyColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getSafetyBg = (score: number) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700';
    if (score >= 40) return 'bg-orange-100 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700';
    return 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700';
  };

  const getSafetyLabel = (score: number) => {
    if (score >= 80) return 'Very Safe';
    if (score >= 60) return 'Moderately Safe';
    if (score >= 40) return 'Caution Advised';
    return 'High Alert';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <span className="text-5xl">🇬🇧</span>
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Peace of Mind
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-300 text-lg mb-3">
            London District Safety, Traffic & Weather Information
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-3 py-1.5 rounded-lg text-xs font-medium">
              <span>🚨</span>
              <span>Crime</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 px-3 py-1.5 rounded-lg text-xs font-medium">
              <span>🚦</span>
              <span>Traffic</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200 px-3 py-1.5 rounded-lg text-xs font-medium">
              <span>🌤️</span>
              <span>Weather</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-3 py-1.5 rounded-lg text-xs font-semibold">
              <span>✅</span>
              <span>100% FREE</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-8">
          <div className="space-y-4">
            {/* District Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Select London Districts ({selectedDistricts.length} selected)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                {londonDistricts.map((district) => (
                  <button
                    key={district.id}
                    onClick={() => toggleDistrict(district.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedDistricts.includes(district.id)
                        ? 'bg-blue-600 text-white shadow-lg scale-105'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-blue-400'
                    }`}
                  >
                    {district.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-3 px-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-3 px-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Analyze Button */}
            <button
              onClick={fetchDistrictData}
              disabled={loading || selectedDistricts.length === 0}
              className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium py-3 px-6 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analyzing {selectedDistricts.length} district(s)...
                </span>
              ) : (
                `🔍 Analyze ${selectedDistricts.length} District${selectedDistricts.length > 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>

        {/* Results for Multiple Districts */}
        {results.length > 0 && (
          <div className="space-y-8">
            {/* Comparison Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white text-center">
              <h2 className="text-3xl font-bold mb-2">
                Comparing {results.length} District{results.length > 1 ? 's' : ''}
              </h2>
              <p className="text-blue-100">
                {startDate} to {endDate} • {calculateDaysFromDates()} days analysis
              </p>
            </div>

            {/* Results for Each District */}
            {results.map((result, resultIdx) => {
              const districtName = londonDistricts.find(d => d.id === result.district)?.name || result.district;
              
              return (
                <div key={result.district} className="space-y-6 border-4 border-gray-200 dark:border-gray-700 rounded-3xl p-6 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
                  {/* District Header */}
                  <div className="flex items-center justify-between pb-4 border-b-2 border-gray-200 dark:border-gray-700">
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                      {resultIdx + 1}. {districtName}
                    </h3>
                    <div className={`text-5xl font-bold ${getSafetyColor(result.data.crime.safetyScore)}`}>
                      {result.data.crime.safetyScore}
                      <span className="text-xl text-gray-500">/100</span>
                    </div>
                  </div>

                  {/* Safety Score Card */}
                  <div className={`rounded-2xl p-6 border-2 ${getSafetyBg(result.data.crime.safetyScore)}`}>
                    <div className="text-center">
                      <div className={`inline-block px-4 py-2 rounded-full text-lg font-bold mb-2 ${getSafetyBg(result.data.crime.safetyScore)}`}>
                        <span className={getSafetyColor(result.data.crime.safetyScore)}>
                          {getSafetyLabel(result.data.crime.safetyScore)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Based on {result.data.crime.summary.totalCrimes.toLocaleString()} crimes • {result.data.crime.summary.month}
                      </p>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border-l-4 border-blue-500">
                      <div className="text-2xl mb-1">🚨</div>
                      <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                        {result.data.crime.summary.totalCrimes.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Crimes</div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border-l-4 border-orange-500">
                      <div className="text-2xl mb-1">🚧</div>
                      <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                        {result.data.disruptions.analysis.total}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Disruptions</div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border-l-4 border-cyan-500">
                      <div className="text-2xl mb-1">🌡️</div>
                      <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                        {result.data.weather.summary.avgMaxTemp}°C
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Avg Temp</div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border-l-4 border-purple-500">
                      <div className="text-2xl mb-1">☔</div>
                      <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                        {result.data.weather.summary.rainyDays}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Rainy Days</div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border-l-4 border-red-500">
                      <div className="text-2xl mb-1">⚠️</div>
                      <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                        {result.data.disruptions.analysis.bySeverity['Moderate'] || 0}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Moderate</div>
                    </div>
                  </div>

                  {/* Three Column Layout for Crime, Disruptions, and Weather */}
                  <div className="grid lg:grid-cols-3 gap-4">
                    {/* Top Crime Categories */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-xl">
                      <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <span>🚨</span> Crime Report
                      </h3>
                      <div className="space-y-2.5">
                        {result.data.crime.summary.topCategories.slice(0, 5).map((cat, idx) => (
                          <div key={idx} className="relative">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {idx + 1}. {cat.category}
                              </span>
                              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                {cat.count}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full"
                                style={{ width: `${cat.percentage}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* TfL Disruptions */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-xl">
                      <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <span>🚦</span> Disruptions
                      </h3>
                      
                      {/* Disruption Mini Stats */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 text-center">
                          <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                            {result.data.disruptions.analysis.total}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Total</div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 text-center">
                          <div className="text-xl font-bold text-red-600 dark:text-red-400">
                            {result.data.disruptions.analysis.bySeverity['Moderate'] || 0}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Moderate</div>
                        </div>
                      </div>

                      {/* Top 3 Disruptions */}
                      <div className="space-y-2">
                        {result.data.disruptions.disruptions.slice(0, 3).map((disruption: any, idx: number) => (
                          <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
                            <div className="flex items-start justify-between mb-1">
                              <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-xs leading-tight">
                                {disruption.location.length > 35 ? disruption.location.substring(0, 35) + '...' : disruption.location}
                              </h4>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                                disruption.severity === 'Moderate' 
                                  ? 'bg-orange-200 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300'
                                  : 'bg-yellow-200 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300'
                              }`}>
                                {disruption.severity}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {new Date(disruption.startDateTime).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Weather Forecast */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-xl">
                      <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <span>🌤️</span> Weather Forecast
                      </h3>
                      
                      {/* Weather Summary */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-2 text-center">
                          <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
                            {result.data.weather.summary.avgMaxTemp}°C
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Avg Max</div>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center">
                          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                            {result.data.weather.summary.rainyDays}/{result.data.weather.forecast.length}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Rainy Days</div>
                        </div>
                      </div>

                      {/* All Days in Date Range */}
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 sticky top-0 bg-white dark:bg-gray-800 py-1">
                          Full Forecast ({result.data.weather.forecast.length} days):
                        </h4>
                        {result.data.weather.forecast.map((day: any, idx: number) => {
                          const weatherEmoji = day.weatherCode === 0 ? '☀️' : 
                                             day.weatherCode <= 3 ? '⛅' :
                                             day.weatherCode >= 61 && day.weatherCode <= 67 ? '🌧️' :
                                             day.weatherCode >= 71 && day.weatherCode <= 77 ? '❄️' :
                                             day.weatherCode >= 95 ? '⛈️' : '🌤️';
                          
                          return (
                            <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5 border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl">{weatherEmoji}</span>
                                  <div>
                                    <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                                      {new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {day.weatherDescription}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                    {day.minTemp}°-{day.maxTemp}°C
                                  </div>
                                  {day.precipitation > 0 && (
                                    <div className="text-xs text-blue-600 dark:text-blue-400">
                                      💧 {day.precipitation}mm
                                    </div>
                                  )}
                                </div>
                              </div>
                              {day.windSpeed > 15 && (
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1">
                                  <span>💨</span>
                                  <span>{day.windSpeed} km/h wind</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Full Weather Forecast - Full Width */}
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
                    <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <span>🌤️</span> Complete Weather Forecast for {districtName}
                    </h3>
                    
                    {/* Weather Summary Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                      <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-lg p-3 border-2 border-cyan-200 dark:border-cyan-800">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Avg Temp</div>
                        <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                          {result.data.weather.summary.avgMinTemp}°-{result.data.weather.summary.avgMaxTemp}°C
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-3 border-2 border-blue-200 dark:border-blue-800">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Precipitation</div>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {result.data.weather.summary.totalPrecipitation}mm
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-3 border-2 border-purple-200 dark:border-purple-800">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Rainy Days</div>
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {result.data.weather.summary.rainyDays}/{result.data.weather.forecast.length}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 rounded-lg p-3 border-2 border-green-200 dark:border-green-800">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Max Wind</div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {result.data.weather.summary.maxWindSpeed} km/h
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg p-3 border-2 border-orange-200 dark:border-orange-800">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Forecast</div>
                        <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                          {result.data.weather.forecast.length} Days
                        </div>
                      </div>
                    </div>

                    {/* Daily Weather Cards - Horizontal Scroll */}
                    <div className="overflow-x-auto pb-2">
                      <div className="flex gap-3" style={{ minWidth: 'fit-content' }}>
                        {result.data.weather.forecast.map((day: any, idx: number) => {
                          const weatherEmoji = day.weatherCode === 0 ? '☀️' : 
                                             day.weatherCode <= 3 ? '⛅' :
                                             day.weatherCode >= 61 && day.weatherCode <= 67 ? '🌧️' :
                                             day.weatherCode >= 71 && day.weatherCode <= 77 ? '❄️' :
                                             day.weatherCode >= 95 ? '⛈️' : '🌤️';
                          
                          const isRainy = day.precipitation > 0;
                          const isWindy = day.windSpeed > 15;
                          
                          return (
                            <div 
                              key={idx} 
                              className={`flex-shrink-0 w-48 rounded-xl p-4 shadow-lg border-2 ${
                                isRainy 
                                  ? 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 border-blue-300 dark:border-blue-700'
                                  : 'bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border-gray-200 dark:border-gray-600'
                              }`}
                            >
                              <div className="text-center mb-3">
                                <div className="text-5xl mb-2">{weatherEmoji}</div>
                                <div className="font-bold text-gray-800 dark:text-gray-200">
                                  {new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short' })}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  {new Date(day.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">Temp</span>
                                  <span className="font-bold text-gray-800 dark:text-gray-200">
                                    {day.minTemp}°-{day.maxTemp}°C
                                  </span>
                                </div>
                                
                                {isRainy && (
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Rain</span>
                                    <span className="font-bold text-blue-600 dark:text-blue-400">
                                      💧 {day.precipitation}mm
                                    </span>
                                  </div>
                                )}
                                
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">Wind</span>
                                  <span className={`font-bold ${isWindy ? 'text-orange-600 dark:text-orange-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                    {isWindy ? '💨 ' : ''}{day.windSpeed} km/h
                                  </span>
                                </div>

                                <div className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                  {day.weatherDescription}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Overall Footer */}
            <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4 bg-white dark:bg-gray-800 rounded-xl">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✅</span>
                  <span>UK Police API</span>
                </div>
                <div className="hidden sm:block text-gray-400">•</div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✅</span>
                  <span>TfL API</span>
                </div>
                <div className="hidden sm:block text-gray-400">•</div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✅</span>
                  <span>Open-Meteo API</span>
                </div>
              </div>
              <p className="text-xs mt-2">
                {results.length} district{results.length > 1 ? 's' : ''} • Crime + Traffic + Weather • 100% Free
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">❌</div>
            <h3 className="text-xl font-semibold text-red-800 dark:text-red-300 mb-2">
              Error Loading Data
            </h3>
            <p className="text-red-600 dark:text-red-400">
              {error}
            </p>
          </div>
        )}


        {/* Initial State */}
        {results.length === 0 && !loading && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center shadow-xl">
            <div className="text-7xl mb-6">📍</div>
            <h3 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4">
              Comprehensive London District Analysis
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-lg mb-6">
              Select a London district to view detailed crime statistics, safety scores, and road disruptions.
              Powered by UK Police and Transport for London APIs.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 max-w-2xl mx-auto text-sm">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <div className="font-semibold text-blue-600 dark:text-blue-400">24</div>
                <div className="text-gray-600 dark:text-gray-400">Districts</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                <div className="font-semibold text-purple-600 dark:text-purple-400">Real-Time</div>
                <div className="text-gray-600 dark:text-gray-400">Crime Data</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                <div className="font-semibold text-orange-600 dark:text-orange-400">30 Days</div>
                <div className="text-gray-600 dark:text-gray-400">Disruptions</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                <div className="font-semibold text-green-600 dark:text-green-400">100% Free</div>
                <div className="text-gray-600 dark:text-gray-400">No API Key</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                <div className="font-semibold text-red-600 dark:text-red-400">Official</div>
                <div className="text-gray-600 dark:text-gray-400">APIs</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
