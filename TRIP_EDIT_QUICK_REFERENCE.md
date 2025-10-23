# Trip Edit Feature - Quick Reference

## Option Comparison Matrix

| Feature | Option 1: Smart Text | Option 2: Form Update | Option 3: Hybrid | Option 4: Versions |
|---------|---------------------|----------------------|------------------|-------------------|
| **User Experience** | ⭐⭐⭐⭐⭐ Natural | ⭐⭐⭐ Form-based | ⭐⭐⭐⭐ Balanced | ⭐⭐ Complex |
| **Implementation Complexity** | ⭐⭐⭐⭐ High | ⭐⭐ Low | ⭐⭐⭐⭐⭐ Very High | ⭐⭐⭐⭐ High |
| **Cost Efficiency** | ⭐⭐⭐⭐⭐ Optimal | ⭐⭐⭐ Good | ⭐⭐⭐⭐ Good | ⭐⭐ Poor |
| **AI Required** | Yes | No | Yes | Optional |
| **Data Preservation** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐ Good | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐⭐ Perfect |
| **Handles Complex Changes** | ⭐⭐⭐⭐⭐ Yes | ⭐⭐⭐ Limited | ⭐⭐⭐⭐⭐ Yes | ⭐⭐⭐⭐ Yes |
| **User Confirmation** | ❌ No | ✅ Explicit | ✅ Preview | ✅ Version |
| **Development Time** | 2-3 weeks | 1 week | 3-4 weeks | 2-3 weeks |

## Cost Analysis Per Update Type

| Update Type | Option 1 | Option 2 | Full Regenerate |
|-------------|----------|----------|-----------------|
| **Time change only** | ~$0.003 | ~$0.003 | ~$0.023 |
| **Add 1 location** | ~$0.023 | ~$0.023 | ~$0.023 |
| **Add 3 locations** | ~$0.063 | ~$0.063 | ~$0.023 |
| **Remove location** | ~$0.003 | ~$0.003 | ~$0.023 |
| **Date change** | ~$0.023* | ~$0.023* | ~$0.023 |

*Weather and events are date-specific, requiring full refresh

## Change Type Detection Matrix

| User Says | Detected Change Type | Data to Refresh | Cost Impact |
|-----------|---------------------|-----------------|-------------|
| "Move meeting to 3pm" | `time_change` | Traffic only | Minimal (~$0.003) |
| "Change date to next week" | `date_change` | Weather, Events, Traffic | High (~$0.023) |
| "Add stop at Harrods" | `new_location` | All data for new location | Medium (~$0.020) |
| "Remove dinner stop" | `remove_location` | Traffic predictions only | Minimal (~$0.003) |
| "Change pickup from Gatwick to Heathrow" | `location_change` | All data for that location | Medium (~$0.020) |
| "Swap locations A and B" | `reorder_locations` | Traffic predictions only | Minimal (~$0.003) |

## API Endpoints Needed

### New Endpoints
```
POST /api/update-trip
  - Accepts: { tripId, updateText }
  - Returns: { success, updatedTrip }

POST /api/extract-changes
  - Accepts: { updateText, existingTrip }
  - Returns: { changes[], tripPurposeUpdate?, specialRemarksUpdate? }

POST /api/preview-update (optional for Option 3)
  - Accepts: { tripId, changes }
  - Returns: { preview of changes }
```

### Modified Endpoints
```
None required - existing endpoints can be reused:
  - /api/uk-crime
  - /api/weather
  - /api/events
  - /api/parking
  - /api/executive-report
```

## Data Refresh Rules

