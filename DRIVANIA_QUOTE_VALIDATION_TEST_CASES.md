# Drivania Quote Validation Test Cases

## Test Case Structure
Each test case should:
1. Set up trip data (locations, times, dates)
2. Click "Quote with drivania" button
3. Verify expected behavior (quote or message)

---

## Category 1: Duration-Based Validation (Primary Check)

### TC-1.1: Trip ≤ 3 hours - Should proceed with quote
**Setup:**
- Pickup: 09:00
- Dropoff: 11:30 (2.5 hours)
- 3 locations (hourly service)
- Route distance: 50 km (31 miles)
- Average mph: 12.4 mph

**Expected:** Quote request sent to Drivania, quotes displayed

---

### TC-1.2: Trip exactly 3 hours - Should proceed with quote
**Setup:**
- Pickup: 09:00
- Dropoff: 12:00 (exactly 3 hours)
- 3 locations (hourly service)
- Route distance: 60 km (37.3 miles)
- Average mph: 12.4 mph

**Expected:** Quote request sent to Drivania (3 hours is NOT > 3, so validation skipped)

---

### TC-1.3: Trip > 3 hours, low mph (≤15) - Should proceed with quote
**Setup:**
- Pickup: 09:00
- Dropoff: 14:00 (5 hours)
- 4 locations (hourly service)
- Route distance: 60 km (37.3 miles)
- Average mph: 7.5 mph

**Expected:** Quote request sent to Drivania, quotes displayed

---

### TC-1.4: Trip > 3 hours, high mph (>15) - Should show complex route message
**Setup:**
- Pickup: 09:00
- Dropoff: 14:00 (5 hours)
- 3 locations (hourly service)
- Route distance: 200 km (124.3 miles) - includes long highway segments
- Average mph: 24.9 mph

**Expected:** 
- NO quote request to Drivania
- Orange alert displayed: "Complex route detected - manual quote required"
- Shows: total distance (miles/km), duration, average mph
- Reason message displayed

---

### TC-1.5: Trip > 3 hours, very high mph (>15) - Should show complex route message
**Setup:**
- Pickup: 09:00
- Dropoff: 15:00 (6 hours)
- 3 locations (hourly service)
- Route distance: 300 km (186.4 miles) - multiple cities/states
- Average mph: 31.1 mph

**Expected:** Complex route message displayed

---

## Category 2: Service Type Variations

### TC-2.1: One-way service (2 locations) - No validation
**Setup:**
- Pickup: 09:00
- Dropoff: 15:00 (6 hours)
- 2 locations only (one-way service)
- Route distance: 300 km (186.4 miles)
- Average mph: 31.1 mph

**Expected:** Quote request sent (validation only applies to hourly services)

---

### TC-2.2: Hourly service with many intermediate stops
**Setup:**
- Pickup: 09:00
- Dropoff: 18:00 (9 hours)
- 6 locations (hourly service)
- Route distance: 120 km (74.6 miles) - many city stops
- Average mph: 8.3 mph

**Expected:** Quote request sent (low mph, passes validation)

---

## Category 3: Edge Cases

### TC-3.1: Missing intermediate stops route calculation
**Setup:**
- Pickup: 09:00
- Dropoff: 14:00 (5 hours)
- 3 locations (hourly service)
- Route distance calculation fails/returns null

**Expected:** Quote request sent (validation skipped if route distance unavailable)

---

### TC-3.2: Missing pickup/dropoff times
**Setup:**
- Pickup: 09:00
- Dropoff: null or invalid time
- 3 locations (hourly service)
- Route distance: 100 km

**Expected:** Quote request sent (validation skipped if times unavailable)

---

### TC-3.3: Same-day trip, late night crossing midnight
**Setup:**
- Pickup: 23:00 (Nov 22)
- Dropoff: 02:00 (Nov 23) - next day
- 3 locations (hourly service)
- Route distance: 200 km (124.3 miles)
- Duration: 3 hours (but crosses midnight)
- Average mph: 41.4 mph

**Expected:** Complex route message (if > 3 hours and > 15 mph)

---

### TC-3.4: Very long trip (>10 hours)
**Setup:**
- Pickup: 09:00
- Dropoff: 22:00 (13 hours)
- 3 locations (hourly service)
- Route distance: 150 km (93.2 miles)
- Average mph: 7.2 mph

**Expected:** Quote request sent (low mph, passes validation)

---

### TC-3.5: Very short trip but high mph (edge case)
**Setup:**
- Pickup: 09:00
- Dropoff: 12:01 (3.02 hours - just over 3 hours)
- 3 locations (hourly service)
- Route distance: 100 km (62.1 miles)
- Average mph: 20.6 mph

**Expected:** Complex route message (duration > 3 hours and mph > 15)

---

## Category 4: Real-World Scenarios

### TC-4.1: City trip with multiple stops (low mph)
**Setup:**
- Pickup: 09:00 (Manhattan)
- Stop 1: 10:30 (Brooklyn)
- Stop 2: 12:00 (Queens)
- Dropoff: 14:00 (Manhattan)
- 4 locations, 5 hours
- Route distance: 80 km (49.7 miles) - city driving
- Average mph: 9.9 mph

**Expected:** Quote request sent

---

### TC-4.2: Highway trip between cities (high mph)
**Setup:**
- Pickup: 09:00 (New York)
- Stop 1: 11:00 (Philadelphia)
- Dropoff: 14:00 (Washington DC)
- 3 locations, 5 hours
- Route distance: 350 km (217.5 miles) - mostly highway
- Average mph: 43.5 mph

