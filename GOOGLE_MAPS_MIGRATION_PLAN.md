# Google Maps Migration Plan
## From Mapbox to Google Maps - Peace of Mind App

---

## 📋 **Executive Summary**

This document outlines a comprehensive plan to migrate from Mapbox GL JS to Google Maps JavaScript API while implementing advanced features including:
- ✅ Business name search and geocoding
- ✅ Real-time traffic predictions
- ✅ Accurate travel times with traffic consideration
- ✅ Turn-by-turn directions with multiple waypoints

---

## 🔑 **Step 1: Environment Configuration**

### **Action Required:**
Create or update `.env.local` file with:

```bash
# Google Maps API Configuration
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyDiOF8u5Ly9iBB8P5RWKVLnmbOBmGrbnc

# Legacy Mapbox Token (keep until migration complete)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoiZ2VyYXJkbWFydHJldCIsImEiOiJjbWdwdndsNGcxZzN1MmpyNWN0ZnU0dTJ3In0.x3AO53mr_-NDrZU19Mnchg
```

### **Google Cloud Console Setup:**
Enable the following APIs in Google Cloud Console:
1. **Maps JavaScript API** - For map display
2. **Places API** - For business name search
3. **Geocoding API** - For address/coordinate conversion
4. **Directions API** - For routes and travel times
5. **Distance Matrix API** - For multi-point travel time calculations

---

## 📦 **Step 2: Install Dependencies**

### **Remove Mapbox packages:**
```bash
npm uninstall mapbox-gl react-map-gl
```

### **Install Google Maps packages:**
```bash
npm install @react-google-maps/api
npm install --save-dev @types/google.maps
```

**Package Details:**
- `@react-google-maps/api` - Official React wrapper for Google Maps (v2.19+)
- `@types/google.maps` - TypeScript definitions for Google Maps API

---

## 🗺️ **Step 3: Component Migration Strategy**

### **Files to Modify:**

#### **1. TripMap.tsx** (Main map component)
**Current:** Uses Mapbox GL JS with route rendering
**Changes Needed:**
- Replace Mapbox map initialization with `GoogleMap` component
- Replace Mapbox Directions API with Google Directions Service
- Convert custom markers to Google Maps Marker components
- Implement Traffic Layer for real-time traffic visualization
- Add DirectionsRenderer for route display
- Update styling to use Google Maps style objects

**Key Google Maps Features to Implement:**
- `google.maps.DirectionsService` - Route calculation
- `google.maps.DirectionsRenderer` - Route display
- `google.maps.TrafficLayer` - Real-time traffic overlay
- `google.maps.Marker` - Location markers
- `google.maps.InfoWindow` - Popup information

#### **2. LocationSearch.tsx** (Location search/autocomplete)
**Current:** Uses Mapbox Geocoding API
**Changes Needed:**
- Replace Mapbox Geocoding with Google Places Autocomplete
- Implement `Autocomplete` component from `@react-google-maps/api`
- Add business/POI search with Places API
- Enhanced search results with business categories
- Add place photos and ratings (optional)

**Key Google Maps Features to Implement:**
- `google.maps.places.Autocomplete` - Business name autocomplete
- `google.maps.places.PlacesService` - Detailed place information
- Place types filtering (businesses, addresses, landmarks)

#### **3. MapTest.tsx** (Test/demo component)
**Current:** Mapbox test component
**Changes Needed:**
- Simple replacement with GoogleMap component
- Update markers and controls
- Test traffic layer functionality
- Verify API key and connection

---

## 🔍 **Step 4: Feature Implementation Details**

### **Feature 1: Business Name to Address Conversion**

**Implementation:**
```javascript
// Using Places Autocomplete Service
const autocompleteService = new google.maps.places.AutocompleteService();

autocompleteService.getPlacePredictions(
  {
    input: 'Starbucks Westminster',
    types: ['establishment'], // businesses only
    componentRestrictions: { country: 'uk' },
    location: new google.maps.LatLng(51.5074, -0.1278),
    radius: 50000 // 50km radius
  },
  (predictions, status) => {
    // Handle results with business names, addresses, and coordinates
  }
);
```

**Benefits over Mapbox:**
- More accurate business search
- Access to Google's extensive business database
- Place details (hours, ratings, photos)
- Better POI (Point of Interest) detection

---

### **Feature 2: Traffic Predictions**

