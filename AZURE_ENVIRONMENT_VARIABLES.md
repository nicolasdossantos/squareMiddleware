# Azure Environment Variables Setup

This document explains how environment variables are configured in Azure App Service for the Square Middleware application.

## Overview

The application uses environment variables for configuration instead of hardcoded values. This allows for:
- Secure storage of secrets
- Different configurations per environment (dev, staging, production)
- Easy updates without code changes

## Current Configuration

### Azure Resources
- **Resource Group:** `square-middleware-prod-rg`
- **App Service:** `square-middleware-prod-api`
- **Region:** East US
- **URL:** https://square-middleware-prod-api.azurewebsites.net

### Environment Variables Set

#### Core Settings
| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Node environment |
| `PORT` | `8080` | Server port (Azure default) |
| `TZ` | `America/New_York` | Timezone |

#### Multi-Tenant Configuration
| Variable | Description |
|----------|-------------|
| `AGENT_CONFIGS` | JSON array of agent configurations (see below) |

**Agent Config Structure:**
```json
[{
  "agentId": "895480dde586e4c3712bd4c770",
  "bearerToken": "test-bearer-token-elite",
  "squareAccessToken": "EAAAl...",
  "squareLocationId": "L71YZWPR1TD9B",
  "squareApplicationId": "sq0idp-...",
  "staffEmail": "owner@elitebarbershop.com",
  "timezone": "America/New_York",
  "businessName": "Elite Barbershop"
}]
```

#### Retell AI
| Variable | Description |
|----------|-------------|
| `RETELL_API_KEY` | API key for Retell AI integration |

#### Twilio (SMS/WhatsApp)
| Variable | Value | Description |
|----------|-------|-------------|
| `TWILIO_ACCOUNT_SID` | `AC4e5314...` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | `94b62ec1...` | Twilio authentication token |
| `TWILIO_SMS_FROM` | `+12675130090` | SMS sender number |

#### Email (SMTP)
| Variable | Value | Description |
|----------|-------|-------------|
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_SECURE` | `false` | Use TLS (not SSL) |
| `SMTP_USER` | Your email | SMTP username |
| `SMTP_PASSWORD` | App password | SMTP password |
| `EMAIL_FROM` | Your email | Sender email address |

#### Security
| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret key for JWT token generation |

#### Azure Services
| Variable | Value | Description |
|----------|-------|-------------|
| `AZURE_KEY_VAULT_NAME` | `square-middleware-kv` | Key Vault name for secrets |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Auto-set | Application Insights telemetry |
| `APPINSIGHTS_INSTRUMENTATIONKEY` | Auto-set | Application Insights key |

#### Legacy Square Settings (For Backward Compatibility)
| Variable | Value | Description |
|----------|-------|-------------|
| `SQUARE_ACCESS_TOKEN` | `EAAAl...` | Default Square access token |
| `SQUARE_LOCATION_ID` | `L71YZWPR1TD9B` | Default Square location |
| `SQUARE_APPLICATION_ID` | `sq0idp-...` | Square application ID |
| `SQUARE_ENVIRONMENT` | `production` | Square environment |

> **Note:** The multi-tenant system uses `AGENT_CONFIGS` which overrides these legacy settings per agent.

## How to Update Environment Variables

### Option 1: Use the Configuration Script (Recommended)

1. **Update `.env.local`** with new values
2. **Run the script:**
   ```bash
   ./deploy/configure-azure-env.sh
   ```
3. **Restart the app:**
   ```bash
   az webapp restart \
     --resource-group square-middleware-prod-rg \
     --name square-middleware-prod-api
   ```

### Option 2: Manual Configuration via Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to: **square-middleware-prod-rg** → **square-middleware-prod-api**
3. Click **Settings** → **Configuration**
4. Click **+ New application setting**
5. Add name and value
6. Click **Save**
7. Restart the app

### Option 3: Azure CLI Manual Update

```bash
az webapp config appsettings set \
  --resource-group square-middleware-prod-rg \
  --name square-middleware-prod-api \
  --settings KEY="value"
```

## Viewing Current Settings

### List all settings:
```bash
az webapp config appsettings list \
  --resource-group square-middleware-prod-rg \
  --name square-middleware-prod-api \
  --output table
```

### Get specific setting:
```bash
az webapp config appsettings list \
  --resource-group square-middleware-prod-rg \
  --name square-middleware-prod-api \
  --query "[?name=='NODE_ENV'].value" \
  --output tsv
```

## Security Best Practices

### ✅ DO:
- Store secrets in Azure Key Vault when possible
- Use managed identities for Azure services
- Rotate secrets regularly
- Use different secrets for dev/staging/production
- Keep `.env.local` in `.gitignore`

### ❌ DON'T:
- Commit `.env.local` to Git
- Share secrets in Slack/email
- Use production secrets in development
- Hardcode secrets in application code

## Environment Variable Precedence

The application loads environment variables in this order (last wins):

1. System environment variables (Azure App Service settings)
2. `.env` file (template/defaults)
3. `.env.local` file (local development only)

In production (Azure), **Azure App Service settings override all files**.

## Troubleshooting

### App not using new environment variables
**Solution:** Restart the app service
```bash
az webapp restart \
  --resource-group square-middleware-prod-rg \
  --name square-middleware-prod-api
```

### Can't find environment variable
**Solution:** Check if it's set in Azure
```bash
az webapp config appsettings list \
  --resource-group square-middleware-prod-rg \
  --name square-middleware-prod-api \
  | grep "VARIABLE_NAME"
```

### Multi-tenant config not working
**Solution:** Verify AGENT_CONFIGS is valid JSON
```bash
az webapp config appsettings list \
  --resource-group square-middleware-prod-rg \
  --name square-middleware-prod-api \
  --query "[?name=='AGENT_CONFIGS'].value" \
  --output tsv | jq .
```

## Adding a New Tenant

To add a new tenant (e.g., "Nini's Nail Salon"):

1. **Update `.env.local`:**
   ```json
   AGENT_CONFIGS=[
     {
       "agentId": "895480dde586e4c3712bd4c770",
       "bearerToken": "test-bearer-token-elite",
       ...
     },
     {
       "agentId": "new-agent-id-here",
       "bearerToken": "new-bearer-token-here",
       "squareAccessToken": "new-square-token",
       "squareLocationId": "new-location-id",
       "squareApplicationId": "sq0idp-...",
       "staffEmail": "owner@ninisnails.com",
       "timezone": "America/New_York",
       "businessName": "Nini's Nail Salon"
     }
   ]
   ```

2. **Run the configuration script:**
   ```bash
   ./deploy/configure-azure-env.sh
   ```

3. **Restart the app**

## Related Files

- `/deploy/configure-azure-env.sh` - Automated configuration script
- `/.env` - Template file (committed to Git)
- `/.env.local` - Local secrets (NOT committed to Git)
- `/src/config/index.js` - Configuration loader

## Support

For issues with environment variables:
1. Check Azure App Service logs
2. Verify variable names match exactly (case-sensitive)
3. Ensure the app was restarted after changes
4. Check Application Insights for runtime errors
