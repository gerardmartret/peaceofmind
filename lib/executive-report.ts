import openai from './openai';

export interface ExecutiveReport {
  tripRiskScore: number; // 1-10
  overallSummary: string;
  locationAnalysis: Array<{
    locationName: string;
    riskLevel: 'high' | 'medium' | 'low';
    keyFindings: string[];
  }>;
  routeDisruptions: {
    drivingRisks: string[];
    externalDisruptions: string[];
  };
  recommendations: string[];
  highlights: Array<{
    type: 'danger' | 'warning' | 'info' | 'success';
    message: string;
  }>;
}

export async function generateExecutiveReport(
  tripData: Array<{
    locationName: string;
    time: string;
    crime: any;
    disruptions: any;
    weather: any;
    events: any;
    parking: any;
  }>,
  tripDate: string,
  routeDistance?: number,
  routeDuration?: number,
  trafficPredictions?: Array<{
    leg: string;
    minutes: number;
    minutesNoTraffic: number;
    distance: string;
    originName: string;
    destinationName: string;
    departureTime: string;
  }>
): Promise<ExecutiveReport> {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🤖 GENERATING EXECUTIVE PEACE OF MIND REPORT WITH GPT-4O...');
    console.log('='.repeat(80));
    console.log(`📅 Trip Date: ${tripDate}`);
    console.log(`📍 Locations: ${tripData.length}`);
    if (routeDistance) console.log(`🚗 Route: ${routeDistance} km, ${Math.round(routeDuration || 0)} min`);
    if (trafficPredictions) {
      const totalTrafficDelay = trafficPredictions.reduce((sum, leg) => sum + (leg.minutes - leg.minutesNoTraffic), 0);
      console.log(`🚦 Traffic Predictions: ${trafficPredictions.length} legs, +${totalTrafficDelay} min delay`);
    }

    // Prepare data summary for GPT
    const dataSummary = tripData.map((loc, idx) => ({
      stop: idx + 1,
      location: loc.locationName,
      time: loc.time,
      safetyScore: loc.crime.safetyScore,
      totalCrimes: loc.crime.summary.totalCrimes,
      topCrimes: loc.crime.summary.topCategories.slice(0, 3).map((c: any) => `${c.category} (${c.count})`),
      trafficDisruptions: loc.disruptions.analysis.total,
      moderateDisruptions: loc.disruptions.analysis.bySeverity['Moderate'] || 0,
      topDisruptions: loc.disruptions.disruptions.slice(0, 2).map((d: any) => d.location),
      weatherSummary: `${loc.weather.summary.avgMinTemp}°C-${loc.weather.summary.avgMaxTemp}°C, ${loc.weather.summary.rainyDays} rainy days`,
      eventsCount: loc.events.summary.total,
      events: loc.events.events.map((e: any) => `${e.title} (${e.severity})`),
      parkingRiskScore: loc.parking.parkingRiskScore,
      nearbyCarParks: loc.parking.summary.totalNearby,
      nearestParkingDistance: loc.parking.carParks[0]?.distance || 'None within 1km',
      cpzRestrictions: loc.parking.cpzInfo.inCPZ
        ? `${loc.parking.cpzInfo.zoneName} - ${loc.parking.cpzInfo.operatingHours} (${loc.parking.cpzInfo.chargeInfo})`
        : 'No CPZ restrictions',
    }));

    const prompt = `You are an executive security analyst preparing a "Peace of Mind" report for a VIP client traveling in London.

TRIP DETAILS:
Date: ${tripDate}
${routeDistance ? `Route: ${routeDistance} km, ${Math.round(routeDuration || 0)} minutes driving` : ''}
Locations: ${tripData.length} stops

${trafficPredictions ? `
TRAFFIC PREDICTIONS (Historical-based):
${JSON.stringify(trafficPredictions.map(leg => ({
  leg: leg.leg,
  route: `${leg.originName.split(',')[0]} → ${leg.destinationName.split(',')[0]}`,
  travelTime: `${leg.minutes} min (${leg.minutesNoTraffic} min without traffic)`,
  distance: leg.distance,
  trafficDelay: `${leg.minutes - leg.minutesNoTraffic} min delay`
})), null, 2)}
` : ''}

DATA FOR EACH LOCATION:
${JSON.stringify(dataSummary, null, 2)}

ANALYZE THIS VIP TRIP AND PROVIDE:

1. TRIP RISK SCORE (1-10): Rate overall disruption risk
   - 1-3: Low risk, smooth trip expected
   - 4-6: Moderate risk, some disruptions possible
   - 7-8: High risk, significant disruptions likely
   - 9-10: Critical risk, trip may need rescheduling
   - Include parking difficulty in overall score (10-15% weight)

2. LOCATION-BY-LOCATION ANALYSIS:
   For each stop, identify:
   - Risk level (high/medium/low)
   - Key safety/disruption concerns
   - Specific data points from crime/traffic/weather/events
   - **PARKING CHALLENGES**: If parking risk score > 6, mention limited parking availability
   - **CPZ RESTRICTIONS**: Warn about Controlled Parking Zones and operating hours

3. ROUTE DISRUPTIONS:
   - Driving risks (traffic, road closures, weather impact on driving)
   - External disruptions (protests blocking routes, events causing detours)
   ${trafficPredictions ? '- Historical traffic delays and timing predictions' : ''}
   - **PARKING LOGISTICS**: Mention if any location has challenging parking

4. RECOMMENDATIONS:
   - 3-5 specific actionable recommendations
   - Time adjustments if needed
   - Route alternatives if applicable
   - **PARKING ADVICE**: Suggest arrival times to avoid CPZ charges (e.g., arrive before 8:30am or after 6:30pm)
   - **ALTERNATIVE PARKING**: Recommend specific car parks if destination parking is limited

5. KEY HIGHLIGHTS:
   - 4-6 most important points
   - Mark as: danger (red), warning (yellow), info (blue), success (green)
   - Include parking warnings if risk score > 7

FORMAT AS JSON:
{
  "tripRiskScore": number,
  "overallSummary": "2-3 sentences about the trip",
  "locationAnalysis": [
    {
      "locationName": "Name",
      "riskLevel": "high|medium|low",
      "keyFindings": ["Finding 1 with data source", "Finding 2 with data source"]
    }
  ],
  "routeDisruptions": {
    "drivingRisks": ["Risk 1 with source", "Risk 2 with source"],
    "externalDisruptions": ["Disruption 1 with source"]
  },
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "highlights": [
    {"type": "danger|warning|info|success", "message": "Message with source"}
  ]
}

IMPORTANT:
- CITE DATA SOURCES (e.g., "78 violent crimes reported - UK Police Data")
- Be specific about WHY each risk exists
- Use actual numbers from the data
- Focus on VIP trip disruption potential`;

    // Use GPT-4o for comprehensive executive analysis (proven working)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.3, // Lower temperature for more focused analysis
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    console.log(`\n🔧 Model: ${completion.model}`);
    console.log(`📊 Tokens: ${completion.usage?.total_tokens}`);
    console.log(`\n📝 GPT-4o Response (first 500 chars):`);
    console.log(responseText.substring(0, 500));
    console.log('...\n');

    // Extract JSON from response - GPT-4o may wrap in markdown
    let jsonText = responseText;
    
    // Remove markdown code blocks
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Try to find complete JSON object
    let jsonMatch = jsonText.match(/\{[\s\S]*"tripRiskScore"[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('❌ No JSON found in response');
      console.error('Full response:', responseText);
      throw new Error('No JSON found in GPT response');
    }

    // Ensure complete JSON by balancing braces
    let startIndex = jsonMatch.index!;
    let braceCount = 0;
    let endIndex = startIndex;
    
    for (let i = startIndex; i < jsonText.length; i++) {
      if (jsonText[i] === '{') braceCount++;
      if (jsonText[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
    
    const jsonString = jsonText.substring(startIndex, endIndex);
    console.log('✅ JSON extracted successfully');

    const report: ExecutiveReport = JSON.parse(jsonString);

    console.log(`\n✅ Executive Report Generated!`);
    console.log(`🎯 Trip Risk Score: ${report.tripRiskScore}/10`);
    console.log(`📋 Highlights: ${report.highlights.length}`);
    console.log(`💡 Recommendations: ${report.recommendations.length}`);
    console.log('='.repeat(80) + '\n');

    return report;
  } catch (error) {
    console.error('❌ Error generating executive report:', error);
    throw error;
  }
}

