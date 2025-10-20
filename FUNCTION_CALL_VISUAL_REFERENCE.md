# Complete Function Call Process - Visual Reference

## High-Level Overview

```
RETELL AGENT
    │
    ├─ Makes: DELETE /api/bookings/:bookingId
    └─ Header: X-Retell-API-Key: xyz
         │
         ▼
    ┌─────────────────────────────────────────┐
    │    MIDDLEWARE CHAIN                     │
    ├─────────────────────────────────────────┤
    │ 1. correlationId    → Generates ID      │
    │ 2. agentAuth        → ⚠️ CHECKS HEADER │
    │ 3. validation       → Content type OK   │
    └────────────┬────────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────┐
    │    ROUTING LAYER                        │
    ├─────────────────────────────────────────┤
    │ Match: DELETE /api/bookings/:bookingId  │
    │ Dispatch: bookingController.cancelBooking
    └────────────┬────────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────┐
    │    CONTROLLER LAYER                     │
    ├─────────────────────────────────────────┤
    │ cancelBooking(req, res)                 │
    │ - Extract tenant context                │
    │ - Validate booking ID                   │
    │ - Call helper function                  │
    └────────────┬────────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────┐
    │    SERVICE/HELPER LAYER                 │
    ├─────────────────────────────────────────┤
    │ cancelBookingHelper()                   │
    │ - Create Square client                  │
    │ - Fetch booking details                 │
    │ - Call cancelBooking API                │
    └────────────┬────────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────┐
    │    SQUARE API (Remote)                  │
    ├─────────────────────────────────────────┤
    │ POST /v2/bookings/{id}/cancel           │
    │ Response: 200 OK { booking: {...} }     │
    └────────────┬────────────────────────────┘
                 │
                 ▼ (Response flows back up)
              RETELL
```

---

## Step-by-Step Execution Timeline

```
TIME    STEP                        LOCATION              WHAT'S HAPPENING
────────────────────────────────────────────────────────────────────────────────
T0      Request arrives             Network → Express     HTTP request received

T1      Correlation ID              correlationId         Generate unique ID
        Generated                   middleware            req.correlationId = UUID

T2      Auth Check                  agentAuth             Extract X-Retell-API-Key
                                    middleware            └─ Line 28-43

T3      Validate Header             agentAuth             Check: header === env var
        vs Env Var                  middleware            └─ If NO → 401 error
                                                          └─ If YES → Continue

T4      Create Tenant Context       agentAuth             Build req.tenant with:
                                    middleware            ├─ accessToken
                                                          ├─ locationId
                                                          ├─ timezone
                                                          └─ Set to req.tenant ✅

T5      Route Matching              Router                URL → handler mapping
                                    (bookings.js)         /api/bookings/:bookingId
                                                          → cancelBooking()

T6      Extract Context             Controller            const { tenant } = req
                                    (Line 565-567)        └─ req.tenant has
                                                             credentials ✅

T7      Extract Booking ID          Controller            const bookingId =
                                    (Line 570-571)        req.params.bookingId
                                                          └─ Should validate
                                                             format ⚠️

T8      Create Context Object       Controller            const context = {
                                    (Line 580-582)        log: (...args) => ...
                                                          }
                                                          (For compatibility)

T9      Call Helper Function        Controller            const result =
                                    (Line 633)            cancelBookingHelper(
                                                            context,
                                                            tenant,     ← ✅ PASSED
                                                            bookingId
                                                          )

T10     Create Square Client        bookingHelpers.js     const client =
                                    (Helper function)     createSquareClient(
                                                            tenant.accessToken,
                                                            tenant.locationId
                                                          )

T11     Fetch Current Booking       bookingHelpers.js     const booking =
                                    (Helper function)     client.bookingsApi
                                                            .retrieveBooking(...)

T12     Call Square Cancel API      bookingHelpers.js     const response =
                                    (Helper function)     client.bookingsApi
                                                            .cancelBooking({...})

                                                          ⚠️ This is where
                                                          401 errors occur
                                                          if credentials
                                                          are wrong

T13     Square Processes Request    Square API            Authorization check
        (Remote)                    (External)            └─ Bearer token valid?
                                                          │  └─ If NO: 401
                                                          │  └─ If YES: Continue

                                                          Business logic check
                                                          └─ Can cancel booking?
                                                             └─ If NO: 400/409
                                                             └─ If YES: Continue

                                                          Update in database
                                                          └─ Set status=CANCELLED

T14     Square Returns Response     Square API            200 OK
                                    (External)            { booking: {...} }

T15     Return from Helper          bookingHelpers.js     return result

T16     Clean BigInt Values         Controller            cleanBigIntFromObject()
                                    (Line 638-641)

T17     Create JSON Response        Controller            res.status(200).json({
                                    (Line 643-649)        success: true,
                                                          data: {...},
                                                          message: '...',
                                                          timestamp: '...'
                                                          })

T18     Send to Network             Express               HTTP 200 response

T19     Retell Receives             Retell Agent          Tool call completed
                                                          Process result

TIME    TOTAL: ~200-500ms (depending on Square API speed)
```

