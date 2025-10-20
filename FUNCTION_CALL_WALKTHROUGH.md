# Complete Function Call Flow Walkthrough

## 🔄 REQUEST FLOW: booking-cancel Example

```
1. RETELL AGENT INITIATES CALL
   ════════════════════════════════════════════════════════════════════════════
   Tool: booking-cancel
   Request: DELETE /api/bookings/GKBX6V09Q2T7FA4ZKZMMMC5C3A

   Headers:
   ├─ X-Retell-API-Key: sk-test-abc123def456
   ├─ Content-Type: application/json
   └─ Host: your-api.azurewebsites.net

   ⚠️  CRITICAL POINT: Does Retell console have this header configured?
                      If NO → Auth middleware will reject with 401


2. EXPRESS RECEIVES REQUEST
   ════════════════════════════════════════════════════════════════════════════
   File: src/express-app.js
   Status: ✅ Request received by server

   Flows through Express middleware stack...


3. MIDDLEWARE CHAIN BEGINS
   ════════════════════════════════════════════════════════════════════════════

   STEP A: correlationId Middleware
   ├─ File: src/middlewares/correlationId.js
   ├─ Action: Generates unique request ID
   └─ Result: req.correlationId = "550e8400-e29b-41d4-a716-446655440000"

   STEP B: agentAuth Middleware ⚠️ CRITICAL AUTHENTICATION POINT
   ├─ File: src/middlewares/agentAuth.js
   ├─ Execution:
   │  ├─ Extract: retellApiKey = req.headers['x-retell-api-key']
   │  │            → Should be: "sk-test-abc123def456"
   │  │
   │  ├─ Check 1: Does retellApiKey exist?
   │  │            → If NO: Fails here ❌
   │  │            → If YES: Continue to Check 2
   │  │
   │  ├─ Check 2: Does retellApiKey === process.env.RETELL_API_KEY?
   │  │            → If NO: Falls through to Bearer token auth
   │  │            → If YES: SUCCESS ✅
   │  │
   │  └─ If SUCCESS:
   │     ├─ Create tenantContext = {
   │     │  ├─ id: 'retell-agent'
   │     │  ├─ agentId: 'retell-agent'
   │     │  ├─ accessToken: process.env.SQUARE_ACCESS_TOKEN
   │     │  │              ⚠️ MUST NOT BE UNDEFINED
   │     │  ├─ locationId: process.env.SQUARE_LOCATION_ID
   │     │  │             ⚠️ MUST NOT BE UNDEFINED
   │     │  ├─ timezone: "America/New_York"
   │     │  └─ authenticated: true
   │     │  }
   │     ├─ Set req.retellContext = tenantContext
   │     ├─ Set req.tenant = tenantContext ✅ CRUCIAL FOR CONTROLLERS
   │     └─ Call next() → Continue to controller
   │
   ├─ Potential Failures Here:
   │  1. X-Retell-API-Key not in request headers
   │  2. Value doesn't match process.env.RETELL_API_KEY
   │  3. process.env.SQUARE_ACCESS_TOKEN is undefined/invalid
   │  4. process.env.SQUARE_LOCATION_ID is undefined/invalid
   │
   └─ Status: Depends on environment setup


4. ROUTING LAYER
   ════════════════════════════════════════════════════════════════════════════
   File: src/routes/bookings.js

   DELETE /api/bookings/:bookingId
   ├─ Route matched ✅
   ├─ Extracts: req.params.bookingId = "GKBX6V09Q2T7FA4ZKZMMMC5C3A"
   └─ Dispatches to: bookingController.cancelBooking(req, res)


5. CONTROLLER LAYER
   ════════════════════════════════════════════════════════════════════════════
   File: src/controllers/bookingController.js (Line 564)
   Function: cancelBooking(req, res)

   Flow:
   ├─ Step 1: Extract context
   │  ├─ const { correlationId, tenant } = req
   │  ├─ correlationId = "550e8400-e29b-41d4-a716-446655440000" ✅
   │  └─ tenant = {
   │     ├─ accessToken: "sq_prod_xxxxxxxxxxxx"
   │     ├─ locationId: "LKTH6WMZZ3Q7F"
   │     └─ ... other fields
   │     } ✅
   │
   ├─ Step 2: Extract bookingId from request
   │  ├─ From URL: req.params.bookingId = "GKBX6V09Q2T7FA4ZKZMMMC5C3A"
   │  ├─ Validate: if (!bookingId) { return error }
   │  │            ⚠️ NO FORMAT VALIDATION - potential issue
   │  └─ Final: bookingId = "GKBX6V09Q2T7FA4ZKZMMMC5C3A" ✅
   │
   ├─ Step 3: Create mock context for compatibility
   │  └─ const context = { log: (...args) => logger.info(...args) }
   │
   ├─ Step 4: Call booking helper
   │  └─ const result = await cancelBookingHelper(context, tenant, bookingId)
   │     └─ Passes ALL required parameters ✅
   │
   ├─ Step 5: Clean response
   │  └─ const cleanedBooking = cleanBigIntFromObject(result.booking)
   │
   └─ Step 6: Send response
      └─ return res.status(200).json({
         success: true,
         data: { booking: cleanedBooking },
         message: 'Booking cancelled successfully'
         })


6. SERVICE LAYER - Booking Helper
   ════════════════════════════════════════════════════════════════════════════
   File: src/utils/helpers/bookingHelpers.js
   Function: cancelBooking(context, tenant, bookingId)

   Flow:
   ├─ Step 1: Create Square Client
   │  └─ const client = createSquareClient(
   │     tenant.accessToken,      ← "sq_prod_xxxxxxxxxxxx"
   │     tenant.locationId        ← "LKTH6WMZZ3Q7F"
   │     )
   │
   ├─ Step 2: Fetch current booking version
   │  └─ const booking = await client.bookingsApi.retrieveBooking({
   │     bookingId: "GKBX6V09Q2T7FA4ZKZMMMC5C3A"
   │     })
   │     └─ ⚠️ NO DETAILED LOGGING HERE - hard to debug if fails
   │
   ├─ Step 3: Call Square Cancel API
   │  └─ const response = await client.bookingsApi.cancelBooking({
   │     bookingId: "GKBX6V09Q2T7FA4ZKZMMMC5C3A",
   │     version: booking.result.booking.version,
   │     idempotencyKey: "..."
   │     })
   │
   ├─ Potential Failures Here:
   │  1. tenant.accessToken invalid/expired → 401 Unauthorized
   │  2. tenant.locationId wrong → 400/404 errors
   │  3. bookingId doesn't exist → 404 Not Found
   │  4. booking already cancelled → Square-specific error
   │  └─ ⚠️ WEAK ERROR HANDLING - errors not clearly surfaced
   │
   └─ Step 4: Return result
      └─ return { booking: response.result.booking }


7. SQUARE API - External Service Call
   ════════════════════════════════════════════════════════════════════════════
   Service: Square (Remote API)

   HTTP Request Sent:
   POST https://connect.squareupsandbox.com/v2/bookings/{booking_id}/cancel

   Headers:
   ├─ Authorization: Bearer sq_prod_xxxxxxxxxxxx
   ├─ Content-Type: application/json
   ├─ User-Agent: squareupsdk/js-v42.0.0
   └─ X-Square-User-Agent: squareupsdk/js-v42.0.0

   ⚠️ MISSING: No correlation ID header to trace back to Retell request

   Possible Responses:
   ├─ 200 OK: { booking: { id: "GKBX...", status: "CANCELLED", ... } }
   │
   ├─ 400 Bad Request: Invalid request format
   │  └─ Usually means: malformed booking ID or params
   │
   ├─ 401 Unauthorized: Invalid access token
   │  └─ Usually means: SQUARE_ACCESS_TOKEN is wrong/expired
   │
   ├─ 404 Not Found: Booking doesn't exist
   │  └─ Usually means: bookingId is wrong or already cancelled
   │
   ├─ 409 Conflict: Can't cancel booking in current state
   │  └─ Usually means: Already cancelled or in wrong status
   │
   └─ 429 Too Many Requests: Rate limited
      └─ Usually means: Too many Square API calls in short time


8. RESPONSE FLOW (Reverse)
   ════════════════════════════════════════════════════════════════════════════

   Square Response
   ├─ Status: 200 OK
   └─ Body: { booking: { id: "GKBX...", status: "CANCELLED", ... } }

   ↓ Helper Returns

   Helper Response
   ├─ Return: { booking: { id: "GKBX...", status: "CANCELLED", ... } }
   └─ ⚠️ No logging of response details

   ↓ Controller Receives

   Controller Processing
   ├─ Clean BigInt values: cleanBigIntFromObject(...)
   ├─ Create JSON: { success: true, data: {...}, message: '...' }
   └─ Send: res.status(200).json(...)

   ↓ Express Sends to Network

   HTTP Response to Retell
   ├─ Status: 200 OK
   ├─ Headers: Content-Type: application/json
   └─ Body: {
      "success": true,
      "data": {
         "booking": {
            "id": "GKBX6V09Q2T7FA4ZKZMMMC5C3A",
            "status": "CANCELLED",
            "customerNote": "...",
            "sellerNote": "...",
            "updatedAt": "2025-10-18T14:23:45.123Z"
         }
      },
      "message": "Booking cancelled successfully",
      "timestamp": "2025-10-18T14:23:45.123Z",
      "correlationId": "550e8400-e29b-41d4-a716-446655440000"
      }

   ↓ Retell Agent Receives

   Retell Tool Result
   └─ Tool call completed successfully ✅
```

