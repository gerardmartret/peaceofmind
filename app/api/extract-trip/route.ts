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

Extract:
1. All locations in London (addresses, landmarks, stations, airports, etc.)
2. Associated times for each location
3. Trip date if mentioned
4. A professional summary for the driver (2-3 sentences max)
5. Specific details for each location: person names, company names, venue names, meeting types, etc.

Return a JSON object with this exact structure:
{
  "success": true,
  "date": "YYYY-MM-DD or null if not mentioned",
  "driverSummary": "Professional 2-3 sentence summary for the driver about the trip, passenger expectations, and key details",
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
- Sort locations chronologically by time
- Convert all times to 24-hour format (e.g., "3pm" -> "15:00", "9am" -> "09:00")
- If time is relative (e.g., "2 hours later"), calculate based on previous time
- If no time specified, use "confidence": "low" and make reasonable estimate
- Expand abbreviated locations (e.g., "LHR" -> "Heathrow Airport, London")
- Only include locations in London area
- If no locations found, return {"success": false, "error": "No London locations found"}
- If date is mentioned in various formats, convert to YYYY-MM-DD
- Pay attention to context around each location: who is involved, what type of activity, company names, venue names
- Look for clues like "meeting with", "dinner at", "pickup from", "drop-off at", "check-in at", etc.

Rules for location purpose:
- Create comprehensive, descriptive names that include specific details from the email
- Include relevant information: location name, person names, company names, event types, etc.
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

Rules for driver summary:
- Keep it to 2-3 sentences maximum
- Professional and concise tone
- Include: passenger name (if mentioned), purpose of trip, any special requirements
- Focus on what the driver needs to know
- Example: "VIP client Mr. Johns requires pickup from Heathrow at 9am for a London roadshow with multiple stops. The itinerary includes meetings at premium locations throughout the day. Please ensure punctuality and professional service."`,
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
      hasSummary: !!parsed.driverSummary,
    });
    
    if (parsed.driverSummary) {
      console.log('📝 [API] Driver summary generated:', parsed.driverSummary.substring(0, 100) + '...');
    }

    // Validate the response
    if (!parsed.success || !parsed.locations || parsed.locations.length === 0) {
      console.log('❌ [API] No locations found in extraction');
      return NextResponse.json({
        success: false,
        error: parsed.error || 'No locations or times could be extracted from the text. Please try again with more specific details.',
      });
    }

    console.log(`🗺️ [API] Starting Google Maps verification for ${parsed.locations.length} locations...`);
    // Verify each location with Google Maps API
    const verifiedLocations = await Promise.all(
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

    console.log('🎉 [API] All locations verified! Returning response...');
    const response = {
      success: true,
      date: parsed.date || null,
      driverSummary: parsed.driverSummary || null,
      locations: verifiedLocations,
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

