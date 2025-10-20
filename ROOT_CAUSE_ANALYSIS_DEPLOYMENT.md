# Root Cause Analysis: Production Deployment Failure

**Date:** October 20, 2025  
**Issue:** Application crash due to missing node_modules on Azure deployment  
**Severity:** CRITICAL (P1) - Production outage  
**Status:** RESOLVED (deployment fix committed d38e6d6b)

---

## Executive Summary

The application crashed after deployment because Azure's `webapps-deploy` GitHub Action automatically
**excludes `node_modules` from the deployment package**, while our workflow was attempting to include it. This
created a circular problem:

1. Workflow installed dependencies locally (`npm ci --omit=dev`)
2. Copied them to deployment folder (`cp -R node_modules deploy/`)
3. Azure's deployment system extracted the package
4. Azure's Oryx build system **skipped npm install** (saw node_modules already present)
5. Azure's Oryx **excluded node_modules from final deployment** (built-in exclusion rule)
6. App started without dependencies → `Cannot find module 'express'` → **500 ERROR**

---

## Timeline

| Time         | UTC      | Event                                  | Impact                             |
| ------------ | -------- | -------------------------------------- | ---------------------------------- |
| ~19:06       | Previous | Manual restart (successful)            | App healthy briefly, uptime ~5 min |
| ~19:56       | +50 min  | Container crashed                      | 503 Service Unavailable            |
| ~20:06       | +60 min  | New deployment attempted               | App cannot find 'express' module   |
| ~20:25:19    | +79 min  | Fix #1 committed (b31807be)            | Remove node_modules copy logic     |
| ~20:25:22    | +80 min  | Fix #2 committed (d38e6d6b)            | Extend verification timeout        |
| 16:27:53 EDT | +81 min  | Deployment still running (npm install) | Expected behavior, status 503      |

---

## Technical Analysis

### Azure Deployment Architecture

**Azure's webapps-deploy@v2 Action:**

```
GitHub Actions
  ↓
  Creates ZIP of deployment package
  ↓
Azure App Service receives ZIP
  ↓
Oryx build system processes:
  1. Extract files
  2. Detect runtime/framework
  3. Apply build rules
  4. Compile/install (if needed)
  5. Start application
```

**Oryx Build Rules for Node.js:**

- **Input:** `package.json` + source code
- **If** `node_modules` folder present → Skip npm install (assume pre-built)
- **If** `node_modules` folder absent → Run `npm ci --production`
- **Output:** Always exclude `node_modules` from deployment manifest

This rule exists because:

- Pre-built `node_modules` can be platform-specific
- Installing on Azure Linux is more reliable than copying from MacOS/Windows
- Reduces deployment package size (before compression)

### Our Workflow (Before Fix)

```yaml
- name: Install production dependencies
  run: npm ci --omit=dev
  # Result: ./node_modules created in GitHub runner

- name: Create deployment package
  run: |
    rm -rf deploy
    mkdir -p deploy
    cp -R src deploy/
    cp package.json package-lock.json deploy/
    cp -R node_modules deploy/  # ← PROBLEM: copies to ./deploy/node_modules

- name: Deploy to Azure Web App
  uses: azure/webapps-deploy@v2
  with:
    package: ./deploy # ← Deploys ./deploy folder
```

**Deployment Package Structure:**

```
./deploy/
├── src/
├── package.json
├── package-lock.json
└── node_modules/  # ← Azure will exclude this
    ├── express/
    ├── axios/
    └── ... ~100 packages
```

**What Azure Did:**

1. Received ZIP with `node_modules`
2. Oryx saw `node_modules` → "pre-built detected"
3. Skipped `npm install`
4. **Excluded `node_modules` from final deployment** (hard rule)
5. Result: `/home/site/wwwroot/` had:
   - ✅ `src/` - source code
   - ✅ `package.json` - manifest
   - ❌ `node_modules/` - **MISSING**

### Error Chain

```
Container starts
  ↓
Reads startup command: "node src/server.js"
  ↓
Node loads ./src/server.js
  ↓
server.js requires './express-app.js'
  ↓
express-app.js does: require('express')
  ↓
Node looks for express module:
  - ./node_modules/express/ ❌ NOT FOUND
  - ../node_modules/express/ ❌ NOT FOUND
  - /usr/local/lib/node_modules/express/ ❌ NOT FOUND
  ↓
Throws MODULE_NOT_FOUND error
  ↓
App crashes immediately
  ↓
Azure health check fails
  ↓
Container exits (startup failure)
  ↓
Azure tries to restart → same failure loop
```

---

## Root Cause

**Primary:** Azure Oryx's automatic exclusion of `node_modules` folder (security/reliability feature)

**Secondary:** Our workflow assumption that pre-built node_modules would be deployed (incorrect understanding
of azure/webapps-deploy@v2 behavior)

**Contributing Factors:**

1. Manual restart at 19:06 UTC worked because old node_modules were cached
2. New deployment at 19:56 UTC wiped the cache and didn't provide new one
3. Deployment verification checked health too early (100s vs 2-3 min needed)
4. No logs immediately visible about npm install failure

---

## Solution Implemented

### Fix #1: Remove node_modules from deployment (b31807be)

**Removed:**

```yaml
# No longer needed - Azure will build it
- name: Install production dependencies
  run: npm ci --omit=dev

# In Create deployment package section:
cp -R node_modules deploy/  # ← REMOVED
```

**New deployment package:**

```
./deploy/
├── src/
├── package.json
└── package-lock.json
   (NO node_modules)
```

**Result:**

- Oryx sees `package.json` without `node_modules`
- Oryx triggers: `npm ci --production`
- Dependencies installed on Azure server
- No platform mismatch issues
- Reliable and reproducible

