# Response Field Discrepancy Analysis

## Problem Statement

The webhook response changed from using `staff_*` field names to `barbers_*` field names. This is causing
confusion about which fields should be used and inconsistency in the response format.

## Root Cause Analysis

There are **TWO different code paths** that return responses with **DIFFERENT field names**:

### Path 1: Customer Lookup SUCCESS (customerController.js)

**Location:** `src/controllers/customerController.js` lines 550-580

**Response Fields:**

```json
{
  "dynamic_variables": {
    "staff_with_ids_json": "...",
    "available_staff": "Mike, Carlos, Antonio"
  }
}
```

**Code:**

```javascript
staff_with_ids_json: JSON.stringify(staffWithIds),
available_staff: staffWithIds.map(s => s.displayName).join(', '),
```

---

### Path 2: Customer Lookup FAILED (retellWebhookController.js)

**Location:** `src/controllers/retellWebhookController.js` lines 200-260

**Response Fields:**

```json
{
  "dynamic_variables": {
    "barbers_with_ids_json": "[{\"id\":\"default\",\"name\":\"Our Team\",\"displayName\":\"Our Team\"}]",
    "available_barbers": "Our Team"
  }
}
```

**Code:**

```javascript
barbers_with_ids_json: String(rawVariables.barbers_with_ids_json || '[]'),
available_barbers: String(rawVariables.available_barbers || ''),
```

---

## The Timeline

### Before callId Feature (Commit 86c83b5f)

- **customerController** returned `staff_with_ids_json` + `available_staff`
- **retellWebhookController** error path returned `barbers_with_ids_json` + `available_barbers`
- **Inconsistency existed but user saw only ONE path** (successful customer lookup)

### After callId Feature (Commit 663bb0df)

- **ONLY changed:** Added `call_id` to dynamic_variables
- **NO changes** to field names
- **SAME two paths existed** but now visible in logs/debugging

### Why You Saw the Change

1. **Before (1 hour ago):** Made successful booking queries → Only saw `staff_*` fields from
   customerController
2. **Now (current):** Tool call failed → Returned error response with `barbers_*` fields from
   retellWebhookController error handler
3. **The fields didn't change** → You just saw different code paths for the first time!

---

## Code Evidence

**Commit 663bb0df changes to retellWebhookController.js:**

```diff
  const mockReq = {
    body: { phone: from_number },
    correlationId: correlationId,
-   tenant: tenant // ✅ PASS TENANT CONTEXT
+   tenant: tenant, // ✅ PASS TENANT CONTEXT
+   callId: callId // ✅ PASS CALL_ID so it can be added to dynamic_variables
  };

  // ... existing code ...

+ // Add callId to dynamic_variables so agent can use it in tool calls
+ if (customerResponse && customerResponse.dynamic_variables) {
+   customerResponse.dynamic_variables.call_id = callId;
+   console.log(`✅ [RETELL DEBUG] Added call_id to dynamic_variables: ${callId}`);
+ }
```

**Result:** Only 1 line was added for callId functionality. The `barbers_*` fields were already there in the
error handler from an earlier commit.

---

## The Real Issue

### What Changed in Reality: NOTHING

- No field names were changed
- No code was modified to swap field names
- The `barbers_*` fields existed before and after

### What Appeared to Change: VISIBILITY

The two different code paths became visible when:

1. Tool calls started failing (error handler triggered)
2. Logs showed the `barbers_*` fields instead of `staff_*` fields
3. This made you realize the inconsistency existed

---

## Impact Assessment

### Problem

**Field Naming Inconsistency:**

- Successful customer lookup: `staff_with_ids_json`, `available_staff`
- Failed customer lookup: `barbers_with_ids_json`, `available_barbers`
- Agent code must handle BOTH field names

### Current Behavior

```
SUCCESS PATH (customerController):
/api/customers/info → {staff_with_ids_json, available_staff}

WEBHOOK INBOUND (retellWebhookController):
- If customer found: → {staff_with_ids_json, available_staff}
- If customer NOT found: → {barbers_with_ids_json, available_barbers}
```

### Agent Compatibility

The agent's dynamic variables only have ONE set of fields at a time:

- **Expected:** Consistent field names across all scenarios
- **Actual:** Field names vary based on success/failure path

---

## Recommendation: Fix the Inconsistency

### Option A: Standardize on `staff_*` (RECOMMENDED)

Update retellWebhookController to use `staff_*` fields:

**Before:**

```javascript
barbers_with_ids_json: String(rawVariables.barbers_with_ids_json || '[]'),
available_barbers: String(rawVariables.available_barbers || ''),
```

**After:**

```javascript
staff_with_ids_json: String(rawVariables.staff_with_ids_json || '[]'),
available_staff: String(rawVariables.available_staff || ''),
```

### Option B: Standardize on `barbers_*`

Update customerController to use `barbers_*` fields:

- More descriptive for barbershop context
- Requires updating all customer info lookups

### Option C: Return Both Sets

Include both field names in all responses:

```javascript
dynamic_variables: {
  staff_with_ids_json: "...",
  available_staff: "...",
  barbers_with_ids_json: "...",     // Legacy/alias
  available_barbers: "..."            // Legacy/alias
}
```

---

## Summary

| Aspect                      | Before (1 hr ago)   | After (now)      | Reality      |
| --------------------------- | ------------------- | ---------------- | ------------ |
| Field names in code         | Both existed        | Both still exist | NO CHANGE    |
| Visible in successful calls | `staff_*` only      | `staff_*` only   | SAME         |
| Visible in failed calls     | Not seeing failures | `barbers_*`      | VISIBILITY   |
| My commits changed fields   | No                  | No               | Confirmed ✅ |
| Inconsistency existed       | Yes                 | Yes              | PRE-EXISTING |

**Conclusion:** The response didn't actually change. You're seeing both code paths for the first time due to
tool call failures triggering the error handler.

---

## Action Items

1. **Investigate why tool calls are failing** (missing header configuration)
2. **Get back to successful queries** (returns `staff_*` fields consistently)
3. **Then optionally standardize** field names when time permits
