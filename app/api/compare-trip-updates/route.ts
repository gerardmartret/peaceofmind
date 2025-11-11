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
Date: ${currentTripData.tripDate || 'N/A'} | Passenger: ${currentTripData.leadPassengerName || 'N/A'} | Vehicle: ${currentTripData.vehicle || 'N/A'} | Count: ${currentTripData.passengerCount || 1} | Destination: ${currentTripData.tripDestination || 'N/A'}
Locations: ${currentLocationsText || 'None'}
Notes: ${currentTripData.tripNotes || 'None'}

EXTRACTED UPDATE:
Date: ${extractedData.date || 'N/A'} | Passenger: ${extractedData.leadPassengerName || extractedData.passengerNames?.join(', ') || 'N/A'} | Vehicle: ${extractedData.vehicleInfo || 'N/A'} | Count: ${extractedData.passengerCount || 'N/A'} | Destination: ${extractedData.tripDestination || 'N/A'}
Locations: ${extractedLocationsText || 'None'}
Notes: ${extractedData.driverNotes || 'None'}

JSON SCHEMA:
{"success":true,"tripDateChanged":bool,"tripDateNew":"YYYY-MM-DD|null","passengerInfoChanged":bool,"passengerInfoNew":"str|null","vehicleInfoChanged":bool,"vehicleInfoNew":"str|null","passengerCountChanged":bool,"passengerCountNew":num|null,"tripDestinationChanged":bool,"tripDestinationNew":"str|null","notesChanged":bool,"mergedNotes":"str","locations":[{"action":"unchanged|modified|removed|added","currentIndex":num,"extractedIndex":num,"locationMatch":{"matched":bool,"confidence":"high|medium|low","reasoning":"str"},"currentLocation":{"name":"str","address":"str","time":"str","purpose":"str"}|null,"extractedLocation":{"formattedAddress":"str","location":"str","time":"str","purpose":"str","lat":num,"lng":num}|null,"changes":{"addressChanged":bool,"timeChanged":bool,"purposeChanged":bool},"finalLocation":{"id":"str (ACTUAL id value like 'pickup-001', NOT literal 'currentLocation.id')","name":"str","formattedAddress":"str","address":"str","time":"str","purpose":"str","lat":num,"lng":num,"fullAddress":"str"}|null}]}

RULES:
1. PARTIAL UPDATES: If extracted locations empty/missing but notes exist:
   - Notes with time refs (e.g., "pickup at 3pm") → update matching location time only, mark "modified"
   - Notes with purpose refs (e.g., "meeting with John") → update matching location purpose only, mark "modified"
   - Notes with instructions only (e.g., "bring watermelon") → update notes only, all locations "unchanged"
   - MUST return ALL current locations (if 5 exist, return 5 entries as "unchanged" or "modified")

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
     * If purposeChanged=true, use extractedLocation.purpose
     * For name: if address/purpose changed, reconstruct as "{purpose}, {formattedAddress}"
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
