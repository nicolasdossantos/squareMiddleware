# Secrets & Configuration Strategy

**Date**: October 16, 2025  
**Status**: Architecture Review & Optimization

---

## 🎯 CONFIGURATION STRATEGY

### Decision: **App Settings vs Key Vault**

**Recommendation**: Use **Azure App Settings** for simplicity and performance.

**Rationale**:

1. **Performance**: Direct environment variables (no API calls to Key Vault)
2. **Simplicity**: One place to manage all credentials
3. **Cost**: No Key Vault operations charges
4. **Security**: App Settings are encrypted at rest and in transit
5. **Azure Native**: Built-in secrets management in App Service

**When to use Key Vault**:

- High-security scenarios (PCI-DSS compliance)
- Need for automatic secret rotation
- Sharing secrets across multiple Azure services
- Audit logging requirements

**Conclusion**: For this application, **App Settings are sufficient and preferred**.

---

## 📊 SECRETS CLASSIFICATION

### **Per-Agent Secrets** (Multi-tenant)

These vary per Retell agent/business:

| Secret                  | Source                     | Notes                     |
| ----------------------- | -------------------------- | ------------------------- |
| `SQUARE_ACCESS_TOKEN`   | Square Developer Dashboard | Unique per Square account |
| `SQUARE_LOCATION_ID`    | Square Dashboard           | Specific location ID      |
| `SQUARE_APPLICATION_ID` | Square Developer Dashboard | Unique per Square app     |
| `EMAIL_TO`              | Business owner             | Staff notification email  |

**Storage Strategy**: Store in agent configuration JSON structure

### **Application-Wide Secrets** (Shared)

These are the same for all agents:

| Secret                 | Source           | Notes                          |
| ---------------------- | ---------------- | ------------------------------ |
| `RETELL_API_KEY`       | Retell Dashboard | Webhook signature verification |
| `TWILIO_ACCOUNT_SID`   | Twilio Console   | SMS service                    |
| `TWILIO_AUTH_TOKEN`    | Twilio Console   | SMS service                    |
| `TWILIO_SMS_FROM`      | Twilio Console   | SMS sender number              |
| `BUSINESS_MESSAGES_TO` | Admin            | Temporary debug recipient      |
| `EMAIL_SMTP_HOST`      | Email provider   | SMTP server                    |
| `EMAIL_SMTP_PORT`      | Email provider   | SMTP port                      |
| `EMAIL_SMTP_USER`      | Email provider   | SMTP username                  |
| `EMAIL_SMTP_PASS`      | Email provider   | SMTP password                  |
| `EMAIL_FROM`           | Email provider   | Default sender                 |

**Storage Strategy**: Store directly in Azure App Settings

---

## ❌ SECRETS TO REMOVE

### 1. `SQUARE_ENVIRONMENT`

**Decision**: **Remove from configuration**

**Reason**: Should always be `production` in production deployments.

**Implementation**:

```javascript
// Hardcode in application
const environment = 'production'; // Always production
// OR detect from NODE_ENV
const environment = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
```

### 2. `SQUARE_WEBHOOK_SIGNATURE_KEY`

**Decision**: **Remove - not currently used**

**Reason**:

- Square webhook verification is not implemented in the current codebase
- Webhook handlers check for signature but don't verify it
- Can add later if needed

**Action**: Remove from documentation and configuration

### 3. WhatsApp Related Variables

**Decision**: **Remove all WhatsApp functionality**

Variables to remove:

- `TWILIO_WHATSAPP_FROM`
- `BUSINESS_OWNER_WHATSAPP`
- `BARBERSHOP_OWNER_WHATSAPP`

**Reason**: Not using WhatsApp functionality

**Action**:

- Remove from config
- Remove WhatsApp-related code
- Keep only SMS functionality

### 4. `ELEVENLABS_WEBHOOK_SECRET`

**Decision**: **Remove - not used**

**Reason**: ElevenLabs integration not implemented

**Action**: Remove from config and code

### 5. `AZURE_KEY_VAULT_NAME`

