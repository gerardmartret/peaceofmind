import { NextResponse } from 'next/server';
import { 
  getWeatherForecast, 
  processWeatherData, 
  getWeatherSummary,
  getWeatherEmoji 
} from '@/lib/open-meteo-api';
import { LONDON_DISTRICTS } from '@/lib/uk-police-api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const districtParam = searchParams.get('district')?.toLowerCase() || 'westminster';
    const days = parseInt(searchParams.get('days') || '7');

    console.log(`\n🌤️  Fetching weather forecast for: ${districtParam}`);
    console.log('='.repeat(60));

    // Get district coordinates
    const districtKey = districtParam as keyof typeof LONDON_DISTRICTS;
    const district = LONDON_DISTRICTS[districtKey];

    if (!district) {
      return NextResponse.json({
        success: false,
        error: `District "${districtParam}" not found`,
      }, { status: 404 });
    }

    console.log(`📍 District: ${district.name}, London`);
    console.log(`📌 Coordinates: ${district.lat}, ${district.lng}`);
    console.log(`📅 Forecast period: ${days} days`);

    // Fetch weather data
    const weatherData = await getWeatherForecast(district.lat, district.lng, days);
    const dailyForecasts = processWeatherData(weatherData);
    const summary = getWeatherSummary(dailyForecasts);

    console.log(`\n✅ Successfully retrieved weather forecast for ${district.name}`);
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
        district: district.name,
        coordinates: { lat: district.lat, lng: district.lng },
        forecast: dailyForecasts,
        summary,
      },
      message: `Successfully retrieved ${days}-day forecast for ${district.name}`,
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

