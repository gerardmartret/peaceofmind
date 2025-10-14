import { NextResponse } from 'next/server';
import { 
  getStreetLevelCrimes, 
  analyzeCrimeData, 
  calculateSafetyScore,
  LONDON_DISTRICTS 
} from '@/lib/uk-police-api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const districtParam = searchParams.get('district')?.toLowerCase() || 'westminster';
    const customLat = searchParams.get('lat');
    const customLng = searchParams.get('lng');
    const date = searchParams.get('date'); // Optional YYYY-MM format

    let lat: number, lng: number, locationName: string;

    // Check if custom coordinates provided
    if (customLat && customLng) {
      lat = parseFloat(customLat);
      lng = parseFloat(customLng);
      locationName = 'Custom Location';
      
      console.log(`\n🔍 Fetching UK Police data for custom location`);
      console.log('='.repeat(60));
      console.log(`📍 Location: Custom`);
      console.log(`📌 Coordinates: ${lat}, ${lng}`);
    } else {
      // Use predefined district
      console.log(`\n🔍 Fetching UK Police data for London district: ${districtParam}`);
      console.log('='.repeat(60));

      const districtKey = districtParam as keyof typeof LONDON_DISTRICTS;
      const district = LONDON_DISTRICTS[districtKey];

      if (!district) {
        const availableDistricts = Object.values(LONDON_DISTRICTS).map(d => d.name).join(', ');
        console.log(`❌ District not found: ${districtParam}`);
        console.log(`Available districts: ${availableDistricts}`);
        console.log('='.repeat(60) + '\n');

        return NextResponse.json({
          success: false,
          error: `District "${districtParam}" not supported. Available: ${availableDistricts}`,
        }, { status: 404 });
      }

      lat = district.lat;
      lng = district.lng;
      locationName = district.name;
      
      console.log(`📍 District: ${district.name}, London`);
      console.log(`📌 Coordinates: ${lat}, ${lng}`);
    }
    if (date) {
      console.log(`📅 Date: ${date}`);
    }

    // Fetch crime data
    const crimes = await getStreetLevelCrimes(lat, lng, date || undefined);

    if (crimes.length === 0) {
      console.log(`⚠️  No crime data available for ${locationName}`);
      console.log('='.repeat(60) + '\n');

      return NextResponse.json({
        success: true,
        data: {
          district: locationName,
          coordinates: { lat, lng },
          crimes: [],
          summary: {
            totalCrimes: 0,
            topCategories: [],
            byOutcome: {},
            month: 'N/A',
          },
          safetyScore: 100,
        },
        message: `No crime data available for ${locationName}`,
      });
    }

    // Analyze the data
    const summary = analyzeCrimeData(crimes);
    const safetyScore = calculateSafetyScore(crimes);

    console.log(`\n✅ Successfully retrieved crime data for ${locationName}`);
    console.log('='.repeat(60));
    console.log(`📊 Total Crimes: ${summary.totalCrimes}`);
    console.log(`📅 Month: ${summary.month}`);
    console.log(`🛡️  Safety Score: ${safetyScore}/100\n`);

    console.log('🔝 Top Crime Categories:');
    console.log('-'.repeat(60));
    summary.topCategories.slice(0, 5).forEach((cat, idx) => {
      console.log(`  ${idx + 1}. ${cat.category.padEnd(25)} ${cat.count.toString().padStart(4)} (${cat.percentage}%)`);
    });

    console.log('\n📋 Crime Outcomes:');
    console.log('-'.repeat(60));
    Object.entries(summary.byOutcome)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([outcome, count]) => {
        console.log(`  ${outcome.padEnd(40)} ${count.toString().padStart(4)}`);
      });

    console.log('\n' + '='.repeat(60));
    console.log('✅ UK Police API data retrieval completed successfully!\n');

    return NextResponse.json({
      success: true,
      data: {
        district: locationName,
        coordinates: { lat, lng },
        crimes: crimes.slice(0, 100), // Limit to 100 for performance
        summary,
        safetyScore,
      },
      message: `Successfully retrieved crime data for ${locationName}, London`,
    });
  } catch (error) {
    console.error('\n❌ Error fetching UK Police data:', error);
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

