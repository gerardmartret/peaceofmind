# Driver Assignment Issues Analysis

## Trip ID: `3fc36712-6667-461e-b57d-64fef6bed2eb`
## Driver: `gleb@kodebusters.com`

## Issues Identified

### 1. Drivania Quotes Showing in Confirmation Modal (Not Booking with Drivania)

**Problem:**
- The "Assign driver" confirmation modal (Flow A) always displays Drivania quotes if `drivaniaQuotes` exists
- This happens even when assigning a driver from Supabase quotes (not booking with Drivania)
- Location: `app/results/[id]/page.tsx` lines 10112-10196

**Root Cause:**
- The modal conditionally renders Drivania quotes based on `drivaniaQuotes &&` without checking if the user is actually booking with Drivania
- Flow A modal is used for both:
  - Selecting driver from Supabase quotes (should NOT show Drivania)
  - Booking with Drivania (should show Drivania)

**Fix:**
- Only show Drivania quotes in Flow A modal if:
  - User is actually booking with Drivania (check if `selectedQuoteDriver` is "drivania" or similar flag)
  - OR add a separate flag to indicate Drivania booking flow
- Alternative: Hide Drivania quotes section when assigning a Supabase driver

---

### 2. Two Emails Sent to Driver

**Problem:**
- Console logs show two calls to `/api/notify-driver-assignment` (lines 798-804)
- Two driver tokens created in database (both for same driver, same trip)
- Both emails sent within 1 second of each other

**Root Cause:**
- **Duplicate email sending:**
  1. `/api/set-driver` route sends email automatically (line 183 in `app/api/set-driver/route.ts`)
  2. Frontend Flow A also sends email manually (line 10257 in `app/results/[id]/page.tsx`)
  3. Frontend Flow B also sends email manually (line 10380 in `app/results/[id]/page.tsx`)

**Fix:**
- Remove manual email sending from frontend (Flow A and Flow B)
- Let `/api/set-driver` handle email sending (it already does this)
- OR remove email sending from `/api/set-driver` and only send from frontend
- **Recommended:** Remove from frontend, keep in API route (single source of truth)

---

### 3. "Driver Already Selected" Message When Accessing Token Link

**Problem:**
- When driver accesses link with token, sees message about driver already being selected
- Two tokens exist in database for same driver/trip (both valid, both match driver email)

