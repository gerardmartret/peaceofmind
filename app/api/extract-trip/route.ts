import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { extractFlightNumbers, matchFlightsToLocations } from '@/lib/flight-parser';
import { getCityConfig } from '@/lib/city-helpers';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Google Maps API key - Use the same key as the frontend
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

console.log('🔑 [API] Google Maps API Key status:', GOOGLE_MAPS_API_KEY ? `LOADED ✅ (length: ${GOOGLE_MAPS_API_KEY.length})` : 'MISSING ❌');

// Function to verify location with Google Maps Geocoding API
async function verifyLocationWithGoogle(locationQuery: string, tripDestination?: string) {
  console.log(`🔍 [API] Verifying location with Google Maps: "${locationQuery}"`);
  
  // Get city-specific configuration
  const cityConfig = getCityConfig(tripDestination);
  console.log(`🌍 [API] City context: ${cityConfig.cityName} (bias: ${cityConfig.geocodingBias}, region: ${cityConfig.geocodingRegion})`);
  
  // Check if API key is available
  if (!GOOGLE_MAPS_API_KEY) {
    console.error('❌ [API] CRITICAL: Google Maps API key is missing!');
    console.error('❌ [API] Check your .env.local file for GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
    return {
      verified: false,
      formattedAddress: locationQuery,
      lat: 0,
      lng: 0,
      placeId: null,
    };
  }
  
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.append('address', `${locationQuery}, ${cityConfig.geocodingBias}`);
    url.searchParams.append('key', GOOGLE_MAPS_API_KEY);
    url.searchParams.append('region', cityConfig.geocodingRegion);

    const maskedUrl = url.toString().replace(GOOGLE_MAPS_API_KEY, `***${GOOGLE_MAPS_API_KEY.slice(-4)}`);
    console.log(`📡 [API] Google Maps API URL:`, maskedUrl);

    const response = await fetch(url.toString());
    const data = await response.json();

    console.log(`📥 [API] Google Maps API response status:`, data.status);
    console.log(`📥 [API] Google Maps API results count:`, data.results?.length || 0);

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const verifiedData = {
        verified: true,
        formattedAddress: result.formatted_address,
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        placeId: result.place_id,
      };
      console.log(`✅ [API] Location verified:`, verifiedData);
      return verifiedData;
    }

    console.log(`⚠️ [API] Location NOT verified (status: ${data.status})`);
    return {
      verified: false,
      formattedAddress: locationQuery,
      lat: 0,
      lng: 0,
      placeId: null,
    };
  } catch (error) {
    console.error('❌ [API] Error verifying location with Google:', error);
    return {
      verified: false,
      formattedAddress: locationQuery,
      lat: 0,
      lng: 0,
      placeId: null,
    };
  }
}

