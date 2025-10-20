# 🚨 CRITICAL HOTFIX: Webhook Circular JSON Error

**Date:** October 20, 2025, 17:25 UTC  
**Severity:** CRITICAL (P0)  
**Status:** ✅ DEPLOYED  
**Commit:** `63b1e938`

---

## 🔥 INCIDENT SUMMARY

### Problem

Retell AI webhooks were failing in production with **500 Internal Server Error** and causing a **retry storm** (18+ signature verifications per webhook).

### Root Cause

Two critical bugs in `retellWebhookController.js`:

1. **Circular JSON Serialization** - The error handler was trying to serialize an error object that contained circular references (Socket objects from Express.js)
2. **Missing Return Statement** - The error handler wasn't returning after sending response, potentially causing double-sends

---

## 📊 IMPACT ANALYSIS

### Production Logs (Before Fix)

```
2025-10-20T17:25:46.952 - Retell: triggering inbound call webhook
2025-10-20T17:25:48.366 - Retell ERROR: Request failed with status code 500

Response data: [{"success":false,"error":"1","message":"1","timestamp":"2",
"details":"3","correlation_id":"4"},"Failed to process Retell webhook",
"2025-10-20T17:25:48.306Z","Converting circular structure to JSON
    --> starting at object with constructor 'Socket'
    |     property 'parser' -> object with constructor 'HTTPParser'
    --- property 'socket' closes the circle","535a0524-a1ec-4ea9-95d3-12e64add4beb"]
```

### Affected Events

- `call_inbound` - ❌ Failing
- `call_started` - ❌ Failing  
- `call_ended` - ❌ Failing
- `call_analyzed` - ❌ Failing

### Retry Storm

Each webhook failure triggered Retell's retry mechanism:

```
2025-10-20T17:25:15.097 [RetellAuth] ✅ Signature verified (attempt 1)
2025-10-20T17:25:15.425 [RetellAuth] ✅ Signature verified (attempt 2)
2025-10-20T17:25:15.980 [RetellAuth] ✅ Signature verified (attempt 3)
...
2025-10-20T17:25:50.590 [RetellAuth] ✅ Signature verified (attempt 18+)
```

**Result:** 18+ authentication checks per failed webhook = massive load

---

## 🔧 TECHNICAL DETAILS

### Bug #1: Circular JSON Serialization

**Location:** `src/controllers/retellWebhookController.js:296`

**Before:**
```javascript
} catch (error) {
  logPerformance(correlationId, 'retell_webhook_error', startTime, {
    event: webhookData?.event,
    error: error.message  // ✅ This was correct
  });

  sendError(res, 'Failed to process Retell webhook', 500, error.message, correlationId);
  // ⚠️ But error.message could be undefined, passing entire error object
}
```

**Problem:**
When `error.message` is `undefined`, JavaScript passes the entire `error` object as the `details` parameter. Express.js errors contain circular references:

```
Error → req → socket → parser → socket (circular!)
```

**After:**
```javascript
} catch (error) {
  // Safe error serialization - extract only serializable properties
  logPerformance(correlationId, 'retell_webhook_error', startTime, {
    event: webhookData?.event,
    errorMessage: error.message || 'Unknown error',  // ✅ Always a string
    errorType: error.name || 'Error'                  // ✅ Always a string
  });

  // Explicitly convert to string to avoid circular references
  const errorDetails = error.message || error.toString();

  return sendError(res, 'Failed to process Retell webhook', 500, errorDetails, correlationId);
}
```

---

### Bug #2: Missing Return Statement

**Location:** `src/controllers/retellWebhookController.js:289`

**Before:**
```javascript
// For all other webhooks, acknowledge with 204 status
res.status(204).send();  // ❌ No return!
```

**Problem:**
Without `return`, the function continues executing. If an error occurs later, it could try to send a response twice, causing Express errors.

**After:**
```javascript
// For all other webhooks, acknowledge with 204 status
return res.status(204).send();  // ✅ Explicit return
```

---

### Bug #3: Missing Correlation ID in Error Handler

**Location:** `src/middlewares/errorHandler.js:51`

**Before:**
```javascript
// Send error response
sendError(res, message, statusCode, details);  // ❌ No correlationId
```

**After:**
```javascript
// Send error response with correlation ID for tracking
sendError(res, message, statusCode, details, req.correlationId);  // ✅ Include correlationId
```

---

## ✅ FIXES IMPLEMENTED

### 1. Safe Error Serialization

```javascript
// Extract only serializable properties
const errorDetails = error.message || error.toString();
```

**Benefit:** Prevents circular JSON serialization errors

---

### 2. Explicit Return Statements

```javascript
return res.status(204).send();
return sendError(res, 'Failed...', 500, errorDetails, correlationId);
```

**Benefit:** Prevents double response sending

---

### 3. Correlation ID Propagation

```javascript
sendError(res, message, statusCode, details, req.correlationId);
```

**Benefit:** Better error tracking and debugging

---

### 4. Updated Test Expectations

Updated 11 test cases in `errorHandler.test.js` to expect the new 5-parameter signature:

