# Component Extraction Priority List

**Goal:** Extract components before page separation to reduce complexity and build momentum.

**Strategy:** Extract pure UI components first (no role logic), then proceed with page separation.

---

## 🟢 TIER 1: Pure UI Components (Extract First)

### 1. LoadingSpinner Component ⭐⭐⭐
**Priority:** HIGH | **Risk:** VERY LOW | **Effort:** 30 min | **Lines:** ~50

**Location:** Lines 4638-4644, 6021-6027, 4868-5050 (regeneration modal)

**What to extract:**
- Standard loading spinner with text
- Used in: Loading quotes, loading trip data, regeneration progress
- Pure UI, no role logic

**Props:**
```typescript
interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}
```

**Benefits:**
- Eliminates duplicate spinner code
- Standardizes loading states
- Used 5+ times in page

---

### 2. RegenerationProgressModal Component ⭐⭐⭐
**Priority:** HIGH | **Risk:** LOW | **Effort:** 2 hours | **Lines:** ~180

**Location:** Lines 4868-5050

**What to extract:**
- Full regeneration progress modal with circular progress
- Steps carousel animation
- Completion view
- Pure UI, no role logic (used by owners/guests but no conditionals inside)

**Props:**
```typescript
interface RegenerationProgressModalProps {
  isOpen: boolean;
  progress: number;
  steps: Array<{
    id: string;
    title: string;
    description: string;
    source: string;
    status: 'pending' | 'loading' | 'completed' | 'error';
  }>;
  onClose?: () => void;
}
```

**Benefits:**
- Large component (~180 lines)
- Already isolated in modal
- Reusable for other regeneration flows

---

### 3. ErrorAlert Component ⭐⭐
**Priority:** MEDIUM | **Risk:** VERY LOW | **Effort:** 30 min | **Lines:** ~30

**Location:** Lines 4835-4858 (update progress error), 7018-7048 (update notification)

**What to extract:**
- Standardized error display with retry button
- Used in multiple places

**Props:**
```typescript
interface ErrorAlertProps {
  title?: string;
  message: string;
  canRetry?: boolean;
  onRetry?: () => void;
  variant?: 'default' | 'destructive';
}
```

**Benefits:**
- Standardizes error handling UI
- Reduces duplicate code

---

## 🟡 TIER 2: Simple Modals (Minimal Role Logic)

### 4. UpdateQuoteModal Component ⭐⭐
**Priority:** MEDIUM | **Risk:** LOW | **Effort:** 1 hour | **Lines:** ~80

**Location:** Lines 4707-4786

**What to extract:**
- Modal for updating existing quote
- Used by drivers (but no role check inside modal)
- Simple form with validation

**Props:**
```typescript
interface UpdateQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentQuote: {
    price: number;
    currency: string;
  };
  onUpdate: (newPrice: string) => Promise<void>;
  isUpdating: boolean;
  error: string | null;
}
```

**Benefits:**
- Isolated modal logic
- Easy to test
- No role conditionals inside

---

### 5. GuestSignupModal Component ⭐⭐
**Priority:** MEDIUM | **Risk:** LOW | **Effort:** 1.5 hours | **Lines:** ~110

**Location:** Lines 6358-6466

**What to extract:**
- Signup modal for guest users
- Benefits grid
- Form with validation
- Pure UI, no role logic (used by guests but no conditionals)

**Props:**
```typescript
interface GuestSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  onSubmit: (password: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}
```

**Benefits:**
- Large isolated component
- Reusable for other signup flows
- No role conditionals

---

### 6. UpdateNotificationModal Component ⭐
**Priority:** MEDIUM | **Risk:** LOW | **Effort:** 45 min | **Lines:** ~40

**Location:** Lines 7010-7048

**What to extract:**
- Simple confirmation modal
- Ask if user wants to notify driver
- Owner-only but no role check inside modal

**Props:**
```typescript
interface UpdateNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (notify: boolean) => Promise<void>;
  isSending: boolean;
}
```

**Benefits:**
- Simple extraction
- Isolated logic

---

### 7. ConfirmDriverRequiredModal Component ⭐
**Priority:** LOW | **Risk:** VERY LOW | **Effort:** 30 min | **Lines:** ~30