**Decision**: **Remove Key Vault dependency**

**Reason**: Using App Settings instead for simplicity

**Action**:

- Remove Key Vault service
- Remove Key Vault client code
- Store agent configs in a database or App Settings

---

## 🏗️ PROPOSED ARCHITECTURE

### Option A: **Database for Agent Configs** (Recommended)

Store per-agent configurations in a database (Azure SQL/CosmosDB/Table Storage).

**Pros**:

- Scalable to many agents
- Easy to add/update agents without redeployment
- Can build admin UI for agent management
- Supports dynamic agent onboarding

**Cons**:

- Requires database setup
- Additional dependency

**Agent Config Table Schema**:

```sql
CREATE TABLE AgentConfigs (
    agent_id VARCHAR(100) PRIMARY KEY,
    bearer_token VARCHAR(255) NOT NULL,
    square_access_token VARCHAR(255) NOT NULL,
    square_location_id VARCHAR(100) NOT NULL,
    square_application_id VARCHAR(100) NOT NULL,
    staff_email VARCHAR(255) NOT NULL,
    timezone VARCHAR(50) NOT NULL,
    business_name VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Option B: **JSON in App Settings**

Store agent configs as JSON in App Settings.

**Pros**:

- No additional services needed
- Simple to implement
- Good for small number of agents (1-10)

**Cons**:

- Requires redeployment to add agents
- Not scalable for many agents
- Manual JSON management

**App Setting Structure**:

```bash
AGENT_CONFIGS='[
  {
    "agentId": "895480dde586e4c3712bd4c770",
    "bearerToken": "secret-token-1",
    "squareAccessToken": "EAAAl1GMw5U8...",
    "squareLocationId": "L71YZWPR1TD9B",
    "squareApplicationId": "sq0idp-Ha6sz9i...",
    "staffEmail": "owner@elitebarbershop.com",
    "timezone": "America/New_York",
    "businessName": "Elite Barbershop"
  }
]'
```

**Recommendation**: Start with **Option B** for MVP, migrate to **Option A** as you scale.

---

## 📋 FINAL SECRETS LIST

### Azure App Settings (Production)

```bash
# ============================================
# NODE ENVIRONMENT
# ============================================
NODE_ENV=production
PORT=3000
TZ=America/New_York

# ============================================
# RETELL AI
# ============================================
RETELL_API_KEY=key_xxxxxxxxxxxxx

# ============================================
# TWILIO SMS (Application-Wide)
# ============================================
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
TWILIO_SMS_FROM=+12675130090
BUSINESS_MESSAGES_TO=+12677210098

# ============================================
# EMAIL SMTP (Application-Wide)
# ============================================
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=notifications@yourdomain.com
EMAIL_SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# ============================================
# AGENT CONFIGURATIONS (Multi-Tenant)
# ============================================
AGENT_CONFIGS=[{"agentId":"895480dde586e4c3712bd4c770","bearerToken":"secret-token","squareAccessToken":"EAAAl1GMw5U8nZA-GsBixNSjKQvSl0ktYKGzIrC09XHY0tQzn8wrZRfIGx-owqpQ","squareLocationId":"L71YZWPR1TD9B","squareApplicationId":"sq0idp-Ha6sz9iJDuMD2L7XPtgLoQ","staffEmail":"owner@elitebarbershop.com","timezone":"America/New_York","businessName":"Elite Barbershop"}]

# ============================================
# SECURITY (Optional)
# ============================================
ALLOWED_ORIGINS=https://yourdomain.com
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=900000

