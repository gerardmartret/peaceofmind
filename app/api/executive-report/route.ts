import { NextResponse } from 'next/server';
import { generateExecutiveReport } from '@/lib/executive-report';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tripData, tripDate, routeDistance, routeDuration, trafficPredictions, emailContent, passengerCount, tripDestination, passengerNames, driverNotes } = body;

    console.log('\n🔍 Generating Executive Report...');
    console.log(`📍 Processing ${tripData.length} location(s)`);
    console.log(`📅 Trip Date: ${tripDate}`);
    console.log(`📏 Route Distance: ${routeDistance}`);
    console.log(`⏱️ Route Duration: ${routeDuration} minutes`);
    if (trafficPredictions) {
      console.log(`🚦 Including ${trafficPredictions.length} traffic prediction leg(s)`);
    }
    console.log(`👥 Passenger Count: ${passengerCount}`);
    console.log(`🏙️ Trip Destination: ${tripDestination}`);
    console.log(`👤 Passenger Names: ${passengerNames}`);
    console.log(`📝 Driver Notes: ${driverNotes}`);

    const report = await generateExecutiveReport(
      tripData,
      tripDate,
      routeDistance,
      routeDuration,
      trafficPredictions,
      emailContent,
      passengerCount,
      tripDestination,
      passengerNames,
      driverNotes
    );

    console.log('✅ Report generated successfully!');
    console.log(`🎯 Trip Risk Score: ${report.tripRiskScore}/10`);
    console.log(`📊 Highlights: ${report.highlights.length} items`);
    console.log(`⚠️ Top Disruptor: ${report.topDisruptor}`);

    return NextResponse.json({
      success: true,
      data: report,
      message: 'Executive report generated successfully',
    });
  } catch (error) {
    console.error('❌ Error generating report:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate report',
      details: error instanceof Error ? error.stack : String(error),
    }, { status: 500 });
  }
}

