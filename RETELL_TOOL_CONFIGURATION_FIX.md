# Retell Tool Configuration Fix

## Problem Identified

From your logs, the booking-cancel tool call failed with:

```
Error in executing custom function call: booking-cancel
Axios Error: error code: ERR_BAD_REQUEST, error message: Request failed with status code 401
response status: 401
response data: [{"error":"1"},"Invalid signature"]
```

This "Invalid signature" error means the tool call went through **signature verification** instead of
**session lookup**. This happens when the `x-retell-call-id` header is missing.

## Root Cause

Your Retell agent's tool definitions are **NOT sending the `x-retell-call-id` header**.

When a tool call arrives without this header:

1. `agentAuth` middleware checks for `x-retell-signature` header ✅ (present)
2. Verifies signature successfully ✅
3. But there's no session to attach to `req.tenant` ❌
4. Tool controller tries to use default credentials ❌
5. Fails because tool needs session-specific credentials ❌

## Solution

### Update ALL Tool Definitions in Retell Dashboard

Every tool in your Retell agent must include this header:

```json
{
  "name": "booking-cancel",
  "description": "Cancel an existing booking",
  "url": "https://square-middleware-prod-api.azurewebsites.net/api/bookings/cancel",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "x-retell-call-id": "{{dynamic_variables.call_id}}"  ← ADD THIS
  },
  "body": {
    "bookingId": "{{bookingId}}"
  }
}
```

### Tools That Need This Header

ALL tools must include `x-retell-call-id`:

1. ✅ **booking-cancel**
2. ✅ **booking-create**
3. ✅ **booking-update**
4. ✅ **check-availability**
5. ✅ **get-customer-info**
6. ✅ **update-customer**
7. ✅ Any other custom tools

### Why This Works

1. `call_inbound` webhook creates session with UUID: `278238d9-4dd5-44c1-94d9-04cd919409a9`
2. Returns this in `dynamic_variables.call_id`
3. Retell stores it and makes it available as `{{dynamic_variables.call_id}}`
4. Tool calls include header: `x-retell-call-id: 278238d9-4dd5-44c1-94d9-04cd919409a9`
5. `agentAuth` middleware:
   - Sees `x-retell-call-id` header
   - Looks up session by this ID
   - Attaches credentials to `req.tenant`
   - Tool executes successfully ✅

## Verification

After updating tool definitions, test with a call:

1. Watch logs for tool call
2. Should see: `[AgentAuth] ✅ Agent authenticated from session: agent_xxx`
3. Should NOT see: `Invalid signature` error

## Current Flow (Broken)

```
Retell Tool Call
     ↓
   [No x-retell-call-id header]
     ↓
agentAuth sees x-retell-signature
     ↓
Verifies signature ✅
     ↓
No session lookup
     ↓
req.tenant = default env vars
     ↓
Tool fails (wrong/missing credentials) ❌
```

## Fixed Flow

```
Retell Tool Call
     ↓
   [x-retell-call-id: UUID]
     ↓
agentAuth checks signature first
     ↓
Then checks for call_id header
     ↓
Looks up session by UUID
     ↓
req.tenant = session credentials ✅
     ↓
Tool executes successfully ✅
```

## Quick Test Command

Test if header is being sent:

```bash
# Watch Azure logs for tool call
# Look for this line:
[AgentAuth] 🔍 Looking up session for call: <UUID>

# If you see this instead, header is missing:
[AgentAuth] 🔐 Verifying Retell webhook signature
```

## Summary

**Action Required:** Add `"x-retell-call-id": "{{dynamic_variables.call_id}}"` to the headers section of EVERY
tool definition in your Retell agent configuration.

This is **not a code issue** - it's a **configuration issue** in the Retell dashboard.