```typescript
const refreshRules = {
  time_change: {
    refreshLocation: false,
    refreshTraffic: true,
    refreshExecutiveReport: true,
  },
  date_change: {
    refreshLocation: true, // Weather, events are date-specific
    refreshTraffic: true,
    refreshExecutiveReport: true,
  },
  new_location: {
    refreshLocation: true, // Only for new location
    refreshTraffic: true,
    refreshExecutiveReport: true,
  },
  remove_location: {
    refreshLocation: false,
    refreshTraffic: true,
    refreshExecutiveReport: true,
  },
  location_change: {
    refreshLocation: true, // Only for changed location
    refreshTraffic: true,
    refreshExecutiveReport: true,
  },
  reorder_locations: {
    refreshLocation: false,
    refreshTraffic: true,
    refreshExecutiveReport: true,
  },
};
```

## UI Component Structure

```
results/[id]/page.tsx
  └─ EditTripButton (owner only)
       └─ EditTripModal
            ├─ UpdateTextArea
            ├─ ProcessingState
            ├─ ErrorState
            └─ SuccessState
```

## Example Update Scenarios

### Scenario 1: Simple Time Change
```
Input: "Move the UBS meeting from 2pm to 3pm"

Extraction:
{
  changes: [{
    type: 'time_change',
    locationIndex: 1,
    locationName: 'UBS Bank',
    oldTime: '14:00',
    newTime: '15:00'
  }]
}

Refresh Strategy:
- Preserve: Crime, weather, events, parking, cafes data
- Regenerate: Traffic predictions, executive report
- Cost: ~$0.003
```

### Scenario 2: Add Location
```
Input: "Add a stop at Harrods at 4:30pm for shopping before dinner"

Extraction:
{
  changes: [{
    type: 'new_location',
    location: 'Harrods, London',
    time: '16:30',
    purpose: 'Shopping at Harrods',
    insertAfter: 2  // After UBS meeting
  }]
}

Refresh Strategy:
- Preserve: All existing location data
- Fetch: Complete data for Harrods only
- Regenerate: Traffic predictions, executive report
- Cost: ~$0.023
```

### Scenario 3: Complex Multi-Change
```
Input: "Change pickup from Gatwick to Heathrow at 10am instead of 9am, 
        and add lunch at The Shard at 1pm"

Extraction:
{
  changes: [
    {
      type: 'location_change',
      locationIndex: 0,
      oldLocation: 'Gatwick Airport',
      newLocation: 'Heathrow Airport, London',
      verified: { lat: 51.4700, lng: -0.4543, ... }
    },
    {
      type: 'time_change',
      locationIndex: 0,
      oldTime: '09:00',
      newTime: '10:00'
    },
    {
      type: 'new_location',
      location: 'The Shard, London',
      time: '13:00',
      purpose: 'Lunch at The Shard',
      insertAfter: 1
    }
  ]
}

Refresh Strategy:
- Preserve: Data for locations 2, 3, 4 (unchanged)
- Fetch: Data for Heathrow (new), The Shard (new)
- Regenerate: All traffic predictions, executive report
- Cost: ~$0.043
```

### Scenario 4: Date Change
```
Input: "Move the entire trip to next Tuesday (23rd Jan)"

Extraction:
{
  changes: [{
    type: 'date_change',
    oldDate: '2025-01-15',
    newDate: '2025-01-23'
  }]
}

Refresh Strategy:
- Preserve: Crime data (monthly), parking data, cafe data
- Fetch: Weather (date-specific), events (date-specific)
- Regenerate: All traffic predictions, executive report
- Cost: ~$0.023
```

## OpenAI Prompt Structure

### Change Extraction Prompt
```typescript
const prompt = `You are analyzing an update request for an existing trip.

EXISTING TRIP:
${JSON.stringify(existingTrip.locations)}
Date: ${existingTrip.trip_date}

UPDATE REQUEST:
"${updateText}"

Extract what changed and return JSON:
{
  "changes": [
    {
      "type": "time_change|location_change|new_location|remove_location|date_change|reorder_locations",
      // Type-specific fields
    }
  ],
  "tripPurposeUpdate": "string or null",
  "specialRemarksUpdate": "string or null"
}