**Implementation:**
```javascript
// Add Traffic Layer for real-time visualization
const trafficLayer = new google.maps.TrafficLayer();
trafficLayer.setMap(map);

// Get traffic-aware directions with predictions
directionsService.route({
  origin: 'Location A',
  destination: 'Location B',
  travelMode: google.maps.TravelMode.DRIVING,
  drivingOptions: {
    departureTime: new Date(Date.now() + 3600000), // 1 hour from now
    trafficModel: google.maps.TrafficModel.BEST_GUESS // or OPTIMISTIC/PESSIMISTIC
  }
}, callback);
```

**Traffic Models Available:**
- `BEST_GUESS` - Historical and live traffic (default)
- `OPTIMISTIC` - Better than usual conditions
- `PESSIMISTIC` - Worse than usual conditions

**Benefits over Mapbox:**
- Real-time traffic overlay on map (visual)
- Historical traffic patterns
- Predictive traffic for future departure times
- More accurate for London roads

---

### **Feature 3: Travel Times with Traffic**

**Implementation:**
```javascript
// For single route
directionsService.route(request, (result, status) => {
  if (status === google.maps.DirectionsStatus.OK) {
    const route = result.routes[0].legs[0];
    const durationInTraffic = route.duration_in_traffic.text; // e.g., "25 mins"
    const durationInTrafficValue = route.duration_in_traffic.value; // seconds
    const distance = route.distance.text; // e.g., "5.2 km"
  }
});

// For multiple origins/destinations
const distanceMatrixService = new google.maps.DistanceMatrixService();
distanceMatrixService.getDistanceMatrix({
  origins: ['Location A', 'Location B'],
  destinations: ['Destination 1', 'Destination 2'],
  travelMode: google.maps.TravelMode.DRIVING,
  drivingOptions: {
    departureTime: new Date(),
    trafficModel: google.maps.TrafficModel.BEST_GUESS
  }
}, callback);
```

**Data Provided:**
- `duration` - Normal travel time (no traffic)
- `duration_in_traffic` - Real-time traffic-adjusted time
- `distance` - Route distance
- Time comparisons for planning

---

### **Feature 4: Directions & Routes**

**Implementation:**
```javascript
const directionsService = new google.maps.DirectionsService();
const directionsRenderer = new google.maps.DirectionsRenderer({
  map: map,
  suppressMarkers: false, // show A/B markers
  polylineOptions: {
    strokeColor: '#3B82F6',
    strokeWeight: 5,
    strokeOpacity: 0.8
  }
});

// Multi-waypoint route (your trip planner feature)
directionsService.route({
  origin: locations[0],
  destination: locations[locations.length - 1],
  waypoints: locations.slice(1, -1).map(loc => ({
    location: new google.maps.LatLng(loc.lat, loc.lng),
    stopover: true
  })),
  travelMode: google.maps.TravelMode.DRIVING,
  optimizeWaypoints: true, // Google optimizes route order
  drivingOptions: {
    departureTime: new Date(tripDate + ' ' + locations[0].time),
    trafficModel: google.maps.TrafficModel.BEST_GUESS
  }
}, (result, status) => {
  if (status === google.maps.DirectionsStatus.OK) {
    directionsRenderer.setDirections(result);
    // Extract route information
    const route = result.routes[0];
    const totalDistance = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0);
    const totalDuration = route.legs.reduce((sum, leg) => sum + leg.duration_in_traffic.value, 0);
  }
});
```

**Features:**
- Up to 25 waypoints per route
- Automatic route optimization
- Turn-by-turn instructions
- Alternative routes
- Avoid highways/tolls options

---

## 🔧 **Step 5: Code Migration Breakdown**

### **TripMap.tsx Changes:**

**Remove:**
```typescript
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
```

**Add:**
```typescript
import { GoogleMap, DirectionsRenderer, Marker, InfoWindow, TrafficLayer } from '@react-google-maps/api';
```

**Replace Map Initialization:**
```typescript
// OLD: Mapbox
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
const map = new mapboxgl.Map({
  container: mapContainer.current,
  style: 'mapbox://styles/mapbox/streets-v11',
  center: [lng, lat],
  zoom: 12,
});

// NEW: Google Maps
<GoogleMap
  mapContainerStyle={{ width: '100%', height: '400px' }}
  center={{ lat: locations[0].lat, lng: locations[0].lng }}
  zoom={12}
  onLoad={(map) => {
    // Map loaded, add traffic layer
    const trafficLayer = new google.maps.TrafficLayer();
    trafficLayer.setMap(map);
  }}
>
  {/* Markers and routes go here */}
</GoogleMap>
```

