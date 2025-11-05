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
   - External disruptions (protests, events causing detours)${trafficPredictions ? '\n   - Historical traffic delays' : ''}

5. KEY HIGHLIGHTS: 4-6 critical points
   Type: danger (high risk), warning (moderate), info (neutral), success (positive)

6. EXCEPTIONAL INFORMATION (EXTRACT FROM TRIP NOTES): Include items that are:
   - URGENT/time-sensitive (RIGHT NOW, ASAP, within X minutes)
   - Critical safety/medical (allergies, medical conditions, deadly risks)
   - Security/privacy requirements (VIP status, discretion, codes, signs)
   - Unusual/non-standard requirements (special dress codes, silence requirements, special identification)
   - Flight monitoring requirements
   - Immediate confirmations needed
   - Format as bullet points, one per line

7. IMPORTANT INFORMATION (EXTRACT FROM TRIP NOTES): Include items that are:
   - Contact details (phone numbers, email addresses, flight numbers)
   - Vehicle requirements and amenities (vehicle type, temperature settings, newspapers, WiFi, refreshments)
   - Meeting schedules with full details (times, locations, postcodes, duration)
   - Passenger comfort preferences (scents, food restrictions, temperature)
   - Specific parking instructions (hide car, secure parking, specific locations)
   - Restaurant/venue coordination needs (call ahead, reservations)
   - Drop-off/pickup location details
   - Alternative schedules or backup plans
   - Format as a STRING with sections separated by line breaks (use \n for new lines)
   - Example: "Contact Methods:\n- Email/phone for confirmation\n\nFlight Details:\n- BA123 landing 1:15 PM\n\nVehicle Specifications:\n- Tinted, WiFi, USB\n- Temperature: 20°C, no scents\n\nNewspapers:\n- FT, WSJ"
   - DO NOT return as a JSON object with keys - MUST be a plain string

8. RECOMMENDATIONS FOR THE DRIVER (AI-GENERATED ONLY - DO NOT EXTRACT FROM TRIP NOTES): 
   Provide 3-5 AI-generated actionable recommendations based on location data analysis:
   - Traffic timing adjustments (only if no schedule conflicts mentioned in trip notes)
   - Parking CPZ advice (only if no specific parking instructions in trip notes)
   - Weather/clothing preparation advice (only if no preferences in trip notes)
   - Top-rated cafes for driver convenience (only if no venue/food notes)
   - General safety precautions based on crime data
   - Alternative routes if severe traffic predicted
   
   CRITICAL: Do NOT include ANY items from trip notes in recommendations
   - If trip notes mention "Monitor flight BA123" → Goes to Exceptional Info ONLY, NOT recommendations
   - If trip notes mention "Provide FT/WSJ papers" → Goes to Important Info ONLY, NOT recommendations
   - If trip notes mention "Temperature 20°C" → Goes to Important Info ONLY, NOT recommendations
   
   Recommendations should provide DATA-DRIVEN insights, not repeat trip note requirements

