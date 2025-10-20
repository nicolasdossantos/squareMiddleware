# 🔧 Retell Tool Headers Configuration Guide

## Important Discovery

**Retell does NOT automatically send `x-agent-id` header with tool calls.**

You must **manually configure the headers** in each tool's settings in the Retell dashboard using template
variables.

---

## ✅ What You Need to Do

### Step 1: Get Your Agent ID

First, find your agent ID in Retell:

1. Go to https://retell.cc/dashboard
2. Click on your Elite Barbershop agent
3. Look for the **Agent ID** (it will look like: `895480dde586e4c3712bd4c770`)
4. Copy this value

### Step 2: Configure Each Tool

For **each tool** (availability-get, booking-create, booking-update, booking-cancel, customer-info-update):

1. **Go to Retell Dashboard**
2. **Select your Elite Barbershop agent**
3. **Go to: Settings → Custom Functions (or Tools)**
4. **Click Edit on the tool** (e.g., `availability-get`)
5. **Find the "Custom Headers" or "HTTP Headers" section**

### Step 3: Add Required Headers

Add these headers to EACH tool:

```json
{
  "x-retell-signature": "Retell adds this automatically",
  "x-agent-id": "YOUR_AGENT_ID_HERE"
}
```

**Replace `YOUR_AGENT_ID_HERE`** with your actual agent ID from Step 1.

---

## 📝 Detailed Example

### For the `availability-get` Tool:

1. In Retell Dashboard, edit `availability-get` tool
2. Find HTTP Headers section
3. Add headers:

```
Header Name:   x-agent-id
Header Value:  895480dde586e4c3712bd4c770
```

(The x-retell-signature header is added automatically by Retell)

**Tool Settings should look like:**

```
Method: GET or POST (as configured)
URL: https://square-middleware-prod-api.azurewebsites.net/api/bookings/availability
Headers:
  - x-agent-id: 895480dde586e4c3712bd4c770
  - Content-Type: application/json (if POST)
```

### For the `booking-cancel` Tool:

```
Method: POST
URL: https://square-middleware-prod-api.azurewebsites.net/api/bookings/cancel
Headers:
  - x-agent-id: 895480dde586e4c3712bd4c770
  - Content-Type: application/json
```

---

## 🔐 How It Works

### Without Headers:

```
❌ Retell calls your API:
   POST /api/bookings/availability
   Body: { serviceVariationIds: [...], daysAhead: 14 }

❌ Missing headers:
   - x-retell-signature: (only Retell adds this)
   - x-agent-id: (NOT SENT - you must configure)

❌ Your middleware rejects with:
   "Missing x-agent-id header"
```

### With Proper Headers (After Configuration):

```
✅ Retell calls your API:
   POST /api/bookings/availability
   Headers:
     - x-retell-signature: v=1760878707109,d=abc123...
     - x-agent-id: 895480dde586e4c3712bd4c770
   Body: { serviceVariationIds: [...], daysAhead: 14 }

✅ Your middleware:
   1. Verifies x-retell-signature ✓
   2. Extracts x-agent-id from header ✓
   3. Loads config from Key Vault ✓
   4. Sets req.tenant with Square credentials ✓
   5. Proceeds to controller ✓
```

---

## 📋 Tools That Need Configuration

Configure headers for ALL these tools:

1. ✅ **availability-get** - Get available time slots
   - URL: `/api/bookings/availability`
   - Method: GET
2. ✅ **booking-create** - Create new booking
   - URL: `/api/bookings`
   - Method: POST
3. ✅ **booking-update** - Update existing booking
   - URL: `/api/bookings/{bookingId}`
   - Method: PUT
4. ✅ **booking-cancel** - Cancel booking
   - URL: `/api/bookings/cancel`
   - Method: POST
5. ✅ **customer-info-update** - Update customer info
   - URL: `/api/customers/update`
   - Method: POST

---

## 🧪 Testing After Configuration

After you've configured the headers:

1. **Make a test call** through Retell agent
2. **Check Azure logs** for:

   ```
   [AgentAuth] DEBUG - x-agent-id: 895480dde586e4c3712bd4c770
   [AgentAuth] DEBUG - x-retell-signature: v=1760878707109,d=...
   [AgentAuth] ✅ Agent authenticated: 895480dde586e4c3712bd4c770
   ```

3. **If you see errors**, check:
   - ❌ "Missing x-agent-id header" → Configure it in Retell
   - ❌ "Agent not found" → Agent ID doesn't exist in Key Vault
   - ❌ "Invalid signature" → x-retell-signature verification failed

---

## 🔍 Debugging: Check Headers Being Sent

We've added debug logging to show what Retell is actually sending:

```javascript
// In src/middlewares/agentAuth.js
console.log('[AgentAuth] DEBUG - All headers received:', JSON.stringify(req.headers, null, 2));
console.log('[AgentAuth] DEBUG - x-retell-signature:', signatureHeader);
console.log('[AgentAuth] DEBUG - x-agent-id:', agentId);
```

**Check Azure logs to see:**

- What headers Retell is sending
- If x-agent-id is present
- If x-retell-signature is present

---

## 📚 Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│ Retell Agent Makes Tool Call                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ POST /api/bookings/availability                         │
│ Headers (YOU configure in Retell dashboard):            │
│   - x-agent-id: 895480dde586e4c3712bd4c770            │
│                                                         │
│ Headers (Retell adds automatically):                    │
│   - x-retell-signature: v=...,d=...                    │
│                                                         │
│ Body (Retell sends):                                    │
│   { serviceVariationIds: [...], daysAhead: 14 }        │
│                                                         │
└─────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────┐
│ Your API Receives                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ agentAuth Middleware (in src/middlewares/agentAuth.js):│
│   1. Extract x-agent-id from header                    │
│   2. Verify x-retell-signature                         │
│   3. Load agent config from Key Vault                  │
│   4. Attach req.tenant with Square credentials         │
│   5. Call next() to proceed                            │
│                                                         │
│ bookingController.getServiceAvailability():            │
│   - Uses req.tenant.squareAccessToken                  │
│   - Uses req.tenant.squareLocationId                   │
│   - Returns available time slots                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────┐
│ Retell Receives Response                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ HTTP 200 OK                                             │
│ { availabilities: [...], success: true }              │
│                                                         │
│ Retell agent continues call...                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Checklist

Before testing again:

- [ ] Found your Agent ID in Retell dashboard
- [ ] Opened each of 5 tools in Retell dashboard
- [ ] Added `x-agent-id` header to each tool with your Agent ID
- [ ] Saved changes in Retell for each tool
- [ ] Restarted or redeployed your agent (if needed)
- [ ] Ready to test with agent calls

---

## 💡 Key Insight

The `x-agent-id` header is **how your API knows which tenant/agent is calling**:

- ✅ Elite Barbershop agent sends: `x-agent-id: elite-barbershop-id`
- ✅ Your API receives it, loads Elite Barbershop config from Key Vault
- ✅ Uses Elite Barbershop's Square credentials
- ✅ Future: Nini's Nail Salon agent sends: `x-agent-id: ninis-nails-id`
- ✅ Your API loads Nini's config, uses their Square credentials

**One API, multiple tenants, properly authenticated!** 🚀

---

## 📞 Next Steps

1. Configure the headers in Retell dashboard (this is user-facing)
2. Run test call with agent
3. Check Azure logs for the debug output
4. Verify success in logs: `[AgentAuth] ✅ Agent authenticated`
5. If errors, share the debug logs so we can fix

Good luck! Let me know if you hit any issues. 🎯
