# 🔍 Complete Function Call Flow Analysis: booking-cancel

## Overview
This document traces a complete function call from Retell agent through your Express middleware, routes, controllers, services, and finally to the Square API.

---

## ⚡ STEP-BY-STEP FLOW

### **Step 1: Retell Agent Makes Tool Call**
```
Retell Agent Tool: booking-cancel
├─ Sends HTTP request
├─ POST/DELETE /api/bookings/:bookingId
├─ Headers:
│  ├─ X-Retell-API-Key: <RETELL_API_KEY>
│  ├─ Content-Type: application/json
│  └─ (NO X-Agent-ID header - Retell can't pass custom headers in tool defs)
└─ Body: { "bookingId": "..." }
```

**Current Status**: ✅ Ready to receive request

---

### **Step 2: Express Server Receives Request**
```
File: src/express-app.js
├─ Server listening on :3000
├─ Request enters middleware chain
└─ Hits /api/bookings/:bookingId route
```

---

### **Step 3: Route Handler (FIRST CHECK - MIDDLEWARE CHAIN)**
```
File: src/routes/bookings.js (Lines 1-82)
├─ Routes defined: GET, POST, DELETE for /api/bookings/:bookingId
├─ Middleware stack (IN ORDER):
│  ├─ 1️⃣  correlationId middleware → Generates req.correlationId
│  ├─ 2️⃣  agentAuth middleware → ⚠️ CRITICAL AUTHENTICATION STEP
│  ├─ 3️⃣  validateContentType middleware
│  └─ 4️⃣  Controller handler
└─ For DELETE: Calls bookingController.cancelBooking()
```

**Route Definition (Line 52-54):**
```javascript
router.delete('/:bookingId', asyncHandler(bookingController.cancelBooking));
```

---

### **Step 4: AUTHENTICATION MIDDLEWARE - agentAuth**
```
File: src/middlewares/agentAuth.js (Lines 1-108)

EXECUTION PATH FOR RETELL AGENT:
─────────────────────────────────

1. Extract Headers:
   ├─ authHeader = req.headers['authorization']       → undefined
   ├─ agentId = req.headers['x-agent-id']            → undefined
   └─ retellApiKey = req.headers['x-retell-api-key']  → "YOUR_KEY_VALUE"

2. CHECK 1 (Lines 28-43): RETELL_API_KEY Auth ✅
   if (retellApiKey === process.env.RETELL_API_KEY) {
       Create tenantContext = {
           id: 'retell-agent',
           agentId: 'retell-agent',
           accessToken: process.env.SQUARE_ACCESS_TOKEN,      ← ✅ ESSENTIAL
           locationId: process.env.SQUARE_LOCATION_ID,        ← ✅ ESSENTIAL
           squareAccessToken: process.env.SQUARE_ACCESS_TOKEN,
           squareLocationId: process.env.SQUARE_LOCATION_ID,
           timezone: process.env.TZ,
           environment: process.env.SQUARE_ENVIRONMENT,
           authenticated: true,
           isRetellAgent: true
       }
       
       req.retellContext = tenantContext  ← For retell-specific code
       req.tenant = tenantContext         ← ✅ FOR CONTROLLER COMPATIBILITY
       return next() → Proceed to controller
   }

3. CHECK 2 (Lines 46-51): Standard Bearer Token Auth (SKIPPED)
   if (!authHeader || !agentId) {
       → return 401 error
   }
```

**What Gets Set on Request Object:**
- ✅ `req.correlationId` - Correlation ID from previous middleware
- ✅ `req.tenant` - Tenant context with Square credentials
- ✅ `req.tenant.accessToken` - Square access token (CRITICAL)
- ✅ `req.tenant.locationId` - Square location ID (CRITICAL)

**Potential Gaps Here:**
1. ⚠️ Missing environment variables will cause failure
2. ⚠️ X-Retell-API-Key header must match RETELL_API_KEY exactly
3. ⚠️ SQUARE_ACCESS_TOKEN must be valid
4. ⚠️ SQUARE_LOCATION_ID must be valid

---