Return JSON:
{
  "tripRiskScore": number,
  "overallSummary": "Start with: '[Passenger Name] x[number] passengers in [City]' on first line, then 'Vehicle: [Vehicle Type]' on second line, followed by 2-3 sentences about the trip",
  "riskScoreExplanation": "Explain why score is X/10, which data used and how calculated",
  "topDisruptor": "The ONE thing most likely to disrupt trip and why",
  "routeDisruptions": {"drivingRisks": ["str"], "externalDisruptions": ["str"]},
  "recommendations": ["3-5 AI-generated actionable items based on location data (traffic, parking CPZ, cafes, weather). ONLY if trip notes are minimal/generic. Do NOT duplicate anything from Exceptional or Important Information."],
  "highlights": [{"type": "danger|warning|info|success", "message": "str with source"}],
  "exceptionalInformation": "Extract from trip notes ONLY: Security codes (Code: Blue Horizon), URGENT time constraints (confirm in 2 minutes, rush to airport by 21:15), deadly allergies (NO CITRUS, NO NUTS deadly), unusual dress codes COMPLETE (black suit, no logos, J.C. sign all together), unusual behavioral requirements (NO TALKING, VIP passenger maintain discretion), urgent operational instructions (be ready to leave quickly, stash car after stops), flight monitoring (monitor flight BA123 live). Format as bullet points with '-', one per line. EXTRACT ALL MATCHING ITEMS - do not skip any. DO NOT DUPLICATE these in other sections. Return empty string if no exceptional items exist.",
  "importantInformation": "Extract from trip notes ONLY: Contact methods (contact for confirmation email/phone), flight details (numbers/times/terminals), vehicle specifications (tinted, WiFi, USB), vehicle restrictions (temperature 20°C AND no scents together, Evian only), newspapers/amenities (Provide FT/WSJ papers), food/beverage requests (bring a banana, even if profane), meeting schedules, parking instructions, drop-off/pickup details. Format as a STRING with clear sections using line breaks. Example:\n\nContact Methods:\n- Via email/phone for confirmation\n\nFlight Details:\n- Flight BA123 landing at 1:15 PM\n- Drop off for flight BA456 at 10 PM\n\nVehicle Specifications:\n- Tinted windows, Wi-Fi, USB charging\n\nVehicle Restrictions:\n- Temperature: 20°C, no scents\n- Evian only\n\nNewspapers/Amenities:\n- Financial Times, Wall Street Journal\n\nFood/Beverage Requests:\n- Bring a banana\n\nMeeting Schedules:\n- 3PM: Shard meeting (until 5PM)\n- 5:30PM: Legal meeting at Ned (until 7PM)\n\nEXTRACT ALL MATCHING ITEMS - count the lines in trip notes and ensure all are extracted. DO NOT SKIP temperature, scent, food requests, or any other details. DO NOT DUPLICATE items from Exceptional Information. MUST be a string, NOT an object. Return empty string if no important items exist."
}

MANDATORY FIELDS:
- recommendations: MUST be an array of 3-5 AI-generated items (do NOT extract from trip notes, provide data-driven advice)
- highlights: MUST be an array of 4-6 critical points with type and message

OPTIONAL FIELDS (POPULATED FROM TRIP NOTES - NO DUPLICATION):
- exceptionalInformation: Extract ONLY critical/urgent/unusual items from trip notes (see assignment list above)
- importantInformation: Extract ONLY contextual/requirement items from trip notes (see assignment list above)
- These two fields should contain 100% of trip notes content with ZERO overlap

CRITICAL RULES - TRIP NOTES DISTRIBUTION (EXTRACT EVERYTHING):
1. ALL INFORMATION from trip notes MUST be distributed across exceptionalInformation and importantInformation ONLY
2. DO NOT LOSE, OMIT, OR GENERALIZE any specific details from trip notes
3. DO NOT FILTER OUT inappropriate language, profanity, or unusual requests - extract them exactly as written
4. Process trip notes LINE BY LINE - every single line must go somewhere
5. DO NOT DUPLICATE - each item goes to ONE section only (Exceptional OR Important, never both)
6. Recommendations should contain ONLY AI-generated advice, NEVER items from trip notes
7. The goal is to make displaying raw trip notes obsolete - everything should be structured clearly
8. DO NOT INVENT OR ASSUME INFORMATION - Only extract what is explicitly stated
9. DO NOT USE THE EXAMPLES BELOW AS TEMPLATES - They are for understanding only
10. IF trip notes are minimal/generic (like "This is the only service required"), THEN:
    - Return EMPTY STRINGS for exceptionalInformation and importantInformation
    - Provide AI-generated recommendations based on location data
11. IF trip notes contain specific details, ENSURE 100% of that content is distributed (no duplication, no omissions)
12. DO NOT SKIP lines that seem irrelevant, inappropriate, or unclear - extract them anyway
13. Coverage target: 100% - if trip notes have 15 items, ALL 15 must appear in the report

