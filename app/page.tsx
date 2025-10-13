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

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; data?: CrimeData; error?: string } | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState('westminster');

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

  const fetchCrimeData = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      console.log(`🚀 Fetching crime data for ${selectedDistrict}...`);
      const response = await fetch(`/api/uk-crime?district=${selectedDistrict}`);
      const data = await response.json();
      
      console.log('📦 API Response:', data);
      setResult(data);
    } catch (error) {
      console.error('❌ Error:', error);
      setResult({ success: false, error: 'Failed to fetch data' });
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
            London District Safety Information
          </p>
          <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-lg text-sm">
            <span>📍</span>
            <span>24 London Districts • Real-Time Crime Data</span>
            <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-semibold">FREE API</span>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-8">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="district" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select London District
              </label>
              <select
                id="district"
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-3 px-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {londonDistricts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchCrimeData}
                disabled={loading}
                className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium py-3 px-6 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Analyzing...
                  </span>
                ) : (
                  `🔍 Analyze ${londonDistricts.find(d => d.id === selectedDistrict)?.name}`
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {result && result.success && result.data && (
          <div className="space-y-6">
            {/* Safety Score Card */}
            <div className={`rounded-2xl p-8 border-2 ${getSafetyBg(result.data.safetyScore)}`}>
              <div className="text-center">
                <div className="text-6xl sm:text-8xl font-bold mb-3">
                  <span className={getSafetyColor(result.data.safetyScore)}>
                    {result.data.safetyScore}
                  </span>
                  <span className="text-3xl text-gray-500 dark:text-gray-400">/100</span>
                </div>
                <div className={`inline-block px-4 py-2 rounded-full text-lg font-bold mb-3 ${getSafetyBg(result.data.safetyScore)}`}>
                  <span className={getSafetyColor(result.data.safetyScore)}>
                    {getSafetyLabel(result.data.safetyScore)}
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                  {result.data.district}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Based on {result.data.summary.totalCrimes.toLocaleString()} reported crimes • {result.data.summary.month}
                </p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border-l-4 border-blue-500">
                <div className="text-3xl mb-2">📊</div>
                <div className="text-3xl font-bold text-gray-800 dark:text-gray-200">
                  {result.data.summary.totalCrimes.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Incidents</div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border-l-4 border-purple-500">
                <div className="text-3xl mb-2">📅</div>
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                  {result.data.summary.month}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Report Period</div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border-l-4 border-green-500">
                <div className="text-3xl mb-2">📍</div>
                <div className="text-lg font-bold text-gray-800 dark:text-gray-200">
                  {result.data.coordinates.lat.toFixed(4)}°N
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Latitude</div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border-l-4 border-orange-500">
                <div className="text-3xl mb-2">🧭</div>
                <div className="text-lg font-bold text-gray-800 dark:text-gray-200">
                  {result.data.coordinates.lng.toFixed(4)}°W
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Longitude</div>
              </div>
            </div>

            {/* Top Crime Categories */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <span>🔝</span> Top Crime Categories in {result.data.district}
              </h2>
              <div className="space-y-4">
                {result.data.summary.topCategories.slice(0, 8).map((cat, idx) => (
                  <div key={idx} className="relative">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-gray-500 dark:text-gray-400 w-6">
                          {idx + 1}
                        </span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {cat.category}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                          {cat.count.toLocaleString()}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                          ({cat.percentage}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Crime Outcomes */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <span>⚖️</span> Investigation Outcomes
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(result.data.summary.byOutcome)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([outcome, count], idx) => (
                    <div key={idx} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                        {count.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 leading-tight">
                        {outcome}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Info Footer */}
            <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4 bg-white dark:bg-gray-800 rounded-xl">
              <p className="font-semibold mb-1">✅ Real Data from UK Police Open Data API</p>
              <p className="text-xs">
                Data covers crimes reported within a 1-mile radius of {result.data.district} center point
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {result && !result.success && (
          <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">❌</div>
            <h3 className="text-xl font-semibold text-red-800 dark:text-red-300 mb-2">
              Error Loading Data
            </h3>
            <p className="text-red-600 dark:text-red-400">
              {result.error || 'Unknown error occurred'}
            </p>
          </div>
        )}

        {/* Initial State */}
        {!result && !loading && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center shadow-xl">
            <div className="text-7xl mb-6">📍</div>
            <h3 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4">
              Explore London District Safety
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-lg mb-6">
              Select a London district from the dropdown above and click "Analyze" to view detailed crime statistics
              and safety information powered by real UK Police data.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto text-sm">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <div className="font-semibold text-blue-600 dark:text-blue-400">24</div>
                <div className="text-gray-600 dark:text-gray-400">Districts</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                <div className="font-semibold text-purple-600 dark:text-purple-400">Real-Time</div>
                <div className="text-gray-600 dark:text-gray-400">Data</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                <div className="font-semibold text-green-600 dark:text-green-400">100% Free</div>
                <div className="text-gray-600 dark:text-gray-400">No API Key</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                <div className="font-semibold text-orange-600 dark:text-orange-400">Official</div>
                <div className="text-gray-600 dark:text-gray-400">UK Police</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
