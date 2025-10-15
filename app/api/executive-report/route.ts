import { NextResponse } from 'next/server';
import { generateExecutiveReport } from '@/lib/executive-report';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tripData, tripDate, routeDistance, routeDuration, trafficPredictions } = body;

    console.log('\n🔍 Generating Executive Report...');
    console.log(`📍 Processing ${tripData.length} location(s)`);
    if (trafficPredictions) {
      console.log(`🚦 Including ${trafficPredictions.length} traffic prediction leg(s)`);
    }

    const report = await generateExecutiveReport(
      tripData,
      tripDate,
      routeDistance,
      routeDuration,
      trafficPredictions
    );

    return NextResponse.json({
      success: true,
      data: report,
      message: 'Executive report generated successfully',
    });
  } catch (error) {
    console.error('❌ Error generating report:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate report',
    }, { status: 500 });
  }
}