DISTRIBUTION GUIDELINES:

EXCEPTIONAL INFORMATION - Extract from trip notes:
✓ URGENT items (RIGHT NOW, ASAP, "in X minutes/seconds", immediate, "rush to")
✓ Critical safety/medical (allergies with severity like "deadly", medical conditions, NO CITRUS, NO NUTS)
✓ Security/privacy (VIP status, "VIP passenger", discretion, privacy, confidentiality, codes like "Blue Horizon", special signs like "J.C.")
✓ Unusual requirements (COMPLETE dress codes like "black suit, no logos, tiny 'J.C.' sign for identification", silence requirements, "no talking")
✓ Flight monitoring tasks ("monitor flight BA123", "track arrival", "monitor flight BA123 live")
✓ Immediate confirmations needed ("confirm in 2 minutes", "respond immediately", "confirm details in 2 minutes")
✓ Urgent operational instructions ("be ready to leave quickly", "stash car quickly", "rush to airport by 21:15")
✓ Time-critical constraints (any mention of specific short timeframes, deadlines, "by 21:15", "by X time")
✓ Discretion/privacy statements ("maintain discretion", "VIP passenger, maintain discretion", "keep confidential", "ensure privacy")
✓ Unusual personal requests even if profane or unclear (extract exactly as written)
✗ Standard scheduling or routine preferences

CRITICAL: Extract COMPLETE dress codes as ONE item:
Example: "Driver: black suit, no logos, tiny 'J.C.' sign for identification" → "Driver must wear black suit with no logos and carry tiny 'J.C.' sign for identification"

IMPORTANT: For dress codes, extract the COMPLETE requirement in one statement:
Example: If notes say "Driver: black suit, no logos, tiny 'J.C.' sign"
Extract: "Driver must wear black suit with no logos and carry tiny 'J.C.' sign for identification"
Do NOT split this into separate items or omit parts

IMPORTANT INFORMATION - Extract from trip notes:
✓ Contact details (phone numbers, email addresses, "contact via email/phone", "Contact for confirmation: [email/phone]")
✓ Flight information (flight numbers, arrival/departure times, airports, terminals)
✓ Vehicle requirements (type, temperature settings like "20°C", "Temperature at 20°C", WiFi, USB, refreshments)
✓ Vehicle restrictions ("no scents", "Evian only", "tinted", "tinted windows", specific amenities)
✓ Newspapers/reading material ("FT/WSJ", "Financial Times", "Wall Street Journal", "Provide FT/WSJ papers")
✓ Food/beverage requests (water, snacks, specific items, "bring a banana", even if unusual/profane)
✓ Full meeting schedules (times, locations, postcodes, duration, venue names)
✓ Passenger comfort preferences (temperature, scents, quiet environment, "Temperature at 20°C, no scents")
✓ Parking instructions ("hide car", "stash car", "secure parking", specific locations)
✓ Restaurant/venue coordination (call ahead, reservations, confirmations)
✓ Drop-off/pickup details (locations, times, specific terminals)
✓ Alternative schedules or backup plans
✓ ANY other specific requests or requirements not covered above
✗ Generic information not in trip notes

CRITICAL: Extract temperature AND scent requirements together:
Example: "Temperature at 20°C, no scents" → Include both in Vehicle Restrictions section

FORMAT as a STRING with clear sections separated by line breaks, NOT as an object
Example: "Contact Methods:\n- Via email/phone\n\nFlight Details:\n- BA123 at 1:15 PM\n\nVehicle:\n- Tinted, WiFi, USB\n- Temperature: 20°C, no scents\n- Evian only"

