# Automated Onboarding API - Setup Guide

## Overview

The automated onboarding API allows you to complete agent onboarding in one API call after OAuth authorization
is complete.

## What It Does

1. ✅ Receives OAuth callback data
2. ✅ Generates secure bearer token for the agent
3. ✅ Updates Azure App Service `AGENT_CONFIGS` environment variable
4. ✅ Restarts the app service automatically
5. ✅ Returns credentials for Retell configuration

## Prerequisites

### 1. Install Dependencies

```bash
npm install @azure/arm-appservice
```

### 2. Configure Environment Variables

Add these to your Azure App Service Configuration:

```bash
# Admin API Protection
ADMIN_API_KEY=your-secure-random-key-here

# Azure Configuration (for automated updates)
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP=your-resource-group-name
AZURE_APP_SERVICE_NAME=square-middleware-prod-api

# Optional: Public URL for webhook configuration
PUBLIC_URL=https://square-middleware-prod-api.azurewebsites.net
```

### 3. Generate Admin API Key

```bash
# Generate a secure random key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Configure Azure Managed Identity

Your App Service needs permissions to manage its own configuration:

```bash
# Enable System-assigned Managed Identity in Azure Portal:
# App Service → Identity → System assigned → On

# Grant permissions
az role assignment create \
  --assignee <managed-identity-principal-id> \
  --role "Website Contributor" \
  --scope /subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.Web/sites/<app-service-name>
```

## Usage

### Complete Flow Example

#### Step 1: Generate Authorization URL

```bash
curl "https://your-api.azurewebsites.net/oauth/authorize?agentId=agent_new_shop&businessName=Joe%27s%20Cuts&environment=production"
```

Response:

```json
{
  "success": true,
  "authorizationUrl": "https://connect.squareup.com/oauth2/authorize?client_id=xxx&scope=...&state=xxx",
  "agentId": "agent_new_shop",
  "environment": "production"
}
```

#### Step 2: Send Seller to Authorization URL

Seller visits the URL, signs in, and approves permissions.

#### Step 3: Capture Callback Response

Square redirects to `/authcallback`. If you want JSON response, add `Accept: application/json` header:

```bash
# Manually trigger (or capture from browser):
curl -H "Accept: application/json" \
  "https://your-api.azurewebsites.net/authcallback?code=sq0cgb-xxx&state=xxx"
```

Response contains OAuth data:

```json
{
  "success": true,
  "agentId": "agent_new_shop",
  "environment": "production",
  "merchantId": "MERCHANT_123",
  "accessToken": "EAAAl...",
  "refreshToken": "rrf_...",
  "expiresAt": "2025-11-25T00:00:00Z",
  "scope": ["APPOINTMENTS_READ", ...],
  "businessName": "Joe's Cuts",
  "defaultLocationId": "L123ABC",
  "supportsSellerLevelWrites": false,
  "timezone": "America/New_York"
}
```

#### Step 4: Complete Onboarding (Automated)

```bash
curl -X POST "https://your-api.azurewebsites.net/api/admin/complete-onboarding" \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: your-admin-api-key" \
  -d '{
    "agentId": "agent_new_shop",
    "businessName": "Joe'\''s Cuts",
    "accessToken": "EAAAl...",
    "refreshToken": "rrf_...",
    "expiresAt": "2025-11-25T00:00:00Z",
    "scope": ["APPOINTMENTS_READ", "APPOINTMENTS_WRITE"],
    "merchantId": "MERCHANT_123",
    "defaultLocationId": "L123ABC",
    "supportsSellerLevelWrites": false,
    "timezone": "America/New_York",
    "squareEnvironment": "production",
    "staffEmail": "joe@joescuts.com"
  }'