---

## Critical Dependency Chain

```
FOR SUCCESS: All of these must be true in sequence

    1. X-Retell-API-Key header exists in request
       ↓ (Must pass: header === env var)

    2. process.env.RETELL_API_KEY is set
       ↓ (Must match Retell tool configuration)

    3. process.env.SQUARE_ACCESS_TOKEN is set
       ↓ (Must be valid Square API token)

    4. process.env.SQUARE_LOCATION_ID is set
       ↓ (Must be valid Square location)

    5. Auth middleware creates req.tenant ✓
       ↓ (Must be passed to controller)

    6. Controller receives req.tenant ✓
       ↓ (Must pass to helper function)

    7. Helper receives tenant ✓
       ↓ (Must create Square client)

    8. Square client created ✓
       ↓ (Must call Square API)

    9. Square API called with valid token
       ↓ (Must authorize request)

    10. Booking cancelled ✓
        ↓

    ✅ SUCCESS: 200 response to Retell
```

---

## Failure Points (Where It Could Break)

```
┌─ Point 1: Auth Middleware
│  ├─ Missing X-Retell-API-Key header
│  │   → 401 "Missing or invalid Authorization header"
│  │
│  ├─ Header doesn't match env var
│  │   → 401 "Missing or invalid Authorization header"
│  │
│  ├─ RETELL_API_KEY env var not set
│  │   → 401 (header won't match undefined)
│  │
│  └─ SQUARE_ACCESS_TOKEN env var not set
│      → Creates tenant with undefined accessToken
│      → Later: Square API 401
│
├─ Point 2: Controller
│  ├─ No bookingId in request
│  │   → 400 "bookingId is required"
│  │
│  └─ Invalid bookingId format (not detected)
│      → Sent to Square
│      → Square: 400 "Invalid booking ID"
│
├─ Point 3: Helper Function
│  ├─ tenant parameter missing
│  │   → Cannot create Square client
│  │   → TypeError: Cannot read accessToken of undefined
│  │
│  └─ Duplicate code path (gap 3)
│      → handleCancelBooking doesn't pass tenant
│      → Crashes with above error
│
└─ Point 4: Square API
   ├─ Invalid access token
   │   → 401 "Unauthorized"
   │
   ├─ Invalid location ID
   │   → 400 "Invalid location"
   │
   ├─ Booking doesn't exist
   │   → 404 "Not found"
   │
   ├─ Booking already cancelled
   │   → 409 "Conflict"
   │
   └─ Rate limited
       → 429 "Too many requests"
```

---

## Detailed Middleware Flow

```
REQUEST: DELETE /api/bookings/GKBX6V09Q2T7FA4ZKZMMMC5C3A
         Headers: X-Retell-API-Key: sk-test-abc123

    │
    ▼ Enter middleware chain

    MIDDLEWARE 1: correlationId
    ├─ Check: Has X-Correlation-ID header?
    ├─ If NO: Generate new UUID
    ├─ Set: req.correlationId = "550e8400-e29b-41d4-a716-446655440000"
    └─ Call: next()

    │
    ▼ MIDDLEWARE 2: agentAuth (CRITICAL)
    ├─ Extract Headers:
    │  ├─ authHeader = undefined (no Authorization)
    │  ├─ agentId = undefined (no X-Agent-ID)
    │  └─ retellApiKey = "sk-test-abc123"
    │
    ├─ CHECK 1: Is retellApiKey defined?
    │  └─ YES ✓ Continue
    │
    ├─ CHECK 2: Does retellApiKey === process.env.RETELL_API_KEY?
    │  └─ If NO: Skip this block, try Bearer token
    │  └─ If YES: ✓ SUCCESS BRANCH:
    │     │
    │     ├─ Create tenantContext = {
    │     │  ├─ id: 'retell-agent'
    │     │  ├─ accessToken: process.env.SQUARE_ACCESS_TOKEN
    │     │  │              ← ⚠️ MUST NOT BE UNDEFINED
    │     │  ├─ locationId: process.env.SQUARE_LOCATION_ID
    │     │  │             ← ⚠️ MUST NOT BE UNDEFINED
    │     │  ├─ timezone: process.env.TZ
    │     │  ├─ authenticated: true
    │     │  └─ isRetellAgent: true
    │     │  }
    │     │
    │     ├─ Set: req.retellContext = tenantContext
    │     ├─ Set: req.tenant = tenantContext ← ✅ BOTH SET
    │     └─ Call: next() → Continue to routes
    │
    │ └─ If CHECK 2 FAILS:
    │    ├─ Try Bearer token auth (lines 46-73)
    │    ├─ If no Bearer: Return 401
    │    └─ If Bearer invalid: Return 403
    │
    ▼ MIDDLEWARE 3+: Other middleware (validation, etc.)

    │
    ▼ ROUTE HANDLER
    DELETE /api/bookings/:bookingId
    ├─ Routed to: bookingController.cancelBooking()
    └─ req has: .correlationId, .tenant, .params
```