RECOMMENDATIONS - AI-generated advice ONLY (do NOT extract from trip notes):
✓ Traffic timing suggestions (only if no schedule conflicts in trip notes)
✓ Parking CPZ advice (only if no specific parking instructions in trip notes)
✓ Weather/clothing advice (only if no preferences in trip notes)
✓ Top-rated cafes for driver convenience (only if no venue/food notes)
✓ General safety precautions based on crime data
✓ Alternative routes if traffic disruptions are severe
✗ Do NOT duplicate anything from Exceptional Information (codes, allergies, dress codes, urgent tasks, flight monitoring, discretion)
✗ Do NOT duplicate anything from Important Information (contact methods, vehicle specs, newspapers, schedules, parking instructions)

IMPORTANT: Avoid duplication - assign each item to ONE primary section only:

PRIMARY SECTION ASSIGNMENTS (do NOT duplicate across sections):

EXCEPTIONAL INFORMATION gets:
- Security codes ("Code: Blue Horizon")
- URGENT time constraints ("Confirm in 2 minutes", "RIGHT NOW")
- Deadly/critical allergies ("NO NUTS - deadly")
- Unusual dress codes ("black suit, no logos, 'J.C.' sign")
- Unusual behavioral requirements ("NO TALKING", "maintain discretion")
- Urgent operational instructions ("be ready to bolt", "quick exits")
- Flight monitoring ("Monitor flight BA123 live")

IMPORTANT INFORMATION gets:
- Contact methods ("via email/phone")
- Flight details (numbers, times, terminals)
- Vehicle specifications (tinted, WiFi, USB)
- Vehicle restrictions ("Evian only", "temperature 20°C", "no scents")
- Newspapers/amenities ("FT/WSJ papers")
- Meeting schedules (times, locations, postcodes)
- Drop-off/pickup details
- Parking instructions ("stash car", "secure parking")

RECOMMENDATIONS gets:
- AI-generated advice based on data (traffic, parking, cafes, weather)
- ONLY if trip notes are minimal/generic
- Do NOT duplicate items already in Exceptional or Important Information

This creates clear separation: what's CRITICAL (Exceptional), what's CONTEXTUAL (Important), what's ADVISORY (Recommendations)

COMPLETENESS VALIDATION - LINE BY LINE CHECK:
Before finalizing, review trip notes LINE BY LINE and ensure:

1. COUNT the number of lines in trip notes
2. COUNT the number of items extracted across Exceptional + Important Information
3. These numbers should MATCH (allowing for multi-line items that are combined)

SPECIFIC CHECKS (common items that get missed):
✓ Security code extracted? (e.g., "Code: Blue Horizon")
✓ VIP/discretion requirements extracted? (e.g., "VIP passenger, maintain discretion")
✓ COMPLETE dress code extracted as ONE item? (e.g., "black suit, no logos, tiny 'J.C.' sign")
✓ Temperature AND scent requirements extracted TOGETHER? (e.g., "Temperature at 20°C, no scents")
✓ Newspaper requests extracted? (e.g., "Provide FT/WSJ papers")
✓ Time-critical deadlines extracted? (e.g., "Rush to airport by 21:15")
✓ Food/beverage requests extracted, even if profane? (e.g., "bring a banana")
✓ Unclear/random text extracted with note? (e.g., "SEX" → add with "(context unclear)")
✓ Contact methods extracted? (e.g., "Contact for confirmation: [email/phone]")
✓ Flight monitoring extracted? (e.g., "Monitor flight BA123 live")
✓ Urgent confirmations extracted? (e.g., "Confirm details in 2 minutes")
✓ Operational instructions extracted? (e.g., "Stash the car after stops")

FINAL VALIDATION:
- Every specific detail has been extracted to EXACTLY ONE section (no duplication)
- No operational instructions are lost
- No preferences are omitted
- No timing details are missing
- No security items are missing
- No contact methods are missing
- No vehicle restrictions are missing
- No discretion/privacy requirements are missing
- The three sections together contain 100% of trip notes information WITHOUT duplication
- Check that items in Exceptional Info are NOT repeated in Important Info or Recommendations
- Check that items in Important Info are NOT repeated in Recommendations

TARGET: 100% COVERAGE - ZERO ITEMS MISSED

