# Deployment Fixes Summary - October 20, 2025

## Critical Issues Fixed

### Issue 1: Missing node_modules on Deployment (Commit b31807be)

**Problem:**
- App was crashing with `Error: Cannot find module 'express'`
- Root cause: `azure/webapps-deploy@v2` automatically excludes `node_modules` from deployment
- Workflow was copying `node_modules` to deploy folder, but Azure Oryx build system saw them and skipped `npm install`, then excluded them from final deployment

**Timeline:**
- 19:06 UTC: Manual restart worked (old node_modules still present from previous deployment)
- 19:56 UTC: New deployment started, wiped files including node_modules
- 20:06 UTC: Deployment completed but app crashed (no node_modules to require dependencies)

**Solution:**
1. Removed `npm ci --omit=dev` step from workflow
2. Removed `cp -R node_modules deploy/` from package creation
3. Let Azure's Oryx build system handle `npm install --production` on server
4. `SCM_DO_BUILD_DURING_DEPLOYMENT=true` already configured in Azure

**Changes:**
```yaml
# REMOVED:
- name: Install production dependencies
  run: npm ci --omit=dev

# REMOVED from Create deployment package:
cp -R node_modules deploy/

# NOW: Only deploy source code
- src/
- package.json
- package-lock.json
```

**Result:** Azure will now run `npm install` during deployment using Oryx build system.

---

### Issue 2: Deployment Verification Timeout Too Short (Commit d38e6d6b)

**Problem:**
- Workflow verification was timing out at 100 seconds
- npm install + app startup takes 2-3 minutes on Azure's container
- Health check was failing 10 times at 10-second intervals, then exiting

**Solution:**
1. Increased initial wait from 15s to 30s (let npm install start)
2. Increased verification attempts from 10 to 24 (360 seconds total)
3. Increased wait between attempts from 10s to 15s
4. Added timeout to curl commands (10s connect + read timeout)

**Changes:**
```yaml
# BEFORE: Total ~100 seconds
max_attempts=10
sleep 10  # between attempts
sleep 15  # initial wait

# AFTER: Total ~360 seconds (~6 minutes)
max_attempts=24
sleep 15  # between attempts
sleep 30  # initial wait
curl --connect-timeout 10 --max-time 10
```

**Result:** Deployment will now wait up to 6 minutes for npm install and app startup.

---

## Deployment Flow (Current - After Fixes)

```
1. GitHub Actions triggers on push to main
2. Test suite runs (509 tests)
3. Create minimal deployment package:
   ├── deploy/src/
   ├── deploy/package.json
   ├── deploy/package-lock.json
   └── (NO node_modules)
4. Stop Azure App Service
5. Deploy via azure/webapps-deploy@v2
6. Azure's Oryx build system:
   ├── Detects package.json without node_modules
   ├── Runs `npm ci --production`
   └── Installs ~100 dependencies (~2-3 minutes)
7. Start Azure App Service
8. Health check verification (24 attempts × 15 seconds = 360 seconds max)
9. Success → Deployment complete
```

---

## Related Production Fixes (Previous Session)

### Circular JSON Serialization Fix (Commit 63b1e938)
**Issue:** Webhook error responses were serializing entire error object including Socket references
**Fix:** Extract only `error.message || error.toString()` before sending
**File:** `src/controllers/retellWebhookController.js` line 299
**Impact:** All webhook types (call_inbound, call_started, call_ended, call_analyzed) now return proper JSON

### Correlations ID Tracking (Commit 63b1e938)
**Issue:** Error responses missing tracking correlation ID
**Fix:** Added `req.correlationId` as 5th parameter to all `sendError()` calls
**File:** `src/middlewares/errorHandler.js` line 51
**Impact:** Better error tracking in Application Insights

---

## Current Status

| Item | Status | Details |
|------|--------|---------|
| Test Suite | ✅ 509/509 | All passing |
| Webhook Fix | ✅ Deployed | Circular JSON fixed (commit 63b1e938) |
| Deployment Package | ✅ Fixed | node_modules removed (commit b31807be) |
| Verification Timeout | ✅ Fixed | Extended to 6 minutes (commit d38e6d6b) |
| Deployment Running | 🔄 In Progress | Waiting for verification step |

---

## Monitoring

Watch for:
1. **npm install completion** - Look for successful dependency installation in logs
2. **App startup** - Health endpoint should respond with 200 OK
3. **Webhook success** - Next Retell webhook should work without circular JSON errors
4. **Performance** - Monitor response times in Application Insights

---

## Future Improvements

1. **Skip stop/start** - Azure has built-in swap slots for zero-downtime
2. **Pre-build artifacts** - Use GitHub Actions to create pre-built ZIP with dependencies (if needed)
3. **Deployment slots** - Use staging slot, verify, then swap to production
4. **Custom Oryx configuration** - Create `.oryx-config.yaml` for fine-tuned build
5. **Application Insights integration** - Automatic tracing of deployment and build performance

---

## Related Tasks (From Code Quality Queue)

- [ ] Consolidate duplicate webhook services (comprehensiveWebhookService + webhookService)
- [ ] Split 1,494-line bookingController.js into 5 modules
- [ ] Split 1,145-line squareUtils.js into 3 modules
- [ ] Add circuit breaker pattern to Square API calls
- [ ] Deploy KQL monitoring queries to Application Insights
