# 🅿️ PARKING INTEGRATION PLAN

## 📋 OVERVIEW

Add parking information to the Peace of Mind app using TfL API, showing parking availability, restrictions, and alternatives for each location in the trip report.

**Key Requirement:** Parking data must be "evergreen" - providing general/static information rather than time-specific data to avoid misleading users when reports are generated outside operating hours.

---

## 🎯 OBJECTIVES

For each selected location, provide:
1. **Parking availability at destination** - Show car parks near the location
2. **Parking restrictions** - Warn if destination is in a CPZ (Controlled Parking Zone)
3. **Alternative parking** - Suggest nearby options
4. **Risk factor** - Add to peace of mind score if parking is challenging

---

## 🔍 TfL API ANALYSIS

### Available Endpoints:

#### 1. **Place Search API** (Primary)
```
GET https://api.tfl.gov.uk/Place/Search?query={lat,lng}&radius={meters}&type=CarPark
```
- Returns car parks within specified radius of coordinates
- Provides static information about car park facilities
- No API key required for basic usage

#### 2. **Place by Type API** (Alternative)
```
GET https://api.tfl.gov.uk/Place/Type/CarPark
```
- Returns all TfL car parks in London
- Can be filtered client-side by distance
- Static data only

#### 3. **Place Details API** (For enrichment)
```
GET https://api.tfl.gov.uk/Place/{id}
```
- Get detailed information about specific car park
- Includes facilities, operating hours, capacity (if available)
- Use for "evergreen" data like total spaces, facilities

#### 4. **Occupancy API** (Real-time - LIMITED USE)
```
GET https://api.tfl.gov.uk/Occupancy/CarPark/{id}
```
- Real-time occupancy data (23 out of 61 car parks)
- **We will NOT use this for primary display** due to evergreen requirement
- Could store in database for historical pattern analysis (future enhancement)

### What Data We CAN Use (Evergreen):
✅ Car park locations (lat/lng, address)
✅ Total capacity (spaces available)
✅ Operating hours (e.g., "24/7", "Mon-Fri 7am-7pm")
✅ Facilities (covered, secure, accessible)
✅ Distance from destination
✅ Type of parking (station car park, public car park)

### What Data We CANNOT Use (Time-dependent):
❌ Current occupancy ("23 spaces available now")
❌ Real-time pricing
❌ "Open now" / "Closed now" status

---

## 📊 DATA STRUCTURE

### Parking Data Interface:
```typescript
interface ParkingData {
  location: string;
  coordinates: { lat: number; lng: number };
  carParks: Array<{
    id: string;
    name: string;
    address: string;
    distance: number; // meters from destination
    totalSpaces?: number;
    operatingHours?: string; // e.g., "24 hours" or "Mon-Fri 7am-7pm"
    facilities: string[]; // ["covered", "secure", "accessible", "EV charging"]
    type: string; // "Station Car Park", "Public Car Park"
    isUnderground?: boolean;
  }>;
  cpzInfo?: {
    inCPZ: boolean;
    zone?: string;
    operatingHours?: string;
    restrictions?: string;
  };
  parkingRiskScore: number; // 1-10 (10 = very challenging parking)
  summary: {
    totalNearby: number;
    averageDistance: number;
    hasStationParking: boolean;
    cpzWarning: boolean;
  };
}
```

---

## 🏗️ IMPLEMENTATION PLAN

### Phase 1: Create TfL Parking API Client

**File:** `lib/tfl-parking-api.ts`

**Functions:**
1. `getNearbyCarParks(lat, lng, radiusMeters)` - Get car parks within radius
2. `getCarParkDetails(id)` - Get detailed info about specific car park
3. `calculateParkingRiskScore(data)` - Calculate risk based on availability
4. `checkCPZStatus(lat, lng)` - Check if location is in CPZ (using London Datastore data or placeholder)

**Features:**
- Filter by distance
- Sort by nearest first
- Extract evergreen data only
- Handle API errors gracefully

---

### Phase 2: Create Parking API Route

**File:** `app/api/parking/route.ts`

**Endpoint:** `GET /api/parking?lat={lat}&lng={lng}&location={name}`

**Response:**
```json
{
  "success": true,
  "data": {
    "location": "76 Dean St, London",
    "coordinates": { "lat": 51.513955, "lng": -0.132913 },
    "carParks": [
      {
        "id": "CarPark_123",
        "name": "Tottenham Court Road Car Park",
        "address": "Oxford Street, London",
        "distance": 450,
        "totalSpaces": 50,
        "operatingHours": "24 hours",
        "facilities": ["covered", "secure"],
        "type": "Station Car Park"
      }
    ],
    "cpzInfo": {
      "inCPZ": true,
      "zone": "West End (Zone F)",
      "operatingHours": "Mon-Sat 8:30am-6:30pm",
      "restrictions": "Pay & Display required during operating hours"
    },
    "parkingRiskScore": 7,
    "summary": {
      "totalNearby": 3,
      "averageDistance": 620,
      "hasStationParking": true,
      "cpzWarning": true
    }
  }
}
```

---

### Phase 3: Update Data Flow