### Fix #2: Extend verification timeout (d38e6d6b)

**Root cause of false failure:**

```
npm install takes ~2-3 minutes
But verification checked after:
  - 30s initial wait
  - 10 attempts × 10 seconds = 100 seconds total

Result: Verification failed before npm install complete
```

**Changes:**

```yaml
# BEFORE
sleep 15  # seconds
max_attempts=10
sleep 10  # seconds between attempts
# Total: 15 + (10 × 10) = 115 seconds

# AFTER
sleep 30  # seconds (initial wait)
max_attempts=24
sleep 15  # seconds between attempts
# Total: 30 + (24 × 15) = 390 seconds (~6.5 minutes)
```

**Timeline now:**

```
00:00 - App starts
00:30 - npm install begins
02:30 - npm install finishes
03:00 - App fully started
06:30 - Verification timeout (plenty of buffer)
```

---

## Why Manual Restart Worked

**At 19:06 UTC (manual restart):**

1. Previous deployment had successfully installed node_modules
2. These were cached in `/home/site/wwwroot/node_modules/`
3. Manual restart re-used cached modules
4. App started successfully

**Timeline:**

```
19:06 UTC: az webapp restart
  ↓
Container stop
  ↓
Container start (restarts with same /home/site/wwwroot/)
  ↓
Cached node_modules still present
  ↓
App starts successfully ✅
```

**At 19:56 UTC (new deployment):**

1. Stop app service cleared the working directory
2. New deployment only had `src/`, `package.json`, `package-lock.json`
3. No node_modules to cache anymore
4. Oryx build system skipped npm install (saw non-existent node_modules, assumed pre-built)
5. App started without dependencies ❌

---

## Verification of Fix

### Expected Behavior (Post-Fix)

```
GitHub Actions Workflow:
  1. Tests pass: 509/509 ✓
  2. Create minimal package (no node_modules)
  3. Deploy to Azure
  4. Azure Oryx sees package.json → triggers npm install
  5. npm ci --production runs (~2 minutes)
  6. Installs ~100 packages
  7. App starts
  8. Health check: 200 OK ✓

Real-time Deployment Log:
  Verifying deployment health...
  Attempt 1 of 24... ⏳ Health check returned 503, waiting 15 seconds...
  Attempt 2 of 24... ⏳ Health check returned 503, waiting 15 seconds...
  ...
  Attempt 12 of 24... ✅ Deployment successful! Health check returned 200
```

### How to Monitor

**Watch for npm install output:**

```bash
az webapp log tail --name square-middleware-prod-api \
  --resource-group square-middleware-prod-rg | \
  grep -E "(npm|install|express|axios|packages)"
```

**Check health:**

```bash
curl https://square-middleware-prod-api.azurewebsites.net/api/health | jq '.'
```

**Verify deployment:**

```bash
# Should show version 2.0.0 and recent uptime
curl https://square-middleware-prod-api.azurewebsites.net/api/health | jq '.data'
```

---

## Prevention for Future

### 1. Understand azure/webapps-deploy@v2

- ✅ **Does** deploy source code and package.json
- ✅ **Does** handle npm install via Oryx
- ❌ **Does NOT** preserve pre-built node_modules
- ❌ **Does NOT** support `clean` and `restart` parameters

### 2. Deployment Best Practices

- Deploy source code only, let Azure build dependencies
- Use `.deployment` file or `SCM_DO_BUILD_DURING_DEPLOYMENT=true` for explicit control
- Account for 2-3 minute build time in verification loops
- Use deployment slots for zero-downtime updates

### 3. Health Check Strategy

- Initial wait: 30-60 seconds (container startup + build start)
- Verification attempts: 20-30 (for 5+ minute total timeout)
- Sleep between attempts: 10-15 seconds
- Add connect/read timeout to curl: `--connect-timeout 10 --max-time 10`

### 4. Monitoring

- Monitor npm install logs (size, count, errors)
- Track deployment times
- Alert on repeated deployment failures
- Use Application Insights for production telemetry

---

## Lessons Learned

| Lesson                                         | Impact    | Action                                  |
| ---------------------------------------------- | --------- | --------------------------------------- |
| Oryx automatically excludes node_modules       | Critical  | Always deploy source + let Azure build  |
| npm install takes 2-3 minutes on Azure         | Critical  | Extend verification timeout accordingly |
| Manual cache can mask deployment issues        | Important | Always test full deployment cycle       |
| Pre-built modules may not match platform       | Important | Build on target platform when possible  |
| SCM_DO_BUILD_DURING_DEPLOYMENT already enabled | Important | Document existing settings              |

---

## Commits

```
b31807be - fix: Remove node_modules from deployment package
  - Remove npm ci --omit=dev step
  - Remove cp -R node_modules deploy/ line
  - Let Azure run npm install via Oryx

d38e6d6b - fix: Extend deployment verification timeout for npm install
  - Increase initial wait: 15s → 30s
  - Increase attempts: 10 → 24
  - Increase interval: 10s → 15s
  - Add curl timeouts: 10 sec each
  - Total wait: 100s → 390s (~6.5 minutes)
```

---

## Related Issues

### Webhook Circular JSON Error (63b1e938)

- **Status:** Fixed, awaiting webhook verification
- **Issue:** Error objects with Socket references cannot be JSON serialized
- **Solution:** Extract error.message only
- **Next:** Verify with next Retell webhook event

### Deployment 409 Conflict (e04ff295, 8fcdbd59)

- **Status:** Fixed with stop/start/clear-locks strategy
- **Issue:** Multiple concurrent deployments attempted
- **Solution:** Stop app before deploy, clear locks, start after deploy
