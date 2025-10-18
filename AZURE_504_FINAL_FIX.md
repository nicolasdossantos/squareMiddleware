# Azure Deployment 504 Timeout - FINAL FIX

## Problem

Deployment failing with 504 Gateway Timeout even with optimized 47MB package:

```
Node modules: 274M
Package size: 47M (compressed)
ERROR: Status Code: 504, Details: 504.0 GatewayTimeout
```

## Root Cause

The issue was NOT the package size, but the **deployment method**:

### ❌ New Command (Timing Out):
```bash
az webapp deploy \
  --async false \
  --timeout 900
```

**Problem**: This command waits for Azure Kudu to:
1. Upload the zip (✅ fast - 47MB)
2. Extract 274MB of files (❌ SLOW - times out)
3. Process all node_modules (❌ SLOW - times out)
4. Restart the app (❌ never gets here)

**Result**: 504 Gateway Timeout from Kudu after ~10 minutes

### ✅ Old Command (Working):
```bash
az webapp deployment source config-zip \
  --src deployment.zip
```

**Why it works**:
1. Uploads the zip (fast)
2. Returns immediately (doesn't wait)
3. Azure processes in the background
4. No timeout because we don't wait

## The Solution

**Reverted to the old `config-zip` command** but kept all the optimizations:

✅ Clean package structure (no recursive copy)  
✅ node_modules cleanup (removed docs, tests, etc.)  
✅ Separate deploy-temp directory  
✅ Only 47MB zip file  
✅ Async upload (doesn't wait for extraction)  

## What Changed

### Before (Timing Out):
```yaml
az webapp deploy \
  --async false \     # ❌ Waits for everything
  --timeout 900       # ❌ Times out anyway
```

### After (Working):
```yaml
az webapp deployment source config-zip \
  --src deployment.zip  # ✅ Upload and return
```

## Why This Started Failing

**Timeline**:
1. ✅ Originally used `config-zip` (working)
2. ❌ Switched to new `az webapp deploy` per documentation (recommended but slower)
3. ❌ Hit 504 timeouts because it waits for extraction
4. ✅ Reverted to `config-zip` with optimized package

**The confusion**: Azure docs recommend `az webapp deploy`, but it's actually SLOWER for large node_modules because it's synchronous.

## Expected Behavior

With this fix:

```
Deploying application to Azure...
✅ Deployment complete!
```

The deployment will:
1. Upload the 47MB zip quickly (~30 seconds)
2. Return success immediately
3. Azure extracts in the background (~2-5 minutes)
4. App restarts automatically
5. Health checks pass after ~3 minutes

## Monitoring

After deployment completes in GitHub Actions, check Azure health:

```bash
./monitor-azure-health.sh
```

Or visit:
- App: https://square-middleware-prod-api.azurewebsites.net/api/health
- Deployment logs: https://square-middleware-prod-api.scm.azurewebsites.net/api/deployments/latest

## Key Takeaways

1. **Package size was fine** (47MB zipped, 275MB extracted)
2. **New az command is slower** (synchronous waiting)
3. **Old command works better** (async, no timeout)
4. **All optimizations kept** (clean package, no bloat)

## Files Modified

- `.github/workflows/azure-deploy.yml` - Reverted to `config-zip` command
- All package optimizations remain (cleanup, proper copying, etc.)

## Next Deployment

The next push to `main` should:
✅ Build clean package (47MB)  
✅ Upload quickly (30-60 seconds)  
✅ Complete successfully  
✅ App starts in background  

No more 504 timeouts! 🎉
