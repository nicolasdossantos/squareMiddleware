# Azure Deployment Guide - Square Middleware API

Complete step-by-step guide to deploy your Square Middleware API to Azure with security built-in.

---

## 🎯 Overview

This guide will help you:
1. Create a new Azure infrastructure (Resource Group, App Service, Key Vault)
2. Configure security (Managed Identity, IP restrictions)
3. Deploy your application code
4. Test the deployment
5. Migrate from old infrastructure (optional)

**Total Cost: ~$14/month**

---

## 📋 Prerequisites

### 1. Azure CLI Installed
```bash
# Check if installed
az --version

# If not installed, install from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
```

### 2. Logged into Azure
```bash
# Login
az login

# Verify subscription
az account show
```

### 3. Required Information
- [ ] Retell API Key (for signature verification)
- [ ] Retell Agent IDs
- [ ] Square Access Tokens (per agent)
- [ ] Square Location IDs (per agent)
- [ ] Retell webhook IP addresses

---

## 🚀 Deployment Steps

### Step 1: Create Azure Infrastructure (~5 minutes)

This creates all Azure resources with security built-in.

```bash
# Make script executable
chmod +x deploy/azure-deploy.sh

# Run deployment
./deploy/azure-deploy.sh
```

**What this creates:**
- ✅ Resource Group: `square-middleware-prod-rg`
- ✅ App Service Plan: `square-middleware-prod-app-plan` (B1 tier)
- ✅ App Service: `square-middleware-prod-api`
- ✅ Managed Identity: Auto-enabled on App Service
- ✅ Key Vault: `square-middleware-kv`
- ✅ Application Insights: `square-middleware-prod-insights`

**Output:** `deploy/deployment-info.json` with all resource details

---

### Step 2: Store Secrets in Key Vault (~5 minutes)

Store your Retell API key and agent configurations securely.

```bash
# Make script executable
chmod +x deploy/store-secrets.sh

# Run secret storage
./deploy/store-secrets.sh
```

**You'll be prompted for:**
1. Retell API Key
2. For each agent:
   - Agent ID
   - Square Access Token
   - Square Location ID
   - Square Environment (sandbox/production)
   - Timezone

**Output:** 
- Secrets stored in Key Vault
- `deploy/agent-tokens.txt` with Bearer tokens for Retell configuration

⚠️ **IMPORTANT:** Save the Bearer tokens - you'll need them in Retell webhook config!

---

### Step 3: Deploy Application Code (~10 minutes)

#### Option A: Deploy from Local Git

```bash
# Configure deployment source
az webapp deployment source config-local-git \
  --name square-middleware-prod-api \
  --resource-group square-middleware-prod-rg

# Get deployment URL
GIT_URL=$(az webapp deployment source show \
  --name square-middleware-prod-api \
  --resource-group square-middleware-prod-rg \
  --query url -o tsv)

# Add Azure remote
git remote add azure $GIT_URL

# Deploy current branch
git push azure square-middleware:master
```

#### Option B: Deploy from GitHub

```bash
# Connect to GitHub repo
az webapp deployment source config \
  --name square-middleware-prod-api \
  --resource-group square-middleware-prod-rg \
  --repo-url https://github.com/nicolasdossantos/barberboutique \
  --branch square-middleware \
  --git-token <YOUR_GITHUB_TOKEN>
```

#### Option C: Deploy ZIP file

```bash
# Create deployment package (exclude node_modules, tests, docs)
zip -r deploy.zip . -x "node_modules/*" "tests/*" "docs/*" ".git/*"

# Deploy
az webapp deployment source config-zip \
  --resource-group square-middleware-prod-rg \
  --name square-middleware-prod-api \
  --src deploy.zip
```

---

### Step 4: Configure IP Restrictions (~5 minutes)

Restrict access to only Retell webhook IPs.

```bash
# Make script executable
chmod +x deploy/configure-ip-restrictions.sh

# Run IP configuration
./deploy/configure-ip-restrictions.sh
```

**You'll be prompted for:**
- Retell webhook IP addresses (get from Retell docs/support)
- Whether to allow your current IP (for testing)

---

### Step 5: Verify Deployment (~5 minutes)

#### 5.1 Check App Service Status
```bash
az webapp show \
  --name square-middleware-prod-api \
  --resource-group square-middleware-prod-rg \
  --query "{State: state, HostNames: defaultHostName}" \
  -o table
```

#### 5.2 Test Health Endpoint
```bash
# Test health endpoint
curl https://square-middleware-prod-api.azurewebsites.net/health

# Expected response:
# {"status":"ok"}
```

#### 5.3 View Application Logs
```bash
# Stream logs
az webapp log tail \
  --name square-middleware-prod-api \
  --resource-group square-middleware-prod-rg
```

#### 5.4 Test Protected Endpoint (requires auth)

Generate a test signature:
```bash
# Use the test-signature.js script (see below)
node deploy/test-signature.js
```

Then test with curl:
```bash
curl -X POST https://square-middleware-prod-api.azurewebsites.net/api/webhooks/retell/call-started \
  -H "Content-Type: application/json" \
  -H "x-retell-signature: <GENERATED_SIGNATURE>" \
  -H "x-retell-timestamp: <TIMESTAMP>" \
  -H "Authorization: Bearer <AGENT_BEARER_TOKEN>" \
  -H "x-agent-id: <AGENT_ID>" \
  -d '{"agentId":"agent123","callId":"test123"}'
```

---

## 🔧 Post-Deployment Configuration

### Configure Retell Webhooks

In your Retell dashboard, configure webhooks to point to:

**Webhook URL:**
```
https://square-middleware-prod-api.azurewebsites.net/api/webhooks/retell/call-started
```

