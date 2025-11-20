// Open-Meteo API Client
// Documentation: https://open-meteo.com/
// 100% Free, No API Key Required

export interface WeatherForecast {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  weather_code: number[];
  wind_speed_10m_max: number[];
}

export interface WeatherData {
  latitude: number;
  longitude: number;
  timezone: string;
  daily: WeatherForecast;
}

export interface DailySummary {
  date: string;
  maxTemp: number;
  minTemp: number;
  precipitation: number;
  precipitationProb: number;
  weatherCode: number;
  weatherDescription: string;
  windSpeed: number;
}

/**
 * Get weather forecast for a location
 * @param lat Latitude
 * @param lng Longitude
 * @param days Number of days to forecast (default: 7)
 * @param timezone IANA timezone string (default: 'Europe/London')
 */
export async function getWeatherForecast(
  lat: number,
  lng: number,
  days: number = 7,
  timezone: string = 'Europe/London'
): Promise<WeatherData> {
  try {
    console.log(`🌤️  Fetching weather forecast for ${lat}, ${lng} (${days} days, timezone: ${timezone})`);
    
    const url = `https://api.open-meteo.com/v1/forecast?` +
      `latitude=${lat}&longitude=${lng}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,wind_speed_10m_max` +
      `&timezone=${encodeURIComponent(timezone)}` +
      `&forecast_days=${days}`;
    
    console.log(`📡 Calling Open-Meteo API...`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Open-Meteo API Error: ${response.status} ${response.statusText}`);
    }

    const data: WeatherData = await response.json();
    console.log(`✅ Retrieved ${data.daily.time.length} days of forecast`);
    
    return data;
  } catch (error: any) {
    console.error('❌ Error fetching weather data:', error.message);
    throw error;
  }
}

/**
 * Convert weather code to description
 * Based on WMO Weather interpretation codes
 */
export function getWeatherDescription(code: number): string {
  const weatherCodes: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };
  
  return weatherCodes[code] || 'Unknown';
}

/**
 * Get weather emoji based on weather code
 */
export function getWeatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code >= 45 && code <= 48) return '🌫️';
  if (code >= 51 && code <= 57) return '🌦️';
  if (code >= 61 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌧️';
  if (code >= 85 && code <= 86) return '🌨️';
  if (code >= 95) return '⛈️';
  return '🌤️';
}

/**
 * Process weather data into daily summaries
 */
export function processWeatherData(data: WeatherData): DailySummary[] {
  return data.daily.time.map((date, idx) => ({
    date,
    maxTemp: Math.round(data.daily.temperature_2m_max[idx]),
    minTemp: Math.round(data.daily.temperature_2m_min[idx]),
    precipitation: Math.round(data.daily.precipitation_sum[idx] * 10) / 10,
    precipitationProb: data.daily.precipitation_probability_max[idx],
    weatherCode: data.daily.weather_code[idx],
    weatherDescription: getWeatherDescription(data.daily.weather_code[idx]),
    windSpeed: Math.round(data.daily.wind_speed_10m_max[idx]),
  }));
}

/**
 * Get weather summary for next N days
 */
export function getWeatherSummary(dailyData: DailySummary[]): {
  avgMaxTemp: number;
  avgMinTemp: number;
  totalPrecipitation: number;
  rainyDays: number;
  maxWindSpeed: number;
} {
  const avgMaxTemp = Math.round(
    dailyData.reduce((sum, day) => sum + day.maxTemp, 0) / dailyData.length
  );
  
  const avgMinTemp = Math.round(
    dailyData.reduce((sum, day) => sum + day.minTemp, 0) / dailyData.length
  );
  
  const totalPrecipitation = Math.round(
    dailyData.reduce((sum, day) => sum + day.precipitation, 0) * 10
  ) / 10;
  
  const rainyDays = dailyData.filter(day => day.precipitation > 0.1).length;
  
  const maxWindSpeed = Math.max(...dailyData.map(day => day.windSpeed));
  
  return {
    avgMaxTemp,
    avgMinTemp,
    totalPrecipitation,
    rainyDays,
    maxWindSpeed,
  };
}

