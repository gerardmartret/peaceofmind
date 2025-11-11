// Executive Report Generator
// Generates a comprehensive trip analysis report with AI-powered risk scoring

import openai from './openai';
import { getCityConfig } from './city-helpers';

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
  // Get city configuration for conditional analysis
  const cityConfig = getCityConfig(tripDestination);
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🤖 GENERATING EXECUTIVE PEACE OF MIND REPORT WITH GPT-4O-MINI...');
    console.log('='.repeat(80));
    console.log(`📅 Trip Date: ${tripDate}`);
    console.log(`👤 Lead Passenger Name: ${leadPassengerName}`);
    console.log(`🚗 Vehicle Info: ${vehicleInfo}`);
    console.log(`👥 Passenger Count: ${passengerCount}`);
    console.log(`🏙️ Trip Destination: ${cityConfig.cityName}`);
    console.log(`🌍 City Mode: ${cityConfig.isLondon ? 'London (Full APIs)' : `${cityConfig.cityName} (Limited APIs)`}`);
    console.log(`👤 Passenger Names: ${passengerNames}`);
    console.log(`📝 Driver Notes: ${driverNotes}`);
    console.log(`📍 Locations: ${tripData.length}`);
    if (routeDistance) console.log(`🚗 Route: ${routeDistance} km, ${Math.round(routeDuration || 0)} min`);
    if (trafficPredictions) {
      const totalTrafficDelay = trafficPredictions.reduce((sum, leg) => sum + (leg.minutes - leg.minutesNoTraffic), 0);
      console.log(`🚦 Traffic Predictions: ${trafficPredictions.length} legs, +${totalTrafficDelay} min delay`);
    }

    // Prepare data summary for GPT (conditional based on city)
    const dataSummary = tripData.map((loc, idx) => {
      // Base data available for all cities
      const base = {
        stop: idx + 1,
        location: loc.locationName,
        time: loc.time,
        weatherSummary: `${loc.weather.summary.avgMinTemp}°C-${loc.weather.summary.avgMaxTemp}°C, ${loc.weather.summary.rainyDays} rainy days`,
        eventsCount: loc.events.summary.total,
        events: loc.events.events.map((e: any) => `${e.title} (${e.severity})`),
        premiumCafes: loc.cafes.cafes.length,
        topCafes: loc.cafes.cafes.slice(0, 3).map((c: any) => `${c.name} (${c.rating}⭐, ${'$'.repeat(c.priceLevel)}, ${Math.round(c.distance)}m)`),
        cafesAverageRating: loc.cafes.summary.averageRating,
      };

      // Add London-specific fields only for London
      if (cityConfig.isLondon) {
        return {
          ...base,
          safetyScore: loc.crime.safetyScore,
          totalCrimes: loc.crime.summary.totalCrimes,
          topCrimes: loc.crime.summary.topCategories.slice(0, 3).map((c: any) => `${c.category} (${c.count})`),
          trafficDisruptions: loc.disruptions.analysis.total,
          moderateDisruptions: loc.disruptions.analysis.bySeverity['Moderate'] || 0,
          topDisruptions: loc.disruptions.disruptions.slice(0, 2).map((d: any) => d.location),
          parkingRiskScore: loc.parking.parkingRiskScore,
          nearbyCarParks: loc.parking.summary.totalNearby,
          nearestParkingDistance: loc.parking.carParks[0]?.distance || 'None within 1km',
          cpzRestrictions: loc.parking.cpzInfo.inCPZ
            ? `${loc.parking.cpzInfo.zoneName} - ${loc.parking.cpzInfo.operatingHours} (${loc.parking.cpzInfo.chargeInfo})`
            : 'No CPZ restrictions',
        };
      }
      
      return base;
    });

    const prompt = `You are an executive security analyst preparing a "Peace of Mind" report for a VIP client traveling in ${cityConfig.cityName}.

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

${cityConfig.isLondon ? `
DATA SOURCES AVAILABLE (London):
- UK Police crime statistics (safetyScore, totalCrimes, topCrimes)
- Transport for London disruptions (trafficDisruptions, topDisruptions)
- TfL parking + CPZ zones (parkingRiskScore, cpzRestrictions, nearbyCarParks)
- Weather forecast (Open-Meteo)
- Google Maps traffic predictions
- Premium cafes (Google Places)
- Events data

ANALYSIS REQUIREMENTS:

1. TRIP RISK SCORE (1-10): 1-3=Low, 4-6=Moderate, 7-8=High, 9-10=Critical
   Include crime data, TfL disruptions, and parking difficulty (10-15% weight) in your assessment

2. Give the ONE thing that most likely to disrupt the trip. Explain why.
3. Explain why the trip risk score is what it is. Explain which data is used and how it is used to calculate the score.

4. ROUTE DISRUPTIONS:
   - Driving risks (traffic, TfL disruptions, road closures, weather)
   - External disruptions ${trafficPredictions ? '\n   - Historical traffic delays' : ''}
   - Crime and safety concerns

5. KEY HIGHLIGHTS: 4-6 critical points
   Type: danger (high risk), warning (moderate), info (neutral), success (positive)

6. EXCEPTIONAL INFORMATION: Critical/urgent trip requirements as actionable statements
7. IMPORTANT INFORMATION: Contextual trip requirements as actionable statements
8. RECOMMENDATIONS: Data-driven insights from location analysis (traffic, crime, TfL disruptions, weather, parking, CPZ zones)
` : `
DATA SOURCES AVAILABLE (${cityConfig.cityName} - Non-London):
- Weather forecast (Open-Meteo)
- Google Maps traffic predictions
- Premium cafes (Google Places)
- Events data

