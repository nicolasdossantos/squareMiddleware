# Retell Agent Tool Configuration Guide

## Overview

This system uses **session-based authentication** for secure agent tool calls:

```text
1. Call Starts
   ├─ Retell sends call_inbound webhook
   ├─ Signature verified (x-retell-signature)
   ├─ Session created with unique call_id
   └─ Webhook response includes callId

2. Agent Makes Tool Calls (within 5 min)
   ├─ Agent sends HTTP request to /api/bookings/cancel, /api/bookings/availability, etc.
   ├─ Request includes x-retell-call-id header with the callId from step 1
   ├─ Middleware looks up session by call_id
   ├─ Loads agent credentials from session
   └─ Tool executes with proper credentials

3. Call Ends
   ├─ Retell sends call_ended webhook
   ├─ Session destroyed, credentials cleared
   └─ No further tool calls accepted for that call_id
```

## How It Works

### 1. Webhook Headers (Retell → Your API)

**call_inbound webhook:**

```text
POST /api/webhooks/retell
Headers:
  x-retell-signature: v=1760915546302,d=0c70a4515361b263...
  Content-Type: application/json

Body:
{
  "event": "call_inbound",
  "call_inbound": {
    "agent_id": "agent_0970558d8c08a3307fde43e798",
    "agent_version": 1,
    "from_number": "+12677210098",
    "to_number": "+12675730180"
  }
}
```

**Response (includes callId):**

```json
{
  "processed": true,
  "event": "call_inbound",
  "agentId": "agent_0970558d8c08a3307fde43e798",
  "callId": "550e8400-e29b-41d4-a716-446655440000",
  "fromNumber": "+12677210098",
  "customerResponse": {...},
  "summary": "Inbound call processed"
}
```

### 2. Tool Call Headers (Agent → Your API)

**When the agent makes a tool call:**

```text
POST /api/bookings/cancel
Headers:
  x-retell-call-id: 550e8400-e29b-41d4-a716-446655440000
  Content-Type: application/json

Body:
{
  "bookingId": "5tjk57c7vep5os"
}
```

**What happens:**

1. Middleware receives request
2. Checks for `x-retell-call-id` header
3. Looks up session: `550e8400-e29b-41d4-a716-446655440000`
4. Loads agent credentials from session (agent_0970558d8c08a3307fde43e798)
5. Executes tool call with proper credentials
6. Returns response to agent

### 3. End Call (Retell → Your API)

**call_ended webhook:**

```json
{
  "event": "call_ended",
  "call": {
    "call_id": "550e8400-e29b-41d4-a716-446655440000",
    "from_number": "+12677210098",
    "to_number": "+12675730180"
  }
}
```

**What happens:**

1. Session destroyed
2. Credentials cleared
3. Any future calls with that call_id are rejected

## Configuring Your Retell Agent

### Step 1: Extract callId from Webhook Response

When your agent starts a call, it receives the `callId` in the webhook response. **Store this in your agent's
memory/context**.

**Example (pseudocode):**

```javascript
// After call_inbound webhook
const callId = webhookResponse.callId;
agent.memory.callId = callId;
```

### Step 2: Add Header to Tool Calls

When defining tools in Retell, add the `x-retell-call-id` header:

**Tool Definition (Example: cancel_booking):**

```json
{
  "name": "cancel_booking",
  "description": "Cancel a customer's booking",
  "request_url": "https://square-middleware-prod-api.azurewebsites.net/api/bookings/cancel",
  "request_method": "POST",
  "headers": {
    "x-retell-call-id": "{{call_id}}"
  },
  "request_params": {
    "bookingId": {
      "type": "string",
      "description": "The booking ID to cancel",
      "required": true
    }
  }
}
```

### Step 3: Pass callId to Tool Calls

In your agent instructions, make sure the agent passes the callId when making tool calls.

**In Retell LLM instructions:**

```text
When making any tool call to the Square Middleware API, ALWAYS include the current call_id in the request headers.
The current call_id was provided at the start of this call.

Use these endpoints:
- POST /api/bookings/cancel (with booking ID)
- GET /api/bookings/availability (with dates)
- etc.
```

## Security Features