CRITICAL EXTRACTION EXAMPLES (extract to ONE section only - no duplication):

EXCEPTIONAL INFORMATION ONLY:
- "Code: Blue Horizon" → Extract: "- Code: Blue Horizon"
- "VIP passenger, maintain discretion" → Extract: "- VIP passenger, maintain discretion"
- "Confirm in 2 minutes" / "Confirm details in 2 minutes" → Extract: "- Confirm details in 2 minutes"
- "Monitor flight BA123 live" → Extract: "- Monitor flight BA123 live"
- "NO TALKING during the drive" / "No talking" → Extract: "- NO TALKING during the drive"
- "Be ready to leave quickly" → Extract: "- Be ready to leave quickly"
- "Stash the car after stops" → Extract: "- Stash the car after stops"
- "Rush to airport by 21:15" → Extract: "- Rush to airport by 21:15"
- "Driver: black suit, no logos, tiny 'J.C.' sign for identification" → Extract: "- Driver must wear black suit with no logos and carry tiny 'J.C.' sign for identification"
- "Allergy alert: NO CITRUS, NO NUTS (deadly)" → Extract: "- Allergy alert: NO CITRUS, NO NUTS (deadly)"

IMPORTANT INFORMATION ONLY:
- "Contact for confirmation: [email/phone]" → "Contact Methods:\n- Via email/phone for confirmation"
- "Temperature at 20°C, no scents" → "Vehicle Restrictions:\n- Temperature: 20°C, no scents"
- "Provide FT/WSJ papers" → "Newspapers/Amenities:\n- Financial Times, Wall Street Journal"
- "Vehicle: tinted, Wi-Fi, USB, Evian only" → "Vehicle Specifications:\n- Tinted windows, Wi-Fi, USB\n\nVehicle Restrictions:\n- Evian only"
- "bring a banana you SON OF A BITCH" → "Food/Beverage Requests:\n- Bring a banana"
- Flight details, meeting schedules → Respective sections

EXTRACT INAPPROPRIATE CONTENT:
- If trip notes contain profanity or unusual language, extract it but clean it up slightly
- "bring a banana you SON OF A BITCH" → "Food/Beverage Requests:\n- Bring a banana (urgent request)"
- Random words like "SEX" → If unclear, add to end of Important Information with note: "Additional note from trip notes: SEX (context unclear)"

CRITICAL: importantInformation MUST be a STRING, NOT an object
❌ WRONG: {"Flight Details": "...", "Contact Methods": "..."}
✅ CORRECT: "Contact Methods:\n- Via email/phone\n\nFlight Details:\n- BA123 at 1:15 PM\n\nVehicle Restrictions:\n- Temperature: 20°C, no scents"

RECOMMENDATIONS should contain ONLY:
- AI-generated advice if trip notes are minimal/generic
- Traffic timing suggestions (if no schedule conflicts in trip notes)
- Parking CPZ advice (if no specific parking instructions in trip notes)
- Weather/clothing advice (if no preferences in trip notes)
- Top-rated cafes (if no venue/food notes)

NOTE: When extracting dress codes, capture the COMPLETE requirement:
- If trip notes say "Driver: black suit, no logos, tiny 'J.C.' sign" 
- Extract ALL parts together in EXCEPTIONAL INFORMATION: "Driver must wear black suit with no logos and carry tiny 'J.C.' sign for identification"
- Don't extract only partial dress code information
- Don't duplicate in recommendations

FINAL REMINDER - ABSOLUTE REQUIREMENTS:
1. Process trip notes LINE BY LINE
2. ZERO items should be missed
3. If trip notes have 15 lines, extract all 15 items
4. DO NOT filter out profanity or unusual content
5. DO NOT skip items that seem unclear
6. MUST extract: temperature, scents, dress codes, food requests, security codes, VIP requirements, time deadlines
7. importantInformation MUST be a STRING, not an object
8. TARGET: 100% coverage - every single line from trip notes must appear somewhere

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