### **Step 5: Controller Handler**
```
File: src/controllers/bookingController.js (Lines 564-649)

FUNCTION: cancelBooking(req, res)

1. Extract context from req:
   const { correlationId, tenant } = req
   └─ ✅ tenant has: accessToken, locationId
   
2. Extract bookingId:
   const query = req.query || {}
   const bookingId = req.params.bookingId || req.params.id || query.bookingId
   └─ ✅ Should be in URL: /api/bookings/:bookingId
   
3. Validation (Line 575-580):
   if (!bookingId) {
       return res.status(400).json({ error: 'bookingId is required' })
   }
   
4. Create Azure Functions Context Mock:
   const context = {
       log: (...args) => logger.info(...args),
       error: (...args) => logger.error(...args)
   }
   
5. Call Helper (Line 624-633):
   const { cancelBooking: cancelBookingHelper } = 
       require('../utils/helpers/bookingHelpers')
   
   const result = await cancelBookingHelper(context, tenant, bookingId)
   └─ ✅ Passes tenant with Square credentials
   
6. Clean BigInt Response (Line 638-641):
   const cleanedBooking = cleanBigIntFromObject(result.booking)
   
7. Return Success (Line 643-649):
   return res.status(200).json({
       success: true,
       data: { booking: cleanedBooking },
       message: 'Booking cancelled successfully'
   })
```

**Potential Gaps Here:**
1. ⚠️ Booking ID extraction from multiple sources - could be confusing
2. ⚠️ No validation that bookingId format is correct
3. ⚠️ Error handling might mask actual errors

---

### **Step 6: Booking Helper Layer**
```
File: src/utils/helpers/bookingHelpers.js (892 lines)

FUNCTION: cancelBooking(context, tenant, bookingId)

1. Create Square Client:
   const { square } = require('../squareUtils')
   
   OR more explicitly:
   const client = createSquareClient(
       tenant.accessToken,      ← Uses tenant.accessToken ✅
       tenant.locationId        ← Uses tenant.locationId ✅
   )
   
2. Call Square API:
   await square.bookingsApi.cancelBooking({
       bookingId: bookingId,
       version: bookingVersion,
       idempotencyKey: generateIdempotencyKey()
   })
   
3. Return formatted response:
   return {
       booking: result.result.booking  ← Square SDK v42+ structure
   }
```

**This is where the actual API call happens:**
```javascript
// Pseudo code flow:
const client = createSquareClient(tenant.accessToken, tenant.locationId)
const response = await client.bookingsApi.cancelBooking({...})
```

---

### **Step 7: Square API Call**
```
Square SDK makes HTTP request:
POST https://connect.squareupsandbox.com/v2/bookings/{booking_id}/cancel

Headers:
├─ Authorization: Bearer <square_access_token>
├─ User-Agent: squareupsdk/js-v42.0.0
├─ Content-Type: application/json
└─ X-Square-User-Agent: squareupsdk/js-v42.0.0

Sent from: req.tenant.accessToken (Retell auth path)

Response:
├─ 200 OK: { booking: {...} }
├─ 400: Invalid request
├─ 401: Invalid access token ← ⚠️ Would indicate bad SQUARE_ACCESS_TOKEN
├─ 404: Booking not found
└─ 429: Rate limited
```

---

### **Step 8: Response Flow (Reverse)**
```
Square API Response
    ↓
Booking Helper (Line 6)
    ├─ Extract: result.result.booking
    ├─ Log: cancel_booking_success
    └─ Return: { booking: {...} }
    ↓
Controller (Line 638-649)
    ├─ Clean BigInt: cleanBigIntFromObject()
    └─ Return: 200 JSON response
    ↓
Express Response
    ├─ Status: 200
    ├─ Body: { success, data, message, timestamp }
    └─ Sent to Retell Agent
    ↓
Retell Agent
    └─ Processes tool call result
```

---

## 🚨 IDENTIFIED GAPS & ISSUES

### **Gap 1: Missing X-Retell-API-Key Header**
**Location:** Step 4 (Auth Middleware)
**Issue:** Retell agent tool calls don't include X-Retell-API-Key header
**Current Code Check:**
```javascript
if (retellApiKey && retellApiKey === process.env.RETELL_API_KEY) {
    // Only works if header is present
}
```
**Status:** ✅ FIXED (middleware ready)
**Action Needed:** Configure Retell tools in dashboard to include header

