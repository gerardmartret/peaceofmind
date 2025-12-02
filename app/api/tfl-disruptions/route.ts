import { NextResponse } from 'next/server';
import { 
  getAllDisruptions, 
  filterDisruptionsByTimeframe,
  filterDisruptionsByArea,
  analyzeDisruptions 
} from '@/lib/tfl-api';
import { LONDON_DISTRICTS } from '@/lib/uk-police-api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const districtParam = searchParams.get('district')?.toLowerCase() || 'notting-hill';
    const daysAhead = parseInt(searchParams.get('days') || '7');

    console.log(`\n🚦 Fetching TfL disruptions for: ${districtParam}`);
    console.log('='.repeat(60));

    let locationName: string;
    let isCustomLocation = false;

    // Check if this is a custom location (starts with "custom-")
    if (districtParam.startsWith('custom-')) {
      locationName = 'Custom Location';
      isCustomLocation = true;
      console.log(`📍 Location: Custom (London-wide disruptions)`);
      console.log(`📅 Time range: Next ${daysAhead} days`);
    } else {
      // Get district info from predefined districts
      const districtKey = districtParam as keyof typeof LONDON_DISTRICTS;
      const district = LONDON_DISTRICTS[districtKey];

      if (!district) {
        return NextResponse.json({
          success: false,
          error: `District "${districtParam}" not found`,
        }, { status: 404 });
      }

      locationName = district.name;
      console.log(`📍 District: ${district.name}, London`);
      console.log(`📅 Time range: Next ${daysAhead} days`);
    }

    // Fetch all disruptions
    const allDisruptions = await getAllDisruptions();
    
    // Filter by timeframe
    const upcomingDisruptions = filterDisruptionsByTimeframe(allDisruptions, daysAhead);
    
    // Filter by area (only if not a custom location)
    let areaDisruptions: any[] = [];
    let isFiltered = false;
    
    if (!isCustomLocation) {
      // Try to match district name in location/comments
      areaDisruptions = filterDisruptionsByArea(upcomingDisruptions, locationName);
      isFiltered = areaDisruptions.length > 0;
    }
    
    // Use area-specific if found, otherwise show all London-wide disruptions
    const disruptions = isFiltered ? areaDisruptions : upcomingDisruptions;

    console.log(`\n✅ Found ${disruptions.length} ${isFiltered ? 'area-specific' : 'London-wide'} disruptions`);
    
    // Analyze the disruptions
    const analysis = analyzeDisruptions(disruptions);
    
    console.log('\n📊 Disruption Summary:');
    console.log('='.repeat(60));
    console.log(`  Total: ${analysis.total}`);
    console.log(`  Active Now: ${analysis.active}`);
    console.log(`  Upcoming: ${analysis.upcoming}`);
    
    console.log('\n📈 By Severity:');
    Object.entries(analysis.bySeverity)
      .sort((a, b) => b[1] - a[1])
      .forEach(([severity, count]) => {
        console.log(`  ${severity.padEnd(20)} ${count}`);
      });
    
    console.log('\n🏗️  By Category:');
    Object.entries(analysis.byCategory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`  ${category.padEnd(20)} ${count}`);
      });

    console.log('\n🚧 Top 5 Disruptions:');
    console.log('='.repeat(60));
    disruptions.slice(0, 5).forEach((d, idx) => {
      console.log(`\n${idx + 1}. ${d.location}`);
      console.log(`   Category: ${d.category} | Severity: ${d.severity}`);
      console.log(`   From: ${new Date(d.startDateTime).toLocaleDateString()}`);
      console.log(`   To: ${new Date(d.endDateTime).toLocaleDateString()}`);
      console.log(`   Details: ${d.comments.substring(0, 100)}...`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ TfL disruptions data retrieval completed!\n');

    // Simplify disruptions data to reduce response size
    const simplifiedDisruptions = disruptions.slice(0, 50).map(d => ({
      id: d.id,
      location: d.location,
      category: d.category,
      severity: d.severity,
      comments: d.comments,
      startDateTime: d.startDateTime,
      endDateTime: d.endDateTime,
      // Omit large fields like geometry, streets, corridors to reduce payload
    }));

    return NextResponse.json({
      success: true,
      data: {
        district: locationName,
        timeframe: `${daysAhead} days`,
        isAreaFiltered: isFiltered,
        disruptions: simplifiedDisruptions,
        analysis,
      },
      message: `Found ${disruptions.length} disruptions for ${locationName}`,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' // 5 min cache, 10 min stale
      }
    });
  } catch (error) {
    console.error('\n❌ Error fetching TfL disruptions:', error);
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

