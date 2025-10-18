# Quick Deployment Reference

## Before Every Commit

```bash
npm run precommit
```

Runs: format → lint → test (all must pass)

## After Pushing to Main

**Deployment Timeline:**

- GitHub Actions starts: ~30 seconds
- Build & deploy: ~8 minutes total
- Health check ready: ~9 minutes after push

**Check deployment status:**

1. **GitHub Actions** (real-time):

   ```
   https://github.com/nicolasdossantos/squareMiddleware/actions
   ```

2. **Azure Health Check** (after 8-9 minutes):

   ```bash
   ./monitor-azure-health.sh
   ```

3. **Azure Logs** (if issues):
   ```bash
   az webapp log tail --name square-middleware-prod-api \
     --resource-group square-middleware-prod-rg
   ```

## Deployment Fix Summary

**What was fixed:**

1. ❌ **BEFORE**: Zipping 200MB+ with node_modules → 504 timeout
2. ✅ **AFTER**: Zipping ~500KB (src + package files only) → completes successfully

**Key change:**

- Removed `npm ci --omit=dev` from deployment workflow
- Azure installs node_modules from package.json automatically
- Deployment zip is now 400x smaller

## Expected Results

After ~8 minutes:

- ✅ App responds at `/api/health`
- ✅ HTTP 200 status
- ✅ Response time <100ms
- ✅ Uptime increasing (not resetting)

## Troubleshooting

**If deployment fails:**

1. Check GitHub Actions for errors
2. Check Azure logs for startup errors
3. Verify environment variables are set in Azure

**If app keeps restarting:**

- Check logs for crashes
- Verify health check is working
- Ensure "Always On" is enabled

---

**Latest commit:** `dcded279` - Removed node_modules from deployment zip

**Next check:** Wait 8 minutes from last push, then run `./monitor-azure-health.sh`