```

Response:

```json
{
  "success": true,
  "message": "Agent onboarded successfully. App service is restarting.",
  "agent": {
    "agentId": "agent_new_shop",
    "bearerToken": "a1b2c3d4e5f6...",
    "businessName": "Joe's Cuts",
    "environment": "production",
    "supportsSellerLevelWrites": false,
    "merchantId": "MERCHANT_123",
    "defaultLocationId": "L123ABC",
    "timezone": "America/New_York"
  },
  "retellConfiguration": {
    "instructions": [
      "Use this bearerToken for Retell Custom LLM authentication",
      "Configure webhook URL with X-Agent-ID header",
      "Test with a sample call to verify integration"
    ],
    "webhookUrl": "https://your-api.azurewebsites.net/api/webhooks/retell",
    "headers": {
      "X-Agent-ID": "agent_new_shop",
      "Content-Type": "application/json"
    },
    "authentication": {
      "type": "Bearer Token",
      "token": "a1b2c3d4e5f6..."
    }
  },
  "nextSteps": [
    "App service is restarting (may take 30-60 seconds)",
    "Configure Retell agent with the bearerToken above",
    "Set webhook URL in Retell dashboard",
    "Test the integration with a sample call"
  ]
}
```

## Additional Endpoints

### List All Agents

```bash
curl "https://your-api.azurewebsites.net/api/admin/agents" \
  -H "X-Admin-API-Key: your-admin-api-key"
```

Response:

```json
{
  "success": true,
  "agents": [
    {
      "agentId": "agent_elite_barbershop",
      "businessName": "Elite Barbershop",
      "squareEnvironment": "sandbox",
      "timezone": "America/New_York",
      "squareMerchantId": "MERCHANT_ELITE",
      "supportsSellerLevelWrites": true,
      "defaultLocationId": "L71YZWPR1TD9B",
      "staffEmail": "owner@elitebarbershop.com",
      "hasRefreshToken": true,
      "tokenExpiresAt": "2025-01-01T00:00:00.000Z"
    },
    {
      "agentId": "agent_new_shop",
      "businessName": "Joe's Cuts",
      "squareEnvironment": "production",
      "timezone": "America/New_York",
      "squareMerchantId": "MERCHANT_123",
      "supportsSellerLevelWrites": false,
      "defaultLocationId": "L123ABC",
      "staffEmail": "joe@joescuts.com",
      "hasRefreshToken": true,
      "tokenExpiresAt": "2025-11-25T00:00:00Z"
    }
  ],
  "count": 2
}
```

## Security Notes

1. ✅ **Admin API Key**: Required for all admin endpoints. Store securely.
2. ✅ **Managed Identity**: App Service uses its own identity to update configuration.
3. ✅ **HTTPS Only**: All endpoints require HTTPS in production.
4. ✅ **Bearer Tokens**: Auto-generated 64-character hex strings (256-bit security).
5. ✅ **No Token Exposure**: List endpoint never returns access/refresh tokens.

## Troubleshooting

### Error: "AZURE_SUBSCRIPTION_ID environment variable is required"

Add the environment variable to your App Service configuration.

### Error: "Managed identity not configured"

Enable System-assigned Managed Identity and grant Website Contributor role.

### Error: "Agent already exists in configuration"

The agentId is already onboarded. Use a different agentId or manually update the existing one.

### Error: "App service restart failed"

Check that the Managed Identity has sufficient permissions (Website Contributor role).

## Testing Locally

For local testing, you can't restart Azure App Service, but you can test the configuration logic:

```bash
# Set local environment
export ADMIN_API_KEY=test-key-123
export AZURE_SUBSCRIPTION_ID=test-sub
export AZURE_RESOURCE_GROUP=test-rg
export AZURE_APP_SERVICE_NAME=test-app

# Note: Local testing will fail at the Azure API calls
# Use this for integration testing only
npm run start:dev
```

## Next Steps

1. Deploy the updated code
2. Configure environment variables
3. Enable Managed Identity
4. Test the complete flow
5. Document your onboarding process for clients