---

## Data Flow Through System

```
REQUEST BODY:
{
  (usually empty for DELETE)
}

URL PARAMETERS:
├─ :bookingId = "GKBX6V09Q2T7FA4ZKZMMMC5C3A"
└─ Extracted: req.params.bookingId

REQUEST OBJECT (After Middleware):
{
  correlationId: "550e8400...",
  tenant: {
    id: 'retell-agent',
    accessToken: "sq_prod_...",
    locationId: "LKTH6WMZZ3Q7F",
    timezone: "America/New_York",
    authenticated: true,
    isRetellAgent: true
  },
  retellContext: { /* same as tenant */ },
  params: { bookingId: "GKBX6V09Q2T7FA4ZKZMMMC5C3A" }
}

PASSED TO HELPER:
├─ context: { log: (...) => ... }
├─ tenant: { accessToken: "sq_prod_...", locationId: "LKTH6WMZZ3Q7F" }
└─ bookingId: "GKBX6V09Q2T7FA4ZKZMMMC5C3A"

SQUARE API REQUEST:
{
  method: "POST",
  endpoint: "/v2/bookings/GKBX6V09Q2T7FA4ZKZMMMC5C3A/cancel",
  headers: {
    Authorization: "Bearer sq_prod_...",
    Content-Type: "application/json"
  },
  body: {
    idempotencyKey: "..."
  }
}

SQUARE API RESPONSE:
{
  result: {
    booking: {
      id: "GKBX6V09Q2T7FA4ZKZMMMC5C3A",
      status: "CANCELLED",
      customerId: "...",
      createdAt: "2025-10-18T...",
      updatedAt: "2025-10-18T..."
    }
  }
}

CLEANED & RETURNED:
{
  success: true,
  data: {
    booking: { /* same structure */ }
  },
  message: "Booking cancelled successfully",
  timestamp: "2025-10-18T14:23:45.123Z",
  correlationId: "550e8400..."
}

SENT TO RETELL:
HTTP 200
{ success: true, data: { booking: {...} }, ... }
```

---

## Environment Variables Required

```
Variable                  Location        Purpose
─────────────────────────────────────────────────────────────────────
RETELL_API_KEY           Azure            Must match X-Retell-API-Key
                         Environment      header from Retell tools
                         Variables

SQUARE_ACCESS_TOKEN      Azure            Bearer token for Square API
                         Environment      authentication
                         Variables        ← If invalid: 401 from Square

SQUARE_LOCATION_ID       Azure            Square location to operate in
                         Environment      ← If missing: API errors
                         Variables

TZ                       Azure            Timezone for date calculations
                         Environment      (default: America/New_York)
                         Variables

SQUARE_ENVIRONMENT       Azure            sandbox or production
                         Environment
                         Variables
```

---

## Test Checklist

**Before Test:**

- [ ] X-Retell-API-Key header configured in all 5 Retell tools
- [ ] RETELL_API_KEY env var set in Azure and matches Retell tools
- [ ] SQUARE_ACCESS_TOKEN env var set in Azure
- [ ] SQUARE_LOCATION_ID env var set in Azure
- [ ] Valid test booking exists in Square

**During Test:**

- [ ] Check Azure app logs for auth errors
- [ ] Monitor for any 401 errors
- [ ] Check for "booking cancelled successfully" message
- [ ] Verify booking status changed in Square

**After Test:**

- [ ] Booking status = CANCELLED in Square ✓
- [ ] Response received by Retell ✓
- [ ] No errors in logs ✓
