# Deployment Checklist

## ⚠️ ALWAYS RUN BEFORE COMMITTING

```bash
npm run precommit
```

This runs:

1. ✅ `npm run format` - Auto-format code with Prettier
2. ✅ `npm run lint` - Check code quality with ESLint
3. ✅ `npm test` - Run all 509 tests

**OR use the script:**

```bash
./pre-commit-checks.sh
```

## Why This Matters

- **Prevents deployment failures** - GitHub Actions will reject builds with failing tests
- **Maintains code quality** - Ensures consistent formatting and no linting errors
- **Saves time** - Catches issues locally before pushing to Azure
- **Protects production** - Azure won't restart your app due to test failures

## GitHub Actions Workflow

When you push to `main`, GitHub Actions automatically:

1. Checks out code
2. Installs dependencies
3. Runs `npm test` ⚠️ **MUST PASS**
4. Builds deployment package
5. Deploys to Azure

**If tests fail, deployment is blocked!**

## Quick Reference

| Command                     | Purpose            | When to Use           |
| --------------------------- | ------------------ | --------------------- |
| `npm run precommit`         | Run all checks     | Before every commit   |
| `npm run format`            | Format code        | Fix formatting issues |
| `npm run lint`              | Check code quality | Find linting errors   |
| `npm test`                  | Run tests          | Verify functionality  |
| `npm run test:watch`        | Watch mode tests   | During development    |
| `./monitor-azure-health.sh` | Check Azure health | After deployment      |

## Monitoring Deployment

After pushing to GitHub:

```bash
# Wait 3-5 minutes for deployment, then:
./monitor-azure-health.sh
```

Expected output:

- ✅ App is responding (HTTP 200)
- ⏱️ Current Uptime: increasing (not resetting)
- Response time: <100ms

## If Deployment Fails

1. **Check GitHub Actions:**

   - Go to: https://github.com/nicolasdossantos/squareMiddleware/actions
   - Look for failed workflow runs
   - Read error messages

2. **Fix locally:**

   ```bash
   npm run precommit  # Find and fix issues
   git add -A
   git commit -m "Fix: [description]"
   git push
   ```

3. **Check Azure logs:**
   ```bash
   az webapp log tail --name square-middleware-prod-api \
     --resource-group square-middleware-prod-rg
   ```

## Commit Message Format

Good commit messages:

```
Fix: Optimize health check for Azure stability
Add: Pre-commit checks script
Update: Customer search endpoint validation
```

Bad commit messages:

```
fixed stuff
updates
asdf
```

## Environment Variables

Before first deployment, ensure these are set in Azure:

- `AGENT_CONFIGS` - Multi-tenant configuration JSON
- `EMAIL_TO` - Email recipient for notifications
- `EMAIL_SMTP_*` - SMTP configuration
- Square API credentials per tenant

See: `AZURE_ENVIRONMENT_VARIABLES.md` for complete list

---

## TL;DR

**Before EVERY commit:**

```bash
npm run precommit
```

**After EVERY push:**

```bash
./monitor-azure-health.sh
```

**That's it! 🚀**
