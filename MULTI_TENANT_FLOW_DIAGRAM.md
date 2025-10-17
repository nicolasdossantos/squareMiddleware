# Multi-Tenant Request Flow Diagram

## Visual Flow: How Agent Authentication Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CUSTOMER CALLS BUSINESS                              │
│  "Hi, I'd like to book a haircut with Carmen for Saturday"              │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  RETELL AI AGENT (Elite Barbershop)                      │
│                                                                           │
│  Agent Variables Configured in Retell Dashboard:                         │
│  • agent_id = "895480dde586e4c3712bd4c770"                               │
│  • agent_bearer_token = "test-bearer-token-elite"                        │
│                                                                           │
│  Agent decides to call: GetAvailability()                                │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             │ HTTP POST Request
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    HTTPS REQUEST TO YOUR API                             │
│                                                                           │
│  POST https://square-middleware-prod-api.azurewebsites.net/api/...      │
│                                                                           │
│  Headers:                                                                │
│  ├─ Authorization: Bearer test-bearer-token-elite                        │
│  ├─ x-agent-id: 895480dde586e4c3712bd4c770                               │
│  └─ Content-Type: application/json                                       │
│                                                                           │
│  Body:                                                                   │
│  {                                                                       │
│    "serviceId": "haircut-service-id",                                   │
│    "staffMemberId": "carmen-id",                                        │
│    "startDate": "2025-10-18"                                            │
│  }                                                                       │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   MIDDLEWARE: agentAuthMiddleware                        │
│                   (src/middlewares/agentAuth.js)                         │
│                                                                           │
│  Step 1: Extract Headers                                                │
│  ├─ agentId = "895480dde586e4c3712bd4c770"                               │
│  └─ bearerToken = "test-bearer-token-elite"                              │
│                                                                           │
│  Step 2: Load AGENT_CONFIGS from Azure Environment                      │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │ AGENT_CONFIGS = [                                        │            │
│  │   {                                                      │            │
│  │     "agentId": "895480dde586e4c3712bd4c770",            │            │
│  │     "bearerToken": "test-bearer-token-elite",           │            │
│  │     "squareAccessToken": "EAAAl...",                    │            │
│  │     "squareLocationId": "L71YZWPR1TD9B",                │            │
│  │     "businessName": "Elite Barbershop"                  │            │
│  │   }                                                      │            │
│  │ ]                                                        │            │
│  └─────────────────────────────────────────────────────────┘            │
│                                                                           │
│  Step 3: Lookup Agent by ID                                             │
│  ✓ Found agent config for "895480dde586e4c3712bd4c770"                   │
│                                                                           │
│  Step 4: Validate Bearer Token                                          │
│  Expected: "test-bearer-token-elite"                                     │
│  Received: "test-bearer-token-elite"                                     │
│  ✓ MATCH - Authentication successful!                                    │
│                                                                           │
│  Step 5: Attach Agent Context to Request                                │
│  req.tenant = {                                                          │
│    id: "895480dde586e4c3712bd4c770",                                     │
│    accessToken: "EAAAl1GMw5U8nZA...",  ← Elite's Square token           │
│    locationId: "L71YZWPR1TD9B",         ← Elite's location              │
│    businessName: "Elite Barbershop",                                     │
│    timezone: "America/New_York"                                          │
│  }                                                                       │
│                                                                           │
│  ✓ Continue to next middleware/controller                                │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONTROLLER: bookingController                         │
│                    (src/controllers/bookingController.js)                │
│                                                                           │
│  const tenant = req.tenant;                                              │
│  // tenant.accessToken = Elite's Square token                            │
│  // tenant.locationId = Elite's Square location                          │
│                                                                           │
│  Calls: bookingService.getAvailability(tenant, params)                   │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SERVICE: bookingService                               │
│                    (src/services/bookingService.js)                      │
│                                                                           │
│  Creates Square API client using tenant credentials:                     │
│  const square = createSquareClient(tenant.accessToken);                  │
│                                                                           │
│  Makes Square API call:                                                 │
│  square.bookingsApi.searchAvailability({...})                            │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SQUARE API (Elite Barbershop)                         │
│                                                                           │
│  Using Access Token: EAAAl1GMw5U8nZA...                                 │
│  Location ID: L71YZWPR1TD9B                                              │
│                                                                           │
│  Searches availability in Elite Barbershop's Square account              │
│  Returns: Available time slots for Carmen                                │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    RESPONSE BACK TO RETELL                               │
│                                                                           │
│  {                                                                       │
│    "slots": [                                                            │
│      {                                                                   │
│        "startAt": "2025-10-18T14:00:00Z",                                │
│        "readable_time": "Saturday, October 18 at 2:00 PM",              │
│        "staffMember": "Carmen"                                           │
│      }                                                                   │
│    ]                                                                     │
│  }                                                                       │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  RETELL AI AGENT RESPONDS TO CUSTOMER                    │
│                                                                           │
│  "Great news! Carmen is available this Saturday at 2:00 PM.              │
│   Would you like me to book that for you?"                               │
└─────────────────────────────────────────────────────────────────────────┘
```

## What Happens with a Different Agent (Nini's Nail Salon)?

```
Customer calls Nini's → Different Retell Agent → Different Headers

