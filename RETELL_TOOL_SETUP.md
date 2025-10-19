# Retell Agent Tool Configuration

## Problem
Retell's tool definitions don't support custom headers (like `X-Agent-ID`), so API calls were failing with 401 Unauthorized.

## Solution
Updated API to accept Retell agent calls using the `X-Retell-API-Key` header instead.

## Required Setup in Retell Dashboard

For **each tool** in your Elite Barbershop agent, add this header to all HTTP requests:

### Header Configuration
```
Header Name: X-Retell-API-Key
Header Value: <your-retell-api-key>
```

### Tools That Need This Header

1. **availability-get**
   - Endpoint: `https://square-middleware-prod-api.azurewebsites.net/api/availability`
   - Method: `GET`
   - Headers: `X-Retell-API-Key: <RETELL_API_KEY>`

2. **booking-create**
   - Endpoint: `https://square-middleware-prod-api.azurewebsites.net/api/bookings`
   - Method: `POST`
   - Headers: `X-Retell-API-Key: <RETELL_API_KEY>`

3. **booking-update**
   - Endpoint: `https://square-middleware-prod-api.azurewebsites.net/api/bookings/{bookingId}`
   - Method: `PUT`
   - Headers: `X-Retell-API-Key: <RETELL_API_KEY>`

4. **booking-cancel**
   - Endpoint: `https://square-middleware-prod-api.azurewebsites.net/api/bookings/{bookingId}`
   - Method: `DELETE`
   - Headers: `X-Retell-API-Key: <RETELL_API_KEY>`

5. **customer-info-update**
   - Endpoint: `https://square-middleware-prod-api.azurewebsites.net/api/customer/info`
   - Method: `PUT`
   - Headers: `X-Retell-API-Key: <RETELL_API_KEY>`

## Steps in Retell Console

1. Go to **Agent Settings** → **Tools**
2. For each tool, click **Edit**
3. Add custom HTTP header:
   - Name: `X-Retell-API-Key`
   - Value: `<your-actual-retell-api-key-value>`
4. Save and deploy

## Verification

After updating tools in Retell, make a test call. You should see:
- ✅ Tool calls succeed with 200/201 responses
- ❌ No more 401 errors

The logs will show:
```
info: Calling tool: booking-cancel
Arguments: {"bookingId":"30vh7lgrxazmg3"}
```

And in your server:
```
✅ Agent authenticated via X-Retell-API-Key header
```

## Environment Variable

Ensure `RETELL_API_KEY` is set in your Azure App Service:

```bash
az webapp config appsettings set \
  --resource-group square-middleware-prod-rg \
  --name square-middleware-prod-api \
  --settings RETELL_API_KEY="<your-retell-api-key>"
```

Verify it's set:
```bash
az webapp config appsettings list \
  --resource-group square-middleware-prod-rg \
  --name square-middleware-prod-api \
  | grep RETELL_API_KEY
```

## Testing Without Retell

To test locally with curl:

```bash
curl -X DELETE \
  https://square-middleware-prod-api.azurewebsites.net/api/bookings/30vh7lgrxazmg3 \
  -H "X-Retell-API-Key: <RETELL_API_KEY>"
```

Should return:
```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "data": {
    "bookingId": "30vh7lgrxazmg3",
    "status": "CANCELLED"
  }
}
```

---

**Last Updated:** October 19, 2025
