# Retell AI Integration Guide

Complete guide for integrating Square Booking Middleware with Retell AI.

**Last Updated**: December 17, 2024 **API Version**: 2.0.0 **Square SDK**: v42.3.0

---

## 🎯 Quick Start

### Production URLs

**Base URL**: `https://square-middleware-prod-api.azurewebsites.net`

All endpoints use this base URL. For example:

- Health: `https://square-middleware-prod-api.azurewebsites.net/api/health`
- Availability: `https://square-middleware-prod-api.azurewebsites.net/api/bookings/availability`

---

## 🔐 Authentication

All endpoints (except health checks and webhooks) require:

```http
X-Agent-ID: 895480dde586e4c3712bd4c770
Authorization: Bearer test-bearer-token-elite
Content-Type: application/json
```

**Multi-Tenant Configuration:**

- Each agent has dedicated Square credentials
- Configured via `AGENT_CONFIGS` environment variable
- Automatic routing based on `X-Agent-ID` header

---

## 📞 RETELL AI ENDPOINTS

### 1. Get Service Availability

**Endpoint**: `POST /api/bookings/availability`

**Purpose**: Get available time slots for booking services

**Request**:

```json
{
  "serviceId": "SERVICE_ID",
  "startDate": "2025-10-16",
  "endDate": "2025-10-23"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "availabilities": [
      {
        "startAt": "2025-10-16T09:00:00Z",
        "locationId": "LOCATION_ID",
        "appointmentSegments": [...]
      }
    ]
  },
  "message": "Service availability retrieved successfully"
}
```

**Retell Configuration**:

```
Name: GetAvailability
Description: Get available time slots for a service
URL: https://square-middleware-prod-api.azurewebsites.net/api/bookings/availability
Method: POST
Headers:
  X-Agent-ID: {your-agent-id}
  Authorization: Bearer {your-token}
  Content-Type: application/json
```

---

### 2. Get Customer Info by Phone

**Endpoint**: `POST /api/customers/info`

**Purpose**: Look up customer details by phone number

**Request**:

```json
{
  "phoneNumber": "+12677210098"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "CUSTOMER_ID",
      "givenName": "Nick",
      "familyName": "dos Santos",
      "emailAddress": "nick@example.com",
      "phoneNumber": "+12677210098",
      "note": "Customer notes here"
    },
    "activeBookings": [],
    "source": "square_search"
  },
  "message": "Customer information retrieved successfully"
}
```

**Retell Configuration**:

```
Name: GetCustomerInfo
Description: Look up customer by phone number
URL: https://square-middleware-prod-api.azurewebsites.net/api/customers/info
Method: POST
Headers:
  X-Agent-ID: {your-agent-id}
  Authorization: Bearer {your-token}
  Content-Type: application/json
```

---

### 3. Create Booking

**Endpoint**: `POST /api/bookings`

**Purpose**: Create a new booking

**Request**:

```json
{
  "customerId": "CUSTOMER_ID",
  "serviceId": "SERVICE_ID",
  "startAt": "2025-10-16T09:00:00Z",
  "customerNote": "Booking notes"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "booking": {
      "id": "BOOKING_ID",
      "version": 1,
      "status": "ACCEPTED",
      "createdAt": "2024-12-17T20:00:00Z",
      "startAt": "2025-10-16T09:00:00Z",
      "customerId": "CUSTOMER_ID",
      "appointmentSegments": [...]
    }
  },
  "message": "Booking created successfully"
}
```

**Retell Configuration**:

```
Name: CreateBooking
Description: Create a new booking for a customer
URL: https://square-middleware-prod-api.azurewebsites.net/api/bookings
Method: POST
Headers:
  X-Agent-ID: {your-agent-id}
  Authorization: Bearer {your-token}
  Content-Type: application/json
```

---

### 4. Update Customer

**Endpoint**: `PUT /api/customers/{customerId}`

**Purpose**: Update customer information

**Request**:

