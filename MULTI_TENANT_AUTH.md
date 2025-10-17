# Multi-Tenant Agent Authentication & Configuration

## How It Works

The system uses a **multi-tenant architecture** where each Retell AI agent represents a different business (e.g., Elite Barbershop, Nini's Nail Salon). Each agent has its own credentials and configuration.

## Authentication Flow

### Step 1: Agent Calls API
When a Retell AI agent calls a custom function, it includes these headers:

```http
POST /api/customers/info
Authorization: Bearer test-bearer-token-elite
x-agent-id: 895480dde586e4c3712bd4c770
Content-Type: application/json
```

### Step 2: Agent Authentication Middleware
The `agentAuthMiddleware` validates the request:

```javascript
// src/middlewares/agentAuth.js

1. Extract headers:
   - Authorization: Bearer <token>
   - x-agent-id: <agent-id>

2. Look up agent config from AGENT_CONFIGS environment variable

3. Validate bearer token matches the agent's stored token

4. If valid, attach agent-specific config to req.tenant and req.retellContext
```

### Step 3: Request Proceeds with Agent Context
Once authenticated, all subsequent code uses the agent-specific credentials:

```javascript
// In any controller/service:
const tenant = req.tenant;
// tenant.accessToken = agent's Square access token
// tenant.locationId = agent's Square location ID
// tenant.businessName = agent's business name
// tenant.timezone = agent's timezone
```

## Configuration Structure

### Environment Variable: `AGENT_CONFIGS`

This is a **JSON array** stored in Azure App Service settings:

```json
[
  {
    "agentId": "895480dde586e4c3712bd4c770",
    "bearerToken": "test-bearer-token-elite",
    "squareAccessToken": "EAAAl1GMw5U8nZA-GsBixNSjKQvSl0ktYKGzIrC09XHY0tQzn8wrZRfIGx-owqpQ",
    "squareLocationId": "L71YZWPR1TD9B",
    "squareApplicationId": "sq0idp-Ha6sz9iU8JwRPwdGhzq9Mmw",
    "staffEmail": "owner@elitebarbershop.com",
    "timezone": "America/New_York",
    "businessName": "Elite Barbershop"
  },
  {
    "agentId": "new-agent-id-for-ninis",
    "bearerToken": "bearer-token-ninis-salon",
    "squareAccessToken": "EAAAl...<Nini's Square Token>",
    "squareLocationId": "M82AZXQS2UE0C",
    "squareApplicationId": "sq0idp-...",
    "staffEmail": "owner@ninisnails.com",
    "timezone": "America/New_York",
    "businessName": "Nini's Nail Salon"
  }
]
```

## How Retell Knows Which Agent ID to Send

### In Retell AI Dashboard:

1. **Create a Custom Function** (e.g., `GetCustomerInfo`)
2. **Function URL:** `https://square-middleware-prod-api.azurewebsites.net/api/customers/info`
3. **Custom Headers:**
   ```json
   {
     "Authorization": "Bearer {{agent_bearer_token}}",
     "x-agent-id": "{{agent_id}}"
   }
   ```

### In Retell Agent Configuration:

Each agent has metadata/variables you can set:

**Elite Barbershop Agent:**
- `agent_bearer_token` = `test-bearer-token-elite`
- `agent_id` = `895480dde586e4c3712bd4c770`

**Nini's Nail Salon Agent:**
- `agent_bearer_token` = `bearer-token-ninis-salon`
- `agent_id` = `new-agent-id-for-ninis`

### Retell Auto-Substitutes Variables

When the agent calls your API, Retell replaces `{{agent_bearer_token}}` and `{{agent_id}}` with the values from that specific agent's configuration.

## Complete Request Flow Example

### Elite Barbershop Customer Calls

```
1. Customer: "Do you have my phone number on file?"

2. Retell Agent (Elite Barbershop) decides to call GetCustomerInfo

3. Retell sends HTTP request:
   POST https://square-middleware-prod-api.azurewebsites.net/api/customers/info
   Authorization: Bearer test-bearer-token-elite
   x-agent-id: 895480dde586e4c3712bd4c770
   { "phone": "+12677210098" }

4. Your middleware (agentAuthMiddleware):
   - Extracts agentId: "895480dde586e4c3712bd4c770"
   - Looks up agent config from AGENT_CONFIGS
   - Validates bearer token matches "test-bearer-token-elite"
   - Loads Elite Barbershop's Square credentials

5. Your controller (customerController):
   - Uses req.tenant.accessToken (Elite's Square token)
   - Uses req.tenant.locationId (Elite's location ID)
   - Searches Elite's Square customers

6. Response sent back to Retell with Elite's customer data

7. Agent responds: "Yes, I have Nick Dos Santos on file at nick@example.com"
```

### Nini's Nail Salon Customer Calls (Different Agent)

```
1. Customer: "What's my appointment?"

2. Retell Agent (Nini's Salon) calls GetCustomerInfo

3. Retell sends HTTP request:
   POST https://square-middleware-prod-api.azurewebsites.net/api/customers/info
   Authorization: Bearer bearer-token-ninis-salon
   x-agent-id: new-agent-id-for-ninis
   { "phone": "+15551234567" }

4. Your middleware:
   - Extracts agentId: "new-agent-id-for-ninis"
   - Looks up Nini's config
   - Validates bearer token matches "bearer-token-ninis-salon"
   - Loads Nini's Square credentials

5. Your controller:
   - Uses Nini's Square access token
   - Uses Nini's location ID
   - Searches Nini's Square customers

6. Response sent with Nini's customer data
```

## Security Model

### Multi-Layer Security:

1. **Agent ID** - Identifies which business
2. **Bearer Token** - Authenticates the agent (prevents unauthorized access)
3. **Square Access Token** - Agent-specific Square API credentials
4. **HTTPS** - All traffic encrypted
5. **Retell Signature** - Webhook signature verification (for webhooks)

### What Prevents Cross-Tenant Access?

**Example Attack: Elite's agent tries to access Nini's data**

```http
POST /api/customers/info
Authorization: Bearer test-bearer-token-elite  ← Elite's token
x-agent-id: new-agent-id-for-ninis             ← Nini's agent ID (WRONG!)
```

**What happens:**
1. Middleware looks up agent config for "new-agent-id-for-ninis"
2. Finds bearer token should be "bearer-token-ninis-salon"
3. Compares with provided token "test-bearer-token-elite"
4. **MISMATCH** → Returns 403 Forbidden

**Each agent MUST have matching:**
- Agent ID
- Bearer Token
- Square Credentials

## Adding a New Tenant (Business)

### Step 1: Get Square Credentials for New Business

From Square Developer Dashboard:
- Create new application (or use existing)
- Get Access Token for the business
- Get Location ID
- Get Application ID

### Step 2: Generate Unique Identifiers

```bash
# Generate agent ID (or use Retell's agent ID)
AGENT_ID="abc123xyz789"

# Generate bearer token (random secure string)
BEARER_TOKEN=$(openssl rand -hex 32)
```

### Step 3: Update .env.local

```bash
AGENT_CONFIGS=[
  {
    "agentId": "895480dde586e4c3712bd4c770",
    "bearerToken": "test-bearer-token-elite",
    "squareAccessToken": "EAAAl...",
    "squareLocationId": "L71YZWPR1TD9B",
    "squareApplicationId": "sq0idp-...",
    "staffEmail": "owner@elitebarbershop.com",
    "timezone": "America/New_York",
    "businessName": "Elite Barbershop"
  },
  {
    "agentId": "abc123xyz789",
    "bearerToken": "<generated-bearer-token>",
    "squareAccessToken": "<ninis-square-token>",
    "squareLocationId": "<ninis-location-id>",
    "squareApplicationId": "sq0idp-...",
    "staffEmail": "owner@ninisnails.com",
    "timezone": "America/New_York",
    "businessName": "Nini's Nail Salon"
  }
]
```

### Step 4: Deploy to Azure

```bash
./deploy/configure-azure-env.sh
```

### Step 5: Configure Retell Agent

In Retell Dashboard, create new agent with variables:
- `agent_bearer_token` = `<generated-bearer-token>`
- `agent_id` = `abc123xyz789`

Configure custom function headers:
```json
{
  "Authorization": "Bearer {{agent_bearer_token}}",
  "x-agent-id": "{{agent_id}}"
}
```

### Step 6: Test

```bash
curl -X POST https://square-middleware-prod-api.azurewebsites.net/api/customers/info \
  -H "Authorization: Bearer <generated-bearer-token>" \
  -H "x-agent-id: abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+15551234567"}'
```

## Troubleshooting

### Error: "Agent not found"
**Cause:** Agent ID not in AGENT_CONFIGS
**Solution:** Check Azure App Service settings, ensure AGENT_CONFIGS includes the agent

### Error: "Invalid bearer token"
**Cause:** Bearer token doesn't match agent's stored token
**Solution:** Verify Retell agent variable `agent_bearer_token` matches AGENT_CONFIGS

### Error: "Missing x-agent-id header"
**Cause:** Retell function not configured with custom headers
**Solution:** Add custom headers in Retell function configuration

### Wrong Business Data Returned
**Cause:** Wrong agent ID or credentials
**Solution:** Check req.tenant in logs, verify Square credentials are correct

## Key Files

- `/src/middlewares/agentAuth.js` - Agent authentication middleware
- `/src/services/agentConfigService.js` - Loads and manages agent configs
- `/deploy/configure-azure-env.sh` - Deploy script
- `/.env.local` - Local configuration (do not commit!)
- `/AZURE_ENVIRONMENT_VARIABLES.md` - Environment variable documentation

## Summary

**How the system knows which agent is calling:**
1. Retell sends `x-agent-id` header with every request
2. Middleware looks up agent config from `AGENT_CONFIGS`
3. Validates bearer token matches
4. Loads agent-specific Square credentials
5. All subsequent operations use that agent's credentials

**Security:**
- Each agent has unique bearer token
- Bearer token MUST match agent ID
- Square credentials are agent-specific
- No cross-tenant access possible

**Configuration:**
- All agent configs in single `AGENT_CONFIGS` environment variable
- JSON array format
- Deployed via script to Azure App Service
- Retell agents configured with matching credentials