#### A. Update Main Page (`app/page.tsx`)
- Add parking data fetch alongside crime, weather, disruptions, events
- Store parking data in trip results

#### B. Update Executive Report Generation

**File:** `lib/executive-report.ts`

**Changes:**
1. Add `parking` to `tripData` input parameter
2. Include parking summary in GPT prompt:
   - Number of nearby car parks
   - CPZ status and restrictions
   - Parking risk score
   - Distance to nearest parking
3. Ask GPT to analyze parking challenges in:
   - Location analysis
   - Recommendations
   - Highlights (if parking is difficult)
4. Update `tripRiskScore` calculation to include parking difficulty

**Example Prompt Addition:**
```
PARKING INFORMATION:
${JSON.stringify(tripData.map(loc => ({
  location: loc.locationName,
  nearbyCarParks: loc.parking.summary.totalNearby,
  averageDistance: `${loc.parking.summary.averageDistance}m`,
  cpzRestrictions: loc.parking.cpzInfo?.inCPZ ? 
    `CPZ Zone ${loc.parking.cpzInfo.zone} - ${loc.parking.cpzInfo.restrictions}` : 
    'No CPZ restrictions',
  parkingRiskScore: loc.parking.parkingRiskScore,
  closestCarPark: loc.parking.carParks[0]?.name || 'None within 1km'
})), null, 2)}

PARKING ANALYSIS REQUIRED:
- Identify locations with challenging parking (risk score > 6)
- Recommend alternatives if parking is limited
- Warn about CPZ restrictions and suggest arrival/departure timing
- Include parking difficulty in overall trip risk score
```

---

### Phase 4: Update Results Display

**File:** `app/results/[id]/page.tsx`

**UI Additions:**

1. **Location Cards** - Add parking section to each location:
```
🅿️ PARKING INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Nearest Car Park: Tottenham Court Road (450m)
   • 50 spaces total
   • 24 hour access
   • Facilities: Covered, Secure

⚠️  CPZ Warning: West End Zone F
   • Operating Hours: Mon-Sat 8:30am-6:30pm
   • Pay & Display required

🅿️  Alternative Options:
   • Oxford Street Car Park (680m) - 100 spaces
   • Soho Square Car Park (820m) - 35 spaces

🎯 Parking Risk: 7/10 (Limited availability)
```

2. **Color Coding:**
- Green: Parking risk 1-3 (easy parking)
- Yellow: Parking risk 4-6 (moderate)
- Red: Parking risk 7-10 (challenging)

3. **Expandable Details:**
- Show top 3 car parks by default
- "Show more parking options" button
- Map markers for car parks on Google Map

---

### Phase 5: Update TypeScript Types

**File:** `lib/database.types.ts` (if storing in Supabase)

**Add to trip_results JSONB structure:**
```typescript
parking: {
  location: string;
  coordinates: { lat: number; lng: number };
  carParks: Array<{...}>;
  cpzInfo?: {...};
  parkingRiskScore: number;
  summary: {...};
}
```

---

## 🎨 UI/UX DESIGN

### Executive Report Section:
Add new section in executive report:
```
PARKING ASSESSMENT
──────────────────────────────────────
For each location, we've analyzed parking availability 
and restrictions:

Location 1: 76 Dean St
  ✓ 3 car parks within 800m
  ⚠️  CPZ Zone F (Mon-Sat 8:30am-6:30pm)
  💡 Recommendation: Arrive before 8:30am or after 6:30pm 
     to avoid CPZ charges, or use Tottenham Court Road 
     station car park (450m, 24hr access)

Location 2: Hounslow
  ✓ Easy parking - 5 car parks nearby
  ✓ No CPZ restrictions
  ✓ Large capacity station car park 200m away
```

### Results Page Components:
- Parking info cards with icons
- Google Maps integration showing car park markers
- Color-coded risk badges
- Collapsible sections for details

---

## 🚨 CPZ DATA CHALLENGE & SOLUTION

**Challenge:** TfL API doesn't provide CPZ boundary data

**Solutions (in order of preference):**

### Option 1: London Datastore Static Data ⭐ RECOMMENDED
- Download CPZ boundary data from London Datastore (GIS/GeoJSON format)
- Store in Supabase as static dataset
- Use point-in-polygon check to determine if location is in CPZ
- Update quarterly

**Pros:** Free, accurate, official data
**Cons:** Manual updates needed, setup time

### Option 2: Borough-Specific APIs
- Integrate with Westminster, City of London, Camden APIs
- Focus on high-traffic VIP areas first
- Expand to other boroughs later

**Pros:** More accurate, potentially real-time
**Cons:** Multiple integrations, inconsistent APIs

### Option 3: Heuristic Approach (MVP)
- Create manual list of known CPZ areas (Central London, Westminster, etc.)
- Use broad zone definitions
- Show generic warning: "This area may be in a Controlled Parking Zone"

**Pros:** Quick to implement, good for MVP
**Cons:** Less accurate, generic warnings

### Option 4: Third-Party APIs
- Use ParkWhiz, JustPark, AppyParking APIs
- Get CPZ data + real parking availability

