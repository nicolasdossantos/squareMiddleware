# Elite Barbershop - Onboarding Complete! 🎉

**Business Name:** Elite Barbershop  
**Date Onboarded:** October 15, 2025  
**Status:** ✅ Ready for Production

---

## 🔑 **Your Access Credentials**

### API Authentication

**Bearer Token (Keep this secret!):**

```text
772983911747a8081fcfc30b7e4c1edd3f3ff78c0e1dcecb860a281d41b00b96
```

**API Base URL:**

```text
https://square-middleware-prod-api.azurewebsites.net
```

### Configuration Details

| Setting                | Value                            |
| ---------------------- | -------------------------------- |
| **Business Name**      | Elite Barbershop                 |
| **Agent ID**           | agent_895480dde586e4c3712bd4c770 |
| **Square Location ID** | L71YZWPR1TD9B                    |
| **Square Environment** | Production                       |
| **Timezone**           | America/New_York (EST)           |
| **Contact Email**      | hello@fluentfront.ai             |
| **Contact Phone**      | +12677210098                     |

---

## 🚀 **Setup Steps**

### ✅ Step 1: Store Configuration in Azure Key Vault

Run the onboarding script:

```bash
# Make script executable
chmod +x onboard-elite-barbershop.sh

# Run the script
./onboard-elite-barbershop.sh
```

**What this does:**

- Stores Retell API key in Key Vault
- Stores Elite Barbershop configuration (Square credentials, bearer token)
- Verifies storage was successful

---

### ✅ Step 2: Configure Retell Webhook

1. **Log into Retell AI Dashboard:**

   - Go to: <https://app.retellai.com>
   - Navigate to your agent: `agent_895480dde586e4c3712bd4c770`

2. **Set Webhook URL:**

   - In agent settings, find "Webhook URL"
   - Enter: `https://square-middleware-prod-api.azurewebsites.net/api/webhooks/retell`
   - Save changes

3. **Enable Webhook Events:**
   - ✅ call_started
   - ✅ call_analyzed
   - ✅ call_ended
   - ✅ call_inbound (if using inbound calls)

---

### ✅ Step 3: Test the Integration

#### Test 1: Health Check

```bash
curl https://square-middleware-prod-api.azurewebsites.net/api/health

# Expected: { "status": "healthy", "timestamp": "..." }
```

#### Test 2: API Authentication

```bash
curl -X GET "https://square-middleware-prod-api.azurewebsites.net/api/health" \
  -H "Authorization: Bearer 772983911747a8081fcfc30b7e4c1edd3f3ff78c0e1dcecb860a281d41b00b96"

# Expected: { "status": "healthy" }
```

#### Test 3: Square Connection - Get Customer Info

```bash
# Test with your barbershop phone number
curl -X GET "https://square-middleware-prod-api.azurewebsites.net/api/customer/info?phone=%2B12677210098" \
  -H "Authorization: Bearer 772983911747a8081fcfc30b7e4c1edd3f3ff78c0e1dcecb860a281d41b00b96" \
  -H "Content-Type: application/json"

# Expected: Customer data or 404 if not in Square yet
```

#### Test 4: Service Availability

```bash
# Check available appointment slots for next 7 days
curl -X GET "https://square-middleware-prod-api.azurewebsites.net/api/availability?daysAhead=7" \
  -H "Authorization: Bearer 772983911747a8081fcfc30b7e4c1edd3f3ff78c0e1dcecb860a281d41b00b96" \
  -H "Content-Type: application/json"

# Expected: Array of available time slots
```

#### Test 5: Retell Voice Call

1. **Call your Retell phone number**
2. **Have a test conversation:**
   - "Hi, I'd like to book a haircut"
   - Provide test customer info
   - Select a time slot
3. **Check your Square Dashboard:**
   - Go to: <https://squareup.com/dashboard/appointments>
   - Verify the booking appeared
4. **Check Application Insights:**
   - Look for webhook events
   - Verify no errors

---

## 📊 **Monitoring & Dashboards**

### Retell AI Dashboard

- **URL:** <https://app.retellai.com>
- **What to monitor:**
  - Call volume
  - Call duration
  - Transcripts
  - Call success rate

### Square Dashboard

- **URL:** <https://squareup.com/dashboard>
- **What to monitor:**
  - New bookings
  - Customer data
  - Payment processing (if applicable)

### Azure Application Insights

- **URL:** <https://portal.azure.com>
- **What to monitor:**
  - API request volume
  - Response times
  - Error rates
  - Webhook events

---

## 📱 **API Endpoints You Can Use**

### Health & Monitoring

```bash
GET /api/health                # Basic health check
GET /api/health/detailed       # Detailed health with dependencies
GET /health/ready              # Readiness probe
GET /health/live               # Liveness probe
```

### Customer Management

```bash
# Get customer by phone
GET /api/customer/info?phone=+12677210098
Headers: Authorization: Bearer <your-bearer-token>

# Update customer info
PUT /api/customer/info
Headers: Authorization: Bearer <your-bearer-token>
Body: { "customerId": "...", "email": "...", ... }
```