✅ **Session-Based**: Each call gets a unique session  
✅ **Time-Limited**: Sessions expire after 10 minutes  
✅ **Auto-Cleanup**: Expired sessions cleaned up every 30 seconds  
✅ **Signature Verification**: Webhooks verified with x-retell-signature  
✅ **No Exposed Credentials**: Credentials stored server-side, not in headers  
✅ **Lifecycle Managed**: Sessions created at call start, destroyed at call end

## Error Handling

If a tool call fails to include the `x-retell-call-id` header:

```json
{
  "error": "Session expired or not found",
  "callId": null
}
```

If the session has expired:

```json
{
  "error": "Session expired or not found",
  "callId": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Monitoring Sessions

The system automatically logs session lifecycle:

```text
[SessionStore] 📝 Session created: 550e8400... (agent: agent_097..., expires in 600s)
[SessionStore] ✅ Session found: 550e8400... (access #1)
[SessionStore] 🗑️  Session destroyed: 550e8400...
[SessionStore] Cleaned up 2 expired sessions (3 remaining)
```

Check Azure App Insights logs for `[SessionStore]` entries to monitor active sessions.

## Testing Flow

1. **Start call**: Call your phone number
2. **Webhook received**: Check Azure logs for `call_inbound` event
3. **Extract callId**: Note the `callId` from logs or webhook response
4. **Tool call**: Agent makes booking query/cancel
5. **Check header**: Verify `x-retell-call-id` header in logs
6. **Session lookup**: Verify session found in middleware logs
7. **Tool executes**: Booking is processed
8. **Call ends**: Check for `call_ended` and `Session destroyed` logs

## Troubleshooting

### "Session expired or not found"

- Ensure `x-retell-call-id` header is being sent
- Check that call hasn't exceeded 10 minutes
- Verify the callId matches the one from call_inbound

### "Invalid signature" on webhook

- Verify `RETELL_API_KEY` is set correctly
- Ensure webhook signature header is present
- Check that request body wasn't modified

### Session cleanup not working

- The system auto-cleans every 30 seconds
- Sessions have 10-minute TTL
- Check logs for `[SessionStore]` cleanup messages

## Architecture Diagram

```text
┌─────────────────────────────────────────────────────────┐
│                    Retell Agent                         │
└─────────────────────────────────────────────────────────┘
                          │
                          │ call_inbound webhook
                          │ (with signature)
                          ▼
┌─────────────────────────────────────────────────────────┐
│  POST /api/webhooks/retell                              │
│  ├─ Verify x-retell-signature                           │
│  ├─ Extract agent_id                                    │
│  ├─ Create session: callId → {agent_id, credentials}    │
│  ├─ Return callId to agent                              │
│  └─ (Agent stores callId in memory)                     │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Agent makes tool calls
                          │ (with x-retell-call-id header)
                          ▼
┌─────────────────────────────────────────────────────────┐
│  POST /api/bookings/cancel etc.                         │
│  Headers: x-retell-call-id: {callId}                    │
│  ├─ agentAuth middleware                                │
│  ├─ Lookup session by callId                            │
│  ├─ Load agent_id + credentials from session            │
│  ├─ Attach to req.tenant                                │
│  └─ Tool executes with credentials                      │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Tool call response
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Response to Agent                                      │
│  {success: true, result: {...}}                         │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Call ends
                          │ call_ended webhook
                          ▼
┌─────────────────────────────────────────────────────────┐
│  POST /api/webhooks/retell                              │
│  ├─ Verify x-retell-signature                           │
│  ├─ Extract call_id                                     │
│  ├─ Destroy session (credentials cleared)               │
│  └─ Future tool calls with this callId rejected         │
└─────────────────────────────────────────────────────────┘
```

## Environment Variables Required

```bash
# Square credentials (used for env var fallback)
SQUARE_ACCESS_TOKEN=sq_live_...
SQUARE_LOCATION_ID=LXXX...
SQUARE_ENVIRONMENT=production

# Retell webhook signature verification
RETELL_API_KEY=your_retell_api_key

# Session management (automatic, no config needed)
```

## Questions?

If you have questions about the session flow or need to debug, check:

- Azure App Insights logs with filter: `[SessionStore]` or `[AgentAuth]`
- Look for `Session created:`, `Session found:`, `Session destroyed:` entries
- Verify webhook responses include `callId` field
