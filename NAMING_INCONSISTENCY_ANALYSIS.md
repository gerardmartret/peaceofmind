# Database Naming Inconsistency Analysis

## Critical Issues Found

### 1. **DRIVER NOTES vs TRIP NOTES - CRITICAL MISMATCH**

**Actual Database (via MCP):**
- Field name: `trip_notes` (text, nullable)
- Comment: "Trip notes and special instructions"

**Code Usage:**
- `lib/database.types.ts`: Defines `driver_notes` (DOESN'T EXIST IN DB!)
- `app/page.tsx`: Uses `driver_notes` when saving (line 1353)
- `app/results/[id]/page.tsx`: Tries to read `data.driver_notes` (line 959)
- `app/my-trips/page.tsx`: Tries to select `driver_notes` (line 46)

**Impact:** 
- ❌ Data is likely NOT being saved when using `driver_notes`
- ❌ Data is likely NOT being read when querying `driver_notes`
- ❌ This field has been silently failing!

### 2. **Missing Fields in Database Types**

**Actual Database has:**
- ✅ `lead_passenger_name` (text, nullable)
- ✅ `vehicle` (text, nullable) - NOT `vehicle_info`
- ✅ `trip_notes` (text, nullable) - NOT `driver_notes`

**database.types.ts has:**
- ❌ `driver_notes` (WRONG - should be `trip_notes`)
- ❌ Missing `lead_passenger_name`
- ❌ Missing `vehicle`

### 3. **Frontend Variable Naming Inconsistencies**

**State Variables in app/page.tsx:**
- `extractedDriverSummary` - used for driver notes
- Maps to: `driver_notes` in DB insert (WRONG field name)

**State Variables in app/results/[id]/page.tsx:**
- `driverNotes` - used for storing notes
- `editedDriverNotes` - used for editing
- Both try to read/write `driver_notes` (WRONG field name)

### 4. **API Response Naming**

**Extract Route (`app/api/extract-trip/route.ts`):**
- Returns: `driverNotes` (camelCase)
- Frontend stores in: `extractedDriverSummary`
- Should map to: `trip_notes` in DB (not `driver_notes`)

## Field Mapping Summary

### Current (BROKEN) Flow:
```
Extract API → driverNotes → extractedDriverSummary → driver_notes (DB) ❌
```

### Correct Flow Should Be:
```
Extract API → driverNotes → extractedDriverSummary → trip_notes (DB) ✅
```

## Required Fixes

### Priority 1: CRITICAL - Fix driver_notes → trip_notes

1. **Update `lib/database.types.ts`:**
   - Remove `driver_notes`
   - Add `trip_notes: string | null`
   - Add `lead_passenger_name: string | null`
   - Add `vehicle: string | null`

2. **Update `app/page.tsx`:**
   - Line 1353: Change `driver_notes` → `trip_notes`

3. **Update `app/results/[id]/page.tsx`:**
   - Line 838: Change `driver_notes` → `trip_notes`
   - Line 959: Change `data.driver_notes` → `data.trip_notes`

4. **Update `app/my-trips/page.tsx`:**
   - Line 46: Change `driver_notes` → `trip_notes` in select
   - Line 20: Update type definition

### Priority 2: Add Missing Fields

1. **Add to extraction prompt:**
   - Extract `leadPassengerName` (first passenger name)
   - Extract `vehicleInfo` (vehicle/car information)

2. **Update frontend state:**
   - Add `leadPassengerName` state
   - Add `vehicleInfo` state (note: DB field is `vehicle`, not `vehicle_info`)

3. **Update database inserts:**
   - Add `lead_passenger_name`
   - Add `vehicle` (NOT `vehicle_info`)

4. **Update UI preview:**
   - Show editable fields for all extracted data:
     - Lead Passenger Name
     - Number of Passengers
     - Trip Destination
     - Vehicle Info
     - Trip Notes (driver notes)

## Naming Convention Map

### Database (snake_case):
- `trip_notes` ✅ (currently misnamed as `driver_notes` in code)
- `lead_passenger_name` ✅
- `vehicle` ✅ (NOT `vehicle_info`)
- `passenger_count` ✅
- `passenger_names` ✅
- `trip_destination` ✅

### Frontend State (camelCase):
- `tripNotes` or `driverNotes` (for display/editing)
- `leadPassengerName`
- `vehicle` (NOT `vehicleInfo`)
- `passengerCount`
- `passengerNames`
- `tripDestination`

### API Responses (camelCase):
- `driverNotes` (keep as is, it's just the field name)
- `leadPassengerName`
- `vehicleInfo` (can be different from DB `vehicle` field name)

## Location Purpose Storage

**Current:**
- Location purpose is extracted and used as `loc.purpose`
- Stored in `locations` JSON array
- Need to verify each location object includes `purpose` field when saved

**Verify in code:**
- Check `app/page.tsx` line 1003: `name: loc.purpose || ...`
- Ensure purpose is preserved in the locations JSON structure

## Recommended Action Plan

1. **First:** Fix the `driver_notes` → `trip_notes` mismatch (CRITICAL)
2. **Second:** Update `database.types.ts` to match actual DB schema
3. **Third:** Add extraction for `leadPassengerName` and `vehicleInfo`
4. **Fourth:** Update UI to show all fields in preview/edit step
5. **Fifth:** Update manual form to include all fields
6. **Sixth:** Update database inserts to save all fields correctly