---

## 🔴 FAILURE SCENARIOS

### **Scenario 1: X-Retell-API-Key Not Configured**

```
Request Headers: { }  ← Missing X-Retell-API-Key
          ↓
agentAuth checks: retellApiKey === undefined
          ↓
Falls through to Bearer token auth
          ↓
No Authorization header → 401 error
          ↓
Retell receives: { error: 'Missing or invalid Authorization header' }
```

### **Scenario 2: Environment Variables Not Set**

```
agentAuth receives X-Retell-API-Key ✅
          ↓
Checks: retellApiKey === process.env.RETELL_API_KEY
          ↓
Match found ✅
          ↓
Creates tenantContext:
├─ accessToken: undefined  ← process.env.SQUARE_ACCESS_TOKEN not set
├─ locationId: undefined   ← process.env.SQUARE_LOCATION_ID not set
└─ Continues to controller...
          ↓
Controller calls helper with undefined credentials
          ↓
createSquareClient(undefined, undefined) fails
          ↓
Square API call never even sent
          ↓
Error thrown: "Cannot create client with undefined credentials"
```

### **Scenario 3: Invalid Square Access Token**

```
Auth middleware ✅
Controller ✅
Helper ✅
          ↓
Square API receives:
Authorization: Bearer sq_prod_invalid_token_xxxx
          ↓
Square API response: 401 Unauthorized
          ↓
Helper throws error
          ↓
Controller catch block:
├─ Checks: error.message.includes('authentication failed')
├─ If YES: Returns 401
└─ If NO: Returns 500 generic error
          ↓
Retell receives error response
```

