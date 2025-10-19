# Square Middleware API - Complete Endpoint Documentation

**Version:** 2.0.0  
**Base URL:** `https://square-middleware-prod-api.azurewebsites.net` (Production)  
**Base URL:** `http://localhost:3000` (Development)

---

## Table of Contents

1. [Service Info](#service-info)
2. [Health Monitoring](#health-monitoring)
3. [Customer Management](#customer-management)
4. [Booking Management](#booking-management)
5. [Webhook Integrations](#webhook-integrations)
6. [SMS Messaging](#sms-messaging)
7. [Error Responses](#error-responses)

---

## Service Info

### GET /api

Returns basic service information and API version.

**Method:** `GET`

**Parameters:** None

**Response:**
```json
{
  "service": "Square Middleware API",
  "version": "2.0.0",
  "status": "active",
  "timestamp": "2025-10-18T20:40:33.123Z"
}
```

**Status Codes:**
- `200` - Success

---

## Health Monitoring

### GET /api/health

Basic health check - **NO external API calls**. Fast response for Azure health probes.

**Method:** `GET`

**Parameters:** None

**Response:**
```json
{
  "success": true,
  "message": "Service is healthy",
  "data": {
    "status": "healthy",
    "timestamp": "2025-10-18T20:40:33.123Z",
    "version": "2.0.0",
    "environment": "production",
    "uptime": 438
  }
}
```

**Status Codes:**
- `200` - Service is healthy
- `500` - Service error

---

### GET /api/health/detailed

Detailed health check with all dependencies including Square API connectivity.

**Method:** `GET`

**Parameters:** None

**Response:**
```json
{
  "success": true,
  "message": "Service and dependencies are healthy",
  "data": {
    "status": "healthy",
    "timestamp": "2025-10-18T20:40:33.123Z",
    "version": "2.0.0",
    "environment": "production",
    "uptime": 438,
    "memory": {
      "used": "46 MB",
      "total": "128 MB"
    },
    "dependencies": [
      {
        "name": "Square API",
        "status": "healthy",
        "responseTime": 250
      },
      {
        "name": "Email Service",
        "status": "healthy",
        "responseTime": 150
      },
      {
        "name": "Memory Usage",
        "status": "healthy",
        "details": {
          "heapUsed": "46 MB",
          "heapTotal": "128 MB",
          "heapUsagePercent": "36%",
          "rss": "150 MB"
        }
      },
      {
        "name": "Disk Space",
        "status": "healthy",
        "details": "Sufficient disk space available"
      }
    ]
  }
}
```

**Status Codes:**
- `200` - All dependencies healthy
- `503` - Service degraded (some dependencies unhealthy)

---

### GET /api/health/ready

Readiness probe for Kubernetes/orchestrators. Only checks environment configuration.

**Method:** `GET`

**Parameters:** None

**Response:**
```json
{
  "success": true,
  "message": "Service is ready",
  "data": {
    "ready": true,
    "timestamp": "2025-10-18T20:40:33.123Z"
  }
}
```

**Status Codes:**
- `200` - Service is ready
- `503` - Service not ready

---

### GET /api/health/live

Liveness probe for Kubernetes/orchestrators. Checks if process is running.

**Method:** `GET`

**Parameters:** None

**Response:**
```json
{
  "success": true,
  "message": "Service is alive",
  "data": {
    "alive": true,
    "uptime": 438,
    "timestamp": "2025-10-18T20:40:33.123Z"
  }
}
```

**Status Codes:**
- `200` - Service is alive
- `500` - Service error

---

## Customer Management

### GET /api/customer/info

Get customer information by ID or phone.

**Method:** `GET`

**Headers:**
```
X-Agent-ID: agent_id (required)
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | string | No | Customer ID from Square |
| `phoneNumber` | string | No | Customer phone number (e.g., +12675730180) |

**Response:**
```json
{
  "success": true,
  "message": "Customer information retrieved",
  "data": {
    "customerId": "08FAQHFKW4GPWKG6H22SCPFGXM",
    "firstName": "Nick",
    "lastName": "dos Santos",
    "email": "nick@example.com",
    "phoneNumber": "+12677210098",
    "isReturningCustomer": true,
    "upcomingBookings": [
      {
        "bookingId": "30vh7lgrxazmg3",
        "status": "ACCEPTED",
        "date": "Monday, October 20, 2025",
        "time": "10:00 AM",
        "service": "Regular Haircut",
        "barber": "Nicolas"
      }
    ],
    "bookingHistory": []
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid parameters
- `404` - Customer not found
- `429` - Rate limit exceeded

---

### POST /api/customer/info

Get customer information by phone number (Azure Functions compatibility).

**Method:** `POST`

**Headers:**
```
X-Agent-ID: agent_id (required)
Content-Type: application/json
```

**Body:**
```json
{
  "phoneNumber": "+12677210098"
}
```

**Response:** Same as GET /api/customer/info

**Status Codes:**
- `200` - Success
- `400` - Invalid phone number
- `404` - Customer not found
- `429` - Rate limit exceeded

---

### PUT /api/customer/info

Update customer information.

**Method:** `PUT`

**Headers:**
```
X-Agent-ID: agent_id (required)
Content-Type: application/json
```

**Body:**
```json
{
  "customerId": "08FAQHFKW4GPWKG6H22SCPFGXM",
  "firstName": "Nick",
  "lastName": "dos Santos",
  "email": "nick.updated@example.com",
  "phoneNumber": "+12677210098"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Customer updated successfully",
  "data": {
    "customerId": "08FAQHFKW4GPWKG6H22SCPFGXM",
    "firstName": "Nick",
    "lastName": "dos Santos",
    "email": "nick.updated@example.com",
    "phoneNumber": "+12677210098"
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid parameters
- `404` - Customer not found
- `409` - Conflict
- `429` - Rate limit exceeded

---

### POST /api/customers/bookings

Get customer bookings by customer ID or phone.

**Method:** `POST`

**Headers:**
```
X-Agent-ID: agent_id (required)
Content-Type: application/json
```

**Body:**
```json
{
  "customerId": "08FAQHFKW4GPWKG6H22SCPFGXM"
}
```

OR

```json
{
  "phoneNumber": "+12677210098"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Customer bookings retrieved",
  "data": {
    "customerId": "08FAQHFKW4GPWKG6H22SCPFGXM",
    "upcomingBookings": [
      {
        "bookingId": "30vh7lgrxazmg3",
        "status": "ACCEPTED",
        "startAt": "2025-10-20T14:00:00Z",
        "date": "Monday, October 20, 2025",
        "time": "10:00 AM",
        "service": "Regular Haircut",
        "barber": "Nicolas",
        "location": "Elite Barbershop"
      }
    ],
    "bookingHistory": []
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid parameters
- `404` - Customer not found
- `429` - Rate limit exceeded

---

### PUT /api/customers/:customerId

Update customer information (legacy endpoint).

**Method:** `PUT`

**Parameters:**
- `:customerId` - Customer ID

**Headers:**
```
X-Agent-ID: agent_id (required)
Content-Type: application/json
```

**Body:**
```json
{
  "firstName": "Nick",
  "lastName": "dos Santos",
  "email": "nick@example.com",
  "phoneNumber": "+12677210098"
}
```

**Response:** Same as PUT /api/customer/info

**Status Codes:**
- `200` - Success
- `400` - Invalid parameters
- `404` - Customer not found
- `429` - Rate limit exceeded

---

## Booking Management

### GET /api/availability

Get service availability for booking.

**Method:** `GET`

**Headers:**
```
X-Agent-ID: agent_id (required)
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `daysAhead` | number | No | 14 | Number of days to check ahead |
| `serviceVariationId` | string | No | All | Filter by specific service |
| `teamMemberId` | string | No | All | Filter by specific barber |

**Response:**
```json
{
  "success": true,
  "message": "Availability retrieved",
  "data": {
    "availability": [
      {
        "date": "2025-10-20",
        "dayOfWeek": "Monday",
        "slots": [
          {
            "time": "09:00 AM",
            "available": true,
            "barbers": ["Nicolas", "Marcus"]
          },
          {
            "time": "10:00 AM",
            "available": true,
            "barbers": ["Marcus"]
          },
          {
            "time": "11:00 AM",
            "available": false,
            "barbers": []
          }
        ]
      }
    ]
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid parameters
- `429` - Rate limit exceeded

---

### POST /api/bookings

Create a new booking.

**Method:** `POST`

**Headers:**
```
X-Agent-ID: agent_id (required)
Content-Type: application/json
```

**Body:**
```json
{
  "customerId": "08FAQHFKW4GPWKG6H22SCPFGXM",
  "serviceVariationId": "OBG43DLYYAYBTAL3BKYTTQS6",
  "teamMemberId": "TM1Y3qOc3Elhop-2",
  "startAt": "2025-10-20T14:00:00Z",
  "customerNote": "Please take my beard",
  "sellerNote": "VIP customer"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Booking created successfully",
  "data": {
    "bookingId": "booking_123456",
    "customerId": "08FAQHFKW4GPWKG6H22SCPFGXM",
    "status": "ACCEPTED",
    "startAt": "2025-10-20T14:00:00Z",
    "service": "Regular Haircut",
    "barber": "Nicolas",
    "price": "$30.00"
  }
}
```

**Status Codes:**
- `201` - Created
- `400` - Invalid parameters
- `409` - Booking conflict (time already taken)
- `429` - Rate limit exceeded

---

### GET /api/bookings/:bookingId

Get booking details.

**Method:** `GET`

**Parameters:**
- `:bookingId` - Booking ID

**Headers:**
```
X-Agent-ID: agent_id (required)
```

**Response:**
```json
{
  "success": true,
  "message": "Booking retrieved",
  "data": {
    "bookingId": "booking_123456",
    "customerId": "08FAQHFKW4GPWKG6H22SCPFGXM",
    "status": "ACCEPTED",
    "startAt": "2025-10-20T14:00:00Z",
    "duration": 30,
    "service": "Regular Haircut",
    "barber": "Nicolas",
    "price": "$30.00",
    "customerNote": "Please take my beard",
    "sellerNote": "VIP customer"
  }
}
```

**Status Codes:**
- `200` - Success
- `404` - Booking not found
- `429` - Rate limit exceeded

---

### PUT /api/bookings/:bookingId

Update an existing booking.

**Method:** `PUT`

**Parameters:**
- `:bookingId` - Booking ID

**Headers:**
```
X-Agent-ID: agent_id (required)
Content-Type: application/json
```

**Body:**
```json
{
  "startAt": "2025-10-20T15:00:00Z",
  "teamMemberId": "TMASL62ru9PzaYi9",
  "customerNote": "Updated note",
  "sellerNote": "Staff note"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Booking updated successfully",
  "data": {
    "bookingId": "booking_123456",
    "status": "ACCEPTED",
    "startAt": "2025-10-20T15:00:00Z",
    "service": "Regular Haircut",
    "barber": "Marcus"
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid parameters
- `404` - Booking not found
- `409` - Booking conflict
- `429` - Rate limit exceeded

---

### DELETE /api/bookings/:bookingId

Cancel/delete a booking.

**Method:** `DELETE`

**Parameters:**
- `:bookingId` - Booking ID

**Headers:**
```
X-Agent-ID: agent_id (required)
```

**Response:**
```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "data": {
    "bookingId": "booking_123456",
    "status": "CANCELLED"
  }
}
```

**Status Codes:**
- `200` - Success
- `404` - Booking not found
- `429` - Rate limit exceeded

---

### GET /api/bookings

List bookings with filters (admin/staff endpoint).

**Method:** `GET`

**Headers:**
```
X-Agent-ID: agent_id (required)
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | string | No | Filter by customer |
| `status` | string | No | Filter by status (ACCEPTED, PENDING, CANCELLED) |
| `startDate` | string | No | Start date (ISO 8601) |
| `endDate` | string | No | End date (ISO 8601) |

**Response:**
```json
{
  "success": true,
  "message": "Bookings retrieved",
  "data": {
    "bookings": [
      {
        "bookingId": "booking_123456",
        "customerId": "08FAQHFKW4GPWKG6H22SCPFGXM",
        "status": "ACCEPTED",
        "startAt": "2025-10-20T14:00:00Z",
        "service": "Regular Haircut",
        "barber": "Nicolas"
      }
    ],
    "total": 1
  }
}
```

**Status Codes:**
- `200` - Success
- `429` - Rate limit exceeded

---

### POST /api/bookings/:bookingId/confirm

Confirm booking (changes status from PENDING to ACCEPTED).

**Method:** `POST`

**Parameters:**
- `:bookingId` - Booking ID

**Headers:**
```
X-Agent-ID: agent_id (required)
Content-Type: application/json
```

**Body:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "message": "Booking confirmed successfully",
  "data": {
    "bookingId": "booking_123456",
    "status": "ACCEPTED"
  }
}
```

**Status Codes:**
- `200` - Success
- `404` - Booking not found
- `409` - Booking already confirmed
- `429` - Rate limit exceeded

---

### POST /api/booking (Legacy Endpoint)

Unified booking management endpoint (Azure Functions compatibility).

**Method:** `POST`

**Headers:**
```
X-Agent-ID: agent_id (required)
Content-Type: application/json
```

**Body (action parameter determines operation):**
```json
{
  "action": "create|update|cancel|list|getAvailability",
  "data": { /* depends on action */ }
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid parameters
- `404` - Resource not found
- `429` - Rate limit exceeded

---

## Webhook Integrations

### POST /api/webhooks/square/booking

Square booking webhook handler.

**Method:** `POST`

**Headers:**
```
Content-Type: application/json
X-Square-HMAC-SHA256: signature
```

**Body:**
Square webhook payload (see Square documentation)

**Response:**
```json
{
  "success": true,
  "message": "Webhook processed"
}
```

**Status Codes:**
- `204` - No Content (processed successfully)
- `400` - Invalid signature
- `405` - Method not allowed

---

### POST /api/webhooks/retell

Retell AI webhook handler (call_started and call_analyzed events).

**Method:** `POST`

**Headers:**
```
Content-Type: application/json
X-Retell-Signature: signature
```

**Body:**
```json
{
  "event": "call_started|call_analyzed",
  "call": {
    "call_id": "call_123456",
    "from_number": "+12677210098",
    "agent_id": "agent_123",
    "call_analysis": {}
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook processed"
}
```

**Status Codes:**
- `204` - No Content (processed successfully)
- `400` - Invalid signature
- `405` - Method not allowed

---

### GET /api/webhooks/health

Webhook health check.

**Method:** `GET`

**Response:**
```json
{
  "success": true,
  "message": "Webhook service is healthy",
  "data": {
    "status": "healthy",
    "processedWebhooks": 1542,
    "failedWebhooks": 2,
    "timestamp": "2025-10-18T20:40:33.123Z"
  }
}
```

**Status Codes:**
- `200` - Success

---

## SMS Messaging

### POST /api/sms/send

Send a simple SMS text message.

**Method:** `POST`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "to": "+12675730180",
  "message": "Hello! Your appointment is confirmed for tomorrow at 10:00 AM."
}
```

**Parameters:**
| Parameter | Type | Required | Max Length | Description |
|-----------|------|----------|-----------|-------------|
| `to` | string | Yes | - | Recipient phone (format: +1234567890) |
| `message` | string | Yes | 1600 | SMS message text |

**Response:**
```json
{
  "success": true,
  "message": "SMS sent successfully",
  "data": {
    "messageId": "twilio_123456",
    "to": "+12675730180",
    "status": "sent",
    "timestamp": "2025-10-18T20:40:33.123Z"
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid parameters (bad phone or message)
- `429` - Rate limit exceeded

---

### POST /api/sms/booking-confirmation

Send booking confirmation SMS.

**Method:** `POST`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "bookingId": "booking_123456",
  "customerPhone": "+12677210098"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bookingId` | string | Yes | Booking ID from Square |
| `customerPhone` | string | Yes | Customer phone (format: +1234567890) |

**Response:**
```json
{
  "success": true,
  "message": "Booking confirmation SMS sent",
  "data": {
    "messageId": "twilio_123456",
    "to": "+12677210098",
    "status": "sent",
    "timestamp": "2025-10-18T20:40:33.123Z"
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid parameters
- `404` - Booking not found
- `429` - Rate limit exceeded

---

### POST /api/sms/customer-message

Send customer message to barbershop (used by AI agent for escalation).

**Method:** `POST`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "customerFirstName": "Nick",
  "customerLastName": "dos Santos",
  "customerPhoneNumber": "+12677210098",
  "message": "Customer requesting a custom service not available in booking system",
  "messageTo": "+12678040148"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerFirstName` | string | Yes | Customer first name |
| `customerLastName` | string | Yes | Customer last name |
| `customerPhoneNumber` | string | Yes | Customer phone (format: +1234567890) |
| `message` | string | Yes | Message content (max 1600 chars) |
| `messageTo` | string | No | Override recipient phone (default: business owner) |

**Response:**
```json
{
  "success": true,
  "message": "Customer message sent to barbershop",
  "data": {
    "messageId": "twilio_789012",
    "to": "+12678040148",
    "from": "+12677210098",
    "status": "sent",
    "timestamp": "2025-10-18T20:40:33.123Z"
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid parameters
- `429` - Rate limit exceeded

---

## Error Responses

### Standard Error Response

All errors follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "SpecificErrorType",
  "data": null,
  "timestamp": "2025-10-18T20:40:33.123Z",
  "correlationId": "abc-123-def-456"
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| `200` | OK | Request successful |
| `201` | Created | Resource created successfully |
| `204` | No Content | Webhook processed (no response body) |
| `400` | Bad Request | Invalid parameters or validation failed |
| `401` | Unauthorized | Missing or invalid authentication |
| `404` | Not Found | Resource not found |
| `405` | Method Not Allowed | HTTP method not allowed for endpoint |
| `409` | Conflict | Booking conflict or duplicate operation |
| `429` | Too Many Requests | Rate limit exceeded (100 req/15 min per agent) |
| `500` | Internal Server Error | Server error |
| `503` | Service Unavailable | Service degraded or not ready |

### Common Error Messages

#### Validation Error
```json
{
  "success": false,
  "message": "Validation failed",
  "error": "ValidationError",
  "details": [
    "Field 'phoneNumber' must be a valid phone number in format +1234567890"
  ],
  "timestamp": "2025-10-18T20:40:33.123Z",
  "correlationId": "abc-123-def-456"
}
```

#### Rate Limit Error
```json
{
  "success": false,
  "message": "Too many requests",
  "error": "RateLimitError",
  "data": {
    "retryAfter": 900,
    "resetTime": "2025-10-18T20:55:33.123Z"
  },
  "timestamp": "2025-10-18T20:40:33.123Z",
  "correlationId": "abc-123-def-456"
}
```

#### Authentication Error
```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "AuthenticationError",
  "details": "Missing or invalid X-Agent-ID header",
  "timestamp": "2025-10-18T20:40:33.123Z",
  "correlationId": "abc-123-def-456"
}
```

---

## Authentication

All endpoints (except webhooks and health checks) require the `X-Agent-ID` header:

```
X-Agent-ID: agent_895480dde586e4c3712bd4c770
```

This header identifies the tenant/agent for multi-tenant isolation.

---

## Rate Limiting

**Default Rate Limit:** 100 requests per 15 minutes per agent

When rate limit is exceeded:
- HTTP Status: `429`
- Response includes `Retry-After` header with seconds to wait
- `resetTime` in response indicates when limit resets

---

## Correlation IDs

All requests automatically receive a `X-Correlation-ID` header for tracking:

```
X-Correlation-ID: 3bef551b-f04f-4081-bb6b-3f6ceaa94b47
```

Use this ID for debugging and support requests.

---

## Webhook Security

### Square Webhooks
- Verified using HMAC-SHA256 signature in `X-Square-HMAC-SHA256` header
- Invalid signatures return `400 Bad Request`

### Retell Webhooks
- Verified using signature in `X-Retell-Signature` header
- 5-minute timestamp validation window
- Invalid signatures return `400 Bad Request`

---

## Date/Time Format

All timestamps use ISO 8601 format: `YYYY-MM-DDTHH:mm:ss.sssZ`

Example: `2025-10-18T20:40:33.123Z`

---

## Phone Number Format

All phone numbers must use E.164 format:
- Prefix: `+`
- Country code: 1-3 digits
- National number: 9-14 digits
- Example: `+12677210098`

---

## Pagination

Currently, list endpoints don't use cursor-based pagination. Limits are applied:
- Bookings: max 1000
- Pages fetched: max 25
- Execution time: max 30 seconds

---

## Environment Variables

### Required for Production
- `NODE_ENV=production`
- `PORT=8080`
- `SQUARE_ACCESS_TOKEN` - Square API access token
- `SQUARE_LOCATION_ID` - Square location ID
- `RETELL_API_KEY` - Retell AI API key
- `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASS`, `EMAIL_TO`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`

### Optional
- `APPLICATIONINSIGHTS_CONNECTION_STRING` - Azure Application Insights
- `LOG_LEVEL` - debug, info, warn, error
- `TZ` - Timezone (default: America/New_York)

---

## Support

For issues or questions:
- Check Application Insights logs
- Include correlation ID in support requests
- Review error messages for specific details

**Last Updated:** October 18, 2025
