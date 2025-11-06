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

6. EXCEPTIONAL INFORMATION: Extract critical/urgent/unusual items from trip notes (bullet points)
7. IMPORTANT INFORMATION: Extract contextual/requirement items from trip notes (bullet points)
8. RECOMMENDATIONS: Integrate trip notes requirements with location data to create actionable advice (5-8 items)

Return JSON:
{
  "tripRiskScore": number,
  "overallSummary": "Start with: '[Passenger Name] x[number] passengers in [City]' on first line, then 'Vehicle: [Vehicle Type]' on second line, followed by 2-3 sentences about the trip",
  "riskScoreExplanation": "Explain why score is X/10, which data used and how calculated",
  "topDisruptor": "The ONE thing most likely to disrupt trip and why",
  "routeDisruptions": {"drivingRisks": ["str"], "externalDisruptions": ["str"]},
  "recommendations": ["5-8 actionable items integrating trip notes with data insights"],
  "highlights": [{"type": "danger|warning|info|success", "message": "str"}],
  "exceptionalInformation": "Extract ONLY if LITERALLY in trip notes: codes, time constraints, allergies, dress codes (COMPLETE), behaviors (NO TALKING), urgent ops (monitor flight, hide car, leave immediately, prepare to - ONLY if these exact phrases appear). Format: '- Item\\n- Item'. DO NOT invent. Empty if none.",
  "importantInformation": "Extract ONLY items LITERALLY in trip notes. Format: '- Item\\n- Item'. DO NOT invent contact/flight/vehicle/parking details not explicitly stated. Empty if none."
}

CRITICAL RULES - TRIP NOTES DISTRIBUTION:
1. DO NOT INVENT - Only extract text that LITERALLY appears in trip notes (no paraphrasing beyond clarity)
2. Process trip notes LINE BY LINE - extract ALL to Exceptional or Important Information (100% coverage)
3. Count trip note lines: If 10 lines exist, extract exactly 10 items (no more, no less)
4. Exceptional + Important = ZERO overlap (each item to ONE section only)
5. DO NOT filter profanity/unclear content - extract and clean slightly
6. Format: "- Item 1\n- Item 2\n- Item 3" (actual \n characters between items)
7. Extract EVERY action verb stated: monitor, hide, prepare, confirm, provide, maintain, contact
8. If action NOT in trip notes, do NOT include it (no assumptions: VIP, discretion, parking unless stated)
9. Recommendations: REFERENCE trip notes + ADD data insights (traffic, parking, crime, weather)

SECTION ASSIGNMENTS:

EXCEPTIONAL INFO (Critical/Urgent from trip notes - extract ONLY if explicitly stated):
Security codes, URGENT time constraints (confirm in X min), deadly allergies, unusual dress codes (COMPLETE), unusual behaviors (NO TALKING - only if stated), urgent operations (monitor flight, hide car, leave immediately, prepare to, be ready to), flight monitoring (monitor flight X live for updates)

IMPORTANT INFO (Contextual details from trip notes - bullet points):
Contact methods, flight details, vehicle specs/restrictions (temperature + scents together, Evian only, tinted, WiFi, USB), newspapers, food requests (even if profane), meeting schedules, parking instructions, drop-off/pickup details

RECOMMENDATIONS (Trip notes + Data → Actionable):
Convert trip notes to HOW-TO actions + add data insights (traffic timing, parking strategies, safety precautions, weather prep)

VALIDATION - VERIFY BEFORE SUBMITTING:
1. Count trip note lines = Count extracted items in Exceptional + Important (must match exactly)
2. Every item LITERALLY in trip notes (no invented items: VIP, hide car, prepare to leave, parking - unless stated)
3. Common missed: codes, flight monitoring, no talking, confirm in X min, COMPLETE dress codes, allergies, contact, temperature+scents, newspapers
4. Format: Each item starts with '-', separated by \n

EXAMPLES:

EXCEPTIONAL INFO (extract ONLY what's stated - with \n between items):
IF trip notes say: "Code: Blue Horizon", "Monitor flight BA123 live", "Confirm details in 2 minutes", "No talking during ride", "Driver: black suit, no logos, tiny 'J.C.' sign", "NO CITRUS, NO NUTS (deadly)"
→ Extract exactly these 6 items:
"- Code: Blue Horizon\n- Monitor flight BA123 live for updates\n- Confirm details in 2 minutes\n- No talking during the ride\n- Driver must wear black suit with no logos and carry tiny 'J.C.' sign for identification\n- Allergy alert: NO CITRUS, NO NUTS (deadly)"
Do NOT add "VIP", "hide car", "prepare to leave" if they're not in trip notes

IMPORTANT INFO (extract ONLY what's stated - with \n between items):
IF trip notes say: "Contact details required", "Temperature at 20°C, no scents", "FT/WSJ papers to be provided", "Vehicle: tinted, Wi-Fi, USB charging, Evian only"
→ Extract exactly these items:
"- Contact details required immediately\n- Vehicle temperature: 20°C, no scents\n- Newspapers: Financial Times, Wall Street Journal\n- Vehicle: Tinted windows, Wi-Fi, USB charging, Evian only"
Do NOT add "parking instructions" or "schedules" if not in trip notes

RECOMMENDATIONS (trip notes + data):
"Monitor BA123" + Traffic → "Track BA123 real-time; adjust for predicted 9-min delay"
"FT/WSJ papers" → "Ensure FT/WSJ in vehicle; place in rear pocket for access"
"20°C, no scents" + Weather → "Maintain 20°C, no scents; pre-warm 10 min before (rain expected)"
No note + Crime → "Caution at Connaught (safety 44/100); keep vehicle locked"

Cite sources (e.g., "78 crimes - UK Police Data"). Use actual data numbers.`;

    // Use GPT-4o-mini for comprehensive executive analysis (proven working, 90% cost reduction)
    console.log('🤖 Calling GPT-4o-mini for AI-powered analysis...');
    console.log(`📏 Prompt length: ${prompt.length} characters`);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000, // Increased to accommodate detailed extraction requirements
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