Rules:
- Match locations by index or name similarity
- Be precise about what changed
- If ambiguous, include confidence score
- Preserve unchanged details
`;
```

## Database Update Pattern

```typescript
// Pattern 1: Minimal update (time change only)
await supabase.from('trips').update({
  locations: updatedLocations,
  traffic_predictions: newTraffic,
  executive_report: newReport,
  edit_count: trip.edit_count + 1,
  last_edited_at: new Date().toISOString()
}).eq('id', tripId);

// Pattern 2: Full update (new locations)
await supabase.from('trips').update({
  locations: updatedLocations,
  trip_results: mergedResults,
  traffic_predictions: newTraffic,
  executive_report: newReport,
  edit_count: trip.edit_count + 1,
  last_edited_at: new Date().toISOString()
}).eq('id', tripId);
```

## Error Handling Checklist

- [ ] Validate user owns the trip
- [ ] Handle OpenAI extraction failures
- [ ] Handle Google Maps verification failures
- [ ] Handle partial data fetch failures
- [ ] Rollback on database update failure
- [ ] Show clear error messages to user
- [ ] Log errors for debugging
- [ ] Rate limit updates per user
- [ ] Prevent concurrent edits

## Testing Checklist

### Unit Tests
- [ ] Change extraction accuracy
- [ ] Location matching logic
- [ ] Time parsing and validation
- [ ] Data merging correctness
- [ ] Refresh strategy determination

### Integration Tests
- [ ] Full update flow (happy path)
- [ ] Partial data failure handling
- [ ] Database transaction consistency
- [ ] API rate limiting
- [ ] Concurrent update handling

### E2E Tests
- [ ] Time change scenario
- [ ] Add location scenario
- [ ] Remove location scenario
- [ ] Complex multi-change scenario
- [ ] Date change scenario
- [ ] Error recovery scenario

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Update latency** | < 10s | Time from submit to completion |
| **AI extraction accuracy** | > 95% | Correct change detection rate |
| **Data preservation rate** | > 80% | % of data reused vs refetched |
| **Error rate** | < 2% | Failed updates / total updates |
| **User satisfaction** | > 4.5/5 | Post-update survey rating |

## Rollout Plan

### Week 1: Core API
- Implement `/api/update-trip`
- Implement change extraction
- Implement refresh strategy
- Unit test coverage

### Week 2: UI Integration
- Add Edit button to results page
- Create edit modal
- Integrate with API
- Add loading/error states

### Week 3: Polish & Launch
- Add success notifications
- Add analytics tracking
- User acceptance testing
- Soft launch to beta users
- Monitor and iterate
- Full launch

## Monitoring Dashboard Metrics

```typescript
// Track in analytics
{
  event: 'trip_updated',
  properties: {
    tripId: string,
    changeTypes: string[],
    locationsAdded: number,
    locationsRemoved: number,
    locationsChanged: number,
    timesChanged: number,
    dateChanged: boolean,
    dataRefreshed: number, // % of data refreshed
    cost: number, // API cost
    latency: number, // Time to complete
    success: boolean
  }
}
```

## Common Pitfalls to Avoid

1. **Over-refreshing data**: Don't fetch data that hasn't changed
2. **Under-refreshing data**: Don't forget date-specific data when date changes
3. **Poor error messages**: Be specific about what went wrong
4. **No validation**: Always validate chronological order
5. **Lost data**: Preserve old data before applying changes
6. **Race conditions**: Handle concurrent edits properly
7. **Cost explosion**: Monitor and cap API usage
8. **Poor UX**: Show progress, don't leave user hanging

## Success Criteria

✅ Users can successfully edit trips via natural language  
✅ 80%+ of unchanged data is preserved  
✅ Update latency < 10 seconds  
✅ Cost per update < $0.05 (average)  
✅ Error rate < 2%  
✅ User satisfaction > 4.5/5  
✅ Feature adoption > 30% of active users  

