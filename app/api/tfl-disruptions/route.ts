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

    // Get district info
    const districtKey = districtParam as keyof typeof LONDON_DISTRICTS;
    const district = LONDON_DISTRICTS[districtKey];

    if (!district) {
      return NextResponse.json({
        success: false,
        error: `District "${districtParam}" not found`,
      }, { status: 404 });
    }

    console.log(`📍 District: ${district.name}, London`);
    console.log(`📅 Time range: Next ${daysAhead} days`);

    // Fetch all disruptions
    const allDisruptions = await getAllDisruptions();
    
    // Filter by timeframe
    const upcomingDisruptions = filterDisruptionsByTimeframe(allDisruptions, daysAhead);
    
    // Filter by area (try to match district name in location/comments)
    let areaDisruptions = filterDisruptionsByArea(upcomingDisruptions, district.name);
    
    // If no exact matches, show all upcoming disruptions with a note
    const isFiltered = areaDisruptions.length > 0;
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

    return NextResponse.json({
      success: true,
      data: {
        district: district.name,
        timeframe: `${daysAhead} days`,
        isAreaFiltered: isFiltered,
        disruptions: disruptions.slice(0, 50), // Limit to 50 for performance
        analysis,
      },
      message: `Found ${disruptions.length} disruptions for ${district.name}`,
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