---

### **Gap 2: Missing Environment Variables**
**Location:** Step 4 (Auth Middleware, Lines 35-36)
**Issue:** If SQUARE_ACCESS_TOKEN or SQUARE_LOCATION_ID are undefined:
```javascript
const tenantContext = {
    accessToken: process.env.SQUARE_ACCESS_TOKEN,    // ← Could be undefined
    locationId: process.env.SQUARE_LOCATION_ID,      // ← Could be undefined
}
```
**Current Status:** ⚠️ POTENTIAL ISSUE
**Impact:** Square API calls will fail with 401/invalid credentials
**Check With:**
```bash
az webapp config appsettings list \
  --resource-group square-middleware-prod-rg \
  --name square-middleware-prod-api | grep -E "SQUARE_ACCESS_TOKEN|SQUARE_LOCATION_ID|RETELL_API_KEY"
```

---

### **Gap 3: Tenant Object Not Set on Controller Level**
**Location:** Step 5 (Controller)
**Issue (RESOLVED):** Previously, controllers expected `req.tenant` but auth middleware only set `req.retellContext`
**Previous Code:**
```javascript
// BEFORE FIX:
req.retellContext = tenantContext  // ← Only this was set
// Controllers expected:
const { tenant } = req  // ← Would be undefined
```
**Current Status:** ✅ FIXED
**Current Code:**
```javascript
// AFTER FIX:
req.retellContext = tenantContext
req.tenant = tenantContext  // ← Both set now ✅
```

---

### **Gap 4: No Validation of Booking ID Format**
**Location:** Step 5 (Controller, Lines 575-580)
**Issue:** Accepts any string as bookingId, no format validation
```javascript
const bookingId = req.params.bookingId || req.params.id || query.bookingId
if (!bookingId) {
    // Only checks if empty, not if format is valid
}
```
**Impact:** Invalid booking IDs might be sent to Square API
**Suggestion:** Add format validation:
```javascript
if (!bookingId || !/^[A-Za-z0-9_-]{10,}$/.test(bookingId)) {
    return res.status(400).json({ error: 'Invalid bookingId format' })
}
```

---

### **Gap 5: Duplicate cancelBooking Function Paths**
**Location:** Steps 5 & 6
**Issue:** Three separate implementations:
1. **Express Handler** (`cancelBooking` - Line 564)
   - Calls `cancelBookingHelper`
   - Creates Azure context
   
2. **Handler Function** (`handleCancelBooking` - Line 1144)
   - Also calls `cancelBookingHelper`
   - Used by `manageBooking` route
   
3. **Helper Function** (`cancelBookingHelper` - bookingHelpers.js)
   - Actually calls Square API

**Potential Issue:** Path 1 vs Path 2 inconsistency
```javascript
// PATH 1 (Direct route):
DELETE /api/bookings/:bookingId
    → cancelBooking()
    → cancelBookingHelper(context, tenant, bookingId)
    
// PATH 2 (Manager route):
DELETE /api/booking/cancel?bookingId=...
    → manageBooking()
    → handleCancelBooking()
    → cancelBookingHelper(context, bookingId)  ← ⚠️ Different args!
```

**Current Status:** ⚠️ INCONSISTENCY
**Issue:** Path 2 passes `context, bookingId` but Path 1 passes `context, tenant, bookingId`

---

### **Gap 6: Error Handling Not Comprehensive**
**Location:** Step 5 & 8 (Controller error handling, Lines 596-612)
**Issue:** Generic error messages don't surface real Square API errors
```javascript
catch (error) {
    // Only catches specific strings:
    if (error.message.includes('not found')) { ... }
    if (error.message.includes('authentication failed')) { ... }
    // Everything else returns 500 with generic message
}
```
**Potential Issue:** 401 errors from Square won't be clearly identified
**Suggestion:** Add more specific error handling:
```javascript
if (error.statusCode === 401) {
    return res.status(401).json({
        success: false,
        message: 'Authentication failed with Square API',
        error: error.message,
        debug: { accessTokenLength: tenant.accessToken?.length }
    })
}
```