```javascript
// Before:
expect(sendError).toHaveBeenCalledWith(mockRes, 'Validation Error', 400, { field: 'required' });

// After:
expect(sendError).toHaveBeenCalledWith(mockRes, 'Validation Error', 400, { field: 'required' }, 'test-correlation-id');
```

**Result:** All 509 tests passing ✅

---

## 📈 BONUS IMPROVEMENTS (Deployed Together)

While fixing the critical bug, we also deployed several code quality improvements:

1. **Test File Renaming** - Removed `.basic` suffix from test files for consistency
2. **Package.json Documentation** - Added explanation for OpenTelemetry override
3. **Error Codes System** - Created `errorCodes.js` with 40+ standardized error codes

These improvements were low-risk and fully tested (509/509 tests passing).

---

## 🧪 VALIDATION

### Test Results

```bash
Test Suites: 36 passed, 36 total
Tests:       6 skipped, 509 passed, 515 total
Snapshots:   0 total
Time:        4.617 s
```

### Deployment

```bash
commit 63b1e938
Author: Nicolas dos Santos
Date:   2025-10-20 17:30 UTC

fix: Prevent circular JSON error and webhook retry storm
```

### Expected Production Behavior

After deployment, Retell webhooks should:

1. ✅ Return proper JSON responses (no circular references)
2. ✅ Respond with 200/204 on success (no retries)
3. ✅ Include correlation IDs in all error responses
4. ✅ Log errors safely without circular references

---

## 📋 MONITORING CHECKLIST

Monitor these Azure Application Insights queries for 1 hour after deployment:

### 1. Webhook Success Rate
```kql
requests
| where timestamp > ago(1h)
| where url contains "/api/webhooks/retell"
| summarize 
    Total = count(),
    Success = countif(resultCode == 200 or resultCode == 204),
    Errors = countif(resultCode >= 400)
| extend SuccessRate = (Success * 100.0) / Total
```

**Expected:** Success rate > 95%

---

### 2. Circular JSON Errors
```kql
traces
| where timestamp > ago(1h)
| where message contains "circular"
| count
```

**Expected:** 0 occurrences

---

### 3. Webhook Retry Count
```kql
requests
| where timestamp > ago(1h)
| where url contains "/api/webhooks/retell"
| summarize Count = count() by bin(timestamp, 1m)
| render timechart
```

**Expected:** Steady rate, no spikes (spikes = retry storms)

---

### 4. Error Response Format
```kql
requests
| where timestamp > ago(1h)
| where url contains "/api/webhooks/retell"
| where resultCode >= 400
| project timestamp, resultCode, customDimensions
| take 10
```

**Expected:** All errors have `correlation_id` field

---

## 🚀 DEPLOYMENT TIMELINE

| Time | Event |
|------|-------|
| 17:25 UTC | Issue discovered in production logs |
| 17:30 UTC | Root cause identified (circular JSON + missing return) |
| 17:35 UTC | Fixes implemented and tested locally |
| 17:40 UTC | All 509 tests passing |
| 17:45 UTC | Committed to `code-quality-improvements` branch |
| 17:50 UTC | Merged to `main` |
| 17:51 UTC | Pushed to GitHub (commit `63b1e938`) |
| 17:52 UTC | Azure deployment triggered |
| 17:55 UTC | **Deployment complete** ✅ |

---

## 📚 LESSONS LEARNED

### 1. Always Return After Sending Response
```javascript
// ❌ BAD
res.status(200).json({ success: true });

// ✅ GOOD
return res.status(200).json({ success: true });
```

### 2. Never Pass Error Objects Directly
```javascript
// ❌ BAD - Can contain circular references
sendError(res, 'Failed', 500, error);

// ✅ GOOD - Extract serializable properties
sendError(res, 'Failed', 500, error.message || error.toString());
```

### 3. Always Include Correlation IDs
```javascript
// ❌ BAD
sendError(res, 'Failed', 500, details);

// ✅ GOOD
sendError(res, 'Failed', 500, details, req.correlationId);
```

### 4. Test Error Paths Thoroughly
- Ensure error handlers are tested with various error types
- Include tests for missing/undefined properties
- Verify response format matches expectations

---

## 🔗 RELATED DOCUMENTS

- [HOTFIX_WEBHOOK_SCOPING.md](./HOTFIX_WEBHOOK_SCOPING.md) - Previous webhook hotfix (webhookData scoping)
- [CODE_QUALITY_IMPROVEMENTS.md](./CODE_QUALITY_IMPROVEMENTS.md) - Full improvement guide
- [IMPLEMENTATION_PRIORITY_PLAN.md](./IMPLEMENTATION_PRIORITY_PLAN.md) - Remaining improvements

---

## 📞 ESCALATION

If issues persist after deployment:

1. Check Azure Application Insights for new errors
2. Review Retell webhook logs in their dashboard
3. Roll back to commit `cf5f2f32` (previous stable version)
4. Investigate with full request/response logging enabled

---

## ✅ SIGN-OFF

- **Developer:** Nicolas dos Santos
- **Tested:** All 509 tests passing
- **Reviewed:** Automated + manual testing
- **Deployed:** 2025-10-20 17:55 UTC
- **Status:** ✅ **PRODUCTION READY**

---

**Next Steps:** Monitor production for 1 hour, then continue with remaining code quality improvements on `code-quality-improvements` branch.