```json
{
  "emailAddress": "newemail@example.com",
  "givenName": "Nick",
  "familyName": "dos Santos",
  "note": "Updated customer notes"
}
```

**Response**:

```json
{
  "success": true,
  "message": "Customer information updated successfully"
}
```

**Retell Configuration**:

```
Name: UpdateCustomer
Description: Update customer details
URL: https://square-middleware-prod-api.azurewebsites.net/api/customers/{customerId}
Method: PUT
Headers:
  X-Agent-ID: {your-agent-id}
  Authorization: Bearer {your-token}
  Content-Type: application/json
```

---

### 5. Cancel Booking

**Endpoint**: `DELETE /api/bookings/{bookingId}`

**Purpose**: Cancel an existing booking

**Request**: No body required, bookingId in URL

**Response**:

```json
{
  "success": true,
  "data": {
    "booking": {
      "id": "BOOKING_ID",
      "status": "CANCELLED_BY_CUSTOMER",
      "version": 2
    }
  },
  "message": "Booking cancelled successfully"
}
```

**Retell Configuration**:

```
Name: CancelBooking
Description: Cancel an existing booking
URL: https://square-middleware-prod-api.azurewebsites.net/api/bookings/{bookingId}
Method: DELETE
Headers:
  X-Agent-ID: {your-agent-id}
  Authorization: Bearer {your-token}
```

---

### 6. Send SMS

**Endpoint**: `POST /api/sms/send`

**Purpose**: Send SMS confirmation or notification

**Request**:

```json
{
  "to": "+12677210098",
  "message": "Your booking is confirmed for Oct 16 at 9:00 AM"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "sid": "SM...",
    "status": "queued",
    "to": "+12677210098",
    "from": "+12675130090"
  },
  "message": "SMS sent successfully"
}
```

**Retell Configuration**:

```
Name: SendSMS
Description: Send SMS message to customer
URL: https://square-middleware-prod-api.azurewebsites.net/api/sms/send
Method: POST
Headers:
  X-Agent-ID: {your-agent-id}
  Authorization: Bearer {your-token}
  Content-Type: application/json
```

---

## 🔔 WEBHOOK CONFIGURATION

### Retell AI Webhook Receiver

**Endpoint**: `POST /api/webhooks/retell`

**Purpose**: Receive webhook events from Retell AI

**Supported Events**:

- `call_started` - When a call begins
- `call_analyzed` - After call analysis completes
- `call_ended` - When a call ends
- `call_inbound` - For inbound calls

**Webhook URL for Retell Dashboard**:

```
https://square-middleware-prod-api.azurewebsites.net/api/webhooks/retell
```

**Expected Payload** (call_started example):

```json
{
  "event": "call_started",
  "call": {
    "call_id": "call-123",
    "from_number": "+12677210098",
    "to_number": "+12675130090",
    "agent_id": "agent-id",
    "call_status": "in-progress",
    "start_timestamp": 1734480000
  }
}
```

**Response**: `204 No Content` (standard webhook acknowledgment)

**Features**:

- ✅ Automatic customer lookup by phone number
- ✅ Extensive debug logging
- ✅ Correlation ID tracking
- ✅ Multi-event support

---

## 📋 COMPLETE ENDPOINT LIST

### Health Checks (No Auth Required)

```
GET  /api/health          - Basic health check
GET  /api/health/detailed - Detailed system health
GET  /api/health/ready    - Kubernetes readiness probe
GET  /api/health/live     - Kubernetes liveness probe
```

### Customer Management

```
POST /api/customers/info        - Get customer by phone
PUT  /api/customers/{id}        - Update customer info
```

### Booking Management

```
POST   /api/bookings                  - Create booking
GET    /api/bookings/{id}             - Get booking details
GET    /api/bookings                  - List all bookings
PUT    /api/bookings/{id}             - Update booking
DELETE /api/bookings/{id}             - Cancel booking
POST   /api/bookings/availability     - Get available slots
```

