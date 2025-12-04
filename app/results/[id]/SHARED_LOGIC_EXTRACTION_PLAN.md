# Shared Logic Extraction Plan

**Goal:** Extract all shared logic (hooks, utilities, data fetching) before page separation so it can be reused across owner/driver/guest pages.

---

## 🎣 TIER 1: Data Fetching Hooks (Extract First)

### 1. useTripData Hook ⭐⭐⭐
**Priority:** CRITICAL | **Risk:** LOW | **Effort:** 3 hours | **Lines:** ~225

**Location:** Lines 1829-2054

**What to extract:**
- Trip data loading from database
- Data transformation (traffic predictions, locations, JSON parsing)
- Location ID validation and fixing
- State initialization (driver notes, passenger info, etc.)
- Ownership check logic (but make it return role info)

**Hook Interface:**
```typescript
interface UseTripDataParams {
  tripId: string;
  user: User | null;
  isAuthenticated: boolean;
}

interface UseTripDataReturn {
  tripData: TripData | null;
  loading: boolean;
  error: string | null;
  ownershipChecked: boolean;
  // Role information
  isOwner: boolean;
  isGuestCreator: boolean;
  isGuestCreatedTrip: boolean;
  // Trip metadata
  tripStatus: string;
  driverEmail: string | null;
  // Setters for updates
  setTripData: (data: TripData) => void;
  setTripStatus: (status: string) => void;
  setDriverEmail: (email: string | null) => void;
  // Other trip fields
  driverNotes: string;
  leadPassengerName: string;
  vehicleInfo: string;
  passengerCount: number;
  tripDestination: string;
  locationDisplayNames: Record<string, string>;
  // Setters
  setDriverNotes: (notes: string) => void;
  setLeadPassengerName: (name: string) => void;
  setVehicleInfo: (info: string) => void;
  setPassengerCount: (count: number) => void;
  setTripDestination: (dest: string) => void;
  setLocationDisplayNames: (names: Record<string, string>) => void;
}
```

**Benefits:**
- Core data fetching logic shared by all pages
- Handles all data transformation
- Returns role information
- ~225 lines extracted

**File:** `hooks/useTripData.ts`

---

### 2. useDriverTokenValidation Hook ⭐⭐⭐
**Priority:** HIGH | **Risk:** LOW | **Effort:** 1.5 hours | **Lines:** ~80

**Location:** Lines 700-778

**What to extract:**
- Driver token validation from URL
- Token state management
- Driver view state
- canTakeAction calculation

**Hook Interface:**
```typescript
interface UseDriverTokenValidationParams {
  tripId: string;
  searchParams: URLSearchParams;
  loading: boolean;
}

interface UseDriverTokenValidationReturn {
  driverToken: string | null;
  validatedDriverEmail: string | null;
  isDriverView: boolean;
  canTakeAction: boolean;
  tokenValidationError: string | null;
  tokenAlreadyUsed: boolean;
  tokenMessage: string | null;
  driverResponseStatus: 'accepted' | 'rejected' | null;
}
```

**Benefits:**
- Isolated token validation logic
- Used by driver page
- Can be tested independently

**File:** `hooks/useDriverTokenValidation.ts`

---

### 3. useQuotes Hook ⭐⭐⭐
**Priority:** HIGH | **Risk:** MEDIUM | **Effort:** 3 hours | **Lines:** ~200

**Location:** Lines 2370-2526