---

### **Gap 7: No Request/Response Logging at Square API Level**
**Location:** Step 7 (Square API call)
**Issue:** When Square API calls fail, there's no detailed logging of:
- What was sent to Square
- What Square returned
- Headers sent
- Rate limiting info

**Suggestion:** Add logging in bookingHelpers.js:
```javascript
const logApiCall = (method, endpoint, statusCode, body) => {
    console.log(`📡 [SQUARE API] ${method} ${endpoint} → ${statusCode}`)
    console.log(`📦 Response:`, body)
}
```

---

### **Gap 8: Correlation ID Not Threaded Through Service Layers**
**Location:** Steps 5-7
**Issue:** correlationId is created but not passed to Square API calls
```javascript
// Step 5: Has correlationId
const { correlationId, tenant } = req

// Step 6: Calls helper but helpers don't receive correlationId
const result = await cancelBookingHelper(context, tenant, bookingId)
                                         // ↑ No correlationId passed

// Step 7: Square API call has no correlation ID
```

**Impact:** Can't trace Square API calls back to original Retell requests
**Suggestion:** Pass correlationId through entire chain:
```javascript
const result = await cancelBookingHelper(context, tenant, bookingId, correlationId)
```

---

## 📊 FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RETELL AGENT TOOL CALL                             │
│                    DELETE /api/bookings/:bookingId                          │
│              Header: X-Retell-API-Key: <RETELL_API_KEY>                    │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MIDDLEWARE CHAIN (src/routes/bookings.js)                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 1. correlationId middleware                                          │  │
│  │    └─ Sets: req.correlationId                                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                             │                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 2. agentAuth middleware (src/middlewares/agentAuth.js)   [CRITICAL] │  │
│  │    └─ Checks: X-Retell-API-Key === process.env.RETELL_API_KEY       │  │
│  │    └─ Creates: tenantContext with Square credentials                │  │
│  │    └─ Sets: req.tenant = tenantContext ✅ ESSENTIAL                 │  │
│  │    └─ Sets: req.retellContext = tenantContext (for compatibility)   │  │
│  │                                                                      │  │
│  │    ⚠️  GAPS:                                                         │  │
│  │    - SQUARE_ACCESS_TOKEN env var must exist                         │  │
│  │    - SQUARE_LOCATION_ID env var must exist                          │  │
│  │    - X-Retell-API-Key header must be configured in Retell console   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                             │                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 3. validateContentType, validation middlewares                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              CONTROLLER HANDLER (src/controllers/bookingController.js)      │
│                                                                              │
│  Function: cancelBooking(req, res)                                          │
│  ├─ Extract: { correlationId, tenant } = req                               │
│  │  └─ ✅ req.tenant.accessToken (from auth middleware)                    │
│  │  └─ ✅ req.tenant.locationId (from auth middleware)                     │
│  │                                                                          │
│  ├─ Extract: bookingId from URL params                                     │
│  │  └─ ⚠️ No format validation                                             │
│  │                                                                          │
│  ├─ Create: Azure Functions context mock                                   │
│  │  └─ For compatibility with helpers                                      │
│  │                                                                          │
│  ├─ Call: cancelBookingHelper(context, tenant, bookingId)                 │
│  │  └─ Passes tenant with Square credentials ✅                            │
│  │                                                                          │
│  ├─ ⚠️ GAPS:                                                               │
│  │  - No validation of bookingId format                                    │
│  │  - No detailed error logging                                           │
│  │  - correlationId not passed through to Square                          │
│  │  - Three different code paths (Path 1: direct, Path 2: manager)       │
│  └─ Return: 200 JSON response with cleaned booking data                    │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│            BOOKING SERVICE/HELPER (src/utils/helpers/bookingHelpers.js)     │
│                                                                              │
│  Function: cancelBooking(context, tenant, bookingId)                        │
│  ├─ Create: Square Client                                                  │
│  │  └─ Uses: tenant.accessToken ✅                                          │
│  │  └─ Uses: tenant.locationId ✅                                           │
│  │                                                                          │
│  ├─ Call: square.bookingsApi.cancelBooking({...})                          │
│  │  └─ Sends: idempotencyKey for idempotency                              │
│  │                                                                          │
│  ├─ Handle: Square API response                                            │
│  │  └─ Extract: result.result.booking (SDK v42+ structure)                │
│  │                                                                          │
│  └─ Return: { booking: {...} }                                             │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SQUARE API (External Service)                            │
│                                                                              │
│  POST https://connect.squareupsandbox.com/v2/bookings/{booking_id}/cancel  │
│  ├─ Authorization: Bearer <square_access_token>                            │
│  ├─ ⚠️ GAPS:                                                               │
│  │  - No detailed logging of API response                                  │
│  │  - No correlation ID in request                                         │
│  │  - Limited error handling for 401/403/429                               │
│  └─ Response: 200 OK { booking: {...} }                                    │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      RESPONSE FLOW (Reverse)                                │
│                                                                              │
│  Helper → cleanBigIntFromObject()                                           │
│          │                                                                   │
│          ▼                                                                   │
│  Controller → 200 JSON { success, data, message, timestamp }               │
│          │                                                                   │
│          ▼                                                                   │
│  Express Response → HTTP 200                                               │
│          │                                                                   │
│          ▼                                                                   │
│  Retell Agent ← Tool call result                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ VERIFICATION CHECKLIST