NOTE: UK Police crime data, TfL disruptions, and CPZ parking data NOT available for ${cityConfig.cityName}.

ANALYSIS REQUIREMENTS:

1. TRIP RISK SCORE (1-10): 1-3=Low, 4-6=Moderate, 7-8=High, 9-10=Critical
   Focus assessment on weather conditions, traffic predictions, and events. No crime/TfL/parking data available.

2. Give the ONE thing that most likely to disrupt the trip. Explain why (focus on weather, traffic, events).
3. Explain why the trip risk score is what it is. Explain which data sources you used (weather, traffic predictions, events) and how they influenced the score.

4. ROUTE DISRUPTIONS:
   - Driving risks (traffic, weather, road conditions)
   - External disruptions ${trafficPredictions ? '\n   - Historical traffic delays' : ''}
   - Major events

5. KEY HIGHLIGHTS: 4-6 critical points
   Type: danger (high risk), warning (moderate), info (neutral), success (positive)

6. EXCEPTIONAL INFORMATION: Critical/urgent trip requirements as actionable statements
7. IMPORTANT INFORMATION: Contextual trip requirements as actionable statements
8. RECOMMENDATIONS: Data-driven insights from available data (traffic predictions, weather, events, cafes). Do NOT mention crime, TfL disruptions, or parking restrictions as these are not available.
`}

Return JSON:
{
  "tripRiskScore": number,
  "overallSummary": "Start with: '[Passenger Name] x[number] passengers in [City]' on first line, then 'Vehicle: [Vehicle Type]' on second line, followed by 2-3 sentences about the trip",
  "riskScoreExplanation": "Explain why score is X/10, which data used and how calculated",
  "topDisruptor": "The ONE thing most likely to disrupt trip and why",
  "routeDisruptions": {"drivingRisks": ["str"], "externalDisruptions": ["str"]},
  "recommendations": ["Data-driven only: traffic timing, parking strategies, crime precautions, weather prep"],
  "highlights": [{"type": "danger|warning|info|success", "message": "str"}],
  "exceptionalInformation": "Trip notes ONLY. Safety-critical and urgent items as actionable statements. If NO exceptional items found, return empty string ''. Examples: '- Ensure vehicle is completely nut-free (passenger has severe allergy)', '- Confirm driver wears dark suit as specified', '- Maintain driver silence throughout journey'",
  "importantInformation": "Trip notes ONLY. Contextual and operational items as actionable statements. If NO important items found, return empty string ''. Examples: '- Keep Emily (+44 7911 223344) informed of any delays', '- Confirm fast WiFi and charging ports operational', '- Stock vehicle with still and sparkling water'"
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
EXCEPTIONAL: 
  - ANY food restrictions/allergies (any mention of "no X", "allergy", "allergic", "cannot have", food avoidances)
  - Dress codes: "suit", "uniform", "plain black", "dark suit", any clothing requirements
  - Driver behavior: "silent", "quiet", "no talking", "maintain discretion"
  - Signs to hold (name signs for pickup)
  - Security codes
  - Urgent operations (monitor flight, hide car, confirm immediately)
IMPORTANT: 
  - Contacts (names, phone numbers, emails)
  - Vehicle specs (WiFi, chargers, privacy glass, temperature, massage seats, fridge, etc.)
  - Newspapers (FT, WSJ, etc)
  - Food/drinks to provide (water, sparkling, snacks, champagne)
  - Luggage/bags help
  - Flight numbers to track
  - Parking instructions
  - Quotes, billing, invoicing
  - Waiting time

CRITICAL CATEGORIZATION RULES:
- "Driver: suit, silent" → EXCEPTIONAL (suit=dress code, silent=behavior)
- "Track flight X" → IMPORTANT (flight tracking)
- "No nuts" or any "no X" food → EXCEPTIONAL (safety)
- "Contact X" → IMPORTANT (contact info)
- If unsure, prefer EXCEPTIONAL for safety/urgency items

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

EXAMPLES:

Example 1 (10 lines):
Trip notes: "Contact Emily +44 7911 223344" / "Driver: dark suit" / "Help with bags" / "Wi-Fi and chargers" / "Water and sparkling" / "No nuts" / "FT newspaper" / "Privacy glass up" / "Quiet driver" / "Quote ASAP"
Exceptional (4): "- Ensure vehicle nut-free (safety critical)\n- Confirm driver wears dark suit\n- Maintain driver silence\n- Maintain privacy glass raised"
Important (6): "- Keep Emily (+44 7911 223344) informed\n- Assist with luggage\n- Confirm WiFi and chargers operational\n- Stock still and sparkling water\n- Ensure FT newspaper available\n- Prepare comprehensive quote"
COUNT: 10 = 4 + 6 ✓

Example 2 (3 lines) - Simpler trip:
Trip notes: "Driver: suit, silent" / "Contact Eleanor +44 20 7946 0012" / "Track flight VS026"
Exceptional (2): "- Confirm driver wears suit as specified\n- Maintain driver silence throughout journey"
Important (1): "- Keep Eleanor (+44 20 7946 0012) informed of any delays"
COUNT: 3 = 2 + 1 ✓

KEY: "Driver: suit, silent" = TWO exceptional items (suit=dress code, silent=behavior), NOT one

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