### **Scenario 4: Booking ID Wrong**

```
Auth ✅ Controller ✅ Helper ✅
          ↓
Square API receives:
POST /v2/bookings/INVALID_ID/cancel
          ↓
Square responds: 404 Not Found
          ↓
Helper throws error
          ↓
Controller returns 404
```

---

## ⚠️ IDENTIFIED GAPS DURING THIS FLOW

### **Gap A: No Environment Variable Validation**

Location: agentAuth middleware initialization

```javascript
// CURRENT: Creates context with potentially undefined values
const tenantContext = {
  accessToken: process.env.SQUARE_ACCESS_TOKEN, // Could be undefined!
  locationId: process.env.SQUARE_LOCATION_ID // Could be undefined!
};

// SHOULD BE:
if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
  return res.status(500).json({ error: 'Missing environment variables' });
}
```

### **Gap B: No Booking ID Format Validation**

Location: cancelBooking controller (line 575)

```javascript
// CURRENT: Accepts any string
const bookingId = req.params.bookingId;

// SHOULD BE:
if (!/^[A-Z0-9]+$/.test(bookingId)) {
  return res.status(400).json({ error: 'Invalid booking ID format' });
}
```

### **Gap C: Correlation ID Not Threaded to Square**

Location: cancelBooking helper

```javascript
// CURRENT: No correlation ID passed to Square API
const response = await client.bookingsApi.cancelBooking({...})

// SHOULD BE:
const response = await client.bookingsApi.cancelBooking({
    bookingId,
    idempotencyKey: `${correlationId}-${bookingId}`,
    // Add correlation ID to header or request for tracing
})
```

### **Gap D: Duplicate Code Paths**

Location: Two different routes, three implementations

- Path 1: `DELETE /api/bookings/:bookingId` → Direct ✅
- Path 2: `DELETE /api/booking/cancel?bookingId=...` → Via manageBooking
  - Uses `handleCancelBooking` which calls helper WITHOUT tenant parameter ❌

### **Gap E: Error Responses Not Specific**

Location: Controller error handling (lines 596-612)

```javascript
// CURRENT: Generic error messages
catch (error) {
    return res.status(500).json({
        message: 'Failed to cancel booking',
        error: error.message  // Might not be helpful
    })
}

// SHOULD BE:
catch (error) {
    if (error.response?.status === 401) {
        return res.status(401).json({
            error: 'Square API authentication failed',
            hint: 'Check SQUARE_ACCESS_TOKEN in environment'
        })
    }
    if (error.response?.status === 404) {
        return res.status(404).json({
            error: 'Booking not found',
            bookingId: bookingId
        })
    }
    // ... more specific handling
}
```

---

## ✅ VERIFICATION CHECKLIST

**Before Testing:**

- [ ] Verify X-Retell-API-Key configured in Retell console for booking-cancel tool
- [ ] Verify SQUARE_ACCESS_TOKEN set in Azure:
      `az webapp config appsettings list --name square-middleware-prod-api | grep SQUARE_ACCESS_TOKEN`
- [ ] Verify SQUARE_LOCATION_ID set in Azure
- [ ] Verify RETELL_API_KEY set in Azure
- [ ] Valid booking exists in your Square test account

**During Test Call:**

- [ ] Check Azure logs for "Missing or invalid Authorization header" (would indicate auth failure)
- [ ] Check Azure logs for "Agent config lookup failed" (expected, non-blocking)
- [ ] Monitor for any 500 errors
- [ ] Monitor for any 401 errors from Square

**After Test Call:**

- [ ] Booking status in Square changed to CANCELLED
- [ ] Response included correlationId
- [ ] No errors in application logs

---

## 🚀 NEXT STEPS

1. **Verify Gap 1**: Configure X-Retell-API-Key in Retell console
2. **Verify Gap 2**: Run env var check command
3. **Test**: Make test booking-cancel call
4. **Fix Gap 3**: Update handleCancelBooking to pass tenant
5. **Fix Gap 4**: Add booking ID format validation
6. **Fix Gap 5**: Improve error responses
