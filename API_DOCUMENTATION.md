# Square Middleware API Documentation

**Base URL:** `https://square-middleware-prod-api.azurewebsites.net/api`

**Authentication:** All endpoints (except webhooks) require Retell agent authentication via one of three methods:
1. `x-retell-call-id` header (for tool calls during active Retell calls)
2. `x-retell-signature` header (for webhook verification)
3. Environment variable credentials (fallback for direct API calls)

---

## Table of Contents

- [Customer Endpoints](#customer-endpoints)
- [Booking Endpoints](#booking-endpoints)
- [Webhook Endpoints](#webhook-endpoints)
- [SMS Endpoints](#sms-endpoints)
- [Health Check Endpoints](#health-check-endpoints)

---

## Customer Endpoints

### GET /customers/info
**Description:** Get customer information by phone or customer ID

**Request:**
```javascript
GET /api/customer/info?phone=+12125551234
// or
GET /api/customer/info?customerId=CUST123
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `phone` | string | Optional | Customer phone number in E.164 format (+1XXXXXXXXXX) |
| `customerId` | string | Optional | Square customer ID |

**Response:**
```json
{
  "success": true,
  "type": "conversation_initiation_client_data",
  "dynamic_variables": {
    "customer_first_name": "John",
    "customer_last_name": "Doe",
    "customer_full_name": "John Doe",
    "customer_email": "john@example.com",
    "customer_phone": "(212) 555-1234",
    "customer_id": "CUST123",
    "is_returning_customer": true,
    "upcoming_bookings_json": "[...]",
    "booking_history_json": "[...]",
    "available_services": "Haircut, Fade, Beard Trim",
    "available_barbers": "Mike, Carlos, Antonio"
  }
}
```

---

### POST /customers/info
**Description:** Get customer information by phone (compatible with legacy Azure Functions)

**Request:**
```json
POST /api/customers/info
Content-Type: application/json

{
  "phone": "+12125551234"
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `phone` | string | Yes | Customer phone number in E.164 format (+1XXXXXXXXXX) |

**Response:** Same as GET endpoint above

---

### PUT /customers/info
**Description:** Update customer information

**Request:**
```json
PUT /api/customers/info
Content-Type: application/json

{
  "customerId": "CUST123",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+12125551234"
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | string | Yes | Square customer ID |
| `firstName` | string | Optional | Customer first name |
| `lastName` | string | Optional | Customer last name |
| `email` | string | Optional | Customer email address |
| `phone` | string | Optional | Customer phone number in E.164 format |

**Response:**
```json
{
  "success": true,
  "message": "Customer updated successfully",
  "customer": {
    "id": "CUST123",
    "givenName": "John",
    "familyName": "Doe",
    "emailAddress": "john@example.com",
    "phoneNumber": "+12125551234"
  }
}
```

---

### PUT /customers/:customerId
**Description:** Update specific customer by ID

**Request:**
```json
PUT /api/customers/CUST123
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com"
}
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `customerId` | string | Square customer ID |

**Body Parameters:** Same as PUT /customers/info (without customerId field)

**Response:** Same as PUT /customers/info

---

### POST /customers/bookings
**Description:** Get all bookings for a customer

**Request:**
```json
POST /api/customers/bookings
Content-Type: application/json

{
  "phone": "+12125551234"
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `phone` | string | Optional* | Customer phone number in E.164 format |
| `customerId` | string | Optional* | Square customer ID |

*At least one is required

**Response:**
```json
{
  "success": true,
  "bookings": [
    {
      "id": "BOOKING123",
      "customerId": "CUST123",
      "serviceVariationId": "SVC123",
      "locationId": "LOC123",
      "staffId": "STAFF123",
      "startAt": "2025-10-20T14:00:00Z",
      "durationMinutes": 30,
      "status": "ACCEPTED",
      "createdAt": "2025-10-19T10:00:00Z"
    }
  ]
}
```

---

## Booking Endpoints

### GET /bookings/availability
**Description:** Get available time slots for booking

**Request:**
```javascript
GET /api/bookings/availability?daysAhead=7&serviceVariationId=SVC123&staffId=STAFF123
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `daysAhead` | number | Optional | Number of days ahead to fetch availability (default: 7) |
| `serviceVariationId` | string | Optional | Filter by specific service variation |
| `staffId` | string | Optional | Filter by specific staff member |
| `locationId` | string | Optional | Override default location ID |

**Response:**
```json
{
  "success": true,
  "availability": [
    {
      "date": "2025-10-20",
      "slots": [
        {
          "time": "09:00",
          "available": true,
          "staffId": "STAFF123",
          "staffName": "Mike"
        },
        {
          "time": "09:30",
          "available": false,
          "reason": "booked"
        }
      ]
    }
  ]
}
```

---

### POST /bookings
**Description:** Create a new booking

**Request:**
```json
POST /api/bookings
Content-Type: application/json

{
  "customerId": "CUST123",
  "customerPhone": "+12125551234",
  "customerFirstName": "John",
  "customerLastName": "Doe",
  "serviceVariationId": "SVC123",
  "staffId": "STAFF123",
  "startTime": "2025-10-20T14:00:00Z",
  "locationId": "LOC123"
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | string | Optional* | Square customer ID (will create if not provided) |
| `customerPhone` | string | Yes | Customer phone in E.164 format |
| `customerFirstName` | string | Yes | Customer first name |
| `customerLastName` | string | Yes | Customer last name |
| `serviceVariationId` | string | Yes | Square service variation ID |
| `staffId` | string | Yes | Square staff member ID |
| `startTime` | string | Yes | ISO 8601 datetime for booking start |
| `locationId` | string | Optional | Override default location ID |

*If not provided, customer will be created or matched by phone

**Response:**
```json
{
  "success": true,
  "booking": {
    "id": "BOOKING123",
    "customerId": "CUST123",
    "serviceVariationId": "SVC123",
    "staffId": "STAFF123",
    "locationId": "LOC123",
    "startAt": "2025-10-20T14:00:00Z",
    "durationMinutes": 30,
    "status": "ACCEPTED",
    "createdAt": "2025-10-19T10:00:00Z"
  },
  "message": "Booking created successfully"
}
```

---

### GET /bookings/:bookingId
**Description:** Get specific booking details

**Request:**
```javascript
GET /api/bookings/BOOKING123
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `bookingId` | string | Square booking ID |

**Response:**
```json
{
  "success": true,
  "booking": {
    "id": "BOOKING123",
    "customerId": "CUST123",
    "serviceVariationId": "SVC123",
    "staffId": "STAFF123",
    "locationId": "LOC123",
    "startAt": "2025-10-20T14:00:00Z",
    "durationMinutes": 30,
    "status": "ACCEPTED",
    "createdAt": "2025-10-19T10:00:00Z"
  }
}
```

---

### PUT /bookings/:bookingId
**Description:** Update an existing booking

**Request:**
```json
PUT /api/bookings/BOOKING123
Content-Type: application/json

{
  "startTime": "2025-10-20T15:00:00Z",
  "staffId": "STAFF456",
  "serviceVariationId": "SVC456"
}
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `bookingId` | string | Square booking ID |

**Body Parameters:** (all optional)
| Parameter | Type | Description |
|-----------|------|-------------|
| `startTime` | string | New ISO 8601 datetime for booking start |
| `staffId` | string | New staff member ID |
| `serviceVariationId` | string | New service variation ID |

**Response:** Updated booking object (same format as GET endpoint)

---

### DELETE /bookings/:bookingId
**Description:** Cancel/delete a booking

**Request:**
```javascript
DELETE /api/bookings/BOOKING123
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `bookingId` | string | Square booking ID |

**Response:**
```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "booking": {
    "id": "BOOKING123",
    "status": "CANCELLED"
  }
}
```

---

### GET /bookings
**Description:** List all bookings with optional filters

**Request:**
```javascript
GET /api/bookings?customerId=CUST123&status=ACCEPTED&limit=10&offset=0
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | string | Optional | Filter by customer ID |
| `staffId` | string | Optional | Filter by staff member ID |
| `status` | string | Optional | Filter by booking status (ACCEPTED, PENDING, CANCELLED) |
| `limit` | number | Optional | Max results to return (default: 50) |
| `offset` | number | Optional | Results offset for pagination (default: 0) |

**Response:**
```json
{
  "success": true,
  "bookings": [...],
  "total": 100,
  "limit": 10,
  "offset": 0
}
```

---

### POST /bookings/:bookingId/confirm
**Description:** Confirm a pending booking (change status to ACCEPTED)

**Request:**
```javascript
POST /api/bookings/BOOKING123/confirm
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `bookingId` | string | Square booking ID |

**Response:**
```json
{
  "success": true,
  "booking": {
    "id": "BOOKING123",
    "status": "ACCEPTED",
    "confirmedAt": "2025-10-19T10:05:00Z"
  }
}
```

---

## Webhook Endpoints

### POST /webhooks/square/booking
**Description:** Receive Square booking webhook events

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | Must be `application/json` |

**Request Body:** Square webhook payload (signature verified internally)

**Response:**
```json
{
  "success": true,
  "message": "Booking webhook processed successfully"
}
```

**Note:** Only POST requests accepted. GET/other methods return 405 Method Not Allowed.

---

### POST /webhooks/retell
**Description:** Receive Retell AI webhook events (call_inbound, call_started, call_ended, call_analyzed)

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | Must be `application/json` |
| `x-retell-signature` | Yes | HMAC-SHA256 signature for verification |

**Request Body:**

#### call_inbound Event
```json
{
  "event": "call_inbound",
  "call_inbound": {
    "agent_id": "AGENT123",
    "from_number": "+12125551234",
    "to_number": "+12025551234"
  }
}
```

#### call_started Event
```json
{
  "event": "call_started",
  "call": {
    "call_id": "CALL123",
    "agent_id": "AGENT123",
    "from_number": "+12125551234",
    "to_number": "+12025551234"
  }
}
```

#### call_ended Event
```json
{
  "event": "call_ended",
  "call": {
    "call_id": "CALL123",
    "agent_id": "AGENT123",
    "duration_seconds": 300
  }
}
```

#### call_analyzed Event
```json
{
  "event": "call_analyzed",
  "call": {
    "call_id": "CALL123",
    "agent_id": "AGENT123",
    "transcript": "...",
    "summary": "..."
  }
}
```

**Response:**
```json
{
  "processed": true,
  "event": "call_inbound",
  "callId": "uuid-v4-string",
  "agentId": "AGENT123",
  "customerResponse": {
    "success": true,
    "dynamic_variables": {
      "call_id": "uuid-v4-string",
      "customer_first_name": "John",
      "customer_last_name": "Doe",
      "available_services": "Haircut, Fade, Beard Trim",
      "available_barbers": "Mike, Carlos, Antonio"
    }
  }
}
```

**Note:** 
- Only POST requests accepted
- Signature verification required
- `call_inbound` response includes `call_id` in dynamic_variables for tool calls
- Agent must send `x-retell-call-id: {{dynamic_variables.call_id}}` header in all tool calls

---

### GET /webhooks/health
**Description:** Webhook health check

**Request:**
```javascript
GET /api/webhooks/health
```

**Response:**
```json
{
  "status": "ok",
  "webhooks": {
    "square": true,
    "retell": true
  }
}
```

---

## SMS Endpoints

### POST /sms/send
**Description:** Send a simple SMS text message

**Request:**
```json
POST /api/sms/send
Content-Type: application/json

{
  "to": "+12125551234",
  "message": "Your booking confirmation code is: 123456"
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to` | string | Yes | Recipient phone in E.164 format (+1XXXXXXXXXX) |
| `message` | string | Yes | SMS message body (max 1600 characters) |

**Response:**
```json
{
  "success": true,
  "messageId": "SM1234567890",
  "to": "+12125551234",
  "sentAt": "2025-10-19T10:05:00Z"
}
```

---

### POST /sms/booking-confirmation
**Description:** Send booking confirmation SMS

**Request:**
```json
POST /api/sms/booking-confirmation
Content-Type: application/json

{
  "bookingId": "BOOKING123",
  "customerPhone": "+12125551234"
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bookingId` | string | Yes | Square booking ID |
| `customerPhone` | string | Yes | Customer phone in E.164 format |

**Response:**
```json
{
  "success": true,
  "messageId": "SM1234567890",
  "message": "Booking confirmation sent successfully"
}
```

---

### POST /sms/customer-message
**Description:** Send customer message to barbershop (used by AI agent for escalation)

**Request:**
```json
POST /api/sms/customer-message
Content-Type: application/json

{
  "customerFirstName": "John",
  "customerLastName": "Doe",
  "customerPhoneNumber": "+12125551234",
  "message": "Customer would like to reschedule their appointment",
  "messageTo": "+12025559876"
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerFirstName` | string | Yes | Customer first name |
| `customerLastName` | string | Yes | Customer last name |
| `customerPhoneNumber` | string | Yes | Customer phone in E.164 format |
| `message` | string | Yes | Message body (max 1600 characters) |
| `messageTo` | string | Optional | Override default staff phone number |

**Response:**
```json
{
  "success": true,
  "messageId": "SM1234567890",
  "message": "Message sent to barbershop staff successfully",
  "sentTo": "+12025559876"
}
```

---

## Health Check Endpoints

### GET /health
**Description:** Basic health check (no auth required)

**Request:**
```javascript
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "service": "square-middleware",
  "uptime": 3600,
  "timestamp": "2025-10-19T10:05:00Z"
}
```

---

### GET /health/detailed
**Description:** Detailed health check with dependencies

**Request:**
```javascript
GET /api/health/detailed
```

**Response:**
```json
{
  "status": "healthy",
  "service": "square-middleware",
  "timestamp": "2025-10-19T10:05:00Z",
  "dependencies": {
    "square_api": "ok",
    "retell_api": "ok",
    "database": "ok"
  },
  "metrics": {
    "uptime": 3600,
    "memory": "45%",
    "cpu": "12%"
  }
}
```

---

### GET /health/ready
**Description:** Readiness probe for Kubernetes/containers

**Request:**
```javascript
GET /api/health/ready
```

**Response:**
```json
{
  "ready": true
}
```

**Status Code:** 200 if ready, 503 if not ready

---

### GET /health/live
**Description:** Liveness probe for Kubernetes/containers

**Request:**
```javascript
GET /api/health/live
```

**Response:**
```json
{
  "alive": true
}
```

**Status Code:** 200 if alive, 503 if not alive

---

## Authentication

### Three Authentication Flows

#### 1. Retell Tool Calls (x-retell-call-id)
Used when Retell agent makes tool calls during an active call.

**Header:**
```
x-retell-call-id: <UUID from call_inbound response>
```

**How it works:**
1. Retell sends `call_inbound` webhook → Server creates session with UUID callId
2. Server returns callId in webhook response → dynamic_variables
3. Agent sends tool calls with `x-retell-call-id: {{dynamic_variables.call_id}}`
4. Server looks up session, retrieves credentials, executes request

#### 2. Webhook Verification (x-retell-signature)
Used for Retell webhook events.

**Header:**
```
x-retell-signature: <HMAC-SHA256 signature>
```

**How it works:**
1. Retell signs webhook with HMAC-SHA256 using shared API key
2. Server verifies signature matches
3. Request passed to webhook handler (session created for future tool calls)

#### 3. Environment Variable Fallback
For direct API calls or backward compatibility.

**Environment Variables:**
```
SQUARE_ACCESS_TOKEN=<token>
SQUARE_LOCATION_ID=<location>
SQUARE_ENVIRONMENT=production
```

---

## Error Responses

All endpoints return consistent error format:

**400 - Bad Request:**
```json
{
  "success": false,
  "error": "Invalid input",
  "details": "Phone number must be in E.164 format",
  "correlationId": "corr-12345"
}
```

**401 - Unauthorized:**
```json
{
  "success": false,
  "error": "Session expired or not found",
  "callId": "uuid-string",
  "correlationId": "corr-12345"
}
```

**405 - Method Not Allowed:**
```json
{
  "error": "Method GET not allowed for this endpoint"
}
```

**500 - Internal Server Error:**
```json
{
  "success": false,
  "error": "Internal server error",
  "correlationId": "corr-12345"
}
```

---

## Rate Limiting

All endpoints are protected by rate limiting:
- **Per IP:** 100 requests per minute
- **Per Agent:** 50 requests per minute during active calls

Rate limit headers included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1697808300
```

---

## Correlation IDs

Every request generates a unique correlation ID for debugging:
- **Header:** `x-correlation-id` (optional in request, included in response)
- **Included in:** All response bodies, logs, error messages
- **Format:** UUID v4

---

## Retell Agent Configuration

To use these endpoints with Retell agents:

1. **Configure agent to receive webhooks:**
   - Add Retell webhook URL: `https://square-middleware-prod-api.azurewebsites.net/api/webhooks/retell`

2. **Extract callId from webhook response:**
   - Response includes `callId` in root and in `dynamic_variables.call_id`

3. **Use callId in tool calls:**
   - In Retell dashboard, add to tool request headers:
   ```
   x-retell-call-id: {{dynamic_variables.call_id}}
   ```

4. **Endpoints available to agent:**
   - `POST /api/bookings` - Create booking
   - `PUT /api/bookings/:bookingId` - Modify booking
   - `DELETE /api/bookings/:bookingId` - Cancel booking
   - `POST /api/customers/info` - Get customer info
   - `POST /api/customers/bookings` - List customer bookings
   - `POST /api/sms/send` - Send SMS
   - Any other endpoint with `x-retell-call-id` header

---

**Last Updated:** October 19, 2025  
**Version:** 2.0.0  
**Status:** Production
