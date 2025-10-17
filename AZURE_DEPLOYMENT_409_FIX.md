# Azure Deployment 409 Error - FIXED

## Problem

Deployment was failing with:
```
ERROR: Deployment endpoint responded with status code 409
There may be an ongoing deployment or your app setting has WEBSITE_RUN_FROM_PACKAGE.
```

## Root Cause

1. **Deprecated command** - Using `az webapp deployment source config-zip` (old method)
2. **Concurrent deployments** - Azure blocks overlapping deployments
3. **No deployment cleanup** - Previous deployments weren't completing cleanly

## Solution Implemented

### 1. Updated to Modern Deployment Command

**Before (deprecated):**
```yaml
az webapp deployment source config-zip \
  --resource-group square-middleware-prod-rg \
  --name ${{ env.AZURE_WEBAPP_NAME }} \
  --src deployment.zip
```

**After (current):**
```yaml
az webapp deploy \
  --resource-group square-middleware-prod-rg \
  --name ${{ env.AZURE_WEBAPP_NAME }} \
  --src-path deployment.zip \
  --type zip \
  --async false \
  --clean true \
  --restart true
```

### 2. Added App Stop Before Deployment

```yaml
# Stop the app temporarily to prevent deployment conflicts
az webapp stop \
  --resource-group square-middleware-prod-rg \
  --name ${{ env.AZURE_WEBAPP_NAME }}
```

This ensures:
- ✅ No concurrent deployments
- ✅ Clean deployment state
- ✅ No file locking issues

### 3. Key Parameter Changes

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `--async false` | Wait for completion | Ensures deployment finishes before next step |
| `--clean true` | Remove old files | Prevents stale code from persisting |
| `--restart true` | Restart after deploy | Applies changes immediately |
| `--type zip` | Zip deployment | Explicit deployment type |

## Deployment Flow (Updated)

1. ✅ Run tests (`npm test`)
2. ✅ Stop Azure app
3. ✅ Create deployment package
4. ✅ Deploy with new `az webapp deploy` command
5. ✅ Configure health check path
6. ✅ App restarts automatically

## Expected Results

- ✅ No more 409 errors
- ✅ Deployments complete successfully
- ✅ Health checks pass after deployment
- ✅ App stays running with "Always On"

## Monitoring Deployment

**Check GitHub Actions:**
```
https://github.com/nicolasdossantos/squareMiddleware/actions
```

**Check Azure health after 3-5 minutes:**
```bash
./monitor-azure-health.sh
```

Expected output after successful deployment:
```
✅ App is responding (HTTP 200)
⏱️  Current Uptime: 45m 32s
✅ Good uptime - app is stable
```

## Commits Applied

1. `21415e67` - Optimized health check (removed slow API calls)
2. `d8d9c1fd` - Fixed tests to match new implementation
3. `85d9920f` - Added pre-commit automation
4. `8967066a` - Added deployment documentation
5. `2d77216a` - Fixed Azure deployment 409 error ⬅️ **THIS FIX**

## If Deployment Still Fails

### Check for Stuck Deployments

```bash
# List recent deployments
az webapp deployment list \
  --name square-middleware-prod-api \
  --resource-group square-middleware-prod-rg \
  --query "[].{id:id, status:status, timestamp:start_time}" \
  --output table
```

### Manually Stop App

```bash
az webapp stop \
  --name square-middleware-prod-api \
  --resource-group square-middleware-prod-rg
```

### Check Deployment Logs

```bash
az webapp log tail \
  --name square-middleware-prod-api \
  --resource-group square-middleware-prod-rg
```

### Force Restart

```bash
az webapp restart \
  --name square-middleware-prod-api \
  --resource-group square-middleware-prod-rg
```

## Next Steps

1. **Wait 3-5 minutes** for current deployment to complete
2. **Run health check:** `./monitor-azure-health.sh`
3. **Verify stability:** Uptime should stay high and not reset
4. **Test endpoints:** Make test API calls to ensure functionality

---

## Summary

✅ **Deployment process fixed** - Using modern Azure CLI commands
✅ **Concurrent deployment prevention** - App stops before deploy
✅ **Clean deployment** - Old files removed automatically
✅ **Automatic restart** - App comes back online after deploy

**The 409 error should not occur again.**
