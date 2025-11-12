import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  console.log('🔄 [COMPARE] Starting comparison...');
  
  try {
    const body = await request.json();
    const { extractedData, currentTripData } = body;

    if (!extractedData || !currentTripData) {
      return NextResponse.json(
        { success: false, error: 'Missing extractedData or currentTripData' },
        { status: 400 }
      );
    }

    console.log(`📍 [COMPARE] Current: ${currentTripData.locations?.length || 0} locations, Extracted: ${extractedData.locations?.length || 0} locations`);

    // Prepare context for OpenAI to intelligently compare
    const currentLocationsText = (currentTripData.locations || []).map((loc: any, idx: number) => 
      `${idx + 1}. ${loc.name || loc.fullAddress || 'Unknown'} at ${loc.time || 'N/A'}`
    ).join('\n');

    const extractedLocationsText = (extractedData.locations || []).map((loc: any, idx: number) => 
      `${idx + 1}. ${loc.formattedAddress || loc.location || 'Unknown'} at ${loc.time || 'N/A'}${loc.purpose ? ` (Purpose: ${loc.purpose})` : ''}`
    ).join('\n');


    const prompt = `Compare trip update with existing plan and identify changes. Return valid JSON only.

CURRENT PLAN:
Date: ${currentTripData.tripDate || 'Not set'} | Passenger: ${currentTripData.leadPassengerName || 'Not set'} | Vehicle: ${currentTripData.vehicle || 'Not set'} | Count: ${currentTripData.passengerCount || 1} | Destination: ${currentTripData.tripDestination || 'Not set'}
Locations: ${currentLocationsText || 'None'}
Notes: ${currentTripData.tripNotes || 'None'}

EXTRACTED UPDATE:
Date: ${extractedData.date || '(not mentioned)'} | Passenger: ${extractedData.leadPassengerName || extractedData.passengerNames?.join(', ') || '(not mentioned)'} | Vehicle: ${extractedData.vehicleInfo || '(not mentioned)'} | Count: ${extractedData.passengerCount || '(not mentioned)'} | Destination: ${extractedData.tripDestination || '(not mentioned)'}
Locations: ${extractedLocationsText || 'None'}
${extractedData.removedLocations && extractedData.removedLocations.length > 0 ? `Removals: ${extractedData.removedLocations.join(', ')}` : ''}
Notes: ${extractedData.driverNotes || 'None'}

JSON SCHEMA:
{"success":true,"tripDateChanged":bool,"tripDateNew":"YYYY-MM-DD|null","passengerInfoChanged":bool,"passengerInfoNew":"str|null","vehicleInfoChanged":bool,"vehicleInfoNew":"str|null","passengerCountChanged":bool,"passengerCountNew":num|null,"tripDestinationChanged":bool,"tripDestinationNew":"str|null","notesChanged":bool,"mergedNotes":"str","locations":[{"action":"unchanged|modified|removed|added","currentIndex":num,"extractedIndex":num,"locationMatch":{"matched":bool,"confidence":"high|medium|low","reasoning":"str"},"currentLocation":{"name":"str","address":"str","time":"str","purpose":"str"}|null,"extractedLocation":{"formattedAddress":"str","location":"str","time":"str","purpose":"str","lat":num,"lng":num}|null,"changes":{"addressChanged":bool,"timeChanged":bool,"purposeChanged":bool},"finalLocation":{"id":"str (ACTUAL id value like 'pickup-001', NOT literal 'currentLocation.id')","name":"str","formattedAddress":"str","address":"str","time":"str","purpose":"str","lat":num,"lng":num,"fullAddress":"str"}|null}]}

RULES:
0. CRITICAL - NOT MENTIONED ≠ CHANGED:
   - If EXTRACTED UPDATE shows "(not mentioned)" for any field, it means that field was NOT in the update
   - "(not mentioned)" means PRESERVE the current value, NOT change it
   - ONLY mark field as "changed" if update explicitly mentions a NEW value different from current
   - Examples:
     * Current: Vehicle: Mercedes S-Class | Update: Vehicle: (not mentioned) → vehicleInfoChanged=false
     * Current: Count: 2 | Update: Count: (not mentioned) → passengerCountChanged=false
     * Current: Vehicle: Mercedes | Update: Vehicle: BMW 7 Series → vehicleInfoChanged=true, vehicleInfoNew="BMW 7 Series"

0.5. REMOVAL DETECTION:
   - If EXTRACTED UPDATE shows "Removals: [keywords]", scan current locations for matches
   - Match removal keywords to current location names (case-insensitive, partial match OK)
   - Examples:
     * Removals: ["rosewood"] + Current location: "Quick change of suite at Rosewood Hotel" → Mark as action: "removed"
     * Removals: ["ritz hotel"] + Current location: "Meeting at The Ritz" → Mark as action: "removed"
     * Removals: ["stop 3"] + Current locations array → Mark location at index 3 as action: "removed"
   - For removed locations, set finalLocation: null
   - Mark ALL other locations (not in removed list) as "unchanged" if not mentioned in update

1. PARTIAL UPDATES: If extracted locations empty/missing but notes exist:
   - Notes with time refs (e.g., "pickup at 3pm") → update matching location time only, mark "modified"
   - Notes with purpose refs (e.g., "meeting with John") → update matching location purpose only, mark "modified"
   - Notes with instructions only (e.g., "bring watermelon") → update notes only, all locations "unchanged"
   - MUST return ALL current locations (if 5 exist, return 5 entries as "unchanged" or "modified")

1.5. PROTECT CRITICAL LOCATIONS (CRITICAL RULE):
   - Location index 0 (first) = PICKUP - NEVER modify unless update explicitly mentions "pickup", "pick up", or "collection"
   - Location index N-1 (last) = DROPOFF - NEVER modify unless update explicitly mentions "drop off", "dropoff", "drop-off", or "destination"
   - If update doesn't mention pickup/dropoff keywords, these locations MUST be marked as "unchanged"
   - Examples:
     * "ADD stop after lunch" → Location 0 and location N-1 are "unchanged"
     * "change pickup time to 3pm" → Location 0 is "modified" (timeChanged only)
     * "drop off at 5pm instead" → Location N-1 is "modified" (timeChanged only)
     * "skip stop 3" → Location 0 and N-1 are "unchanged"

1.6. HANDLING LOCATION COUNT MISMATCHES (CRITICAL):
   - If CURRENT has N locations and EXTRACTED has M locations where M < N:
     * This is a PARTIAL update (not complete replacement)
     * MUST return ALL N locations in response
     * Mark explicitly mentioned locations as "modified", "removed", or "added"
     * Mark unmentioned locations as "unchanged"
   
   - Location matching priority:
     1. If extracted location has "insertAfter" or "insertBefore" field, mark as "added" with insertion metadata (see rule 1.7)
     2. If extracted location matches current location name/purpose/address, mark as "modified"
     3. If update says "remove X" or "skip X", mark as "removed"
     4. If current location not mentioned at all in update, mark as "unchanged"

1.7. INSERTION METADATA (for ADD operations):
   - If extractedLocation has "insertAfter" field:
     * Find the reference location in current plan by matching the keyword to location name/purpose
     * Return action: "added" with special "insertPosition" object
     * Example: extractedLocation has "insertAfter": "sexy fish"
       - Find current location with name/purpose containing "sexy fish"
       - If found at index 3, return:
         {
           "action": "added",
           "insertPosition": {
             "type": "after",
             "referenceIndex": 3,
             "referenceName": "Sexy Fish lunch"
           },
           "extractedLocation": {...},
           "finalLocation": {...}
         }
   
   - If extractedLocation has "insertBefore" field:
     * Same as insertAfter but use "type": "before"
     * Example: "insertBefore": "dropoff" matches last location
   
   - If reference not found:
     * Log warning in reasoning field
     * Treat as regular "added" without insertPosition (will append at end)
   
   - NEVER:
     * Replace location 0 unless update explicitly mentions "pickup"
     * Replace location N-1 unless update explicitly mentions "drop off" or "destination"
     * Assume locations should be deleted just because they're not mentioned in extracted data
   
   - Example: Current has 7 locations, extracted has 2 locations ["30 St Mary Axe", "Gatwick"]
     * Match "30 St Mary Axe" to its position (e.g., new insertion)
     * Match "Gatwick" to location N-1 (dropoff) as "unchanged" or "modified"
     * Mark remaining 5 locations as "unchanged"

2. LOCATION MATCHING (context-aware):
   - "pickup"/"pick up" = FIRST location | "drop-off"/"destination" = LAST location
   - EXAMPLES:
     * "change pickup time to 6am" → First location: timeChanged=true, addressChanged=false, time="06:00"
     * "pickup at 6am" or "pickup time is 6am" → First location: timeChanged=true, addressChanged=false
     * "drop off at 11pm" or "dropoff time 11pm" → Last location: timeChanged=true, addressChanged=false
     * "change pickup to The Ritz Hotel" → First location: addressChanged=true, timeChanged=false
   - If update mentions ONLY time (no venue/address), set addressChanged=false

3. CHANGE TYPES:
   - unchanged: No changes | modified: Same location, field(s) changed | added: New location | removed: Explicitly mentioned as removed

4. FIELD PRECISION: Only set addressChanged/timeChanged/purposeChanged=true for actual changes

5. FINAL LOCATION:
   - unchanged: Copy currentLocation exactly (preserve id, coords, all fields including time)
   - modified: Merge fields (extracted if changed, current if unchanged). CRITICAL:
     * If timeChanged=true, use extractedLocation.time for finalLocation.time
     * If addressChanged=true, use extractedLocation.formattedAddress
     * If addressChanged=false, MUST preserve currentLocation.fullAddress and currentLocation.formattedAddress exactly
     * If purposeChanged=true, use extractedLocation.purpose
     * For name: if address/purpose changed, reconstruct as "{purpose}, {formattedAddress}"
     * NEVER return empty fullAddress or formattedAddress fields - always preserve from currentLocation if not changed
   - added: Use extractedLocation (new id)
   - removed: No finalLocation

6. NOTES MERGE: Existing notes first + new unique notes as bullet points ("- "), deduplicate

7. COORDINATES: Use extractedLocation coords if valid (!=0), else currentLocation coords

8. CONSERVATIVE: If uncertain, prefer "unchanged" over "modified"`;

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
    console.log('✅ [COMPARE] AI response received');
    
    const parsed = JSON.parse(result || '{}');
    
    if (!parsed.success) {
      console.error('❌ [COMPARE] Failed:', parsed.error);
      return NextResponse.json({
        success: false,
        error: parsed.error || 'Comparison failed',
      });
    }

    // POST-PROCESSING VALIDATION #1: Fix empty addresses in finalLocation
    if (parsed.locations && Array.isArray(parsed.locations)) {
      parsed.locations.forEach((loc: any, idx: number) => {
        if ((loc.action === 'modified' || loc.action === 'unchanged') && loc.finalLocation) {
          const fl = loc.finalLocation;
          const currentLoc = currentTripData.locations?.[loc.currentIndex];
          
          // If addressChanged=false but finalLocation has empty address, restore from current
          if (loc.changes?.addressChanged === false) {
            if (!fl.fullAddress && currentLoc?.fullAddress) {
              console.log(`🔧 [FIX] Restoring fullAddress for location ${idx}: ${currentLoc.fullAddress}`);
              fl.fullAddress = currentLoc.fullAddress;
            }
            if (!fl.formattedAddress && currentLoc?.formattedAddress) {
              console.log(`🔧 [FIX] Restoring formattedAddress for location ${idx}: ${currentLoc.formattedAddress}`);
              fl.formattedAddress = currentLoc.formattedAddress;
            }
            if (!fl.address && currentLoc?.address) {
              console.log(`🔧 [FIX] Restoring address for location ${idx}: ${currentLoc.address}`);
              fl.address = currentLoc.address;
            }
          }
          
          // Validate coordinates are preserved
          if ((!fl.lat || fl.lat === 0) && currentLoc?.lat) {
            console.log(`🔧 [FIX] Restoring lat for location ${idx}: ${currentLoc.lat}`);
            fl.lat = currentLoc.lat;
          }
          if ((!fl.lng || fl.lng === 0) && currentLoc?.lng) {
            console.log(`🔧 [FIX] Restoring lng for location ${idx}: ${currentLoc.lng}`);
            fl.lng = currentLoc.lng;
          }
        }
      });
    }

    // POST-PROCESSING VALIDATION #2: Prevent false positives for non-mentioned fields
    // If extracted data has null/undefined for a field, it means it wasn't mentioned
    // Don't mark it as changed unless there's an explicit new value
    if (!extractedData.vehicleInfo && parsed.vehicleInfoChanged && !parsed.vehicleInfoNew) {
      console.log(`🔧 [FIX] Vehicle not mentioned in update, marking as unchanged`);
      parsed.vehicleInfoChanged = false;
      parsed.vehicleInfoNew = null;
    }
    
    if (!extractedData.leadPassengerName && !extractedData.passengerNames?.length && parsed.passengerInfoChanged && !parsed.passengerInfoNew) {
      console.log(`🔧 [FIX] Passenger info not mentioned in update, marking as unchanged`);
      parsed.passengerInfoChanged = false;
      parsed.passengerInfoNew = null;
    }
    
    if (!extractedData.passengerCount && parsed.passengerCountChanged && !parsed.passengerCountNew) {
      console.log(`🔧 [FIX] Passenger count not mentioned in update, marking as unchanged`);
      parsed.passengerCountChanged = false;
      parsed.passengerCountNew = null;
    }
    
    if (!extractedData.tripDestination && parsed.tripDestinationChanged && !parsed.tripDestinationNew) {
      console.log(`🔧 [FIX] Trip destination not mentioned in update, marking as unchanged`);
      parsed.tripDestinationChanged = false;
      parsed.tripDestinationNew = null;
    }
    
    if (!extractedData.date && parsed.tripDateChanged && !parsed.tripDateNew) {
      console.log(`🔧 [FIX] Trip date not mentioned in update, marking as unchanged`);
      parsed.tripDateChanged = false;
      parsed.tripDateNew = null;
    }

    // Log comparison summary
    const unchanged = parsed.locations?.filter((l: any) => l.action === 'unchanged').length || 0;
    const modified = parsed.locations?.filter((l: any) => l.action === 'modified').length || 0;
    const added = parsed.locations?.filter((l: any) => l.action === 'added').length || 0;
    const removed = parsed.locations?.filter((l: any) => l.action === 'removed').length || 0;
    
    console.log(`📊 [COMPARE] Results: ${unchanged} unchanged, ${modified} modified, ${added} added, ${removed} removed`);
    
    // Log modified locations details
    if (modified > 0) {
      parsed.locations.filter((l: any) => l.action === 'modified').forEach((loc: any, idx: number) => {
        const changes = [];
        if (loc.changes?.addressChanged) changes.push('address');
        if (loc.changes?.timeChanged) changes.push(`time: ${loc.currentLocation?.time} → ${loc.finalLocation?.time}`);
        if (loc.changes?.purposeChanged) changes.push('purpose');
        console.log(`   ${idx + 1}. Modified: ${loc.finalLocation?.name} (${changes.join(', ')})`);
      });
    }
    
    // Log trip detail changes
    const tripChanges = [];
    if (parsed.tripDateChanged) tripChanges.push('date');
    if (parsed.passengerInfoChanged) tripChanges.push('passenger');
    if (parsed.vehicleInfoChanged) tripChanges.push('vehicle');
    if (parsed.passengerCountChanged) tripChanges.push('count');
    if (parsed.tripDestinationChanged) tripChanges.push('destination');
    if (parsed.notesChanged) tripChanges.push('notes');
    
    if (tripChanges.length > 0) {
      console.log(`📝 [COMPARE] Trip details changed: ${tripChanges.join(', ')}`);
    }

    return NextResponse.json({
      success: true,
      comparison: parsed,
    });

  } catch (error) {
    console.error('❌ [COMPARE] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compare trip updates',
      },
      { status: 500 }
    );
  }
}