**Required Headers:**
```
Authorization: Bearer <YOUR_AGENT_BEARER_TOKEN>
x-agent-id: <YOUR_AGENT_ID>
```

The signature (`x-retell-signature`) and timestamp (`x-retell-timestamp`) headers are automatically added by Retell.

---

## 🧪 Testing Strategy

### 1. Test Health Endpoints (No Auth)
```bash
curl https://square-middleware-prod-api.azurewebsites.net/health
curl https://square-middleware-prod-api.azurewebsites.net/health/detailed
```

### 2. Test Customer Endpoints (With Auth)
```bash
# Get customer info
curl -X POST https://square-middleware-prod-api.azurewebsites.net/api/customer/info \
  -H "Content-Type: application/json" \
  -H "x-retell-signature: <SIGNATURE>" \
  -H "x-retell-timestamp: <TIMESTAMP>" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "x-agent-id: <AGENT_ID>" \
  -d '{"phone":"+12159324398"}'
```

### 3. Test Booking Endpoints (With Auth)
```bash
# Get availability
curl -X GET "https://square-middleware-prod-api.azurewebsites.net/api/bookings/availability?date=2025-10-20" \
  -H "x-retell-signature: <SIGNATURE>" \
  -H "x-retell-timestamp: <TIMESTAMP>" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "x-agent-id: <AGENT_ID>"
```

---

## 🔄 Migration from Old Infrastructure

### Before Migration
1. ✅ New infrastructure deployed and tested
2. ✅ All endpoints working correctly
3. ✅ Retell webhooks tested in staging/sandbox
4. ✅ Secrets verified in Key Vault

### Migration Steps

#### 1. Update Retell Webhooks
Point Retell to new URL:
```
Old: https://barber-boutique-api.azurewebsites.net/...
New: https://square-middleware-prod-api.azurewebsites.net/...
```

#### 2. Monitor New Infrastructure
```bash
# Watch logs for any errors
az webapp log tail \
  --name square-middleware-prod-api \
  --resource-group square-middleware-prod-rg
```

#### 3. Verify Traffic
- Check Application Insights for incoming requests
- Verify no errors in logs
- Test a few real bookings

#### 4. Keep Old Infrastructure for 24-48 Hours
Don't delete immediately - keep as fallback

#### 5. Delete Old Infrastructure (After Successful Migration)
```bash
# List resource groups
az group list --query "[].name" -o table

# Delete old resource group (CAREFUL!)
az group delete \
  --name barber-boutique-rg \
  --yes \
  --no-wait
```

---

## 📊 Monitoring & Troubleshooting

### View Application Insights
```bash
# Open in portal
az monitor app-insights component show \
  --app square-middleware-prod-insights \
  --resource-group square-middleware-prod-rg \
  --query "appId" -o tsv
```

### Check Key Vault Access
```bash
# List secrets
az keyvault secret list \
  --vault-name square-middleware-kv \
  --query "[].name" -o table

# Test secret retrieval
az keyvault secret show \
  --vault-name square-middleware-kv \
  --name retell-api-key \
  --query "value" -o tsv
```

### Common Issues

#### Issue: "Cannot access Key Vault"
**Solution:** Verify Managed Identity has permissions
```bash
az keyvault set-policy \
  --name square-middleware-kv \
  --object-id <PRINCIPAL_ID> \
  --secret-permissions get list
```

#### Issue: "401 Unauthorized"
**Solution:** Check signature verification
- Verify Retell API key is correct in Key Vault
- Check timestamp is within 5-minute window
- Verify Bearer token matches agent config

#### Issue: "403 Forbidden"
**Solution:** Check IP restrictions
- Verify Retell webhook IP is allowed
- Temporarily remove restrictions to test

---

## 💰 Cost Management

### Current Monthly Costs (~$14)
- App Service Plan (B1): ~$13/month
- Key Vault: ~$1/month
- Application Insights: FREE (5GB/month)

### Cost Optimization Tips
1. Use B1 tier for low/medium traffic
2. Enable auto-scaling only if needed
3. Monitor Key Vault operations (stay within free tier)
4. Use Application Insights free tier

### View Current Costs
```bash
# View costs for resource group
az consumption usage list \
  --start-date 2025-10-01 \
  --end-date 2025-10-31 \
  --query "[?contains(instanceId, 'square-middleware-prod-rg')]"
```

---

## 🆘 Rollback Plan

If issues arise with new infrastructure:

### Quick Rollback
1. Update Retell webhooks back to old URL
2. Old infrastructure continues serving requests
3. Debug new infrastructure without downtime

### Emergency Rollback Script
```bash
# Restore old webhook URL in Retell dashboard
# Old URL: https://barber-boutique-api.azurewebsites.net/...
```

---

## ✅ Deployment Checklist

- [ ] Azure CLI installed and logged in
- [ ] Created Azure infrastructure (azure-deploy.sh)
- [ ] Stored secrets in Key Vault (store-secrets.sh)
- [ ] Deployed application code
- [ ] Configured IP restrictions (configure-ip-restrictions.sh)
- [ ] Tested health endpoints
- [ ] Tested customer endpoints with auth
- [ ] Tested booking endpoints with auth
- [ ] Updated Retell webhook URLs
- [ ] Monitored logs for 24 hours
- [ ] Verified no errors in production
- [ ] Deleted old infrastructure (after migration)

---

## 📞 Support

If you encounter issues:
1. Check Application Insights for errors
2. Review App Service logs: `az webapp log tail ...`
3. Verify Key Vault access
4. Check IP restrictions
5. Test signature generation

For Azure support: https://portal.azure.com

---

## 📝 Next Steps

After successful deployment:
1. Set up monitoring alerts in Application Insights
2. Configure backup/restore for App Service
3. Set up staging slots for zero-downtime deployments
4. Document your agent configurations
5. Create runbook for common operations