**Location:** Lines 7050-7077

**What to extract:**
- Simple confirmation modal
- Owner-only but no role check inside

**Props:**
```typescript
interface ConfirmDriverRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssignDriver: () => void;
}
```

**Benefits:**
- Very simple
- Quick win

---

## 🔴 TIER 3: Complex Components (Wait for Page Separation)

### 8. DriverQuotesModal Component ⭐⭐⭐
**Priority:** DEFER | **Risk:** MEDIUM | **Effort:** 4 hours | **Lines:** ~600

**Location:** Lines ~5700-6130

**Why defer:**
- Owner-only component
- Complex state management
- Has role-specific logic
- Better extracted after page separation

**Extract after:** Page separation (owner page)

---

### 9. StatusChangeModal Component ⭐⭐
**Priority:** DEFER | **Risk:** MEDIUM | **Effort:** 2 hours | **Lines:** ~220

**Location:** Lines 6132-6356

**Why defer:**
- Owner-only component
- Complex conditional logic
- Multiple flows (confirm, cancel, resend)

**Extract after:** Page separation (owner page)

---

### 10. FlowA/FlowB Modals ⭐
**Priority:** DEFER | **Risk:** LOW | **Effort:** 1 hour each | **Lines:** ~100 each

**Location:** Lines 6468-6650 (Flow A), 6580-6650 (Flow B)

**Why defer:**
- Owner-only components
- Simple but role-specific

**Extract after:** Page separation (owner page)

---

### 11. UpdateTripSection Component ⭐⭐
**Priority:** DEFER | **Risk:** MEDIUM | **Effort:** 2 hours | **Lines:** ~160

**Location:** Lines 4788-4862

**Why defer:**
- Has role condition: `(isOwner || isGuestCreator)`
- Complex state (update text, extraction, progress)
- Better extracted after page separation

**Extract after:** Page separation (owner/guest pages)

---

### 12. EditRouteModal Component ⭐⭐
**Priority:** DEFER | **Risk:** MEDIUM | **Effort:** 3 hours | **Lines:** ~400

**Location:** Lines 7079-7500+

**Why defer:**
- Owner-only component
- Very complex (drag & drop, location editing, form fields)
- Large component

**Extract after:** Page separation (owner page)

---

## 📊 Summary

### Extract Now (Before Page Separation):
1. ✅ LoadingSpinner - 30 min
2. ✅ RegenerationProgressModal - 2 hours
3. ✅ ErrorAlert - 30 min
4. ✅ UpdateQuoteModal - 1 hour
5. ✅ GuestSignupModal - 1.5 hours
6. ✅ UpdateNotificationModal - 45 min
7. ✅ ConfirmDriverRequiredModal - 30 min

**Total:** ~6.5 hours | **Lines Reduced:** ~500-600 lines

### Extract After Page Separation:
- DriverQuotesModal
- StatusChangeModal
- FlowA/FlowB Modals
- UpdateTripSection
- EditRouteModal

**Total:** ~12 hours | **Lines Reduced:** ~1,400 lines

---

## Implementation Order

### Week 1: Quick Wins (Day 1-2)
1. LoadingSpinner (30 min)
2. ErrorAlert (30 min)
3. ConfirmDriverRequiredModal (30 min)
4. UpdateNotificationModal (45 min)
5. UpdateQuoteModal (1 hour)

**Day 1-2 Total:** ~3 hours | **Lines:** ~200

### Week 1: Medium Components (Day 3-4)
6. GuestSignupModal (1.5 hours)
7. RegenerationProgressModal (2 hours)

**Day 3-4 Total:** ~3.5 hours | **Lines:** ~290

### Week 2: Page Separation
- Create owner/driver/guest pages
- Move remaining components during separation

---

## Success Metrics

**Before Extraction:**
- 7,519 lines
- Multiple duplicate loading spinners
- Inline modal code

**After Tier 1 Extraction:**
- ~6,900 lines (8% reduction)
- Standardized loading/error components
- Reusable modal components
- Cleaner codebase for page separation

---

## Notes

- All Tier 1 components are **pure UI** - no role logic
- Can be extracted and tested independently
- Builds momentum before larger refactoring
- Makes page separation easier (less code to move)
- Components can be used in all role pages after separation

