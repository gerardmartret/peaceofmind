import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  console.log('🔄 [API] Starting intelligent trip update comparison...');
  
  try {
    const body = await request.json();
    const { extractedData, currentTripData } = body;

    if (!extractedData || !currentTripData) {
      return NextResponse.json(
        { success: false, error: 'Missing extractedData or currentTripData' },
        { status: 400 }
      );
    }

    console.log('📊 [API] Comparing extracted updates with current trip state');
    console.log(`   Current locations: ${currentTripData.locations?.length || 0}`);
    console.log(`   Extracted locations: ${extractedData.locations?.length || 0}`);

    // Prepare context for OpenAI to intelligently compare
    const currentLocationsText = (currentTripData.locations || []).map((loc: any, idx: number) => 
      `${idx + 1}. ${loc.name || loc.fullAddress || 'Unknown'} at ${loc.time || 'N/A'}`
    ).join('\n');

    const extractedLocationsText = (extractedData.locations || []).map((loc: any, idx: number) => 
      `${idx + 1}. ${loc.formattedAddress || loc.location || 'Unknown'} at ${loc.time || 'N/A'}${loc.purpose ? ` (Purpose: ${loc.purpose})` : ''}`
    ).join('\n');

    // Log for debugging
    console.log(`📝 [API] Current locations count: ${currentTripData.locations?.length || 0}`);
    console.log(`📝 [API] Extracted locations count: ${extractedData.locations?.length || 0}`);
    console.log(`📝 [API] Extracted notes: ${extractedData.driverNotes ? 'YES (' + extractedData.driverNotes.length + ' chars)' : 'NO'}`);

    const prompt = `You are an intelligent trip update analyzer. Your task is to compare extracted update information with an existing trip plan and identify what has changed.

CURRENT TRIP PLAN:
- Trip Date: ${currentTripData.tripDate || 'Not specified'}
- Lead Passenger: ${currentTripData.leadPassengerName || 'Not specified'}
- Vehicle: ${currentTripData.vehicle || 'Not specified'}
- Passenger Count: ${currentTripData.passengerCount || 1}
- Trip Destination: ${currentTripData.tripDestination || 'Not specified'}
- Current Locations:
${currentLocationsText || 'None'}
- Current Notes: ${currentTripData.tripNotes || 'None'}

EXTRACTED UPDATES:
- Trip Date: ${extractedData.date || 'Not specified'}
- Lead Passenger: ${extractedData.leadPassengerName || extractedData.passengerNames?.join(', ') || 'Not specified'}
- Vehicle: ${extractedData.vehicleInfo || 'Not specified'}
- Passenger Count: ${extractedData.passengerCount || 'Not specified'}
- Trip Destination: ${extractedData.tripDestination || 'Not specified'}
- Extracted Locations:
${extractedLocationsText || 'None'}
- Extracted Notes: ${extractedData.driverNotes || 'None'}

Your task is to intelligently match and compare these two sets of data. IMPORTANT: The extracted update may contain:
- ONLY notes/instructions (no location data) - e.g., "Please bring a watermelon" → should only update notes
- ONLY time updates - e.g., "change pickup time to 3pm" → should update first location's time only
- ONLY purpose/description updates - e.g., "the meeting is now with Mr. Smith instead" → should update location purpose
- ANY combination of the above

For locations, you need to:
1. Match locations by context, not just position (e.g., "pickup location" matches "pickup at airport")
2. Understand verbal time updates: "pickup time is now 3pm" → modify first location's time to "15:00"
3. Understand verbal purpose updates: "meeting is with John now" → modify matching location's purpose
4. Understand partial updates: If extracted data has NO locations but only notes, ALL locations remain UNCHANGED, only notes update
5. Identify if a location is:
   - UNCHANGED (same location, same time, same purpose)
   - MODIFIED (same location but time/purpose changed, or location name changed but clearly the same place)
   - REMOVED (exists in current but not in extracted AND explicitly mentioned as removed)
   - ADDED (exists in extracted but not in current)
6. Understand references:
   - "change pickup to Gatwick" → modify first location to Gatwick
   - "pickup time is now 3pm" → modify first location's time to 15:00
   - "bring a watermelon" → add to notes only, no location changes

Return a JSON object with this exact structure:
{
  "success": true,
  "tripDateChanged": boolean,
  "tripDateNew": "YYYY-MM-DD or null",
  "passengerInfoChanged": boolean,
  "passengerInfoNew": "string or null",
  "vehicleInfoChanged": boolean,
  "vehicleInfoNew": "string or null",
  "passengerCountChanged": boolean,
  "passengerCountNew": number or null,
  "tripDestinationChanged": boolean,
  "tripDestinationNew": "string or null",
  "notesChanged": boolean,
  "mergedNotes": "string - existing notes first, then new unique notes as bullet points",
  "locations": [
    {
      "action": "unchanged" | "modified" | "removed" | "added",
      "currentIndex": number (0-based, or -1 if added),
      "extractedIndex": number (0-based, or -1 if removed),
      "locationMatch": {
        "matched": boolean,
        "confidence": "high" | "medium" | "low",
        "reasoning": "explanation of why locations match or don't match"
      },
      "currentLocation": {
        "name": "string",
        "address": "string",
        "time": "string",
        "purpose": "string"
      } or null,
      "extractedLocation": {
        "formattedAddress": "string",
        "location": "string",
        "time": "string",
        "purpose": "string",
        "lat": number,
        "lng": number
      } or null,
      "changes": {
        "addressChanged": boolean,
        "timeChanged": boolean,
        "purposeChanged": boolean
      },
      "finalLocation": {
        "id": "string",
        "name": "string",
        "address": "string",
        "time": "string",
        "purpose": "string",
        "lat": number,
        "lng": number,
        "fullAddress": "string"
      } or null
    }
  ]
}

CRITICAL RULES:
1. HANDLE PARTIAL UPDATES CORRECTLY:
   - If extracted data has NO locations array OR empty locations array:
     * This means NO location changes were requested
     * Check if Extracted Notes contain time/purpose/instruction updates
     * If notes mention time updates (e.g., "pickup at 3pm"), update matching location's time ONLY (mark that location as "modified")
     * If notes mention purpose updates (e.g., "meeting with John"), update matching location's purpose ONLY (mark that location as "modified")
     * If notes are just additional instructions (e.g., "bring watermelon", "make sure driver is dressed like a clown"), update notes ONLY
     * IMPORTANT: For ALL current locations that are NOT mentioned in notes, mark them as "unchanged" with action="unchanged" and include them in finalLocation
     * You MUST return ALL current locations in the locations array - either as "unchanged" or "modified" (if mentioned in notes)
     * DO NOT omit locations - if current plan has 5 locations, return 5 location entries

2. Match locations intelligently by context and purpose, not just name similarity:
   - "pickup location" or "pick up" refers to the FIRST location in current plan
   - "drop-off" or "destination" refers to the LAST location in current plan
   - "change pickup to X" means modify the first location to X
   - "pickup time is 3pm" → modify first location's time only (address and purpose unchanged)
   - "meeting is with John" → modify matching location's purpose only (time and address unchanged)

3. For partial location updates:
   - If only ONE location is mentioned in update (e.g., "change pickup to Gatwick"), modify only that location
   - All other locations remain "unchanged"
   - If extracted has fewer locations, missing ones are "unchanged" (unless explicitly removed in notes)

4. Time-only updates:
   - "pickup time is now 3pm" → timeChanged=true, addressChanged=false, purposeChanged=false
   - Extract time from notes if location data doesn't have it
   - Match by context (pickup=first, dropoff=last)

5. Purpose-only updates:
   - "meeting is with John now" → purposeChanged=true, timeChanged=false, addressChanged=false
   - Match location by context (first location = pickup, etc.)

6. Notes-only updates:
   - If no location/passenger/vehicle info changes mentioned, only update notes
   - All locations marked as "unchanged"
   - All other fields (passenger, vehicle, date) remain unchanged

7. For "modified" locations:
   - Preserve the ID from current location
   - Use coordinates from extractedLocation if available (and not 0)
   - Only change fields that actually changed (timeChanged, purposeChanged, addressChanged)

8. For "added" locations:
   - Generate a new ID or use extractedIndex + 1
   - Use coordinates from extractedLocation

9. For "removed" locations:
   - Mark them but don't include in finalLocation
   - Only mark as removed if explicitly mentioned in update

10. For "unchanged" locations:
    - Preserve current location data exactly as-is in finalLocation
    - Keep original ID, coordinates, address, time, purpose

11. Field change detection:
    - Only mark addressChanged/timeChanged/purposeChanged as true if that specific field actually changed
    - If only time is mentioned, only timeChanged=true
    - If only purpose is mentioned, only purposeChanged=true

12. Notes merging:
    - Keep all existing notes first
    - Append only genuinely new information as bullet points
    - Parse new notes and deduplicate similar content
    - Format as bullet points using "- " prefix

13. When creating finalLocation:
    - For UNCHANGED: Use all data from currentLocation
    - For MODIFIED: Merge currentLocation with extractedLocation:
      * Use extractedLocation time if timeChanged
      * Use extractedLocation purpose if purposeChanged
      * Use extractedLocation address if addressChanged
      * Use extractedLocation coordinates if available (and not 0), else currentLocation coordinates
    - Preserve currentLocation.id for modified/unchanged locations

14. Be conservative:
    - If uncertain about a match, prefer "unchanged" over "modified"
    - If update is unclear, err on the side of preserving existing data
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an expert trip planning assistant that intelligently compares trip updates with existing plans. You understand context and can match locations by purpose, not just name.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    });

    const result = completion.choices[0].message.content;
    console.log('✅ [API] OpenAI comparison response received');
    
    const parsed = JSON.parse(result || '{}');
    
    if (!parsed.success) {
      console.error('❌ [API] Comparison failed:', parsed.error);
      return NextResponse.json({
        success: false,
        error: parsed.error || 'Comparison failed',
      });
    }

    console.log(`📊 [API] Comparison result: ${parsed.locations?.length || 0} location changes identified`);

    return NextResponse.json({
      success: true,
      comparison: parsed,
    });

  } catch (error) {
    console.error('❌ [API] Error in comparison:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compare trip updates',
      },
      { status: 500 }
    );
  }
}
