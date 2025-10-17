# Quick Reference: Setting Up a New Business

## Checklist for Adding a New Tenant

### 1. Get Square Credentials ✓

From [Square Developer Dashboard](https://developer.squareup.com):

- [ ] Create/access Square application for the business
- [ ] Copy **Access Token** (starts with `EAAA...`)
- [ ] Copy **Location ID** (e.g., `L71YZWPR1TD9B`)
- [ ] Copy **Application ID** (starts with `sq0idp-...`)
- [ ] Verify environment (sandbox vs production)

### 2. Generate Secure Credentials ✓

```bash
# Generate agent ID (or use Retell's agent ID from dashboard)
AGENT_ID="your-retell-agent-id-from-dashboard"

# Generate random bearer token
BEARER_TOKEN=$(openssl rand -hex 32)
echo "Bearer Token: $BEARER_TOKEN"
```

### 3. Update Local Configuration ✓

Edit `.env.local`:

```json
AGENT_CONFIGS=[
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
    "agentId": "<NEW_AGENT_ID>",
    "bearerToken": "<GENERATED_BEARER_TOKEN>",
    "squareAccessToken": "<SQUARE_ACCESS_TOKEN>",
    "squareLocationId": "<SQUARE_LOCATION_ID>",
    "squareApplicationId": "<SQUARE_APP_ID>",
    "staffEmail": "owner@newbusiness.com",
    "timezone": "America/New_York",
    "businessName": "New Business Name"
  }
]
```

**Required Fields:**
- `agentId` - Unique identifier (use Retell's agent ID)
- `bearerToken` - Secret token for authentication
- `squareAccessToken` - Square API access token
- `squareLocationId` - Square location ID
- `squareApplicationId` - Square application ID
- `staffEmail` - Email for notifications
- `timezone` - Business timezone
- `businessName` - Display name for emails

### 4. Deploy to Azure ✓

```bash
# Run configuration script
./deploy/configure-azure-env.sh

# Verify deployment
az webapp config appsettings list \
  --resource-group square-middleware-prod-rg \
  --name square-middleware-prod-api \
  --query "[?name=='AGENT_CONFIGS'].value" \
  --output tsv | jq .

# Restart app
az webapp restart \
  --resource-group square-middleware-prod-rg \
  --name square-middleware-prod-api
```

### 5. Configure Retell Agent ✓

In [Retell Dashboard](https://beta.retellai.com):

**Create Agent:**
- [ ] Name: "New Business Name - Receptionist"
- [ ] Voice: Choose preferred voice
- [ ] Language: English (or other)

**Set Agent Variables:**
```json
{
  "agent_id": "<NEW_AGENT_ID>",
  "agent_bearer_token": "<GENERATED_BEARER_TOKEN>"
}
```

**Configure Custom Functions:**

For each function (GetCustomerInfo, CreateBooking, etc.):

**Headers:**
```json
{
  "Authorization": "Bearer {{agent_bearer_token}}",
  "x-agent-id": "{{agent_id}}",
  "Content-Type": "application/json"
}
```

**Function URLs:**
- `GetCustomerInfo`: `https://square-middleware-prod-api.azurewebsites.net/api/customers/info`
- `SearchCustomers`: `https://square-middleware-prod-api.azurewebsites.net/api/customers/search`
- `CreateBooking`: `https://square-middleware-prod-api.azurewebsites.net/api/bookings`
- `GetAvailability`: `https://square-middleware-prod-api.azurewebsites.net/api/bookings/availability`
- `GetServices`: `https://square-middleware-prod-api.azurewebsites.net/api/catalog/services`
- `GetStaff`: `https://square-middleware-prod-api.azurewebsites.net/api/team-members`

### 6. Test the Integration ✓

```bash
# Test customer lookup
curl -X POST https://square-middleware-prod-api.azurewebsites.net/api/customers/info \
  -H "Authorization: Bearer <GENERATED_BEARER_TOKEN>" \
  -H "x-agent-id: <NEW_AGENT_ID>" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+15551234567"}'

# Expected response:
# {
#   "success": true,
#   "customer": { ... },
#   "message": "Customer found"
# }
```

**Test all endpoints:**
- [ ] GET `/health` - Health check
- [ ] POST `/api/customers/info` - Customer lookup
- [ ] GET `/api/customers/search` - Customer search
- [ ] POST `/api/bookings` - Create booking
- [ ] GET `/api/bookings/availability` - Check availability
- [ ] GET `/api/catalog/services` - List services
- [ ] GET `/api/team-members` - List staff

### 7. Make a Test Call ✓

- [ ] Call Retell phone number for new agent
- [ ] Test customer lookup: "Do you have my information?"
- [ ] Test availability: "What times are available on Monday?"
- [ ] Test booking: "Book me for a haircut at 2pm"
- [ ] Verify Square booking was created
- [ ] Check email notifications received

### 8. Monitor and Verify ✓

**Check Logs:**
```bash
# View application logs
az webapp log tail \
  --resource-group square-middleware-prod-rg \
  --name square-middleware-prod-api

# Look for authentication logs
# [AgentAuth] Middleware called
# [AgentAuth] Auth successful, setting tenant: <NEW_AGENT_ID>
```

**Check Application Insights:**
- Go to Azure Portal
- Navigate to Application Insights
- Check for errors or warnings
- Verify API calls are successful

**Verify Data Isolation:**
```bash
# Call with new agent credentials
curl ... -H "x-agent-id: <NEW_AGENT_ID>" \
  -H "Authorization: Bearer <NEW_BEARER_TOKEN>"
# Should see NEW business's data

# Call with Elite's credentials
curl ... -H "x-agent-id: 895480dde586e4c3712bd4c770" \
  -H "Authorization: Bearer test-bearer-token-elite"
# Should see Elite's data (different!)
```

## Common Issues

### Issue: "Agent not found"

**Cause:** AGENT_CONFIGS not updated in Azure

**Fix:**
```bash
./deploy/configure-azure-env.sh
az webapp restart --resource-group square-middleware-prod-rg --name square-middleware-prod-api
```

### Issue: "Invalid bearer token"

**Cause:** Mismatch between .env.local and Retell agent variables

**Fix:** Verify bearer token matches in both:
- `.env.local` → `AGENT_CONFIGS[].bearerToken`
- Retell Dashboard → Agent Variables → `agent_bearer_token`

### Issue: "Square API error"

**Cause:** Invalid Square credentials

**Fix:**
1. Verify Square access token is valid
2. Check token has correct permissions
3. Verify location ID exists
4. Confirm environment (sandbox vs production) matches

### Issue: Wrong business data returned

**Cause:** Wrong agent ID in Retell configuration

**Fix:**
1. Check Retell agent variable `agent_id`
2. Verify it matches `agentId` in AGENT_CONFIGS
3. Restart Retell agent

## Security Checklist

- [ ] Bearer token is randomly generated (minimum 32 characters)
- [ ] Bearer token is unique per agent
- [ ] Square access token is for correct business
- [ ] .env.local is NOT committed to Git
- [ ] Production credentials never used in development
- [ ] Each agent can only access its own data
- [ ] Test cross-tenant isolation (try wrong agent ID)

## Rollback Procedure

If something goes wrong:

```bash
# 1. Remove the new agent from AGENT_CONFIGS in .env.local

# 2. Redeploy
./deploy/configure-azure-env.sh

# 3. Restart app
az webapp restart \
  --resource-group square-middleware-prod-rg \
  --name square-middleware-prod-api

# 4. Disable Retell agent in dashboard
```

## Success Criteria

✅ New business agent successfully added when:

- [ ] Agent authenticates successfully (no 401/403 errors)
- [ ] Customer lookups return correct business's customers
- [ ] Bookings create in correct Square location
- [ ] Email notifications use correct business name
- [ ] Cannot access other businesses' data
- [ ] All custom functions work in Retell
- [ ] Test calls complete successfully

## Next Steps After Setup

1. **Configure Retell Prompt:**
   - Update greeting with business name
   - Set working hours
   - Add business-specific FAQs

2. **Test Edge Cases:**
   - No availability scenarios
   - Customer not found
   - Booking conflicts
   - After-hours calls

3. **Set Up Monitoring:**
   - Configure alerts in Application Insights
   - Set up email notifications for errors
   - Monitor call quality in Retell

4. **Document Business-Specific Info:**
   - Special services
   - Pricing
   - Staff schedules
   - Custom policies

## Support

Need help? Check these resources:

- `/MULTI_TENANT_AUTH.md` - Detailed authentication explanation
- `/MULTI_TENANT_FLOW_DIAGRAM.md` - Visual flow diagrams
- `/AZURE_ENVIRONMENT_VARIABLES.md` - Environment variable docs
- Application Insights logs in Azure Portal
- Retell Dashboard logs and analytics
