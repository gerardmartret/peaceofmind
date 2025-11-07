import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Google Maps API key - Use the same key as the frontend
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

console.log('🔑 [API] Google Maps API Key status:', GOOGLE_MAPS_API_KEY ? `LOADED ✅ (length: ${GOOGLE_MAPS_API_KEY.length})` : 'MISSING ❌');

// Function to verify location with Google Maps Geocoding API
async function verifyLocationWithGoogle(locationQuery: string) {
  console.log(`🔍 [API] Verifying location with Google Maps: "${locationQuery}"`);
  
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
    url.searchParams.append('address', `${locationQuery}, London, UK`);
    url.searchParams.append('key', GOOGLE_MAPS_API_KEY);
    url.searchParams.append('region', 'uk');

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
    const { text } = await request.json();
    console.log(`📝 [API] Received text (${text?.length || 0} chars):`, text?.substring(0, 100) + '...');

    if (!text || typeof text !== 'string') {
      console.log('❌ [API] Invalid text provided');
      return NextResponse.json(
        { success: false, error: 'Invalid text provided' },
        { status: 400 }
      );
    }

    console.log('🤖 [API] Calling OpenAI for extraction and summary generation...');
    // Call OpenAI to extract locations, times, date, AND generate professional summary
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a trip planning assistant that extracts location and time information from unstructured text (emails, messages, etc.).

CRITICAL: For driverNotes, preserve ALL unique content from the original email BUT exclude ANY information that's already extracted into structured fields (locations, times, dates, names). Do NOT repeat location names, addresses, times, or dates in driverNotes - these are already in the locations array. ONLY include contextual details not captured elsewhere.

Extract:
1. All locations in London (addresses, landmarks, stations, airports, etc.)
2. Associated times for each location
3. Trip date if mentioned
4. Lead passenger name (main/first passenger name)
5. Number of passengers (total count)
6. Trip destination/city
7. Vehicle information (ONLY brand and model, e.g., 'Mercedes S-Class', 'BMW 7 Series')
8. Driver notes (ONLY information that doesn't fit in structured fields - NO location names, NO times, NO dates. Include: contact info, special instructions, flight details, vehicle features, dress codes, allergies, preferences, etc.)
9. Passenger names (all passenger names as array)
10. Specific details for each location: person names, company names, venue names, meeting types, etc.

Return a JSON object with this exact structure:
{
  "success": true,
  "date": "YYYY-MM-DD or null if not mentioned. IMPORTANT: If year is not mentioned, always use the current year (${new Date().getFullYear()})",
  "leadPassengerName": "Main passenger name (e.g., 'Mr. Smith', 'John Doe') or null if not mentioned",
  "passengerCount": number,
  "tripDestination": "Main destination city only (e.g., 'London', 'Manchester', 'Birmingham')",
  "vehicleInfo": "ONLY vehicle brand and model (e.g., 'Mercedes S-Class', 'BMW 7 Series', 'Audi A8'). Do NOT include color, features, amenities, or requirements. Put those details in driverNotes instead. Null if not mentioned.",
  "passengerNames": ["Name1", "Name2", "Name3"],
  "driverNotes": "ONLY contextual information NOT captured elsewhere. ABSOLUTELY EXCLUDE: ALL location names (airports, hotels, restaurants, venues, addresses), ALL times (pickup, dropoff, stops), ALL dates, ALL passenger names, vehicle brand/model, trip destination. ONLY INCLUDE: flight numbers, contact info, special instructions, vehicle features (color/amenities), dress codes, allergies, security requirements, operational codes, waiting procedures, preferences. Zero redundancy with locations array or other fields. Format as bullet points.",
  "locations": [
    {
      "location": "Full location name in London",
      "time": "HH:MM in 24-hour format",
      "confidence": "high/medium/low",
      "purpose": "Comprehensive short name that summarizes the purpose with specific details (e.g., 'Pick up at Gatwick Airport', 'Investment Meeting at UBS Bank with Mr John', 'Dinner at Belladonna with Mr. Smith', 'Hotel check-in at The Savoy')"
    }
  ]
}

Rules for extraction:
- Sort locations chronologically by time (if locations exist)
- Convert all times to 24-hour format (e.g., "3pm" -> "15:00", "9am" -> "09:00")
- If time is relative (e.g., "2 hours later"), calculate based on previous time
- If no time specified, use "confidence": "low" and make reasonable estimate
- Expand abbreviated locations (e.g., "LHR" -> "Heathrow Airport, London")
- Only include locations in London area
- IMPORTANT: If the text contains ONLY instructions, notes, or verbal updates WITHOUT locations:
  * Return locations as empty array []
  * Put all instructions/notes in driverNotes field
  * Still set success: true if there's any extractable information (notes, passenger info, vehicle info, etc.)
  * Examples of valid non-location updates:
    - "make sure driver is dressed like a clown" → locations: [], driverNotes: "- Make sure driver is dressed like a clown"
    - "pickup time is now 3pm" → locations: [], driverNotes: "- Pickup time is now 3pm"
    - "bring a watermelon" → locations: [], driverNotes: "- Bring a watermelon"
- If no extractable information at all (no locations, no notes, no passenger info, etc.), then return success: false
- If date is mentioned in various formats, convert to YYYY-MM-DD. CRITICAL: If the year is NOT mentioned in the date, always assume it is the current year (${new Date().getFullYear()}). For example: "March 15" should become "${new Date().getFullYear()}-03-15", "Dec 25" should become "${new Date().getFullYear()}-12-25"
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

Rules for trip destination:
- Extract ONLY the city name (e.g., "London", "Manchester", "Birmingham")
- Do NOT include specific addresses, airports, or venues
- If multiple cities mentioned, choose the main destination city
- If no specific city mentioned, use "London" as default
- Examples: "London City Airport" → "London", "Heathrow Airport" → "London", "Manchester Airport" → "Manchester"

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

    // Validate the response - allow success if there's ANY extractable information
    // (locations, notes, passenger info, etc.) - not just locations
    const hasLocations = parsed.locations && parsed.locations.length > 0;
    const hasNotes = parsed.driverNotes && parsed.driverNotes.trim().length > 0;
    const hasPassengerInfo = parsed.leadPassengerName || (parsed.passengerNames && parsed.passengerNames.length > 0);
    const hasVehicleInfo = parsed.vehicleInfo && parsed.vehicleInfo.trim().length > 0;
    const hasOtherInfo = parsed.date || parsed.tripDestination || parsed.passengerCount;

    const hasAnyExtractableInfo = hasLocations || hasNotes || hasPassengerInfo || hasVehicleInfo || hasOtherInfo;

    if (!parsed.success || !hasAnyExtractableInfo) {
      console.log('❌ [API] No extractable information found');
      return NextResponse.json({
        success: false,
        error: parsed.error || 'No extractable information found in the text. Please try again with more specific details.',
      });
    }

    // If no locations but has other info (notes, instructions, etc.), allow it (for updates)
    let verifiedLocations = [];
    if (hasLocations) {
      console.log(`🗺️ [API] Starting Google Maps verification for ${parsed.locations.length} locations...`);
      // Verify each location with Google Maps API
      verifiedLocations = await Promise.all(
        parsed.locations.map(async (loc: any, index: number) => {
          console.log(`🔍 [API] Verifying location ${index + 1}/${parsed.locations.length}: "${loc.location}"`);
          const googleData = await verifyLocationWithGoogle(loc.location);
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
      console.log('🎉 [API] All locations verified!');
    } else {
      console.log('ℹ️ [API] No locations found, but other information extracted (notes, instructions, etc.) - this is valid for updates');
    }

    console.log('📤 [API] Preparing response...');
    const response = {
      success: true,
      date: parsed.date || null,
      leadPassengerName: parsed.leadPassengerName || null,
      passengerCount: parsed.passengerCount || 1,
      tripDestination: parsed.tripDestination || null,
      vehicleInfo: parsed.vehicleInfo || null,
      passengerNames: parsed.passengerNames || [],
      driverNotes: parsed.driverNotes || null,
      locations: verifiedLocations, // Empty array if no locations found
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