**Root Cause Analysis:**
1. **Two tokens created** due to duplicate email sending (issue #2)
   - Both tokens have same `driver_email`: `gleb@kodebusters.com`
   - Both tokens match `trip.driver`: `gleb@kodebusters.com` ✅
   - Both tokens are `used: false` and `invalidated_at: null` ✅
   - Trip status is `pending` ✅

2. **Possible error messages the user might see:**
   - **"This link is not valid for the currently assigned driver"** (line 84 in validate-driver-token)
     - This would only show if `trip.driver !== tokenData.driver_email`
     - **NOT the case** - both tokens match driver email
   
   - **"You've already responded to this trip"** (line 9169 in UI)
     - Shows when `canTakeAction` is false
     - `canTakeAction = trip.status === 'pending' && !tokenAlreadyUsed` (line 92)
     - **Should be true** since status is 'pending' and tokens are not used
   
   - **"You've already responded to this trip"** (line 101-102 in validate-driver-token)
     - Shows when `tokenAlreadyUsed` is true
     - **NOT the case** - both tokens show `used: false`

3. **Most Likely Root Cause:**
   - **Race condition or timing issue**: When two emails are sent almost simultaneously, the driver might click one link while the system is still processing the second email/token creation
   - **Frontend default logic issue**: Line 1488 sets `canTakeAction` with `result.canTakeAction !== false` which defaults to `true`, but if API returns `undefined` or there's a network issue, behavior is unpredictable
   - **Duplicate token confusion**: Having two valid tokens might cause validation to check the wrong token or create confusion in the UI state

**Fix:**
1. **Fix duplicate email issue first** (issue #2) - this will prevent duplicate tokens
2. **Add duplicate token prevention** in `/api/notify-driver-assignment/route.ts`:
   - Before creating new token, check if valid token exists for same driver/trip
   - If valid token exists (not expired, not used, not invalidated), reuse it instead of creating new one
   - OR invalidate old unused tokens before creating new one
3. **Improve token validation** to handle edge cases:
   - Add logging to track which token is being validated
   - Ensure `canTakeAction` is always explicitly set (not relying on defaults)
4. **Add UI feedback** to show which token is being used if multiple exist

---

### 4. Trip Status Still Shows "Pending" (Owner View)

**Problem:**
- Owner sees trip status as "pending" after assigning driver
- User might expect different status

**Root Cause:**
- This is actually **CORRECT BEHAVIOR**
- Trip status should be "pending" until driver confirms or rejects
- Status flow: `not confirmed` → `pending` (when driver assigned) → `confirmed` (when driver accepts) or `rejected` (when driver rejects)

**Fix:**
- **No fix needed** - this is expected behavior
- However, we should ensure UI clearly communicates:
  - "Pending" means "waiting for driver confirmation"
  - Add tooltip or explanation text

---

## Database State Analysis

### Trip Status:
```sql
status: "pending" ✅ (correct)
driver: "gleb@kodebusters.com" ✅ (correct)
```

### Driver Tokens:
```sql
Token 1: a6377025-3539-4c44-a5d4-0d554b87aa15
  - created_at: 2025-12-01 03:25:03.023772
  - expires_at: 2025-12-04 03:25:02.599
  - used: false
  - invalidated_at: null

Token 2: 73ebedf6-1582-43ab-b013-5173f5a4a1d4
  - created_at: 2025-12-01 03:25:03.904546
  - expires_at: 2025-12-04 03:25:03.56
  - used: false
  - invalidated_at: null
```

**Issue:** Two tokens created within 1 second (duplicate email sending)

---

## Fix Plan

### Priority 1: Fix Duplicate Email Sending
1. Remove email sending from frontend Flow A (line 10257-10276)
2. Remove email sending from frontend Flow B (line 10380-10399)
3. Keep email sending in `/api/set-driver` route only
4. Add check in `/api/notify-driver-assignment` to prevent duplicate tokens:
   - Before creating token, check if valid token exists for same driver/trip
   - If exists and not expired/used, reuse it instead of creating new one
   - OR invalidate old token and create new one

### Priority 2: Fix Drivania Quotes Display
1. Add condition to only show Drivania quotes when actually booking with Drivania
2. Check if `selectedQuoteDriver` indicates Drivania booking
3. OR add separate flag `isDrivaniaBooking` to control display

### Priority 3: Improve Token Validation
1. Add logging to understand why "driver already selected" message appears
2. Ensure token validation handles multiple tokens gracefully
3. Show clearer error messages

### Priority 4: UI Improvements
1. Add tooltip/explanation for "pending" status
2. Show clearer messaging about what "pending" means

---

## Files to Modify

1. `app/results/[id]/page.tsx`
   - Remove email sending from Flow A (lines 10257-10276)
   - Remove email sending from Flow B (lines 10380-10399)
   - Fix Drivania quotes display condition (line 10112)

2. `app/api/notify-driver-assignment/route.ts`
   - Add duplicate token prevention logic
   - Check for existing valid tokens before creating new one

3. `app/api/set-driver/route.ts`
   - Ensure email sending is reliable (already implemented)

---

## Testing Checklist

- [ ] Assign driver from Supabase quotes - verify only one email sent
- [ ] Assign driver directly (Flow B) - verify only one email sent
- [ ] Verify Drivania quotes don't show when assigning Supabase driver
- [ ] Verify only one token created per driver assignment
- [ ] Test token link access - verify no "driver already selected" error
- [ ] Verify trip status correctly shows "pending" after assignment
- [ ] Test driver confirmation flow with token

