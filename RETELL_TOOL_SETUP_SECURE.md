# Secure Bearer Token Configuration for Retell Tools

## Overview

Your API now uses the **industry-standard Bearer token** approach for Retell authentication. This is more secure than custom headers because:

1. ✅ Uses standard `Authorization` header (industry best practice)
2. ✅ API keys are automatically redacted from logs
3. ✅ No custom headers needed
4. ✅ Better security framework support

---

## What Changed

### Before (Custom Header - Removed)
```
X-Retell-API-Key: sk-test-abc123
```
- ❌ Custom header visible in logs
- ❌ Non-standard approach
- ❌ API keys exposed in log files

### After (Bearer Token - Secure) ✅
```
Authorization: Bearer sk-test-abc123
```
- ✅ Standard Authorization header
- ✅ Automatically redacted from logs
- ✅ Industry standard practice
- ✅ API keys protected in logs

---

## How to Configure Retell Tools

### For Each of These 5 Tools:
1. availability-get
2. booking-create
3. booking-update
4. booking-cancel
5. customer-info-update

### Steps:

1. **Go to Retell Console**
   - https://retell.cc/dashboard

2. **Select Your Agent**
   - Elite Barbershop (or your agent name)

3. **Navigate to Tools**
   - Click: Settings → Tools

4. **For Each Tool, Click Edit**

5. **Set HTTP Authentication**
   - Find the "HTTP Headers" section
   - **Add a NEW header** (or update existing):
   
   ```
   Header Name:  Authorization
   Header Value: Bearer <RETELL_API_KEY>
   ```

   Where `<RETELL_API_KEY>` is the value from your Azure environment variables.

6. **Delete Old Header (if exists)**
   - Remove any old `X-Retell-API-Key` header
   - This is no longer needed

7. **Save Changes**

---

## Finding Your RETELL_API_KEY Value

Run this command to see the actual value:

```bash
az webapp config appsettings list \
  --resource-group square-middleware-prod-rg \
  --name square-middleware-prod-api | grep RETELL_API_KEY -A 2
```

Output will look like:
```json
{
  "name": "RETELL_API_KEY",
  "value": "your-actual-key-value-here"
}
```

Copy the `value` field and paste it in the Retell tool definition as:
```
Authorization: Bearer your-actual-key-value-here
```

---

## How It Works (Technical)

When Retell calls your API:

```
1. Retell sends HTTP request to: /api/bookings/:bookingId
2. With header: Authorization: Bearer sk-test-abc123

3. Your API receives in agentAuth middleware:
   ├─ Extract Authorization header
   ├─ Check if Bearer token === RETELL_API_KEY env var
   ├─ If YES → Authenticate as Retell agent ✅
   ├─ Create req.tenant with Square credentials
   └─ Proceed to controller

4. Logger redacts sensitive headers:
   ├─ Logs show: Authorization: [REDACTED]
   └─ API key protected from log files ✅
```

---

## Security Benefits

### Logging Protection ✅
```javascript
// BEFORE (Custom Header)
LOG: "X-Retell-Api-Key: sk-test-abc123xyz"  ❌ Exposed!

// AFTER (Bearer Token)
LOG: "Authorization: [REDACTED]"  ✅ Protected!
```

### Standard Practice ✅
- All major APIs use Authorization header
- Framework-level protection available
- Better tooling support
- Easier for other developers to understand

### Compliance ✅
- Follows OWASP guidelines
- Better for SOC2/compliance audits
- Professional security posture

---

## Testing the Configuration

### Test Command

Once you've configured all 5 tools in Retell:

```bash
# Make a test booking call through Retell agent
# Monitor for:
# - No 401 "Missing or invalid Authorization header" errors
# - No 403 "Invalid bearer token" errors
# - See "Booking cancelled successfully" in logs
```

### Expected Logs
```
INFO: HTTP Request 
  method: DELETE
  url: /api/bookings/GKBX6V09Q2T7FA4ZKZMMMC5C3A
  statusCode: 200
  redactedHeaders: ["authorization"]  ← Authorization header redacted
```

---

## Troubleshooting

### Error: 401 "Missing or invalid Authorization header"
**Cause:** Bearer token not in Authorization header
**Fix:** Check Retell tool configuration has `Authorization: Bearer <key>`

### Error: 403 "Invalid bearer token"
**Cause:** Token doesn't match RETELL_API_KEY
**Fix:** Verify you copied the correct value from Azure env vars

### Error: Tool still using old header
**Cause:** Old X-Retell-API-Key header still configured
**Fix:** Remove the old header from Retell tool definition

---

## Code Changes Made

### agentAuth.js (Middleware)
```javascript
// OLD: Checked custom X-Retell-Api-Key header
if (retellApiKey && retellApiKey === process.env.RETELL_API_KEY) { ... }

// NEW: Checks Authorization Bearer token
if (bearerToken === process.env.RETELL_API_KEY) { ... }
```

**Benefits:**
- Standard Authorization header
- Single code path for both Retell and standard auth
- Cleaner, more maintainable

### logger.js (Security)
```javascript
// NEW: Redacts sensitive headers from logs
const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie'];
redactedHeaders.forEach(header => {
  if (req.headers[header]) {
    redactedHeaders[header] = '[REDACTED]';
  }
});
```

**Benefits:**
- API keys never appear in logs
- Automatic protection
- No manual redaction needed

---

## Migration Checklist

- [ ] Run environment variable check to get RETELL_API_KEY value
- [ ] Go to Retell console
- [ ] For each of 5 tools:
  - [ ] Add new header: `Authorization: Bearer <key>`
  - [ ] Remove old header: `X-Retell-API-Key`
  - [ ] Save changes
- [ ] Test with booking-cancel call
- [ ] Verify logs show `Authorization: [REDACTED]`
- [ ] Verify no 401 errors in logs

---

## Reference

- **Modified Files**: 
  - `src/middlewares/agentAuth.js` - Now checks Bearer token
  - `src/utils/logger.js` - Now redacts sensitive headers

- **Documentation**: 
  - `RETELL_TOOL_SETUP_SECURE.md` - This file

- **Next Steps**:
  - After verifying Retell tools, we'll fix Gap 3 (duplicate code path)
  - Then run comprehensive testing

---

**Security Level:** 🟢 **HIGH** - Industry standard approach with automatic log protection
