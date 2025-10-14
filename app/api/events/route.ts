import { NextResponse } from 'next/server';
import { searchLocationEvents, getEventsSummary } from '@/lib/events-search';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const locationName = searchParams.get('location') || 'London';
    const lat = parseFloat(searchParams.get('lat') || '51.5074');
    const lng = parseFloat(searchParams.get('lng') || '-0.1278');
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    console.log(`\n🔍 Searching for events near: ${locationName}`);
    console.log('='.repeat(60));
    console.log(`📍 Coordinates: ${lat}, ${lng}`);
    console.log(`📅 Date: ${date}`);

    // Search for events using OpenAI
    const events = await searchLocationEvents(locationName, lat, lng, date);
    const summary = getEventsSummary(events);

    if (events.length > 0) {
      console.log(`\n✅ Found ${events.length} relevant event(s)`);
      console.log('='.repeat(60));
      console.log('\n📋 Events:');
      events.forEach((event, idx) => {
        console.log(`\n${idx + 1}. ${event.title}`);
        console.log(`   Type: ${event.type} | Severity: ${event.severity}`);
        console.log(`   ${event.description}`);
        if (event.date) console.log(`   Date: ${event.date}`);
      });
    } else {
      console.log('\n✅ No significant disruptive events found');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Events search completed!\n');

    return NextResponse.json({
      success: true,
      data: {
        location: locationName,
        coordinates: { lat, lng },
        date,
        events,
        summary,
      },
      message: `Found ${events.length} event(s) for ${locationName}`,
    });
  } catch (error) {
    console.error('\n❌ Error searching events:', error);
    console.log('='.repeat(60) + '\n');

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

