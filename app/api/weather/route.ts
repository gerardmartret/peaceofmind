import { NextResponse } from 'next/server';
import { 
  getWeatherForecast, 
  processWeatherData, 
  getWeatherSummary,
  getWeatherEmoji 
} from '@/lib/open-meteo-api';
import { LONDON_DISTRICTS } from '@/lib/uk-police-api';
import { getDestinationTimezone } from '@/lib/city-helpers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const districtParam = searchParams.get('district')?.toLowerCase() || 'westminster';
    const customLat = searchParams.get('lat');
    const customLng = searchParams.get('lng');
    const days = parseInt(searchParams.get('days') || '7');
    const tripDestination = searchParams.get('tripDestination') || null;
    const timezone = getDestinationTimezone(tripDestination);

    let lat: number, lng: number, locationName: string;

    // Check if custom coordinates provided
    if (customLat && customLng) {
      lat = parseFloat(customLat);
      lng = parseFloat(customLng);
      locationName = 'Custom Location';
      
      console.log(`\n🌤️  Fetching weather forecast for custom location`);
      console.log('='.repeat(60));
      console.log(`📍 Location: Custom`);
      console.log(`📌 Coordinates: ${lat}, ${lng}`);
      console.log(`📅 Forecast period: ${days} days`);
    } else {
      // Use predefined district
      console.log(`\n🌤️  Fetching weather forecast for: ${districtParam}`);
      console.log('='.repeat(60));

      const districtKey = districtParam as keyof typeof LONDON_DISTRICTS;
      const district = LONDON_DISTRICTS[districtKey];

      if (!district) {
        return NextResponse.json({
          success: false,
          error: `District "${districtParam}" not found`,
        }, { status: 404 });
      }

      lat = district.lat;
      lng = district.lng;
      locationName = district.name;
      
      console.log(`📍 District: ${district.name}, London`);
      console.log(`📌 Coordinates: ${lat}, ${lng}`);
      console.log(`📅 Forecast period: ${days} days`);
    }

    // Fetch weather data
    const weatherData = await getWeatherForecast(lat, lng, days, timezone);
    const dailyForecasts = processWeatherData(weatherData);
    const summary = getWeatherSummary(dailyForecasts);

    console.log(`\n✅ Successfully retrieved weather forecast for ${locationName}`);
    console.log('='.repeat(60));
    console.log(`🌡️  Average Temperature: ${summary.avgMinTemp}°C - ${summary.avgMaxTemp}°C`);
    console.log(`🌧️  Total Precipitation: ${summary.totalPrecipitation}mm`);
    console.log(`☔ Rainy Days: ${summary.rainyDays}/${days}`);
    console.log(`💨 Max Wind Speed: ${summary.maxWindSpeed} km/h\n`);

    console.log('📅 Daily Forecast:');
    console.log('-'.repeat(60));
    dailyForecasts.forEach((day, idx) => {
      const emoji = getWeatherEmoji(day.weatherCode);
      console.log(
        `  ${emoji} ${day.date}: ${day.minTemp}°C-${day.maxTemp}°C, ` +
        `${day.precipitation}mm rain, ${day.windSpeed} km/h wind - ${day.weatherDescription}`
      );
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Open-Meteo weather data retrieval completed!\n');

    return NextResponse.json({
      success: true,
      data: {
        district: locationName,
        coordinates: { lat, lng },
        forecast: dailyForecasts,
        summary,
      },
      message: `Successfully retrieved ${days}-day forecast for ${locationName}`,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' // 5 min cache, 10 min stale
      }
    });
  } catch (error) {
    console.error('\n❌ Error fetching weather data:', error);
    console.log('='.repeat(60) + '\n');

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