export async function POST(request: NextRequest) {
  console.log('🚀 [API] Starting trip extraction...');
  
  try {
    const { text, tripDestination } = await request.json();
    console.log(`📝 [API] Received text (${text?.length || 0} chars):`, text?.substring(0, 100) + '...');
    if (tripDestination) {
      console.log(`🌍 [API] Trip destination specified: ${tripDestination}`);
    }

    if (!text || typeof text !== 'string') {
      console.log('❌ [API] Invalid text provided');
      return NextResponse.json(
        { success: false, error: 'Invalid text provided' },
        { status: 400 }
      );
    }
    
    // Get city configuration for context
    const cityConfig = getCityConfig(tripDestination);

    console.log('🤖 [API] Calling OpenAI for extraction and summary generation...');
    // Call OpenAI to extract locations, times, date, AND generate professional summary
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a trip planning assistant that extracts location and time information from unstructured text (emails, messages, etc.).

CITY CONTEXT: ${cityConfig.isLondon && !tripDestination ? 'AUTO-DETECT the trip destination city from the text. Look for city names, airports (JFK/LaGuardia=New York, Heathrow/Gatwick=London, SIN/Changi=Singapore), or location context clues.' : `This trip is for ${cityConfig.cityName}. Extract locations relevant to ${cityConfig.cityName}.`}

METRO AREA COVERAGE:
- "New York" = NYC metro area (Manhattan, Brooklyn, Queens, Bronx, Staten Island, Yonkers, Jersey City, Newark, Hoboken, Long Island)
- "London" = Greater London (all 32 boroughs + City of London)
- "Singapore" = Singapore island + surrounding areas within ~50km
- Include locations in surrounding areas within ~50km of city center

CRITICAL: For driverNotes, preserve ALL unique content from the original email BUT exclude ANY information that's already extracted into structured fields (locations, times, dates, names). Do NOT repeat location names, addresses, times, or dates in driverNotes - these are already in the locations array. ONLY include contextual details not captured elsewhere.

Extract:
1. All locations (addresses, landmarks, stations, airports, etc.) - identify which city/metro area they belong to
   - For New York: Include NYC proper (Manhattan, Brooklyn, Queens, Bronx, Staten Island) AND metro area (Yonkers, Jersey City, Newark, Long Island, etc.)
   - For London: Include Greater London area
   - For Singapore: Include Singapore island and surrounding areas
2. Associated times for each location
3. Trip date if mentioned
4. Lead passenger name (main/first passenger name)
5. Number of passengers (total count)
6. Trip destination/city - CRITICAL: Detect from context! Look for:
   - City names mentioned: "New York", "NYC", "Nueva York", "Londres", "London", "Singapore", "Singapura", etc.
   - Airport codes: JFK/LGA/EWR/Newark = New York, LHR/LGW/STN/LTN = London, SIN/Changi = Singapore
   - Address patterns: "NY", "Manhattan", "Brooklyn", "Queens", "Bronx", "Yonkers", "Jersey City" = New York
   - Address patterns: "UK", "Westminster", "Camden" = London
   - Address patterns: "SG", "Singapore" = Singapore
7. Vehicle information (ONLY brand and model, e.g., 'Mercedes S-Class', 'BMW 7 Series')
8. Driver notes (ONLY information that doesn't fit in structured fields - NO location names, NO times, NO dates. Include: contact info, special instructions, flight details, vehicle features, dress codes, allergies, preferences, etc.)
9. Passenger names (all passenger names as array)
10. Specific details for each location: person names, company names, venue names, meeting types, etc.

Return a JSON object with this exact structure:
{
  "success": true,
  "date": "YYYY-MM-DD ONLY if explicitly mentioned in text, otherwise null. CRITICAL: If no date is mentioned at all, return null. Do NOT invent or assume a date. If year is not mentioned but date is, use current year (${new Date().getFullYear()})",
  "leadPassengerName": "Main passenger name (e.g., 'Mr. Smith', 'John Doe') or null if not mentioned",
  "passengerCount": number,
  "tripDestination": "Main destination city only (e.g., 'London', 'New York', 'Paris')",
  "vehicleInfo": "ONLY vehicle brand and model (e.g., 'Mercedes S-Class', 'BMW 7 Series', 'Audi A8'). Do NOT include color, features, amenities, or requirements. Put those details in driverNotes instead. Null if not mentioned.",
  "passengerNames": ["Name1", "Name2", "Name3"],
  "driverNotes": "ONLY contextual information NOT captured elsewhere. ABSOLUTELY EXCLUDE: ALL location names (airports, hotels, restaurants, venues, addresses), ALL times (pickup, dropoff, stops), ALL dates, ALL passenger names, vehicle brand/model, trip destination. ONLY INCLUDE: flight numbers, contact info, special instructions, vehicle features (color/amenities), dress codes, allergies, security requirements, operational codes, waiting procedures, preferences. Zero redundancy with locations array or other fields. Format as bullet points.",
  "removedLocations": ["OPTIONAL: Array of location keywords/names to REMOVE. Extract from phrases like 'skip X', 'remove X', 'cancel X', 'no need for X'. Example: 'skip the rosewood stop' → ['rosewood']. If no removals mentioned, return empty array []"],
  "locations": [
    {
      "location": "Full location name",
      "time": "HH:MM in 24-hour format (ALWAYS use HH:MM format like '09:30', '15:00', NEVER put confidence level here)",
      "confidence": "high/medium/low (this is separate from time - indicates how certain you are about the time estimate)",
      "purpose": "Comprehensive short name that summarizes the purpose with specific details (e.g., 'Pick up at JFK Airport', 'Investment Meeting at UBS Bank with Mr John', 'Dinner at Nobu with Mr. Smith', 'Hotel check-in at The Langham')",
      "insertAfter": "OPTIONAL: keyword/name of location to insert after (ONLY if text says 'add after X' or 'quick stop after X')",
      "insertBefore": "OPTIONAL: keyword/name of location to insert before (ONLY if text says 'add before X')"
    }
  ]
}

CRITICAL TIME FORMATTING RULES:
- "time" field MUST ALWAYS be in "HH:MM" format (e.g., "09:30", "14:00", "21:45")
- NEVER put "low", "medium", "high" in the time field - those go in "confidence" field
- If no specific time mentioned, estimate based on context and previous/next locations
- Example: If pickup is 13:45 and dropoff is 21:30, spread middle stops evenly (14:30, 16:00, 17:30, 19:00, 20:00)
- Use "confidence": "low" for estimated times, but time field must still be "HH:MM" format

Rules for extraction:
- Sort locations chronologically by time (if locations exist)
- Convert all times to 24-hour format (e.g., "3pm" -> "15:00", "9am" -> "09:00")
- If time is relative (e.g., "2 hours later"), calculate based on previous time
- CRITICAL: When text mentions "from [location A] to [location B]", extract ONLY location B as the destination. Location A is context (previous/current location), NOT a new stop to add
- Example: "from blackrock 1 new change to GATWICK" → Extract ONLY "Gatwick Airport" (not "1 New Change")
- Example: "go straight from office to airport" → Extract ONLY the airport (not "office")

REMOVAL OPERATIONS (CRITICAL):
- If text contains removal keywords: "skip", "remove", "cancel", "delete", "no need for", "drop", "eliminate"
- Extract the location keyword being removed
- Add to "removedLocations" array (separate from locations array)
- Examples:
  * "skip the rosewood stop" → removedLocations: ["rosewood"]
  * "remove stop 3" → removedLocations: ["stop 3"]
  * "cancel the ritz hotel visit" → removedLocations: ["ritz hotel"]
  * "no need shower" in context "skip rosewood (no need shower)" → removedLocations: ["rosewood"]
  * "skip meeting at Goldman Sachs" → removedLocations: ["goldman sachs"]
- Extract KEYWORDS that identify the location (venue names, purpose words, building names)
- Do NOT extract removal phrases as regular locations
- If location is being removed, it should ONLY appear in removedLocations, NOT in locations array

POSITIONAL OPERATIONS (ADD/INSERT):
- If text contains "ADD [location] AFTER [reference]", "add [location] after [reference]", "quick stop after [reference]", or similar:
  * Extract the new location details normally
  * Add special field "insertAfter": "[reference location keyword]"
  * Reference keywords: extract key identifying words (e.g., "after sexy fish" → insertAfter: "sexy fish")
  * Example: "ADD 30 St Mary Axe after Sexy Fish" →
    {
      location: "30 St Mary Axe",
      time: "13:00",
      purpose: "Drop files",
      insertAfter: "sexy fish",
      confidence: "low"
    }

- If text contains "ADD [location] BEFORE [reference]", "add [location] before [reference]":
  * Add special field "insertBefore": "[reference keyword]"
  * Example: "add stop before dropoff" → insertBefore: "dropoff"

- If text contains "ADD [location]" without position keywords:
  * No insertion metadata (will append at end)

- Common reference patterns to detect:
  * "after lunch" → insertAfter: "lunch"
  * "after meeting" → insertAfter: "meeting"
  * "before dropoff" → insertBefore: "dropoff"
  * "after [venue name]" → insertAfter: "[venue name]"
  
CRITICAL: Distinguish between ADD and normal location mentions:
- "ADD stop at X after Y" → locations: [{location: X, insertAfter: Y}]
- "go to X then Y" → locations: [{location: X}, {location: Y}] (normal extraction, no position metadata)
- CRITICAL: If no specific time mentioned, ESTIMATE a reasonable time in HH:MM format
  * Example: Pickup at 13:45, then estimate: 14:45 (breakfast), 16:00 (meeting), 18:00 (lunch), 19:30 (pitch), 20:30 (shower), 21:30 (dropoff)
  * Set "confidence": "low" for estimates, but "time" must ALWAYS be "HH:MM" format like "14:45", NEVER "low"
- Expand abbreviated locations appropriately:
  * Airport codes: JFK/LGA/EWR → include "Airport" suffix
  * LHR/LGW/STN/LTN → include "Airport" suffix
  * SIN/Changi → include "Airport" suffix
- ONLY include locations in the trip destination city/metro area (auto-detect from context)
- For New York: Include all NYC metro area locations (Yonkers, Jersey City, Newark, etc. are valid)
- For London: Include all Greater London locations
- For Singapore: Include all Singapore island and surrounding area locations
- IMPORTANT: If the text contains ONLY instructions, notes, or verbal updates WITHOUT locations:
  * Return locations as empty array []
  * Put all instructions/notes in driverNotes field
  * Still set success: true if there's any extractable information (notes, passenger info, vehicle info, etc.)
  * Examples of valid non-location updates:
    - "make sure driver is dressed like a clown" → locations: [], driverNotes: "- Make sure driver is dressed like a clown"
    - "bring a watermelon" → locations: [], driverNotes: "- Bring a watermelon"
    - "ok" or "sounds good" → locations: [], driverNotes: "- Acknowledged", success: true
    - Any text that doesn't contain locations should still be captured in driverNotes if it's meaningful
- CRITICAL EXCEPTION: Location UPDATE instructions (change/update pickup/dropoff/stop location) MUST be extracted to locations array, NOT driverNotes:
  * "change pickup location to Gatwick" → locations: [{location: "Gatwick Airport", time: "09:00", purpose: "Pick up", confidence: "high"}]
  * "update pick up to Heathrow" → locations: [{location: "Heathrow Airport", time: "09:00", purpose: "Pick up", confidence: "high"}]
  * "change dropoff location to London City Airport" → locations: [{location: "London City Airport", time: "17:00", purpose: "Drop off", confidence: "high"}]
  * These are location updates, NOT just notes - they must go in locations array

CRITICAL: Arrival/Departure keyword categorization:
  * "arrival", "arrive", "arriving", "landing", "land", "arrived" → ALWAYS categorize as "Pick up" (passenger arrives at this location)
  * "departure", "depart", "departing", "leaving", "leave", "departed" → ALWAYS categorize as "Drop off" (passenger departs from this location)
  * Examples:
    - "arrival location changed to Gatwick" → locations: [{location: "Gatwick Airport", time: "09:00", purpose: "Pick up", confidence: "high"}]
    - "arrival changed to Heathrow" → locations: [{location: "Heathrow Airport", time: "09:00", purpose: "Pick up", confidence: "high"}]
    - "departure location changed to London City Airport" → locations: [{location: "London City Airport", time: "17:00", purpose: "Drop off", confidence: "high"}]
    - "departure changed to Gatwick" → locations: [{location: "Gatwick Airport", time: "17:00", purpose: "Drop off", confidence: "high"}]
- If no extractable information at all (no locations, no notes, no passenger info, etc.), then return success: false
- CRITICAL DATE RULE: Return date as null if NO date is mentioned in text. Do NOT invent, assume, or default to any date. ONLY if date IS mentioned: convert to YYYY-MM-DD format. If year is NOT mentioned but date is, use current year (${new Date().getFullYear()}). Examples: "March 15" → "${new Date().getFullYear()}-03-15", "Dec 25" → "${new Date().getFullYear()}-12-25", but if text has NO date → null
- Pay attention to context around each location: who is involved, what type of activity, company names, venue names
- Look for clues like "meeting with", "dinner at", "pickup from", "drop-off at", "check-in at", etc.
- CRITICAL RULE: Avoid ALL redundancy between driverNotes and structured fields. If information is captured in location, time, purpose, date, vehicleInfo, or passengerNames, do NOT repeat it in driverNotes
- FINAL CHECK: Before finalizing driverNotes, review and remove ANY mention of location names, venue names, hotel names, restaurant names, airport names, times, or dates. These are ALL in the locations array already

Rules for location purpose:
- Create comprehensive, descriptive names that include specific details from the email
- Include relevant information: location name, person names, company names, event types, etc.
- ALL basic location and time info should be in the locations array, NOT in driverNotes
- Format: "[Action] at [Location] [with/for Additional Details]"
- Examples:
  * "Pick up at Gatwick Airport" (for airport pickups)
  * "Investment Meeting at UBS Bank with Mr John" (for business meetings)
  * "Dinner at Belladonna with Mr. Smith" (for restaurant visits)
  * "Hotel check-in at The Savoy" (for accommodation)
  * "Drop-off at Heathrow Terminal 5" (for airport drop-offs)
  * "Lunch at The Shard with Board Members" (for business meals)
  * "Meeting at Canary Wharf Office" (for office visits)
- Keep names concise but informative (3-8 words typically)
- Include person names, company names, or venue names when mentioned in the email
- If specific details are unclear, use the location name with the action

Rules for lead passenger name extraction:
- Extract the MAIN or FIRST passenger name mentioned in the email
- This should be the primary client/passenger (often the first one mentioned or the VIP/client name)
- Look for patterns like "Mr. Smith", "John Doe", "Client: Name", "VIP: Name"
- If multiple passengers mentioned, choose the one who appears to be the primary client
- Return null if no clear lead passenger name is found

UPDATE/MODIFICATION OPERATIONS (CRITICAL):
- If text contains update keywords: "change", "update", "set", "modify", "edit" followed by a field name and "to" or "is"
- Extract the NEW value and put it in the appropriate structured field (NOT driverNotes)
- Examples:
  * "change passenger first name to Kendrik" → leadPassengerName: "Kendrik"
  * "update passenger name to Mr. Smith" → leadPassengerName: "Mr. Smith"
  * "set vehicle to Mercedes S-Class" → vehicleInfo: "Mercedes S-Class"
  * "modify date to March 15" → date: "${new Date().getFullYear()}-03-15"
  * "change pickup time to 3pm" → locations: [{location: "Pickup", time: "15:00", purpose: "Pick up", confidence: "high"}] (extract location entry with updated time - location name can be generic like "Pickup" or "Dropoff" if only time is being updated)
  * "update passenger count to 4" → passengerCount: 4
  * "change pickup location to Gatwick airport" → locations: [{location: "Gatwick Airport", time: "09:00", purpose: "Pick up", confidence: "high"}]
  * "change pick up location to Heathrow" → locations: [{location: "Heathrow Airport", time: "09:00", purpose: "Pick up", confidence: "high"}]
  * "update dropoff to London City Airport" → locations: [{location: "London City Airport", time: "17:00", purpose: "Drop off", confidence: "high"}]
  * "change stop 2 to The Ritz Hotel" → Extract location with appropriate time and purpose
- Field recognition patterns:
  * "passenger" + ("name"|"first name"|"firstname") → leadPassengerName
  * "vehicle"|"car"|"auto" → vehicleInfo
  * "date"|"trip date"|"day" → date
  * "time"|"pickup time"|"dropoff time" → time (for locations)
  * "passenger count"|"number of passengers"|"passengers" → passengerCount
  * "pickup"|"pick up"|"pick-up" + ("location"|"address"|"place") → Extract as first location (pickup)
  * "dropoff"|"drop off"|"drop-off" + ("location"|"address"|"place") → Extract as last location (dropoff)
  * "arrival"|"arrive"|"arriving"|"landing"|"land"|"arrived" + ("location"|"address"|"place") → Extract as first location with purpose "Pick up" (arrival = pickup)
  * "departure"|"depart"|"departing"|"leaving"|"leave"|"departed" + ("location"|"address"|"place") → Extract as last location with purpose "Drop off" (departure = dropoff)
  * "stop" + number + "to" → Extract as location at that position
- CRITICAL: When location update pattern is detected (pickup/dropoff/stop), extract the NEW location to the locations array with:
  * Full location name (expand airport codes: LGW → Gatwick Airport, LHR → Heathrow Airport)
  * Appropriate time (use existing time if mentioned, otherwise estimate based on context)
  * Purpose indicating it's a pickup/dropoff/stop update
  * confidence: "high" (since it's an explicit update instruction)
- CRITICAL: When update pattern is detected, extract the NEW value to the structured field, NOT driverNotes
- If update pattern is ambiguous or unclear, still attempt extraction but set confidence appropriately

Rules for passenger extraction:
- Extract all passenger names mentioned in the email into passengerNames array
- Count total number of passengers accurately
- Extract main destination city or location
- Look for patterns like "Mr. Smith", "John and Mary", "3 passengers", "group of 4"

Rules for vehicle information extraction:
- Extract ONLY the vehicle brand and model (e.g., "Mercedes S-Class", "BMW 7 Series", "Audi A8")
- Do NOT include: color, tint, features (Wi-Fi, USB, leather), amenities (water, refreshments), or any other details
- Examples: "black Mercedes S-Class with tinted windows" → vehicleInfo: "Mercedes S-Class", driverNotes should include "- Vehicle: black with tinted windows"
- All vehicle details OTHER than brand/model must go in driverNotes (color, features, requirements, amenities, etc.)
- If vehicle brand/model is not explicitly mentioned, return null
- Generic terms like "luxury vehicle" or "executive sedan" without brand/model should return null and go in driverNotes

- RECOGNIZE AND EXPAND COMMON ABBREVIATIONS:
  * "s class" / "s-class" / "sclass" → "Mercedes S-Class"
  * "e class" / "e-class" / "eclass" → "Mercedes E-Class"
  * "c class" / "c-class" / "cclass" → "Mercedes C-Class"
  * "7 series" / "7-series" → "BMW 7 Series"
  * "5 series" / "5-series" → "BMW 5 Series"
  * "3 series" / "3-series" → "BMW 3 Series"
  * "a8" → "Audi A8"
  * "a6" → "Audi A6"
  * "a4" → "Audi A4"
- If abbreviation is ambiguous (just "s class" without brand name), default to most common: "Mercedes S-Class"
- Include model context: "black s class" → vehicleInfo: "Mercedes S-Class", driverNotes: "- Vehicle: black"

Rules for trip destination (CRITICAL - AUTO-DETECT):
- Extract ONLY the city name (e.g., "London", "New York", "Paris", "Tokyo")
- AUTO-DETECT from text clues:
  * Explicit mentions: "New York", "NYC", "Nueva York" → "New York"
  * Explicit mentions: "London", "Londres" → "London"
  * Airport codes: JFK/LaGuardia/LGA/Newark/EWR → "New York"
  * Airport codes: Heathrow/LHR/Gatwick/LGW/Stansted/Luton → "London"
  * Address patterns: "NY", "Manhattan", "Brooklyn", "Queens", "Bronx", "Yonkers", "Jersey City", "Newark NJ" → "New York"
  * Address patterns: "UK", "Westminster", "Camden", "Greater London" → "London"
- IMPORTANT: "New York" includes the entire NYC metro area (5 boroughs + Yonkers + Jersey City + Newark + Long Island)
- IMPORTANT: "London" includes Greater London area
- Do NOT include specific addresses, airports, or venues in the city name
- If multiple cities mentioned, choose where most locations are
- ONLY if absolutely no city clues exist, default to "${cityConfig.cityName}"

Rules for driver notes:
- Include ONLY information that does NOT fit in any structured field above
- ABSOLUTE CRITICAL RULE: ZERO REDUNDANCY WITH STRUCTURED FIELDS
  * Do NOT mention ANY location names: no airports, no hotels, no restaurants, no venues, no addresses, no stops - NOTHING from the locations array
  * Do NOT mention ANY times: no pickup times, no dropoff times, no stop times, no meeting times - NOTHING from location times
  * Do NOT mention "pickup", "drop off", "stop at", "meeting at", "visit to" when referring to specific locations that are in the locations array
  * Do NOT mention ANY dates (already in date field)
  * Do NOT mention passenger names (already extracted)
  * Do NOT mention vehicle brand/model (already in vehicleInfo)
  * Do NOT mention trip destination city (already extracted)
  * Do NOT describe the itinerary, route, or sequence of stops - all locations are already in the locations array
  * Do NOT include "adjusted schedule", "schedule:", or any description of the trip timeline/itinerary - the complete schedule is in the locations array
  * Do NOT say things like "2 PM meeting at...", "5 PM at...", "7 PM lunch at..." - these are already in locations
  * TREAT ALL LOCATION INFORMATION AS COMPLETELY HANDLED BY THE LOCATIONS ARRAY
  * TREAT ALL SCHEDULE/ITINERARY INFORMATION AS COMPLETELY HANDLED BY THE LOCATIONS ARRAY
- MUST INCLUDE all vehicle details except brand/model: color, tint, features (Wi-Fi, USB, leather seats), amenities (water, snacks), and any vehicle-related requirements
- INCLUDE flight numbers, airline codes, terminal information WITHOUT location names (e.g., "Flight BA177", "Terminal 5" but NOT "Flight BA177 at Heathrow")
- INCLUDE contact details, phone numbers, email addresses
- INCLUDE timing constraints WITHOUT specific times (e.g., "confirm in 5 minutes", "allow extra time" but NOT "pickup at 3pm")
- INCLUDE security requirements, VIP status, special instructions (e.g., "VIP passenger", "maintain discretion", "high security clearance required")
- INCLUDE meeting/event details WITHOUT location names (e.g., "dress code: black tie", "bring presentation materials" but NOT "meeting at The Shard")
- INCLUDE parking requirements, waiting instructions WITHOUT locations (e.g., "wait with engine running", "park around the corner" but NOT "park near The Ritz")
- INCLUDE passenger preferences, allergies, special requirements (e.g., "no nuts allergy (deadly)", "temperature at 20°C", "no scents")
- INCLUDE driver appearance requirements (e.g., "plain black suit, no logos", "use tiny 'J.C.' sign for identification")
- INCLUDE operational codes, confirmation requirements, monitoring instructions (e.g., "Code: Blue Horizon", "monitor flight status", "confirm arrival")
- INCLUDE ALL verbal instructions that don't reference specific locations (e.g., "make sure driver is dressed like a clown", "bring a watermelon")
- FORMAT as bullet points using "- " prefix, one item per line
- MAINTAIN the original tone, urgency, and emphasis
- REPHRASE and ORGANIZE for clarity while keeping ALL non-redundant information
- If text contains ONLY instructions (no locations), ALL content goes into driverNotes
- Example format:
  - Code: "Blue Horizon"
  - Flight BA177, monitor for delays
  - Contact Elena +44 20 1234 5678 before arrival
  - Wait with engine running (NO location mentioned)
  - VIP passenger, maintain discretion
  - Driver: plain black suit, no logos, use tiny 'J.C.' sign
  - Vehicle: black with tinted windows, Wi-Fi, USB charging
  - Allergy alert: NO NUTS (deadly)
  - Temperature at 20°C, no scents
  - Confirm driver details in 5 minutes
  - (Notice: NO "schedule", NO "itinerary", NO locations, NO times, NO stops mentioned)
- Example: If email says "URGENT: Code Blue. Contact Elena +44 20 1234 5678 before arrival. Wait at Terminal 5. Flight BA177 delayed 30 minutes. Call passenger upon arrival. Pick up Mr. Smith at Heathrow at 3pm. Meeting at The Shard at 4pm. Lunch at Ivy Garden at 7pm. Drop off at London City Airport at 10pm. Black Mercedes with tinted windows, Wi-Fi, no nuts allergy.", extract as:
  * leadPassengerName: "Mr. Smith"
  * vehicleInfo: "Mercedes"
  * locations: [
      {location: "Heathrow", time: "15:00", purpose: "Pick up Mr. Smith"},
      {location: "The Shard", time: "16:00", purpose: "Meeting"},
      {location: "Ivy Garden", time: "19:00", purpose: "Lunch"},
      {location: "London City Airport", time: "22:00", purpose: "Drop off Mr. Smith"}
    ]
  * driverNotes: "- Code: Blue\n- Contact Elena +44 20 1234 5678 before arrival\n- Wait at Terminal 5\n- Flight BA177 delayed 30 minutes, monitor for updates\n- Call passenger upon arrival\n- Vehicle: black with tinted windows, Wi-Fi\n- Allergy alert: NO NUTS"
  * CRITICAL NOTE: driverNotes contains ZERO mentions of:
    - "Heathrow", "The Shard", "Ivy Garden", or "London City Airport" (all in locations)
    - "3pm", "4pm", "7pm", or "10pm" (all in locations as times)
    - "Pick up at", "Meeting at", "Lunch at", "Drop off at" (all in location purposes)
    - "Mr. Smith" appearing again (already in leadPassengerName)
  * driverNotes ONLY contains contextual info NOT already in structured fields`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent extraction
    });

    const result = completion.choices[0].message.content;
    console.log('✅ [API] OpenAI response received:', result?.substring(0, 200) + '...');
    
    const parsed = JSON.parse(result || '{}');
    console.log('📊 [API] Parsed OpenAI result:', {
      success: parsed.success,
      locationCount: parsed.locations?.length || 0,
      date: parsed.date,
      hasTripPurpose: !!parsed.tripPurpose,
      hasSpecialRemarks: !!parsed.specialRemarks,
    });
    
    if (parsed.tripPurpose) {
      console.log('📝 [API] Trip purpose generated:', parsed.tripPurpose.substring(0, 100) + '...');
    }
    if (parsed.specialRemarks) {
      console.log('⚠️ [API] Special remarks generated:', parsed.specialRemarks.substring(0, 100) + '...');
    }

    // Normalize driverNotes if AI returned it as array instead of string
    if (Array.isArray(parsed.driverNotes)) {
      console.warn('⚠️ [API] driverNotes returned as array, converting to string');
      parsed.driverNotes = parsed.driverNotes.length > 0 ? parsed.driverNotes.join('\n') : null;
    }
    
    // Validate the response - allow success if there's ANY extractable information
    // (locations, notes, passenger info, removedLocations, etc.) - not just locations
    const hasLocations = parsed.locations && parsed.locations.length > 0;
    const hasNotes = parsed.driverNotes && typeof parsed.driverNotes === 'string' && parsed.driverNotes.trim().length > 0;
    const hasRemovals = parsed.removedLocations && parsed.removedLocations.length > 0;
    const hasPassengerInfo = parsed.leadPassengerName || (parsed.passengerNames && parsed.passengerNames.length > 0);
    const hasVehicleInfo = parsed.vehicleInfo && typeof parsed.vehicleInfo === 'string' && parsed.vehicleInfo.trim().length > 0;
    const hasOtherInfo = parsed.date || parsed.tripDestination || parsed.passengerCount;

    const hasAnyExtractableInfo = hasLocations || hasNotes || hasRemovals || hasPassengerInfo || hasVehicleInfo || hasOtherInfo;
    
    // Log what was extracted
    if (hasRemovals) {
      console.log(`🗑️ [API] Detected ${parsed.removedLocations.length} location(s) to remove:`, parsed.removedLocations);
    }

    // If AI marked success=false but we have extractable info, override it
    if (!hasAnyExtractableInfo) {
      console.log('❌ [API] No extractable information found');
      console.log('📊 [API] Extraction details:', {
        hasLocations,
        hasNotes,
        hasRemovals,
        hasPassengerInfo,
        hasVehicleInfo,
        hasOtherInfo,
        parsedSuccess: parsed.success
      });
      return NextResponse.json({
        success: false,
        error: parsed.error || 'No extractable information found in the text. Please try again with more specific details.',
      });
    }

    // Override AI's success flag if we have extractable info
    if (!parsed.success && hasAnyExtractableInfo) {
      console.log('⚠️ [API] AI marked success=false but extractable info found, overriding to success=true');
      parsed.success = true;
    }

    // OPTIMIZATION: Skip Google Maps verification for note-only updates (massive performance gain)
    let verifiedLocations = [];
    if (hasLocations) {
      const verificationStartTime = Date.now();
      console.log(`🗺️ [API] Starting Google Maps verification for ${parsed.locations.length} locations...`);
      
      // Verify each location with Google Maps API (parallelized for speed)
      verifiedLocations = await Promise.all(
        parsed.locations.map(async (loc: any, index: number) => {
          console.log(`🔍 [API] Verifying location ${index + 1}/${parsed.locations.length}: "${loc.location}"`);
          const googleData = await verifyLocationWithGoogle(loc.location, parsed.tripDestination || tripDestination);
          
          // VALIDATION: Check for geocoding mismatches (Issue #3 fix)
          const queryLower = (loc.location || '').toLowerCase();
          const addressLower = (googleData.formattedAddress || '').toLowerCase();
          
          // Detect if query is for an airport
          const isAirportQuery = queryLower.includes('airport') || 
                                queryLower.includes('lgw') || queryLower.includes('lhr') || 
                                queryLower.includes('lcy') || queryLower.includes('stn') || 
                                queryLower.includes('ltn') || queryLower.includes('jfk') || 
                                queryLower.includes('lga') || queryLower.includes('ewr') ||
                                queryLower.includes('gatwick') || queryLower.includes('heathrow') ||
                                queryLower.includes('stansted') || queryLower.includes('luton');
          
          const isAirportResult = addressLower.includes('airport') || 
                                 addressLower.includes('lgw') || addressLower.includes('lhr');
          
          // If query is for airport but result isn't, there's a mismatch
          if (isAirportQuery && !isAirportResult) {
            console.error(`❌ [VALIDATION] Geocoding mismatch detected at location ${index + 1}!`);
            console.error(`   Query: "${loc.location}" (appears to be airport)`);
            console.error(`   Result: "${googleData.formattedAddress}" (NOT an airport)`);
            console.error(`   → Re-geocoding with explicit airport query...`);
            
            // Determine which airport and re-geocode with explicit query
            let retryQuery = loc.location;
            if (queryLower.includes('gatwick') || queryLower.includes('lgw')) {
              retryQuery = 'Gatwick Airport, Horley, UK';
            } else if (queryLower.includes('heathrow') || queryLower.includes('lhr')) {
              retryQuery = 'Heathrow Airport, Longford, UK';
            } else if (queryLower.includes('stansted') || queryLower.includes('stn')) {
              retryQuery = 'Stansted Airport, Bishop\'s Stortford, UK';
            } else if (queryLower.includes('luton') || queryLower.includes('ltn')) {
              retryQuery = 'Luton Airport, Luton, UK';
            } else if (queryLower.includes('city airport') || queryLower.includes('lcy')) {
              retryQuery = 'London City Airport, London, UK';
            } else {
              retryQuery = loc.location + ' Airport, UK';
            }
            
            const fixedData = await verifyLocationWithGoogle(retryQuery, parsed.tripDestination || tripDestination);
            
            const verifiedLoc = {
              location: loc.location,
              time: loc.time,
              confidence: loc.confidence,
              purpose: loc.purpose || 'Visit',
              verified: fixedData.verified,
              formattedAddress: fixedData.formattedAddress,
              lat: fixedData.lat,
              lng: fixedData.lng,
              placeId: fixedData.placeId,
            };
            console.log(`✅ [FIX] Corrected location ${index + 1}:`, {
              original: loc.location,
              verified: verifiedLoc.verified,
              formatted: verifiedLoc.formattedAddress,
              coords: `${verifiedLoc.lat}, ${verifiedLoc.lng}`,
            });
            return verifiedLoc;
          }
          
          // Normal case: no mismatch detected
          const verifiedLoc = {
            location: loc.location, // Original extracted text
            time: loc.time,
            confidence: loc.confidence,
            purpose: loc.purpose || 'Visit', // Default purpose if not provided
            verified: googleData.verified,
            formattedAddress: googleData.formattedAddress,
            lat: googleData.lat,
            lng: googleData.lng,
            placeId: googleData.placeId,
          };
          console.log(`✅ [API] Location ${index + 1} result:`, {
            original: loc.location,
            verified: verifiedLoc.verified,
            formatted: verifiedLoc.formattedAddress,
            coords: `${verifiedLoc.lat}, ${verifiedLoc.lng}`,
          });
          return verifiedLoc;
        })
      );
      
      const verificationTime = Date.now() - verificationStartTime;
      console.log(`🎉 [API] All locations verified in ${verificationTime}ms!`);
    } else {
      console.log('⚡️ [OPTIMIZATION] No locations to verify - skipping Google Maps API calls entirely!');
      console.log('💡 [API] Note-only update detected (driver instructions, passenger info, etc.)');
      console.log('⏱️ [API] Estimated time saved: ~3-6 seconds (no geocoding needed)');
    }

    console.log('📤 [API] Preparing response...');
    
    // FLIGHT NUMBER MATCHING: Extract and match flight numbers to airport locations
    let enrichedLocations = verifiedLocations;
    if (verifiedLocations.length > 0 && parsed.driverNotes) {
      console.log('✈️ [API] Extracting flight numbers from driver notes...');
      const flights = extractFlightNumbers(parsed.driverNotes);
      
      if (flights.length > 0) {
        console.log(`✈️ [API] Found ${flights.length} flight(s):`, flights.map(f => `${f.code} (${f.direction || 'unknown direction'})`).join(', '));
        
        // Match flights to airport locations
        const flightMatches = matchFlightsToLocations(flights, verifiedLocations, parsed.driverNotes);
        
        if (flightMatches.size > 0) {
          console.log(`✈️ [API] Matched ${flightMatches.size} flight(s) to airport locations`);
          
          // Enrich locations with flight numbers
          enrichedLocations = verifiedLocations.map((loc, index) => {
            const matchedFlight = flightMatches.get(index);
            if (matchedFlight) {
              console.log(`✈️ [API] Location ${index + 1} (${loc.location}): Flight ${matchedFlight.code}`);
              return {
                ...loc,
                flightNumber: matchedFlight.code,
                flightDirection: matchedFlight.direction,
              };
            }
            return loc;
          });
        } else {
          console.log('✈️ [API] No flight matches found for airport locations');
        }
      } else {
        console.log('✈️ [API] No flight numbers found in driver notes');
      }
    }
    
    const response = {
      success: true,
      date: parsed.date || null,
      leadPassengerName: parsed.leadPassengerName || null,
      passengerCount: parsed.passengerCount || 1,
      tripDestination: parsed.tripDestination || null,
      vehicleInfo: parsed.vehicleInfo || null,
      passengerNames: parsed.passengerNames || [],
      driverNotes: parsed.driverNotes || null,
      removedLocations: parsed.removedLocations || [], // Keywords for locations to remove
      locations: enrichedLocations, // Now includes flightNumber and flightDirection for airports
    };
    console.log('📤 [API] Final response:', JSON.stringify(response, null, 2));

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ [API] Error extracting trip:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to extract trip information. Please try again.' 
      },
      { status: 500 }
    );
  }
}

