# Quick Reference - Function Call Flow

## 🔴 The 8 Gaps - Quick Summary

### BLOCKING (Do First)
1. **X-Retell-API-Key header** not configured in Retell tools
   - Fix: Add header to 5 tools in Retell console
   
2. **Environment variables** not set in Azure
   - Fix: Verify SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, RETELL_API_KEY exist
   - Check: `az webapp config appsettings list --name square-middleware-prod-api`

### BROKEN CODE (Do Second)
3. **Duplicate path** - handleCancelBooking missing tenant parameter
   - File: bookingController.js line 1169
   - Issue: One route works, other route broken

### IMPROVEMENTS (Do Third)
4. Booking ID validation missing
5. Error messages are generic
6. No Square API request/response logging
7. Correlation ID lost in service layer

---

## 📊 Request Journey

```
Retell Agent
   ↓ DELETE /api/bookings/:bookingId
   ↓ Header: X-Retell-API-Key: xyz
Express
   ↓ correlationId middleware ✓
   ↓ agentAuth middleware ⚠️ CRITICAL
     └─ Check: header === env var?
     └─ Create: req.tenant with credentials
   ↓ bookingController.cancelBooking()
   ↓ bookingService.cancelBooking()
   ↓ Square API
   ↓ Response
```

---

## ✅ Verification Commands

```bash
# Check environment variables
az webapp config appsettings list \
  --resource-group square-middleware-prod-rg \
  --name square-middleware-prod-api | grep -E "SQUARE_ACCESS_TOKEN|SQUARE_LOCATION_ID|RETELL_API_KEY"

# Should output all 3 variables with values
```

---

## 🎯 Immediate Actions

### TODAY
- [ ] Run env var verification command above
- [ ] Go to Retell console
- [ ] Add X-Retell-API-Key header to 5 tools
- [ ] Test booking-cancel call

### IF ERROR
- 401? → Check Gap 1 & Gap 2
- 500? → Check Azure logs
- Timeout? → Check network/Azure status

---

## 📖 Read These Docs

Start here: **README_FUNCTION_CALL_ANALYSIS.md** (overview & links)

Deep dive: **FUNCTION_CALL_FLOW_ANALYSIS.md** (complete technical walkthrough)

Visual: **FUNCTION_CALL_VISUAL_REFERENCE.md** (diagrams & timelines)

Debugging: **FUNCTION_CALL_WALKTHROUGH.md** (failure scenarios)

---

## 🚨 Most Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized | Bad credentials or missing header | Check env vars or Retell config |
| 404 Not Found | Booking doesn't exist | Verify booking ID |
| 500 Server Error | Missing tenant context | Check Gap 3 |
| Timeout | Azure or network issue | Check Azure status |

---

## ⚡ The Critical Path

For booking-cancel to work:

```
1. X-Retell-API-Key in request ✓
2. Matches RETELL_API_KEY env var ✓
3. Auth middleware sets req.tenant ✓
4. req.tenant has accessToken ✓
5. req.tenant has locationId ✓
6. Helper receives tenant ✓
7. Square API called with token ✓
8. Success ✓
```

If any step fails → Look at that gap in the docs

---

## 📞 File Locations

All in: `/Users/nickdossantos/Workspace/Business/squareMiddleware/`

- README_FUNCTION_CALL_ANALYSIS.md (start here)
- FUNCTION_CALL_FLOW_ANALYSIS.md (complete reference)
- FUNCTION_CALL_VISUAL_REFERENCE.md (visual learning)
- FUNCTION_CALL_WALKTHROUGH.md (debugging)
- GAPS_EXECUTIVE_SUMMARY.md (gaps & priorities)
- GAPS_SUMMARY.md (detailed gap analysis)
- CODE:
  - src/middlewares/agentAuth.js (auth logic)
  - src/controllers/bookingController.js (cancelBooking)
  - src/utils/helpers/bookingHelpers.js (Square API call)