# ============================================
# MONITORING (Optional)
# ============================================
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=xxxxx
```

---

## �� MIGRATION PLAN

### Phase 1: Remove Key Vault (Immediate)

1. ✅ Remove `keyVaultService.js`
2. ✅ Remove `@azure/keyvault-secrets` dependency
3. ✅ Remove `@azure/identity` dependency
4. ✅ Remove `AZURE_KEY_VAULT_NAME` from config
5. ✅ Update `agentAuth.js` to read from App Settings
6. ✅ Update `retellAuth.js` to read from App Settings

### Phase 2: Remove Unused Features (Immediate)

1. ✅ Remove WhatsApp-related code
2. ✅ Remove ElevenLabs webhook secret references
3. ✅ Remove `SQUARE_WEBHOOK_SIGNATURE_KEY` references
4. ✅ Hardcode `SQUARE_ENVIRONMENT` based on `NODE_ENV`

### Phase 3: Implement Agent Config Service (Immediate)

1. ✅ Create `agentConfigService.js`
2. ✅ Load agent configs from `AGENT_CONFIGS` JSON
3. ✅ Update middleware to use new service
4. ✅ Add validation for agent config structure

### Phase 4: Update Configuration (Immediate)

1. ✅ Create new `src/config/index.js` with simplified structure
2. ✅ Remove deprecated environment variables
3. ✅ Update documentation

### Phase 5: Testing & Deployment

1. ✅ Update tests for new config structure
2. ✅ Test locally with new App Settings format
3. ✅ Update Azure App Settings
4. ✅ Deploy and verify

---

## 📝 CODE CHANGES REQUIRED

### Files to Delete:

- `src/services/keyVaultService.js`
- `src/middlewares/tenantContext.js` (if exists)

### Files to Create:

- `src/services/agentConfigService.js`

### Files to Modify:

- `src/config/index.js` - Simplify config structure
- `src/middlewares/agentAuth.js` - Use agentConfigService
- `src/middlewares/retellAuth.js` - Read from App Settings
- `src/services/smsService.js` - Remove WhatsApp code
- `src/utils/squareUtils.js` - Hardcode environment
- `package.json` - Remove Key Vault dependencies

---

## 🎯 BENEFITS OF NEW ARCHITECTURE

1. **Simpler**: No Key Vault complexity
2. **Faster**: No API calls to fetch secrets
3. **Cheaper**: No Key Vault operations costs
4. **Easier to Debug**: All config in one place
5. **Easier to Deploy**: Just update App Settings
6. **More Maintainable**: Less moving parts

---

## 🔒 SECURITY CONSIDERATIONS

**Q: Is it secure to store secrets in App Settings?**  
**A**: Yes! Azure App Settings are:

- Encrypted at rest
- Encrypted in transit (HTTPS)
- Only accessible by App Service and authorized users
- Support slot-specific settings
- Audit logged in Activity Log

**Q: What about secret rotation?**  
**A**: Manual rotation process:

1. Generate new secret in source system (Square/Twilio/etc)
2. Update App Setting in Azure Portal
3. Restart app or wait for auto-restart
4. Revoke old secret after verification

**Q: Should we add encryption for agent configs?**  
**A**: Optional enhancement - could encrypt sensitive fields in AGENT_CONFIGS JSON before storing.

---

## 📊 COMPARISON: Before vs After

| Aspect          | Before (Key Vault)      | After (App Settings)    |
| --------------- | ----------------------- | ----------------------- |
| **Complexity**  | High                    | Low                     |
| **Performance** | ~100ms per secret fetch | Instant (in memory)     |
| **Cost**        | $0.03 per 10K ops       | Included in App Service |
| **Deployment**  | KV setup required       | Just App Settings       |
| **Scalability** | Excellent               | Good (1-100 agents)     |
| **Maintenance** | Medium effort           | Low effort              |
| **Security**    | Excellent               | Excellent               |

---

## ✅ RECOMMENDATION

**Adopt the simplified App Settings approach** for the following reasons:

1. You have a small number of agents (currently 1)
2. Performance is critical for webhook processing
3. Simplicity reduces bugs and maintenance
4. App Settings security is sufficient for your use case
5. Can always migrate to Key Vault later if needed

**Next Steps**:

1. Implement agentConfigService
2. Remove Key Vault code
3. Update App Settings in Azure
4. Test thoroughly
5. Deploy

---

**Last Updated**: October 16, 2025  
**Status**: Ready for Implementation