### SMS

```
POST /api/sms/send              - Send single SMS
POST /api/sms/send-bulk         - Send multiple SMS
POST /api/sms/send-with-validation - Send with phone validation
```

### Webhooks (No Auth Required - Signature Validated)

```
POST /api/webhooks/retell          - Retell AI events
POST /api/webhooks/square/booking  - Square booking events
```

### Legacy Azure Functions Compatibility

```
ALL /api/booking/{action}  - Supports: list, create, update, cancel, get
```

---

## 🔧 CONFIGURATION

### Environment Variables Required

```bash
# Square API
SQUARE_ACCESS_TOKEN=your-square-token
SQUARE_LOCATION_ID=your-location-id
SQUARE_ENVIRONMENT=production

# Twilio SMS
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_SMS_FROM=+1234567890

# Multi-Tenant Agent Config
AGENT_CONFIGS=[
  {
    "id": "895480dde586e4c3712bd4c770",
    "squareAccessToken": "your-token",
    "squareLocationId": "your-location",
    "squareEnvironment": "production",
    "timezone": "America/New_York",
    "bearerTokens": ["test-bearer-token-elite"]
  }
]
```

---

## 🎨 RETELL AI TOOL CONFIGURATION EXAMPLES

### Complete Tool Setup

#### Tool 1: Get Availability

```json
{
  "name": "GetAvailability",
  "description": "Get available time slots for booking a service. Returns list of available appointment times.",
  "url": "https://square-middleware-prod-api.azurewebsites.net/api/bookings/availability",
  "method": "POST",
  "headers": {
    "X-Agent-ID": "895480dde586e4c3712bd4c770",
    "Authorization": "Bearer test-bearer-token-elite",
    "Content-Type": "application/json"
  },
  "body": {
    "serviceId": "{{serviceId}}",
    "startDate": "{{startDate}}",
    "endDate": "{{endDate}}"
  },
  "parameters": {
    "serviceId": {
      "type": "string",
      "description": "Square service variation ID",
      "required": true
    },
    "startDate": {
      "type": "string",
      "description": "Start date in YYYY-MM-DD format",
      "required": true
    },
    "endDate": {
      "type": "string",
      "description": "End date in YYYY-MM-DD format",
      "required": true
    }
  }
}
```

#### Tool 2: Get Customer Info

```json
{
  "name": "GetCustomerInfo",
  "description": "Look up customer information by phone number. Returns customer details and active bookings.",
  "url": "https://square-middleware-prod-api.azurewebsites.net/api/customers/info",
  "method": "POST",
  "headers": {
    "X-Agent-ID": "895480dde586e4c3712bd4c770",
    "Authorization": "Bearer test-bearer-token-elite",
    "Content-Type": "application/json"
  },
  "body": {
    "phoneNumber": "{{phoneNumber}}"
  },
  "parameters": {
    "phoneNumber": {
      "type": "string",
      "description": "Customer phone number in E.164 format (+1234567890)",
      "required": true
    }
  }
}
```

#### Tool 3: Create Booking

```json
{
  "name": "CreateBooking",
  "description": "Create a new booking for a customer at a specific time slot.",
  "url": "https://square-middleware-prod-api.azurewebsites.net/api/bookings",
  "method": "POST",
  "headers": {
    "X-Agent-ID": "895480dde586e4c3712bd4c770",
    "Authorization": "Bearer test-bearer-token-elite",
    "Content-Type": "application/json"
  },
  "body": {
    "customerId": "{{customerId}}",
    "serviceId": "{{serviceId}}",
    "startAt": "{{startAt}}",
    "customerNote": "{{customerNote}}"
  },
  "parameters": {
    "customerId": {
      "type": "string",
      "description": "Square customer ID",
      "required": true
    },
    "serviceId": {
      "type": "string",
      "description": "Square service variation ID",
      "required": true
    },
    "startAt": {
      "type": "string",
      "description": "Start time in ISO 8601 format (2025-10-16T09:00:00Z)",
      "required": true
    },
    "customerNote": {
      "type": "string",
      "description": "Optional booking notes",
      "required": false
    }
  }
}
```