Headers:
├─ Authorization: Bearer bearer-token-ninis-salon  ← Different token!
└─ x-agent-id: new-agent-id-for-ninis              ← Different agent ID!

Middleware looks up "new-agent-id-for-ninis" in AGENT_CONFIGS

Finds:
{
  "agentId": "new-agent-id-for-ninis",
  "bearerToken": "bearer-token-ninis-salon",
  "squareAccessToken": "EBBBm...",         ← Nini's Square token
  "squareLocationId": "M82AZXQS2UE0C",     ← Nini's location
  "businessName": "Nini's Nail Salon"
}

Validates token matches ✓

Uses Nini's Square credentials → Nini's customers/availability
```

## Security Validation Example

```
❌ ATTACK SCENARIO: Elite tries to access Nini's data

Request Headers:
├─ Authorization: Bearer test-bearer-token-elite  ← Elite's token
└─ x-agent-id: new-agent-id-for-ninis             ← Nini's agent ID (WRONG!)

Middleware:
1. Looks up agent "new-agent-id-for-ninis"
2. Finds expected token: "bearer-token-ninis-salon"
3. Received token: "test-bearer-token-elite"
4. MISMATCH!

Response: 403 Forbidden
Error: "Invalid bearer token for agent"

✓ Attack blocked - cannot access cross-tenant data!
```

## Configuration in Azure

```
Azure App Service Environment Variables:
┌────────────────────────────────────────────────────────────┐
│ Name: AGENT_CONFIGS                                         │
│ Value: [                                                    │
│   {                                                         │
│     "agentId": "895480dde586e4c3712bd4c770",               │
│     "bearerToken": "test-bearer-token-elite",              │
│     "squareAccessToken": "EAAAl...",                       │
│     "squareLocationId": "L71YZWPR1TD9B",                   │
│     "businessName": "Elite Barbershop"                     │
│   },                                                        │
│   {                                                         │
│     "agentId": "new-agent-id-for-ninis",                   │
│     "bearerToken": "bearer-token-ninis-salon",             │
│     "squareAccessToken": "EBBBm...",                       │
│     "squareLocationId": "M82AZXQS2UE0C",                   │
│     "businessName": "Nini's Nail Salon"                    │
│   }                                                         │
│ ]                                                           │
└────────────────────────────────────────────────────────────┘

Deployed via: ./deploy/configure-azure-env.sh
```

## Retell Configuration

```
Retell Dashboard > Create Agent > Elite Barbershop

Agent Variables:
├─ agent_id = "895480dde586e4c3712bd4c770"
└─ agent_bearer_token = "test-bearer-token-elite"

Custom Function Configuration:

Function Name: GetAvailability
URL: https://square-middleware-prod-api.azurewebsites.net/api/bookings/availability

Headers:
{
  "Authorization": "Bearer {{agent_bearer_token}}",
  "x-agent-id": "{{agent_id}}"
}

When agent calls this function, Retell replaces:
• {{agent_bearer_token}} → "test-bearer-token-elite"
• {{agent_id}} → "895480dde586e4c3712bd4c770"
```

## Key Takeaways

1. **Each Agent = One Business**

   - Elite Barbershop has agent ID `895480dde586e4c3712bd4c770`
   - Nini's Salon has agent ID `new-agent-id-for-ninis`

2. **Authentication is Two-Factor**

   - Agent ID (who you are)
   - Bearer Token (prove it)

3. **Credentials are Per-Agent**

   - Each agent has own Square access token
   - Each agent has own Square location ID
   - Completely isolated data

4. **Configuration is Centralized**

   - All agent configs in `AGENT_CONFIGS` environment variable
   - Deployed to Azure once
   - Retell agents configured with matching credentials

5. **Zero Cross-Tenant Risk**
   - Agent ID + Bearer Token must match
   - Square credentials are per-agent
   - Impossible to access another business's data