**What to extract:**
- `fetchQuotes` (owner's view of all quotes)
- `fetchMyQuotes` (driver's view of their quotes)
- Realtime subscription for quote updates
- Quote state management

**Hook Interface:**
```typescript
interface UseQuotesParams {
  tripId: string;
  isOwner: boolean;
  loading: boolean;
  ownershipChecked: boolean;
  // For driver quotes
  driverEmail?: string | null;
  quoteEmail?: string;
  validatedDriverEmail?: string | null;
}

interface UseQuotesReturn {
  // Owner quotes
  quotes: Quote[];
  loadingQuotes: boolean;
  fetchQuotes: () => Promise<void>;
  // Driver quotes
  myQuotes: Quote[];
  loadingMyQuotes: boolean;
  fetchMyQuotes: (email: string) => Promise<void>;
}
```

**Benefits:**
- Centralizes all quote logic
- Handles realtime subscriptions
- Used by both owner and driver pages

**File:** `hooks/useQuotes.ts`

---

### 4. useRealtimeSubscriptions Hook ⭐⭐
**Priority:** MEDIUM | **Risk:** MEDIUM | **Effort:** 2 hours | **Lines:** ~100

**Location:** Lines 2528-2579

**What to extract:**
- Trip status realtime subscription
- Quote updates subscription (can be part of useQuotes)
- Subscription cleanup

**Hook Interface:**
```typescript
interface UseRealtimeSubscriptionsParams {
  tripId: string;
  isOwner: boolean;
  onTripStatusUpdate?: (status: string, driver: string | null) => void;
  onQuoteUpdate?: () => void;
}

interface UseRealtimeSubscriptionsReturn {
  // Subscriptions are automatic, no return needed
  // Or return cleanup function if needed
}
```

**Benefits:**
- Centralizes realtime logic
- Prevents subscription leaks
- Used by owner page

**File:** `hooks/useRealtimeSubscriptions.ts`

---

## 🛠️ TIER 2: Utility Hooks (Extract Second)

### 5. useScrollPosition Hook ⭐
**Priority:** LOW | **Risk:** VERY LOW | **Effort:** 30 min | **Lines:** ~15

**Location:** Lines 635-642

**What to extract:**
- Scroll position tracking
- Used for sticky headers

**Hook Interface:**
```typescript
interface UseScrollPositionReturn {
  scrollY: number;
}
```

**Benefits:**
- Simple, reusable hook
- Used by sticky quote form and update bar

**File:** `hooks/useScrollPosition.ts`

---

### 6. useUrlParams Hook ⭐
**Priority:** LOW | **Risk:** LOW | **Effort:** 1 hour | **Lines:** ~30

**Location:** Lines 673-697

**What to extract:**
- URL parameter parsing (quote, email)
- Email pre-filling logic
- Scroll to quote form logic

**Hook Interface:**
```typescript
interface UseUrlParamsParams {
  searchParams: URLSearchParams;
  isOwner: boolean;
  isGuestCreator: boolean;
  isGuestCreatedTrip: boolean;
  loading: boolean;
  quoteFormRef: React.RefObject<HTMLDivElement>;
}

interface UseUrlParamsReturn {
  quoteParam: string | null;
  emailParam: string | null;
  isEmailFromUrl: boolean;
  quoteEmail: string;
  setQuoteEmail: (email: string) => void;
}
```

**Benefits:**
- Centralizes URL parameter handling
- Used by driver/guest pages

**File:** `hooks/useUrlParams.ts`

---

## 🔧 TIER 3: Data Transformation Utilities

### 7. tripDataTransformers Utility ⭐⭐
**Priority:** MEDIUM | **Risk:** LOW | **Effort:** 2 hours | **Lines:** ~150

**Location:** Lines 1894-1972 (data transformation logic)

**What to extract:**
- `transformTrafficPredictions` - Parse and format traffic predictions
- `normalizeTripLocations` - Already exists, but add ID validation
- `fixLocationIds` - Validate and fix invalid location IDs
- `parseJsonFields` - Parse trip_results, executive_report from strings
- `transformDatabaseTripToTripData` - Main transformation function

**Functions:**
```typescript
// utils/trip-data-transformers.ts

export function transformTrafficPredictions(
  raw: any
): TrafficPredictions | null;

export function fixLocationIds(
  locations: any[]
): Array<Location & { id: string }>;

export function parseJsonFields(
  tripResults: any,
  executiveReport: any
): {
  tripResults: any[];
  executiveReport: any;
};

export function transformDatabaseTripToTripData(
  data: DatabaseTrip,
  user: User | null,
  isAuthenticated: boolean
): {
  tripData: TripData;
  roleInfo: {
    isOwner: boolean;
    isGuestCreator: boolean;
    isGuestCreatedTrip: boolean;
  };
  metadata: {
    status: string;
    driverEmail: string | null;
    version: number;
  };
};
```

**Benefits:**
- Pure functions, easy to test
- Reusable across all pages
- Handles all data transformation edge cases

**File:** `utils/trip-data-transformers.ts`

---

### 8. roleDetermination Utility ⭐⭐
**Priority:** MEDIUM | **Risk:** LOW | **Effort:** 1 hour | **Lines:** ~50

**Location:** Lines 1862-1892

**What to extract:**
- Ownership check logic
- Guest creator detection
- Guest-created trip detection

**Functions:**
```typescript
// utils/role-determination.ts

export interface RoleInfo {
  isOwner: boolean;
  isGuestCreator: boolean;
  isGuestCreatedTrip: boolean;
}

export function determineRole(
  tripUserId: string | null,
  currentUserId: string | null,
  isAuthenticated: boolean,
  tripId: string
): RoleInfo;
```

**Benefits:**
- Single source of truth for role logic
- Easy to test
- Used by all pages

**File:** `utils/role-determination.ts`

---

## 📡 TIER 4: API Helpers

### 9. tripApiHelpers Utility ⭐
**Priority:** LOW | **Risk:** LOW | **Effort:** 1 hour | **Lines:** ~50

**What to extract:**
- API call wrappers with error handling
- Standardized fetch patterns

**Functions:**
```typescript
// utils/trip-api-helpers.ts

export async function fetchTripData(tripId: string): Promise<TripData | null>;

export async function validateDriverToken(
  token: string,
  tripId: string
): Promise<DriverTokenValidationResult>;

export async function fetchQuotesForTrip(
  tripId: string,
  driverEmail?: string
): Promise<Quote[]>;
```

**Benefits:**
- Standardized API calls
- Centralized error handling
- Easy to mock for tests

**File:** `utils/trip-api-helpers.ts`

---

## 📦 TIER 5: Constants & Types Expansion

### 10. Expand constants.ts ⭐
**Priority:** LOW | **Risk:** VERY LOW | **Effort:** 30 min

**What to add:**
- Trip status constants
- Role type constants
- Default values
- Magic strings

**Additions:**
```typescript
// constants.ts

export const TRIP_STATUSES = {
  NOT_CONFIRMED: 'not confirmed',
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  BOOKED: 'booked',
} as const;

export const USER_ROLES = {
  OWNER: 'owner',
  DRIVER: 'driver',
  GUEST: 'guest',
  GUEST_CREATOR: 'guest-creator',
} as const;

export const DEFAULT_TRIP_VALUES = {
  PASSENGER_COUNT: 1,
  STATUS: TRIP_STATUSES.NOT_CONFIRMED,
  VERSION: 1,
} as const;
```

**Benefits:**
- Eliminates magic strings
- Type-safe constants
- Easy to maintain

---

### 11. Expand types.ts ⭐
**Priority:** LOW | **Risk:** VERY LOW | **Effort:** 1 hour

**What to add:**
- Role-related types
- Hook return types
- API response types

**Additions:**
```typescript
// types.ts

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export type TripStatus = typeof TRIP_STATUSES[keyof typeof TRIP_STATUSES];

export interface RoleInfo {
  isOwner: boolean;
  isGuestCreator: boolean;
  isGuestCreatedTrip: boolean;
  isDriverView: boolean;
}

export interface DriverTokenInfo {
  token: string | null;
  validatedEmail: string | null;
  canTakeAction: boolean;
  tokenUsed: boolean;
  error: string | null;
}
```

**Benefits:**
- Type safety
- Better IDE autocomplete
- Shared across all pages

---

## 📊 Extraction Summary

### Extract Before Page Separation:

| Item | Priority | Effort | Lines | Risk |
|------|----------|--------|-------|------|
| useTripData | ⭐⭐⭐ | 3h | ~225 | Low |
| useDriverTokenValidation | ⭐⭐⭐ | 1.5h | ~80 | Low |
| useQuotes | ⭐⭐⭐ | 3h | ~200 | Medium |
| useRealtimeSubscriptions | ⭐⭐ | 2h | ~100 | Medium |
| tripDataTransformers | ⭐⭐ | 2h | ~150 | Low |
| roleDetermination | ⭐⭐ | 1h | ~50 | Low |
| useScrollPosition | ⭐ | 30min | ~15 | Very Low |
| useUrlParams | ⭐ | 1h | ~30 | Low |
| tripApiHelpers | ⭐ | 1h | ~50 | Low |
| Expand constants | ⭐ | 30min | ~20 | Very Low |
| Expand types | ⭐ | 1h | ~30 | Very Low |

**Total:** ~16 hours | **Lines Reduced:** ~950 lines

---

## Implementation Order

### Week 1: Core Data Hooks (Days 1-3)
1. **useTripData** (3h) - Foundation for everything
2. **tripDataTransformers** (2h) - Used by useTripData
3. **roleDetermination** (1h) - Used by useTripData

**Day 1-3 Total:** ~6 hours

### Week 1: Supporting Hooks (Days 4-5)
4. **useDriverTokenValidation** (1.5h)
5. **useQuotes** (3h)
6. **useRealtimeSubscriptions** (2h)

**Day 4-5 Total:** ~6.5 hours

### Week 2: Utilities & Polish (Day 1)
7. **useScrollPosition** (30min)
8. **useUrlParams** (1h)
9. **tripApiHelpers** (1h)
10. **Expand constants** (30min)
11. **Expand types** (1h)

**Day 1 Total:** ~4 hours

### Week 2: Page Separation (Days 2-5)
- Create owner/driver/guest pages
- Use extracted hooks
- Extract remaining role-specific components

---

## Benefits of This Approach

### Before Extraction:
- 7,519 lines in main page
- Data fetching logic mixed with UI
- Role logic scattered
- Hard to test
- Duplicate transformation code

### After Extraction:
- ~6,500 lines in main page (13% reduction)
- Clean separation of concerns
- Reusable hooks for all pages
- Easy to test hooks independently
- Single source of truth for data transformation

### After Page Separation:
- Each page: ~2,000-3,000 lines
- All pages use shared hooks
- Clear boundaries
- Easy to maintain

---

## File Structure After Extraction

```
app/results/[id]/
├── hooks/
│   ├── useTripData.ts              ← NEW
│   ├── useDriverTokenValidation.ts ← NEW
│   ├── useQuotes.ts                ← NEW
│   ├── useRealtimeSubscriptions.ts ← NEW
│   ├── useScrollPosition.ts        ← NEW
│   ├── useUrlParams.ts             ← NEW
│   ├── usePreviewApplication.ts    ← EXISTS
│   ├── useTripRegeneration.ts      ← EXISTS
│   └── useUpdateExtraction.ts      ← EXISTS
├── utils/
│   ├── trip-data-transformers.ts   ← NEW
│   ├── role-determination.ts       ← NEW
│   ├── trip-api-helpers.ts         ← NEW
│   ├── time-helpers.ts             ← EXISTS
│   ├── location-helpers.ts          ← EXISTS
│   └── ... (other utils)
├── constants.ts                    ← EXPAND
├── types.ts                        ← EXPAND
└── page.tsx                        ← REDUCED
```

---

## Testing Strategy

Each extracted hook/utility should have:
1. **Unit tests** - Test logic independently
2. **Integration tests** - Test with mock data
3. **Type safety** - Full TypeScript coverage

**Example:**
```typescript
// hooks/__tests__/useTripData.test.ts
describe('useTripData', () => {
  it('loads trip data correctly', async () => {
    // Test implementation
  });
  
  it('determines ownership correctly', async () => {
    // Test ownership logic
  });
  
  it('transforms data correctly', async () => {
    // Test data transformation
  });
});
```

---

## Migration Notes

1. **Incremental Migration:**
   - Extract one hook at a time
   - Update main page to use hook
   - Test thoroughly
   - Move to next hook

2. **Backward Compatibility:**
   - Keep old code commented initially
   - Remove after verification
   - Can rollback easily

3. **Type Safety:**
   - Define all interfaces first
   - Use strict TypeScript
   - No `any` types in hooks

4. **Error Handling:**
   - Standardize error handling in hooks
   - Return error states consistently
   - Log errors appropriately

---

## Success Metrics

**Before:**
- 7,519 lines
- Data fetching mixed with UI
- Role logic scattered
- Hard to test

**After Hook Extraction:**
- ~6,500 lines (13% reduction)
- Clean data layer
- Reusable hooks
- Testable logic

**After Page Separation:**
- ~2,000-3,000 lines per page
- All pages use shared hooks
- Clear architecture
- Easy to maintain

