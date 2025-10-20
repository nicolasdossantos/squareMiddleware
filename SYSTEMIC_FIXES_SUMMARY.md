# Systemic API Fixes - October 20, 2025

## Problem Summary

**ALL API endpoints were failing with 401 "Invalid signature" errors** because the `createSquareClient()` function was not receiving the environment parameter across 17 different locations.

### Root Cause
```javascript
// BROKEN - Used in 17 locations
const square = createSquareClient(tenant.accessToken);

// FIXED - Now includes environment parameter
const square = createSquareClient(
  tenant.accessToken || tenant.squareAccessToken,
  tenant.squareEnvironment || tenant.environment || 'production'
);
```

When the environment parameter is missing:
- Square SDK defaults to `'production'` environment
- If tenant uses `'sandbox'`, authentication fails with 401
- **This affected ALL API endpoints that call Square APIs**

## Impact

### Broken Endpoints (Before Fix)
- ❌ GET /api/bookings/availability
- ❌ POST /api/bookings (create booking)
- ❌ GET /api/bookings/:bookingId
- ❌ PUT /api/bookings/:bookingId
- ❌ DELETE /api/bookings/:bookingId (cancel booking)
- ❌ GET /api/customers/:customerId
- ❌ All customer service availability lookups
- ❌ All booking confirmation endpoints

### Working Endpoints (Before Fix)
- ✅ Webhooks (call_inbound, call_started, call_analyzed)
  - These used different code paths through retellWebhookController

## Files Fixed

### 1. squareUtils.js (5 locations)
Core utility functions for Square API interactions:

| Line | Function | Status |
|------|----------|--------|
| 138  | loadServiceVariations | ✅ Fixed |
| 231  | loadStaffMembers | ✅ Fixed |
| 647  | createCustomer | ✅ Fixed |
| 808  | updateCustomer | ✅ Fixed |
| 896  | loadServiceVariationsAsync | ✅ Fixed |

### 2. bookingHelpers.js (8 locations)
Booking-specific Square API operations:

| Line | Function | Status |
|------|----------|--------|
| 211  | getServiceAvailability | ✅ Fixed |
| 305  | createBooking | ✅ Fixed |
| 359  | updateBooking | ✅ Fixed |
| 397  | cancelBooking | ✅ Fixed |
| 448  | confirmBooking | ✅ Fixed |
| 501  | getBookingDetails | ✅ Fixed |
| 516  | confirmBooking (inner call) | ✅ Fixed |
| 654  | listBookings | ✅ Fixed |

### 3. availabilityHelpers.js (1 location)
Availability slot lookup:

| Line | Function | Status |
|------|----------|--------|
| 100  | getSlots | ✅ Fixed |

### 4. bookingController.js (1 location)
Booking controller endpoints:

| Line | Function | Status |
|------|----------|--------|
| 55   | getServiceAvailability | ✅ Fixed |

### 5. customerController.js (1 location)
Customer-related endpoints:

| Line | Function | Status |
|------|----------|--------|
| 338  | getCustomerDetails | ✅ Fixed |

### 6. bookingService.js (1 location)
Booking service layer:

| Line | Function | Status |
|------|----------|--------|
| 152  | listBookings | ✅ Fixed |

## Pattern Applied

All 17 locations now use this pattern:

```javascript
const square = createSquareClient(
  // Fallback for field name inconsistencies
  tenant.accessToken || tenant.squareAccessToken,
  // Use correct environment from tenant context
  tenant.squareEnvironment || tenant.environment || 'production'
);
```

### Field Name Handling
- **Primary:** `tenant.squareAccessToken` (new naming convention)
- **Fallback:** `tenant.accessToken` (legacy naming convention)
- **Result:** Works with both naming conventions across the codebase

### Environment Handling
- **Primary:** `tenant.squareEnvironment` (new naming convention)
- **Secondary:** `tenant.environment` (legacy naming convention)
- **Fallback:** `'production'` (sensible default)
- **Result:** Correctly uses sandbox/production based on tenant config

## Git Commits

1. **Commit 5e71e1c5** - "Fix: Add missing environment parameter to ALL createSquareClient calls"
   - Fixed 16 locations across 5 files
   - Added both field name fallback AND environment parameter

2. **Commit ccc038d2** - "Fix: Add environment parameter to createSquareClient call on line 516"
   - Fixed 1 missed location in bookingHelpers.js

## Testing Checklist

All endpoints should now work correctly with both sandbox and production Square accounts:

### Booking Endpoints
- [ ] GET /api/bookings/availability - Service availability lookup
- [ ] POST /api/bookings - Create new booking
- [ ] GET /api/bookings/:bookingId - Retrieve booking details
- [ ] PUT /api/bookings/:bookingId - Update existing booking
- [ ] DELETE /api/bookings/:bookingId - Cancel booking

### Customer Endpoints
- [ ] GET /api/customers/:customerId - Get customer details with bookings
- [ ] POST /api/customers - Create new customer
- [ ] PUT /api/customers/:customerId - Update customer

### Retell Tool Calls (via x-retell-call-id)
- [ ] booking-cancel tool call - Should work with correct environment
- [ ] Other tool calls requiring Square API access

## Why This Happened

The codebase had grown with different naming conventions:
1. **Legacy code** used: `accessToken`, `locationId`, `environment`
2. **New code** introduced: `squareAccessToken`, `squareLocationId`, `squareEnvironment`
3. **Middleware** (agentAuth) provided BOTH for compatibility
4. **But** many helper functions didn't use the environment parameter at all

This was a **perfect storm**:
- Field name inconsistencies hidden by fallback logic
- Environment parameter completely missing
- Made webhooks work (different code path) but broke API endpoints
- Only became apparent when user tested tool calls

## Prevention Going Forward

1. **Always pass environment parameter to createSquareClient()**
2. **Use field name fallback pattern: `field || squareField`**
3. **Add linting rule** to detect createSquareClient() calls without 2 parameters
4. **Use TypeScript** to enforce correct function signatures
5. **Add integration tests** for both sandbox and production environments

## Related Documents

- [AZURE_DEPLOYMENT_409_FIX.md](./AZURE_DEPLOYMENT_409_FIX.md) - Original issue that revealed field naming problems
- [MULTI_TENANT_FLOW_DIAGRAM.md](./MULTI_TENANT_FLOW_DIAGRAM.md) - Architecture overview
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - Complete API endpoint reference
