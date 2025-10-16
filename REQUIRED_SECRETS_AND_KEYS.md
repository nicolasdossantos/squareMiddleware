# Required Secrets and Keys Configuration Guide

**Application**: Square Middleware API  
**Environment**: Production (Azure App Service)  
**Date**: October 16, 2025

---

## 🔑 CRITICAL SECRETS (Required for Production)

### 1. Square API Credentials

**Used for**: Square payment processing, bookings, customer management

| Environment Variable           | Description                           | Example                   | Where Used                   |
| ------------------------------ | ------------------------------------- | ------------------------- | ---------------------------- |
| `SQUARE_ACCESS_TOKEN`          | Square API access token               | `EAAAl1GMw5U8nZA-Gs...`   | All Square API operations    |
| `SQUARE_LOCATION_ID`           | Square location ID                    | `L71YZWPR1TD9B`           | Booking and location queries |
| `SQUARE_ENVIRONMENT`           | Square environment                    | `production` or `sandbox` | API endpoint selection       |
| `SQUARE_APPLICATION_ID`        | Square application ID                 | `sq0idp-Ha6sz9i...`       | Square API authentication    |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Square webhook signature verification | `your-webhook-key`        | Webhook security             |

**How to get**:

- Log in to [Square Developer Dashboard](https://developer.squareup.com/)
- Create/select your application
- Navigate to "Credentials" section
- Copy Production Access Token
- Find Location ID in Locations section

**Azure Configuration**:

```bash
# Set as App Settings (not Key Vault references)
SQUARE_ACCESS_TOKEN=<your-token>
SQUARE_LOCATION_ID=<your-location-id>
SQUARE_ENVIRONMENT=production
SQUARE_APPLICATION_ID=<your-app-id>
```

---

### 2. Azure Key Vault

**Used for**: Multi-tenant agent credentials, Retell API key storage

| Environment Variable   | Description             | Example                | Where Used               |
| ---------------------- | ----------------------- | ---------------------- | ------------------------ |
| `AZURE_KEY_VAULT_NAME` | Key Vault instance name | `square-middleware-kv` | All Key Vault operations |

**Secrets stored in Key Vault**:

#### a) Retell API Key

- **Secret Name**: `retell-api-key`
- **Purpose**: HMAC signature verification for Retell webhooks
- **Format**: Plain text API key
- **Example**: `key_abc123...`

#### b) Per-Agent Configurations

- **Secret Name Pattern**: `agent-{agentId}`
- **Purpose**: Multi-tenant Square credentials per Retell agent
- **Format**: JSON object
- **Example**:

```json
{
  "agentId": "895480dde586e4c3712bd4c770",
  "bearerToken": "secret-bearer-token-for-api-auth",
  "squareAccessToken": "EAAAl1GMw5U8nZA-GsBixNSjKQvSl0kt...",
  "squareLocationId": "L71YZWPR1TD9B",
  "squareEnvironment": "production",
  "timezone": "America/New_York"
}
```

**How to configure**:

```bash
# Add Retell API key
az keyvault secret set \
  --vault-name square-middleware-kv \
  --name retell-api-key \
  --value "your-retell-api-key"

# Add agent configuration
az keyvault secret set \
  --vault-name square-middleware-kv \
  --name agent-895480dde586e4c3712bd4c770 \
  --value '{"agentId":"895480dde586e4c3712bd4c770","bearerToken":"...","squareAccessToken":"...","squareLocationId":"...","squareEnvironment":"production","timezone":"America/New_York"}'
```

**Managed Identity Permissions**:

```bash
# Grant App Service read access to Key Vault
az keyvault set-policy \
  --name square-middleware-kv \
  --object-id <managed-identity-object-id> \
  --secret-permissions get list
```

---

### 3. Twilio SMS (Optional but Recommended)

**Used for**: SMS notifications, WhatsApp messages

| Environment Variable      | Description                 | Example                 | Where Used                 |
| ------------------------- | --------------------------- | ----------------------- | -------------------------- |
| `TWILIO_ACCOUNT_SID`      | Twilio account identifier   | `ACxxxxxxxxxxxxx`       | SMS service authentication |
| `TWILIO_AUTH_TOKEN`       | Twilio authentication token | `your-auth-token`       | SMS service authentication |
| `TWILIO_SMS_FROM`         | SMS sender phone number     | `+12675130090`          | SMS message origin         |
| `TWILIO_WHATSAPP_FROM`    | WhatsApp sender number      | `whatsapp:+14155238886` | WhatsApp message origin    |
| `BUSINESS_OWNER_WHATSAPP` | Business owner WhatsApp     | `whatsapp:+12678040148` | Staff notifications        |
| `BUSINESS_MESSAGES_TO`    | Business SMS recipient      | `+12677210098`          | Staff notifications        |

**How to get**:

- Sign up at [Twilio Console](https://console.twilio.com/)
- Find Account SID and Auth Token in dashboard
- Purchase phone number for SMS
- Set up WhatsApp Sandbox or Business number

**Status**: Currently shows as "not configured" - SMS endpoints will fail without this

---

### 4. Email Service (SMTP) - Optional

**Used for**: Email notifications to customers and staff

| Environment Variable | Description                | Example                     | Where Used           |
| -------------------- | -------------------------- | --------------------------- | -------------------- |
| `EMAIL_SMTP_HOST`    | SMTP server hostname       | `smtp.gmail.com`            | Email service        |
| `EMAIL_SMTP_PORT`    | SMTP server port           | `587` or `465`              | Email service        |
| `EMAIL_SMTP_USER`    | SMTP username/email        | `notifications@example.com` | Email authentication |
| `EMAIL_SMTP_PASS`    | SMTP password/app password | `your-app-password`         | Email authentication |
| `EMAIL_FROM`         | Sender email address       | `noreply@example.com`       | Email sender         |
| `EMAIL_TO`           | Staff notification email   | `staff@example.com`         | Staff notifications  |

**Popular SMTP Providers**:

- **Gmail**: smtp.gmail.com:587 (requires App Password)
- **SendGrid**: smtp.sendgrid.net:587
- **AWS SES**: email-smtp.region.amazonaws.com:587
- **Mailgun**: smtp.mailgun.org:587

**Status**: Currently unhealthy in dev (no SMTP configured) - Email endpoints will fail without this

---

### 5. ElevenLabs Webhook (Optional)

**Used for**: Voice AI post-call webhook verification

| Environment Variable        | Description                      | Example               | Where Used                     |
| --------------------------- | -------------------------------- | --------------------- | ------------------------------ |
| `ELEVENLABS_WEBHOOK_SECRET` | ElevenLabs webhook signature key | `your-webhook-secret` | Webhook signature verification |

**How to get**:

- Log in to [ElevenLabs Dashboard](https://elevenlabs.io/)
- Navigate to API settings
- Find webhook signature key

---

## 🔧 APPLICATION CONFIGURATION

### Server Configuration

| Environment Variable | Description      | Default            | Required |
| -------------------- | ---------------- | ------------------ | -------- |
| `PORT`               | Server port      | `3000`             | No       |
| `NODE_ENV`           | Environment mode | `development`      | Yes      |
| `TZ`                 | Timezone         | `America/New_York` | No       |

### Security Configuration

| Environment Variable | Description                            | Default           | Required |
| -------------------- | -------------------------------------- | ----------------- | -------- |
| `ALLOWED_ORIGINS`    | CORS allowed origins (comma-separated) | `*`               | No       |
| `RATE_LIMIT_MAX`     | Max requests per window                | `1000`            | No       |
| `RATE_LIMIT_WINDOW`  | Rate limit window (ms)                 | `900000` (15 min) | No       |

### Azure Application Insights (Recommended)

| Environment Variable                    | Description                      | Required |
| --------------------------------------- | -------------------------------- | -------- |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | App Insights connection string   | No       |
| `APPINSIGHTS_INSTRUMENTATIONKEY`        | App Insights instrumentation key | No       |

---

## 📦 CURRENT AZURE APP SETTINGS

Based on your current deployment:

```bash
# ✅ Currently Set (Verified Working)
SQUARE_ACCESS_TOKEN=EAAAl1GMw5U8nZA-GsBixNSjKQvSl0ktYKGzIrC09XHY0tQzn8wrZRfIGx-owqpQ
SQUARE_LOCATION_ID=L71YZWPR1TD9B
SQUARE_ENVIRONMENT=production
SQUARE_APPLICATION_ID=sq0idp-Ha6sz9iJDuMD2L7XPtgLoQ
AZURE_KEY_VAULT_NAME=square-middleware-kv
NODE_ENV=production

# ❌ Missing (Optional but Recommended)
TWILIO_ACCOUNT_SID=<not-set>
TWILIO_AUTH_TOKEN=<not-set>
TWILIO_SMS_FROM=<not-set>
EMAIL_SMTP_HOST=<not-set>
EMAIL_SMTP_PORT=<not-set>
EMAIL_SMTP_USER=<not-set>
EMAIL_SMTP_PASS=<not-set>
EMAIL_FROM=<not-set>
EMAIL_TO=<not-set>
```

---

## 🔐 KEY VAULT SECRETS INVENTORY

### Current Secrets in `square-middleware-kv`:

1. **`retell-api-key`**

   - Purpose: Retell webhook signature verification
   - Status: ✅ Set
   - Used by: `src/middlewares/retellAuth.js`

2. **`agent-895480dde586e4c3712bd4c770`**

   - Purpose: Elite Barbershop agent configuration
   - Status: ✅ Set
   - Contains: Full agent config with Square credentials

3. **`SQUARE-ACCESS-TOKEN`**

   - Purpose: Direct secret (alternative storage)
   - Status: ✅ Set
   - Note: Duplicates App Setting (not recommended)

4. **`SQUARE-LOCATION-ID`**

   - Purpose: Direct secret (alternative storage)
   - Status: ✅ Set
   - Note: Duplicates App Setting (not recommended)

5. **`SQUARE-ENVIRONMENT`**
   - Purpose: Direct secret (alternative storage)
   - Status: ✅ Set
   - Note: Duplicates App Setting (not recommended)

---

## 🎯 MINIMUM REQUIRED FOR PRODUCTION

To run the application in production, you **MUST** have:

### Critical (App Won't Start Without These):

1. ✅ `SQUARE_ACCESS_TOKEN` - Set in App Settings
2. ✅ `SQUARE_LOCATION_ID` - Set in App Settings
3. ✅ `SQUARE_ENVIRONMENT` - Set in App Settings
4. ✅ `AZURE_KEY_VAULT_NAME` - Set in App Settings
5. ✅ `NODE_ENV=production` - Set in App Settings

### Important (Features Will Fail Without These):

6. ✅ `retell-api-key` - Set in Key Vault (for Retell webhooks)
7. ✅ `agent-{agentId}` - Set in Key Vault (for multi-tenant support)

### Optional (Enhanced Features):

8. ⚠️ Twilio credentials (SMS/WhatsApp notifications)
9. ⚠️ Email SMTP credentials (Email notifications)
10. ⚠️ ElevenLabs webhook secret (Voice AI webhooks)
11. ⚠️ Square webhook signature key (Square webhook verification)

---

## 📝 ENVIRONMENT FILE TEMPLATES

### `.env.local` (Local Development with Real Credentials)

```bash
# Square API (Production)
SQUARE_ACCESS_TOKEN=EAAAl1GMw5U8nZA-GsBixNSjKQvSl0ktYKGzIrC09XHY0tQzn8wrZRfIGx-owqpQ
SQUARE_LOCATION_ID=L71YZWPR1TD9B
SQUARE_ENVIRONMENT=production

# Server
PORT=3000
NODE_ENV=development
```

### `.env` (Template - Never Commit Real Values)

```bash
# Square API
SQUARE_ACCESS_TOKEN=test_token
SQUARE_LOCATION_ID=test_location
SQUARE_ENVIRONMENT=sandbox
SQUARE_APPLICATION_ID=your_app_id
SQUARE_WEBHOOK_SIGNATURE_KEY=your_webhook_key

# Azure
AZURE_KEY_VAULT_NAME=your-keyvault-name

# Twilio (Optional)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_SMS_FROM=+1234567890
TWILIO_WHATSAPP_FROM=whatsapp:+1234567890
BUSINESS_OWNER_WHATSAPP=whatsapp:+1234567890
BUSINESS_MESSAGES_TO=+1234567890

# Email (Optional)
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your_email@gmail.com
EMAIL_SMTP_PASS=your_app_password
EMAIL_FROM=noreply@example.com
EMAIL_TO=staff@example.com

# ElevenLabs (Optional)
ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret

# Development
RETELL_API_KEY=your_retell_key
MOCK_BEARER_TOKEN=test-bearer-token
USE_REAL_KEYVAULT=false
```

---

## 🚀 DEPLOYMENT CHECKLIST

Before deploying to Azure:

- [ ] Square credentials set in App Settings
- [ ] Azure Key Vault name configured
- [ ] Retell API key stored in Key Vault
- [ ] Agent configurations stored in Key Vault
- [ ] Managed Identity has Key Vault read permissions
- [ ] NODE_ENV=production set
- [ ] (Optional) Twilio credentials configured
- [ ] (Optional) Email SMTP configured
- [ ] Test health endpoint: `/api/health/detailed`
- [ ] Verify Square API shows "healthy"

---

## �� SECURITY BEST PRACTICES

1. **Never commit secrets to Git**

   - `.env.local` is in `.gitignore`
   - Use environment variables or Key Vault

2. **Use Key Vault for multi-tenant secrets**

   - Per-agent credentials stored as JSON
   - Managed Identity for passwordless access

3. **Rotate credentials regularly**

   - Square tokens can be regenerated
   - Update Key Vault secrets after rotation

4. **Use App Settings for single-tenant secrets**

   - Faster than Key Vault (no API calls)
   - Good for common credentials

5. **Monitor access logs**
   - Enable Key Vault diagnostic logging
   - Track secret access patterns

---

## 📞 SUPPORT

For questions about:

- **Square API**: https://developer.squareup.com/
- **Twilio**: https://console.twilio.com/
- **Azure Key Vault**: https://portal.azure.com/
- **Retell AI**: https://retellai.com/

---

**Last Updated**: October 16, 2025  
**Version**: 2.0.0
