// Executive Report Generator
// Generates a comprehensive trip analysis report with AI-powered risk scoring

import openai from './openai';

export interface TripLocation {
  name: string;
  lat: number;
  lng: number;
  time: string;
  crime?: any;
  disruptions?: any;
  weather?: any;
  events?: any;
  parking?: any;
  cafes?: any;
}

export interface TrafficPrediction {
  leg: string;
  minutes: number;
  minutesNoTraffic: number;
  distance: string;
  distanceMeters: number;
  busyMinutes?: number;
  originName: string;
  destinationName: string;
  departureTime: string;
}

export interface ExecutiveReport {
  tripRiskScore: number; // 1-10
  overallSummary: string;
  riskScoreExplanation: string;
  topDisruptor: string;
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
    cafes: any;
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
    console.log('🤖 GENERATING EXECUTIVE PEACE OF MIND REPORT WITH GPT-4O-MINI...');
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
      premiumCafes: loc.cafes.cafes.length,
      topCafes: loc.cafes.cafes.slice(0, 3).map((c: any) => `${c.name} (${c.rating}⭐, ${'$'.repeat(c.priceLevel)}, ${Math.round(c.distance)}m)`),
      cafesAverageRating: loc.cafes.summary.averageRating,
    }));

    const prompt = `You are an executive security analyst preparing a "Peace of Mind" report for a VIP client traveling in London.

TRIP DETAILS:
Date: ${tripDate}
${routeDistance ? `Route: ${routeDistance} km, ${Math.round(routeDuration || 0)} minutes` : ''}
Locations: ${tripData.length} stops

${trafficPredictions ? `TRAFFIC PREDICTIONS:
${JSON.stringify(trafficPredictions.map(leg => ({
  leg: leg.leg,
  route: `${leg.originName.split(',')[0]} → ${leg.destinationName.split(',')[0]}`,
  minutes: leg.minutes,
  noTrafficMinutes: leg.minutesNoTraffic,
  delay: leg.minutes - leg.minutesNoTraffic
})))}
` : ''}

LOCATION DATA:
${JSON.stringify(dataSummary)}

ANALYSIS REQUIREMENTS:

1. TRIP RISK SCORE (1-10): 1-3=Low, 4-6=Moderate, 7-8=High, 9-10=Critical
   Include parking difficulty (10-15% weight)

2. Give the ONE thing that most likely to disrupt the trip. Explain why.
3. Explain why the trip risk score is what it is. Explain which data is used and how it is used to calculate the score.


4. ROUTE DISRUPTIONS:
   - Driving risks (traffic, road closures, weather)
   - External disruptions (protests, events causing detours)${trafficPredictions ? '\n   - Historical traffic delays' : ''}

5. RECOMMENDATIONS: 3-5 actionable items including:
   - Timing adjustments for traffic
   - Parking advice (CPZ hours, e.g., arrive before 8:30am or after 6:30pm)
   - Specific car parks if parking is limited
   - Top-rated cafes for convenience
   - Clothing advice for the weather like raincoats, umbrellas, etc.

6. KEY HIGHLIGHTS: 4-6 critical points
   Type: danger (high risk), warning (moderate), info (neutral), success (positive)

Return JSON:
{
  "tripRiskScore": number,
  "overallSummary": "2-3 sentences",
  "riskScoreExplanation": "Explain why score is X/10, which data used and how calculated",
  "topDisruptor": "The ONE thing most likely to disrupt trip and why",
  "routeDisruptions": {"drivingRisks": ["str"], "externalDisruptions": ["str"]},
  "recommendations": ["3-5 items: timing, parking CPZ advice, car parks, cafes, weather clothing (raincoats/umbrellas)"],
  "highlights": [{"type": "danger|warning|info|success", "message": "str with source"}]
}

Cite sources (e.g., "78 crimes - UK Police Data"). Use actual data numbers.`;

    // Use GPT-4o-mini for comprehensive executive analysis (proven working, 90% cost reduction)
    console.log('🤖 Calling GPT-4o-mini for AI-powered analysis...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000, // Reduced from 4000 for cost optimization
      temperature: 0.3, // Lower temperature for more focused analysis
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    console.log(`\n🔧 Model: ${completion.model}`);
    console.log(`📊 Tokens: ${completion.usage?.total_tokens}`);
    console.log(`💰 Estimated cost: $${((completion.usage?.prompt_tokens || 0) * 0.15 / 1000000 + (completion.usage?.completion_tokens || 0) * 0.60 / 1000000).toFixed(6)}`);
    console.log(`\n📝 GPT-4o-mini Response (first 500 chars):`);
    console.log(responseText.substring(0, 500));
    console.log('...\n');

    // Extract JSON from response - GPT-4o-mini may wrap in markdown
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
    console.log(`📝 Risk Explanation: ${report.riskScoreExplanation.substring(0, 100)}...`);
    console.log(`⚠️ Top Disruptor: ${report.topDisruptor.substring(0, 100)}...`);
    console.log(`📋 Highlights: ${report.highlights.length}`);
    console.log(`💡 Recommendations: ${report.recommendations.length}`);
    console.log('='.repeat(80) + '\n');

    return report;
  } catch (error) {
    console.error('❌ Error generating executive report:', error);
    throw error;
  }
}

// Note: All helper functions removed as the report is now 100% AI-generated using GPT-4o