**Pros:** Comprehensive, real-time
**Cons:** Paid service, additional cost

**RECOMMENDATION FOR PHASE 1:** 
Use Option 3 (Heuristic) for MVP, then migrate to Option 1 (London Datastore) in Phase 2.

---

## 📝 EVERGREEN DATA STRATEGY

To ensure data remains useful regardless of when report is generated:

### 1. Display Operating Hours (Not Current Status)
```
❌ DON'T: "Open now" / "Closed now"
✅ DO: "Operating Hours: Mon-Fri 7am-10pm, Sat-Sun 24hr"
```

### 2. Show Total Capacity (Not Current Availability)
```
❌ DON'T: "23 spaces available"
✅ DO: "Total capacity: 50 spaces"
```

### 3. Static Facility Information
```
✅ "Covered parking, Accessible spaces, EV charging available"
```

### 4. CPZ Operating Hours (Not Current Enforcement Status)
```
❌ DON'T: "CPZ currently enforced"
✅ DO: "CPZ enforced Mon-Sat 8:30am-6:30pm"
```

### 5. Distance and Location
```
✅ "450m from destination (5 min walk)"
```

---

## 🧪 TESTING CHECKLIST

- [ ] TfL API returns car parks within 1km radius
- [ ] Parking data includes all required fields
- [ ] Falls back gracefully if no car parks found
- [ ] CPZ detection works for known zones
- [ ] Parking risk score calculated correctly
- [ ] Executive report includes parking analysis
- [ ] Results page displays parking info correctly
- [ ] Data is evergreen (no time-specific info)
- [ ] Works with 1, 2, and 3+ locations
- [ ] Database storage (Supabase) works
- [ ] Google Maps shows car park markers

---

## 📊 SUCCESS METRICS

**MVP Success:**
- ✅ Car park data displayed for each location
- ✅ CPZ warnings shown when applicable
- ✅ Parking risk score integrated into trip risk
- ✅ GPT includes parking in recommendations

**Enhanced Success:**
- ✅ Accurate CPZ boundary detection (>90%)
- ✅ 3+ alternative parking suggestions per location
- ✅ Car park markers on map
- ✅ Parking info influences trip scheduling recommendations

---

## 🚀 IMPLEMENTATION TIMELINE

**Phase 1: Core API Integration (2-3 hours)**
- Create `lib/tfl-parking-api.ts`
- Create `app/api/parking/route.ts`
- Test with sample locations
- Implement heuristic CPZ detection

**Phase 2: Data Flow Integration (1-2 hours)**
- Update `app/page.tsx` to fetch parking data
- Store in Supabase with trip results
- Add TypeScript interfaces

**Phase 3: Executive Report Integration (1 hour)**
- Update `lib/executive-report.ts`
- Add parking to GPT prompt
- Test report generation

**Phase 4: UI Display (2-3 hours)**
- Update `app/results/[id]/page.tsx`
- Create parking info cards
- Add map markers
- Style components

**Phase 5: Testing & Refinement (1 hour)**
- Test with multiple locations
- Verify evergreen data display
- Check error handling
- User experience polish

**Total Estimated Time: 7-10 hours**

---

## 🎯 DELIVERABLES

1. ✅ TfL Parking API client library
2. ✅ `/api/parking` endpoint
3. ✅ Parking data integration in trip flow
4. ✅ Executive report with parking analysis
5. ✅ Results page with parking display
6. ✅ Updated TypeScript types
7. ✅ Database schema updates
8. ✅ Documentation (this file + inline comments)

---

## 🔮 FUTURE ENHANCEMENTS (Not in Scope)

1. **Historical Occupancy Patterns**
   - Collect real-time TfL occupancy data daily
   - Build historical database
   - Show "Typically 70% full on Tuesdays at 2pm"

2. **Third-Party Integration**
   - Add JustPark/ParkWhiz for private parking
   - Real-time booking capabilities
   - Price comparisons

3. **Advanced CPZ System**
   - Full London Datastore GeoJSON integration
   - Borough-specific APIs
   - Real-time enforcement status

4. **Smart Recommendations**
   - AI-powered optimal parking suggestion
   - Consider walk time + parking cost + availability
   - Route optimization including parking

---

## ❓ QUESTIONS FOR APPROVAL

1. **CPZ Data Approach:** Start with heuristic (quick) or invest time in London Datastore integration (accurate)?

2. **API Rate Limits:** TfL has rate limits - should we cache parking data in Supabase for frequently searched locations?

3. **Display Priority:** Show all car parks or just top 3 by default?

4. **Risk Score Weight:** How much should parking difficulty affect overall trip risk score (suggest: 10-15% weight)?

5. **Map Integration:** Add car park markers to existing Google Map or create separate parking-focused map?

---

## ✅ READY TO PROCEED

This plan provides:
- ✅ Clear technical approach using TfL API
- ✅ Evergreen data strategy (no time-specific info)
- ✅ Integration with existing executive report
- ✅ Phased implementation
- ✅ Realistic timeline
- ✅ Future scalability

**Awaiting your approval to begin implementation!**