### **Pre-Call Verification**
- [ ] `RETELL_API_KEY` is set in Azure App Service
- [ ] `SQUARE_ACCESS_TOKEN` is valid
- [ ] `SQUARE_LOCATION_ID` is valid
- [ ] `X-Retell-API-Key` header configured in Retell tool definition
- [ ] Booking ID is valid and exists in Square

### **During Call Monitoring**
- [ ] Check logs for "Agent config lookup failed" (expected, non-blocking)
- [ ] Check for "Missing or invalid Authorization header" (would indicate auth failure)
- [ ] Check for Square API 401 (would indicate credential issue)
- [ ] Check for "Booking cancelled successfully" (success message)

### **Post-Call Verification**
- [ ] Booking status changed to CANCELLED in Square
- [ ] Response timestamp included
- [ ] Correlation ID tracked in logs

---

## 🔧 RECOMMENDED IMPROVEMENTS

### **Priority 1: Add Booking ID Validation**
```javascript
// In cancelBooking controller (line ~575)
const bookingIdRegex = /^[A-Za-z0-9_-]{10,}$/
if (!bookingId || !bookingIdRegex.test(bookingId)) {
    return res.status(400).json({ 
        error: 'Invalid booking ID format' 
    })
}
```

### **Priority 2: Improve Error Handling for Square API**
```javascript
// In error catch block (line ~596)
if (error.response?.status === 401) {
    return res.status(401).json({
        error: 'Square API authentication failed',
        debug: {
            hasAccessToken: !!tenant.accessToken,
            tokenLength: tenant.accessToken?.length
        }
    })
}
```

### **Priority 3: Thread Correlation ID Through All Layers**
```javascript
// In bookingHelpers.js
const result = await cancelBookingHelper(
    context, 
    tenant, 
    bookingId, 
    correlationId  // Add this
)
```

### **Priority 4: Add Detailed API Request/Response Logging**
```javascript
// In bookingHelpers.js before Square API call
console.log(`📡 [SQUARE API] Cancelling booking:`, {
    bookingId,
    accessTokenLength: tenant.accessToken.length,
    locationId: tenant.locationId,
    correlationId
})
```

---

## 🎯 CONCLUSION

The function call flow is **mostly sound** with a few identified gaps:

✅ **Working Well:**
- Multi-layer middleware authentication
- Tenant context properly propagated
- Both X-Retell-API-Key and Bearer token auth supported
- BigInt response cleaning

⚠️ **Needs Attention:**
1. Environment variables must be set correctly
2. X-Retell-API-Key header must be configured in Retell console
3. Booking ID format validation missing
4. Error handling could be more specific
5. Correlation ID not threaded through all layers

🚀 **Next Steps:**
1. Verify environment variables are set: `az webapp config appsettings list`
2. Configure X-Retell-API-Key in Retell tool definitions
3. Test with a booking-cancel call and monitor logs
4. Implement recommended improvements for better reliability