**Expected:** Complex route message

---

### TC-4.3: Mixed city and highway (borderline)
**Setup:**
- Pickup: 09:00
- Stop 1: 11:00 (city)
- Dropoff: 14:00 (highway to nearby city)
- 3 locations, 5 hours
- Route distance: 120 km (74.6 miles)
- Average mph: 14.9 mph (just under 15)

**Expected:** Quote request sent (mph = 14.9, which is NOT > 15)

---

### TC-4.4: Mixed city and highway (just over threshold)
**Setup:**
- Pickup: 09:00
- Stop 1: 11:00 (city)
- Dropoff: 14:00 (highway to nearby city)
- 3 locations, 5 hours
- Route distance: 121 km (75.2 miles)
- Average mph: 15.0 mph (exactly 15)

**Expected:** Quote request sent (mph = 15.0, which is NOT > 15, threshold is > 15)

---

### TC-4.5: Mixed city and highway (over threshold)
**Setup:**
- Pickup: 09:00
- Stop 1: 11:00 (city)
- Dropoff: 14:00 (highway to nearby city)
- 3 locations, 5 hours
- Route distance: 122 km (75.8 miles)
- Average mph: 15.2 mph (just over 15)

**Expected:** Complex route message (mph > 15)

---

## Category 5: Data Quality & Error Handling

### TC-5.1: Updated trip - should use latest data
**Setup:**
1. Create trip with 3 locations, 4 hours, low mph
2. Update trip: change intermediate stop location (adds 50 km)
3. Request quote again

**Expected:** 
- Fetches latest trip data from database
- Recalculates route distance with new stop
- Applies validation with updated metrics

---

### TC-5.2: Trip with same pickup/dropoff but different intermediate stops
**Setup:**
- Pickup: Same location
- Dropoff: Same location
- Intermediate stops: Changed (different city)
- Duration: 5 hours
- New route distance: 200 km (124.3 miles)
- Average mph: 24.9 mph

**Expected:** Complex route message (validation detects high mph)

---

### TC-5.3: Invalid time format
**Setup:**
- Pickup: 09:00
- Dropoff: "invalid-time"
- 3 locations

**Expected:** Quote request sent (validation skipped, but may fail at Drivania)

---

## Category 6: UI/UX Validation

### TC-6.1: Complex route message display
**When:** TC-1.4 or TC-1.5 triggers
**Expected UI:**
- Orange alert (not red error)
- Title: "Complex route detected - manual quote required"
- Reason message explaining why
- Metrics displayed:
  - Total route distance (miles and km)
  - Trip duration (hours)
  - Average miles per hour
- NO quote cards displayed
- NO loading spinner after message appears

---

### TC-6.2: Normal quote display
**When:** TC-1.1, TC-1.2, TC-1.3 triggers
**Expected UI:**
- Quote cards displayed
- Service type badge shown
- Distance, drive time, currency displayed
- Vehicle options with prices

---

### TC-6.3: Error handling
**When:** API error or network failure
**Expected UI:**
- Red error alert
- Error message displayed
- NO complex route message
- NO quote cards

---

## Test Execution Checklist

### Pre-test Setup
- [ ] Ensure Drivania API credentials are configured
- [ ] Have test trip IDs ready
- [ ] Open browser console to see logs

### For Each Test Case:
1. [ ] Navigate to trip results page
2. [ ] Open browser console (F12)
3. [ ] Click "Quote with drivania" button
4. [ ] Check console logs for:
   - `⏱️ Trip duration calculation`
   - `🔍 Route validation check` (if duration > 3 hours)
   - `📋 Requesting Drivania quote` (if validation passes)
5. [ ] Verify UI shows expected result
6. [ ] Document actual vs expected behavior

### Key Logs to Check:
- `📍 Latest locations from database` - confirms latest data fetched
- `⏱️ Trip duration calculation` - shows duration in hours
- `🔍 Route validation check` - shows mph calculation and decision
- `📋 Requesting Drivania quote` - confirms quote request sent
- `✅ Drivania quote received` - confirms quote received

---

## Quick Test Scenarios (Priority)

### Must Test:
1. **TC-1.1** - Short trip (≤3 hours) - should work
2. **TC-1.4** - Long trip with high mph - should show message
3. **TC-1.3** - Long trip with low mph - should work
4. **TC-4.3** - Borderline case (14.9 mph) - should work
5. **TC-4.5** - Just over threshold (15.2 mph) - should show message
6. **TC-5.1** - Updated trip - should use latest data

### Nice to Test:
- All other test cases for comprehensive coverage

---

## Expected Console Output Examples

### When validation passes:
```
⏱️ Trip duration calculation: { durationHours: 5.00 }
🔍 Route validation check: { averageMilesPerHour: 7.5, needsSpecialRequest: false }
📋 Requesting Drivania quote...
✅ Drivania quote received
```

### When validation fails:
```
⏱️ Trip duration calculation: { durationHours: 5.00 }
🔍 Route validation check: { averageMilesPerHour: 24.9, needsSpecialRequest: true }
[NO quote request sent]
```

---

## Notes

- **Threshold**: 15 miles per hour (not 15 mph speed, but miles covered per hour of service)
- **Duration check**: Only validates if duration > 3 hours (not >= 3)
- **Service type**: Only validates hourly services (3+ locations)
- **Units**: Distance calculated in km, converted to miles for mph calculation
- **Fallback**: If route calculation fails, validation is skipped and quote proceeds