#### Tool 4: Cancel Booking

```json
{
  "name": "CancelBooking",
  "description": "Cancel an existing booking.",
  "url": "https://square-middleware-prod-api.azurewebsites.net/api/bookings/{{bookingId}}",
  "method": "DELETE",
  "headers": {
    "X-Agent-ID": "895480dde586e4c3712bd4c770",
    "Authorization": "Bearer test-bearer-token-elite"
  },
  "parameters": {
    "bookingId": {
      "type": "string",
      "description": "Square booking ID to cancel",
      "required": true
    }
  }
}
```

#### Tool 5: Send SMS

```json
{
  "name": "SendSMS",
  "description": "Send SMS confirmation or notification to customer.",
  "url": "https://square-middleware-prod-api.azurewebsites.net/api/sms/send",
  "method": "POST",
  "headers": {
    "X-Agent-ID": "895480dde586e4c3712bd4c770",
    "Authorization": "Bearer test-bearer-token-elite",
    "Content-Type": "application/json"
  },
  "body": {
    "to": "{{phoneNumber}}",
    "message": "{{message}}"
  },
  "parameters": {
    "phoneNumber": {
      "type": "string",
      "description": "Recipient phone number in E.164 format",
      "required": true
    },
    "message": {
      "type": "string",
      "description": "SMS message text",
      "required": true
    }
  }
}
```

---

## 📊 TESTING CHECKLIST

### Pre-Deployment

- [x] All 18 endpoints tested
- [x] Authentication working
- [x] Webhook signature validation working
- [x] SMS delivery confirmed
- [x] Square SDK v42+ compatibility verified
- [x] Multi-tenant routing working

### Post-Deployment

- [ ] Update Retell webhook URL
- [ ] Configure Retell tools with production URLs
- [ ] Test end-to-end booking flow
- [ ] Verify SMS notifications
- [ ] Monitor webhook events
- [ ] Check Azure logs

---

## ⚠️ IMPORTANT NOTES

### Square SDK v42+ Pattern

All Square API calls use **separate parameters**, not object wrappers:

```javascript
// ✅ CORRECT
square.bookingsApi.updateBooking(bookingId, { idempotencyKey, booking });

// ❌ WRONG
square.bookingsApi.updateBooking({ bookingId, body: { booking } });
```

### Rate Limiting

- Default: 100 requests per 10 seconds
- Uses express-rate-limit middleware
- Returns 429 when exceeded

### Error Handling

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error message",
  "message": "Detailed description",
  "timestamp": "2024-12-17T20:00:00.000Z"
}
```

### Monitoring

- Correlation IDs on all requests
- Comprehensive logging
- API metrics tracked
- Health check endpoints for Azure/K8s

---

## 🚀 DEPLOYMENT STEPS

1. **Deploy to Azure**:

   ```bash
   cd deploy
   ./azure-deploy.sh
   ```

2. **Configure Twilio**:

   ```bash
   ./store-secrets.sh
   ```

3. **Test Production**:

   ```bash
   curl https://square-middleware-prod-api.azurewebsites.net/api/health
   ```

4. **Update Retell**:

   - Add webhook URL to Retell dashboard
   - Configure 5 tools with production endpoints
   - Test call flow

5. **Monitor**:
   - Check Azure App Service logs
   - Monitor Application Insights
   - Watch health endpoints

---

## 📞 SUPPORT

For issues or questions:

- Check API_TEST_RESULTS.md for test examples
- Review SQUARE_SDK_V42_RESPONSE_STRUCTURE.md for SDK details
- Check Azure logs for detailed error information

**Last Tested**: December 17, 2024 **Test Coverage**: 18/18 endpoints (100%) **Status**: ✅ Production Ready