### Booking Management

```bash
# Check availability
GET /api/availability?daysAhead=7
Headers: Authorization: Bearer <your-bearer-token>

# Create booking
POST /api/bookings
Headers: Authorization: Bearer <your-bearer-token>
Body: {
  "customerId": "...",
  "serviceVariationId": "...",
  "startAt": "2025-10-20T14:00:00Z",
  ...
}

# Update booking
PUT /api/bookings/{bookingId}
Headers: Authorization: Bearer <your-bearer-token>
Body: { "startAt": "...", ... }

# Cancel booking
DELETE /api/bookings/{bookingId}
Headers: Authorization: Bearer <your-bearer-token>
```

### Webhooks (Automatic)

```bash
# Retell webhooks (no auth needed - signature verified)
POST /api/webhooks/retell

# Square webhooks (no auth needed - signature verified)
POST /api/webhooks/square/booking
POST /api/webhooks/square/payment
```

---

## 🔒 **Security Best Practices**

### Bearer Token

- ✅ **NEVER commit to git**
- ✅ **NEVER share publicly**
- ✅ **Store in environment variables or secrets manager**
- ✅ **Use HTTPS only**
- ✅ **Rotate periodically (every 90 days recommended)**

### Square Access Token

- ✅ Stored securely in Azure Key Vault
- ✅ Never exposed in API responses
- ✅ Encrypted at rest
- ✅ Only accessible via Azure Managed Identity

### Monitoring

- ✅ Set up alerts for failed requests
- ✅ Monitor for unauthorized access attempts
- ✅ Review logs weekly
- ✅ Track API usage patterns

---

## 🐛 **Troubleshooting**

### Issue: "Unauthorized" Error

**Cause:** Bearer token incorrect or not provided

**Solution:**

```bash
# Verify token in Key Vault
az keyvault secret show \
  --vault-name square-middleware-kv \
  --name agent-895480dde586e4c3712bd4c770 \
  --query "value" -o tsv | jq .bearerToken
```

### Issue: "Agent config not found"

**Cause:** Configuration not stored in Key Vault

**Solution:**

```bash
# Check if secret exists
az keyvault secret show \
  --vault-name square-middleware-kv \
  --name agent-895480dde586e4c3712bd4c770

# Re-run onboarding script if missing
./onboard-elite-barbershop.sh
```

### Issue: Bookings not appearing in Square

**Cause:** Square credentials invalid or location ID incorrect

**Solution:**

```bash
# Test Square API directly
curl -X GET "https://connect.squareup.com/v2/locations/L71YZWPR1TD9B" \
  -H "Square-Version: 2024-10-17" \
  -H "Authorization: Bearer EAAAl1GMw5U8nZA-GsBixNSjKQvSl0ktYKGzIrC09XHY0tQzn8wrZRfIGx-owqpQ"

# Should return location details
```

### Issue: Retell webhooks not received

**Cause:** Webhook URL not configured or signature verification failing

**Solution:**

1. Verify webhook URL in Retell dashboard
2. Check Application Insights for incoming requests
3. Verify Retell API key in Key Vault:

```bash
az keyvault secret show \
  --vault-name square-middleware-kv \
  --name retell-api-key
```

---

## 📞 **Support & Contact**

### Technical Issues

- **Email:** hello@fluentfront.ai
- **Phone:** +12677210098

### Resources

- **API Documentation:** `README.md`
- **Deployment Guide:** `deploy/DEPLOYMENT_GUIDE.md`
- **Scaling Roadmap:** `SCALING_ROADMAP.md`

---

## ✅ **Post-Onboarding Checklist**

### Day 1

- [ ] Run onboarding script successfully
- [ ] Configure Retell webhook URL
- [ ] Make 3 test calls
- [ ] Verify test bookings appear in Square
- [ ] Check Application Insights for events
- [ ] Save bearer token securely

### Week 1

- [ ] Monitor call volume daily
- [ ] Review call transcripts
- [ ] Check booking success rate
- [ ] Verify no errors in logs
- [ ] Customer feedback collection

### Month 1

- [ ] Performance review
- [ ] Call quality assessment
- [ ] Booking conversion rate analysis
- [ ] Cost tracking
- [ ] Customer satisfaction survey

---

## 🎉 **You're All Set!**

Elite Barbershop is now ready to:

- ✅ Receive customer calls via Retell AI
- ✅ Check real-time appointment availability
- ✅ Book appointments directly to Square
- ✅ Update and cancel bookings
- ✅ Manage customer information

**Next Steps:**

1. Run the onboarding script: `./onboard-elite-barbershop.sh`
2. Configure Retell webhook URL
3. Make your first test call
4. Monitor for 24 hours
5. Go live! 🚀

---

**Questions?** Email: hello@fluentfront.ai

**Welcome aboard!** 🎊
