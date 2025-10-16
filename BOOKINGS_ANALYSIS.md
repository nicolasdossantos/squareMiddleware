# Bookings Fetching Analysis - Square SDK v42+

## Current Approach (customerController.js)

### What's Being Done:

1. **Two separate API calls** executed in parallel using `Promise.all()`:

   - **Future bookings**: `listBookings()` with `startAtMin: now.toISOString()`
   - **Past bookings**: `listBookings()` with `startAtMin: 30daysAgo, startAtMax: now`

2. **Post-processing**:

   - Clean BigInt values from responses
   - Filter future bookings: `ACCEPTED` or `PENDING` status
   - Filter past bookings: Only `ACCEPTED` status
   - Sort future bookings: ASC (earliest first)
   - Sort past bookings: DESC (most recent first)
   - Limit to 10 bookings each

3. **Response format issue**:
   - Code checks both `response.result.bookings` AND `response.data` (legacy)
   - This needs to be fixed to only use `response.result.bookings`

### Problems:

- ❌ Still checking for legacy `response.data` format
- ❌ Making 2 separate API calls when we could potentially use 1
- ❌ Doing filtering client-side that could be done server-side

## Available Square SDK v42+ Methods:

```javascript
// Bookings API methods:
listBookings; // List bookings with filters
bulkRetrieveBookings; // Get multiple bookings by IDs (efficient!)
retrieveBooking; // Get single booking by ID
createBooking; // Create new booking
updateBooking; // Update existing booking
cancelBooking; // Cancel booking
searchAvailability; // Search for available time slots
```

## Square API Limitation - No Status Filtering

**CONFIRMED:** The `listBookings` API does NOT support status filtering!

Available query parameters:

- ✅ `limit` - pagination limit
- ✅ `cursor` - pagination cursor
- ✅ `customerId` - filter by customer
- ✅ `teamMemberId` - filter by team member
- ✅ `locationId` - filter by location
- ✅ `startAtMin` - minimum start time
- ✅ `startAtMax` - maximum start time
- ❌ **NO `status` or `bookingStatus` parameter**

**This means client-side filtering is REQUIRED** - there's no way around it.

## Recommended Approach:

### Option 1: Keep Current Approach (2 calls) - ✅ RECOMMENDED

**Why:** listBookings doesn't support status filtering in the query parameters. We MUST fetch all bookings and
filter client-side.

**Improvements needed:**

1. Fix response structure: `response.result.bookings` only
2. Remove legacy `response.data` fallback
3. Keep parallel execution with `Promise.all()`
4. Consider adding pagination if customer has many bookings

**Code changes:**

```javascript
const [futureResponse, pastResponse] = await Promise.all([
  square.bookingsApi.listBookings({
    customerId: customerData.id,
    startAtMin: now.toISOString(),
    limit: 100 // Increase limit to reduce pagination
  }),
  square.bookingsApi.listBookings({
    customerId: customerData.id,
    startAtMin: thirtyDaysAgo.toISOString(),
    startAtMax: now.toISOString(),
    limit: 100 // Increase limit
  })
]);

// Extract bookings from v42+ response structure
const futureBookings = futureResponse.result?.bookings || [];
const pastBookings = pastResponse.result?.bookings || [];
```

### Option 2: Single API Call with Manual Split - ⚠️ NOT RECOMMENDED

Fetch all bookings from 30 days ago to future, then split in-memory:

- **Cons**:
  - More data transferred
  - More client-side processing
  - No performance benefit
  - Less clear intent

### Option 3: Use bulkRetrieveBookings - ❌ NOT APPLICABLE

Only useful if you already have booking IDs. Not relevant for customer lookup.

## Recommended Implementation:

### Fix 1: customerController.js

Update response handling to use `response.result.bookings`:

```javascript
const [futureResponse, pastResponse] = await Promise.all([
  square.bookingsApi.listBookings({
    customerId: customerData.id,
    startAtMin: now.toISOString(),
    limit: 100
  }),
  square.bookingsApi.listBookings({
    customerId: customerData.id,
    startAtMin: thirtyDaysAgo.toISOString(),
    startAtMax: now.toISOString(),
    limit: 100
  })
]);

const futureBookings = futureResponse.result?.bookings || [];
const pastBookings = pastResponse.result?.bookings || [];
```

### Fix 2: Consider pagination

If a customer has >100 bookings, we'll miss some. Consider adding cursor-based pagination:

```javascript
async function getAllBookings(square, params) {
  let allBookings = [];
  let cursor = null;

  do {
    const response = await square.bookingsApi.listBookings({
      ...params,
      cursor
    });

    const bookings = response.result?.bookings || [];
    allBookings.push(...bookings);
    cursor = response.result?.cursor;
  } while (cursor);

  return allBookings;
}
```

### Fix 3: Error handling

Add specific error handling for each API call to provide better debugging.

## Performance Considerations:

**Current approach (2 parallel calls):**

- ✅ Parallel execution = ~200-400ms total
- ✅ Clear separation of concerns
- ✅ Can filter by time ranges server-side
- ❌ Cannot filter by status server-side (must do client-side)

**Single call approach:**

- ⚠️ Same execution time (~200-400ms)
- ❌ More data transferred
- ❌ Less clear intent
- ❌ Still need client-side filtering for status AND time split

## Conclusion:

**Keep the 2-call approach** - it's actually the most efficient and clear way to do this with Square's API
limitations. Just need to:

1. Fix response structure to use `response.result.bookings`
2. Remove legacy `response.data` fallback
3. Optionally increase limit to 100 (from 10/50)
4. Optionally add pagination for customers with many bookings

The current logic is sound - Square API doesn't support status filtering in queries, so client-side filtering
is necessary regardless of the approach.
