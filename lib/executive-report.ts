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
  exceptionalInformation?: string;
  importantInformation?: string;
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
  }>,
  emailContent?: string,
  leadPassengerName?: string,
  vehicleInfo?: string,
  passengerCount?: number,
  tripDestination?: string,
  passengerNames?: string[],
  driverNotes?: string
): Promise<ExecutiveReport> {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🤖 GENERATING EXECUTIVE PEACE OF MIND REPORT WITH GPT-4O-MINI...');
    console.log('='.repeat(80));
    console.log(`📅 Trip Date: ${tripDate}`);
    console.log(`👤 Lead Passenger Name: ${leadPassengerName}`);
    console.log(`🚗 Vehicle Info: ${vehicleInfo}`);
    console.log(`👥 Passenger Count: ${passengerCount}`);
    console.log(`🏙️ Trip Destination: ${tripDestination}`);
    console.log(`👤 Passenger Names: ${passengerNames}`);
    console.log(`📝 Driver Notes: ${driverNotes}`);
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

PASSENGER INFORMATION:
${(() => {
  let passengerInfo = '';
  
  if (leadPassengerName) {
    passengerInfo += `Lead Passenger Name: ${leadPassengerName}\n`;
  }
  
  if (passengerCount && passengerCount > 0) {
    passengerInfo += `Number of Passengers: ${passengerCount}\n`;
  }
  
  if (passengerNames && passengerNames.length > 0) {
    passengerInfo += `Passenger Names: ${passengerNames.join(', ')}\n`;
  }
  
  if (tripDestination) {
    passengerInfo += `Trip Destination: ${tripDestination}\n`;
  }
  
  if (vehicleInfo) {
    passengerInfo += `Vehicle: ${vehicleInfo}\n`;
  }
  
  if (driverNotes) {
    passengerInfo += `Trip Notes: ${driverNotes}\n`;
  }
  
  return passengerInfo || 'Passenger information not available';
})()}

${emailContent ? `
EMAIL CONTEXT:
${emailContent}

` : ''}TRIP DETAILS:
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
   - External disruptions ${trafficPredictions ? '\n   - Historical traffic delays' : ''}

5. KEY HIGHLIGHTS: 4-6 critical points
   Type: danger (high risk), warning (moderate), info (neutral), success (positive)

6. EXCEPTIONAL INFORMATION: Critical/urgent trip requirements as actionable statements
7. IMPORTANT INFORMATION: Contextual trip requirements as actionable statements
8. RECOMMENDATIONS: Data-driven insights from location analysis (traffic, crime, weather, parking)

Return JSON:
{
  "tripRiskScore": number,
  "overallSummary": "Start with: '[Passenger Name] x[number] passengers in [City]' on first line, then 'Vehicle: [Vehicle Type]' on second line, followed by 2-3 sentences about the trip",
  "riskScoreExplanation": "Explain why score is X/10, which data used and how calculated",
  "topDisruptor": "The ONE thing most likely to disrupt trip and why",
  "routeDisruptions": {"drivingRisks": ["str"], "externalDisruptions": ["str"]},
  "recommendations": ["Data-driven only: traffic timing, parking strategies, crime precautions, weather prep"],
  "highlights": [{"type": "danger|warning|info|success", "message": "str"}],
  "exceptionalInformation": "Trip notes ONLY. Actionable statements with verbs. Example: '- Ensure vehicle is completely nut-free (passenger has severe allergy)' NOT '- The passenger has a severe nut allergy'. Empty if none.",
  "importantInformation": "Trip notes ONLY. Actionable statements with verbs. Example: '- Keep Emily (+44 7911 223344) informed of any delays or changes' NOT '- The primary contact is Emily'. Empty if none."
}

TRIP NOTES → EXCEPTIONAL & IMPORTANT (actionable statements):

BEFORE STARTING: Count how many lines are in trip notes. This number = total items you must extract to Exceptional + Important.

STEP 1 - EXTRACT (100% coverage, no invention):
- COUNT trip note lines FIRST: If 10 lines → must extract exactly 10 items
- Process trip notes LINE BY LINE - extract EVERY line without exception
- Extract ONLY what's LITERALLY stated
- If line contains multiple items with "and" (e.g., "WiFi and chargers"), extract as ONE item mentioning BOTH parts
- NEVER SKIP: ANY food restrictions (no X, avoid Y, etc), signs to hold, dress codes (suits, uniforms), bags/luggage help, vehicle features (WiFi, chargers, glass, temperature), water/drinks, newspapers, quiet driver, contact info, quotes, waiting time

STEP 2 - CATEGORIZE (zero overlap):
EXCEPTIONAL: ANY food restrictions/allergies (any mention of "no X", "allergy", "allergic", "cannot have", food avoidances), dress codes (suits, uniforms, specific attire), signs to hold, unusual behaviors (quiet driver, no talking), codes, urgent time constraints, urgent operations (monitor flight, hide car, etc)
IMPORTANT: Contacts (names, phone numbers, emails), vehicle specs (WiFi, chargers, privacy glass, temperature), newspapers (FT, WSJ, etc), food/drinks (water, sparkling, snacks), luggage/bags help, flight numbers, schedules, parking instructions, quotes, billing, waiting time

CRITICAL: If trip notes mention any food that passenger should NOT have (e.g., "no nuts", "no gluten", "no dairy", "avoid X"), treat as ALLERGY and place in EXCEPTIONAL - this is a safety requirement.

STEP 3 - FORMAT as actionable statements with verbs:
- Use action verbs: "Ensure", "Confirm", "Verify", "Maintain", "Stock", "Keep", "Prepare", "Monitor", "Assist"
- Include context in parentheses if helpful
- For food restrictions, always mark as safety-critical: "no nuts" → "Ensure vehicle completely nut-free and verify all snacks comply (safety critical)"
- For compound items, mention ALL parts: "WiFi and chargers" → "Confirm fast WiFi and multiple charging ports..."
- Examples: "Ensure vehicle completely nut-free (passenger has severe allergy)", "Stock vehicle with both still water and sparkling water"

API DATA → RECOMMENDATIONS (data-driven insights ONLY):
- Generate 5-8 insights from location data analysis (NOT from trip notes)
- Traffic: timing strategies, route adjustments, delay warnings
- Crime: safety precautions, locking protocols, area cautions
- Weather: preparation needs, vehicle pre-conditioning
- Parking: CPZ restrictions, car park locations, cost info

CRITICAL VALIDATION (ENFORCE STRICTLY):
1. COUNT FIRST: Trip note lines = Items in (Exceptional + Important) - MUST BE EQUAL OR REPORT FAILS
2. Check every line extracted: ANY food restrictions/allergies, signs, dress codes, newspapers, privacy glass, quiet driver, bags, water, WiFi, chargers, contacts, quotes
3. Recommendations contain ZERO trip note items (only data-driven insights)
4. All three sections use same actionable verb style
5. Compound items (X and Y) preserve both X AND Y
6. COMMON FAILURES: Missing food restrictions ("no X", allergies), missing signs to hold, missing dress codes, missing newspapers, missing privacy glass, missing quiet driver - these are UNACCEPTABLE

EXAMPLE (showing ALL 10 items extracted):
Trip notes (10 lines):
1. "Contact Emily at +44 7911 223344 for any issues"
2. "Driver to hold sign 'J HALE' and wear a dark suit"
3. "Help with bags"
4. "Require fast Wi-Fi and chargers everywhere"
5. "Provide water and sparkling water"
6. "No nuts in snacks"
7. "FT newspaper requested"
8. "Privacy glass up"
9. "Quiet driver"
10. "Quote needed ASAP, include all waiting time"

Exceptional (4 items - food restrictions, dress codes, signs, behaviors):
   "- Ensure vehicle is completely nut-free and verify all snacks comply with no-nuts requirement (safety critical)
   - Confirm driver holds sign reading 'J HALE' and wears dark suit as specified
   - Ensure driver maintains quiet, professional demeanor without unnecessary conversation
   - Maintain privacy glass raised throughout entire journey"

Important (6 items - contacts, vehicle specs, items, quotes):
   "- Keep Emily (+44 7911 223344) informed of any delays or changes to the itinerary
   - Ensure driver is prepared to assist with all luggage at pickup and drop-off
   - Confirm fast WiFi and multiple charging ports are operational and test before pickup
   - Stock vehicle with both still water and sparkling water before passenger arrival
   - Ensure Financial Times newspaper is available in vehicle
   - Prepare comprehensive quote including all waiting times and send to Emily immediately"

COUNT CHECK: 10 trip note lines = 4 Exceptional + 6 Important = 10 items ✓

Recommendations (data-driven ONLY, not from trip notes):
   "Monitor real-time traffic to adjust for predicted 8-min delay on route to Canary Wharf"
   "Exercise caution in high crime area (78 crimes reported); keep doors locked when stationary"
   "Rain expected at 15:00; ensure umbrella available and pre-warm vehicle 10 minutes before departure"
   "CPZ Zone active until 18:30; use nearby NCP car park at £4.50/hr to avoid penalties"
   "Limited parking availability at destination; arrive 10 minutes early to secure spot"`;

    // Use GPT-4o-mini for comprehensive executive analysis (proven working, 90% cost reduction)
    console.log('🤖 Calling GPT-4o-mini for AI-powered analysis...');
    console.log(`📏 Prompt length: ${prompt.length} characters`);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000, // Increased to accommodate 10-15 recommendations + detailed extraction
      temperature: 0.3, // Lower temperature for more focused analysis
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    console.log(`\n🔧 Model: ${completion.model}`);
    console.log(`📊 Tokens: ${completion.usage?.total_tokens} (prompt: ${completion.usage?.prompt_tokens}, completion: ${completion.usage?.completion_tokens})`);
    console.log(`💰 Estimated cost: $${((completion.usage?.prompt_tokens || 0) * 0.15 / 1000000 + (completion.usage?.completion_tokens || 0) * 0.60 / 1000000).toFixed(6)}`);
    console.log(`📏 Response length: ${responseText.length} characters`);
    console.log(`\n📝 GPT-4o-mini Response (first 500 chars):`);
    console.log(responseText.substring(0, 500));
    console.log('...');
    console.log(`📝 GPT-4o-mini Response (last 200 chars):`);
    console.log('...' + responseText.substring(Math.max(0, responseText.length - 200)));
    console.log('\n');

    // Check if response was truncated
    if (completion.choices[0]?.finish_reason === 'length') {
      console.warn('⚠️ WARNING: Response was truncated due to max_tokens limit!');
      console.warn('   This may result in incomplete JSON. Consider increasing max_tokens.');
    }

    // Extract JSON from response - GPT-4o-mini may wrap in markdown
    let jsonText = responseText;
    
    // Remove markdown code blocks
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Try to find complete JSON object
    let jsonMatch = jsonText.match(/\{[\s\S]*"tripRiskScore"[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('❌ No JSON found in response');
      console.error('❌ Full response:', responseText);
      console.error('❌ Response was likely truncated or malformed');
      throw new Error('No JSON found in GPT response - response may have been truncated');
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
    console.log(`📏 JSON length: ${jsonString.length} characters`);

    const report: ExecutiveReport = JSON.parse(jsonString);

    // VALIDATION: Check if importantInformation is an object instead of string
    if (report.importantInformation && typeof report.importantInformation === 'object') {
      console.error('❌ ERROR: importantInformation is an object, expected string!');
      console.error('   Value:', JSON.stringify(report.importantInformation, null, 2));
      // Convert object to string format
      const infoObj = report.importantInformation as any;
      const sections = Object.entries(infoObj).map(([key, value]) => `${key}:\n- ${value}`).join('\n\n');
      report.importantInformation = sections;
      console.log('✅ Converted importantInformation to string format');
    }

    // VALIDATION: Check field types
    console.log('🔍 Validating report fields...');
    console.log(`   - exceptionalInformation: ${typeof report.exceptionalInformation} (${report.exceptionalInformation ? 'exists' : 'empty'})`);
    console.log(`   - importantInformation: ${typeof report.importantInformation} (${report.importantInformation ? 'exists' : 'empty'})`);
    console.log(`   - recommendations: array of ${report.recommendations?.length || 0} items`);
    console.log(`   - highlights: array of ${report.highlights?.length || 0} items`);

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