**Replace Route Fetching:**
```typescript
// OLD: Mapbox Directions API
const coordinates = locations.map(loc => `${loc.lng},${loc.lat}`).join(';');
const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?access_token=${token}`;
const response = await fetch(directionsUrl);

// NEW: Google Directions Service
const directionsService = new google.maps.DirectionsService();
directionsService.route({
  origin: { lat: locations[0].lat, lng: locations[0].lng },
  destination: { lat: locations[locations.length - 1].lat, lng: locations[locations.length - 1].lng },
  waypoints: locations.slice(1, -1).map(loc => ({
    location: { lat: loc.lat, lng: loc.lng },
    stopover: true
  })),
  travelMode: google.maps.TravelMode.DRIVING,
  drivingOptions: {
    departureTime: new Date(),
    trafficModel: google.maps.TrafficModel.BEST_GUESS
  }
}, (result, status) => {
  setDirectionsResponse(result);
});
```

---

### **LocationSearch.tsx Changes:**

**Remove:**
```typescript
// OLD: Mapbox Geocoding
const response = await fetch(
  `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}`
);
```

**Add:**
```typescript
import { Autocomplete } from '@react-google-maps/api';

// NEW: Google Places Autocomplete
const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

<Autocomplete
  onLoad={setAutocomplete}
  onPlaceChanged={() => {
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place.geometry?.location) {
        onLocationSelect({
          name: place.formatted_address || place.name || '',
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
    }
  }}
  options={{
    types: ['establishment', 'geocode'], // businesses and addresses
    componentRestrictions: { country: 'uk' },
    fields: ['formatted_address', 'name', 'geometry', 'place_id', 'types']
  }}
>
  <input
    type="text"
    placeholder="Search hotels, restaurants, landmarks..."
    className="w-full rounded-lg border-2 py-3 px-4"
  />
</Autocomplete>
```

---

## 📊 **Step 6: API Comparison**

| Feature | Mapbox | Google Maps | Winner |
|---------|--------|-------------|--------|
| **Business Search** | Basic geocoding | Places API with 200M+ POIs | 🏆 Google |
| **Traffic Data** | Limited | Real-time + predictive | 🏆 Google |
| **Travel Time Accuracy** | Good | Excellent (live traffic) | 🏆 Google |
| **Route Optimization** | Manual | Automatic waypoint optimization | 🏆 Google |
| **POI Details** | Limited | Ratings, photos, hours | 🏆 Google |
| **Map Styling** | Highly customizable | Customizable (but less) | 🏆 Mapbox |
| **Price (Free Tier)** | 50K loads/month | $200/month credit (~28K loads) | 🏆 Mapbox |
| **London Coverage** | Global | Excellent UK coverage | 🏆 Google |

---

## 💰 **Step 7: Pricing Considerations**

### **Google Maps Pricing (as of 2024):**
- **$200 monthly credit** (free)
- **Maps JavaScript API:** $7 per 1,000 loads
- **Directions API:** $5 per 1,000 requests
- **Places API:** $17 per 1,000 autocomplete requests
- **Distance Matrix API:** $5 per 1,000 requests

### **Estimated Monthly Usage (Peace of Mind App):**
Assuming 1,000 users/month:
- Map loads: 3,000 loads → $21
- Directions: 2,000 requests → $10
- Places autocomplete: 5,000 requests → $85
- **Total: ~$116/month** (within free $200 credit)

### **Recommendation:**
✅ Should stay within free tier for moderate usage
⚠️ Monitor usage in Google Cloud Console
💡 Consider implementing request caching to reduce API calls

---

## 🧪 **Step 8: Testing Plan**

### **Phase 1: Component Migration (Unit Tests)**
1. ✅ Replace TripMap.tsx with Google Maps
2. ✅ Test map rendering with single location
3. ✅ Test multiple markers display
4. ✅ Verify InfoWindow popups

### **Phase 2: Feature Testing**
1. ✅ Test business name search (e.g., "Starbucks Westminster")
2. ✅ Verify Places Autocomplete suggestions
3. ✅ Test traffic layer visualization
4. ✅ Verify directions between 2 points
5. ✅ Test multi-waypoint routes (3+ locations)
6. ✅ Verify travel time calculations with traffic

### **Phase 3: Integration Testing**
1. ✅ Test full trip planning workflow
2. ✅ Verify executive report generation with new data
3. ✅ Test drag-and-drop reordering with Google routes
4. ✅ Verify safety scores overlay on map
5. ✅ Test mobile responsiveness

### **Phase 4: Performance Testing**
1. ✅ Measure map load time
2. ✅ Test with 10+ waypoints
3. ✅ Verify API quota usage
4. ✅ Test error handling for API failures

---

## 🚀 **Step 9: Deployment Strategy**

### **Option A: Parallel Implementation (Recommended)**
1. Keep Mapbox running
2. Implement Google Maps in parallel (new components)
3. Add feature flag to switch between implementations
4. Test thoroughly
5. Switch to Google Maps
6. Remove Mapbox dependencies

### **Option B: Direct Migration**
1. Create feature branch
2. Migrate all components at once
3. Test comprehensively
4. Deploy when ready

**Recommendation:** **Option A** (safer for production)

---

## 📝 **Step 10: File Changes Summary**

### **Files to Create:**
- `components/GoogleTripMap.tsx` - New Google Maps trip map component
- `components/GoogleLocationSearch.tsx` - New Google Places autocomplete component
- `hooks/useGoogleMaps.ts` - Custom hook for Google Maps initialization
- `lib/google-maps-api.ts` - Google Maps API wrapper functions

### **Files to Modify:**
- `app/page.tsx` - Update to use new Google Maps components
- `package.json` - Update dependencies
- `.env.local` - Add Google Maps API key

### **Files to Delete (after migration complete):**
- `components/TripMap.tsx` (old Mapbox version)
- `components/LocationSearch.tsx` (old Mapbox version)
- `components/MapTest.tsx` (old Mapbox test)
- `app/test-map/page.tsx` (old Mapbox test page)
- `MAPBOX_INTEGRATION.md` (old documentation)

---

## ⚠️ **Step 11: Risks & Mitigation**

### **Risk 1: API Quota Limits**
- **Mitigation:** Implement request caching, monitor usage dashboard
- **Fallback:** Show cached route if API fails

### **Risk 2: Breaking Changes During Migration**
- **Mitigation:** Use feature flags, parallel implementation
- **Rollback Plan:** Keep Mapbox code until Google Maps fully tested

### **Risk 3: Different Data Format**
- **Mitigation:** Create adapter layer to normalize API responses
- **Testing:** Comprehensive unit tests for data transformation

### **Risk 4: Map Styling Differences**
- **Mitigation:** Customize Google Maps styles to match Mapbox look
- **Alternative:** Embrace Google's default styling

---

## ✅ **Step 12: Success Criteria**

Migration is complete when:
1. ✅ All maps render correctly with Google Maps
2. ✅ Business search works with Places Autocomplete
3. ✅ Traffic layer displays real-time traffic
4. ✅ Directions work for multi-waypoint routes
5. ✅ Travel times include traffic predictions
6. ✅ All existing features still work
7. ✅ No Mapbox dependencies remain
8. ✅ API usage is within free tier limits
9. ✅ Mobile responsive design maintained
10. ✅ Executive report generation works with new data

---

## 📞 **Support Resources**

- [Google Maps JavaScript API Docs](https://developers.google.com/maps/documentation/javascript)
- [Places API Docs](https://developers.google.com/maps/documentation/places/web-service)
- [Directions API Docs](https://developers.google.com/maps/documentation/directions)
- [@react-google-maps/api Docs](https://react-google-maps-api-docs.netlify.app/)
- [Google Cloud Console](https://console.cloud.google.com/)

---

## 🎯 **Estimated Timeline**

- **Step 1-2:** Environment & Dependencies - **30 minutes**
- **Step 3-5:** Component Migration - **4-6 hours**
- **Step 6-8:** Feature Implementation - **6-8 hours**
- **Step 9-10:** Testing & Refinement - **4-6 hours**
- **Step 11:** Deployment & Cleanup - **2-3 hours**

**Total Estimated Time: 16-23 hours** (2-3 days of focused work)

---

## 🏁 **Next Steps (Awaiting Your Approval)**

Once you approve this plan, I will:
1. ✅ Update `.env.local` with Google Maps API key
2. ✅ Install Google Maps packages
3. ✅ Create new Google Maps components
4. ✅ Implement all 4 required features:
   - Business name geocoding
   - Traffic predictions
   - Travel times
   - Directions
5. ✅ Update main page to use new components
6. ✅ Test all functionality
7. ✅ Remove Mapbox dependencies

---

**Ready to proceed?** Please review this plan and let me know if you'd like any modifications before I start the implementation! 🚀

