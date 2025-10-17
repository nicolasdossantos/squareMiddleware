# Square SDK v42+ Response Structure Reference

**CRITICAL:** All Square SDK v42+ API responses use `response.result.*` structure, NOT direct properties.

## Response Structure Pattern

```javascript
// ❌ OLD (SDK v39 and earlier)
const items = response.objects;
const employees = response.employees;
const customers = response.customers;

// ✅ NEW (SDK v42+)
const items = response.result.objects;
const employees = response.result.employees;
const customers = response.result.customers;
```

## Common API Response Mappings

### Catalog API

```javascript
// searchCatalogObjects
const response = await square.catalogApi.searchCatalogObjects({...});
const items = response.result.objects || [];
const cursor = response.result.cursor;
```

### Employees API

```javascript
// listEmployees
const response = await square.employeesApi.listEmployees(locationId, status);
const employees = response.result.employees || [];
const cursor = response.result.cursor;
```

### Customers API

```javascript
// searchCustomers
const response = await square.customersApi.searchCustomers({...});
const customers = response.result.customers || [];
const cursor = response.result.cursor;

// createCustomer
const response = await square.customersApi.createCustomer({...});
const customer = response.result.customer;

// updateCustomer
const response = await square.customersApi.updateCustomer({...});
const customer = response.result.customer;
```

### Bookings API

```javascript
// listBookings
const response = await square.bookingsApi.listBookings({...});
const bookings = response.result.bookings || [];
const cursor = response.result.cursor;

// createBooking
const response = await square.bookingsApi.createBooking({...});
const booking = response.result.booking;

// updateBooking
const response = await square.bookingsApi.updateBooking({...});
const booking = response.result.booking;

// cancelBooking
const response = await square.bookingsApi.cancelBooking({...});
const booking = response.result.booking;

// retrieveBooking
const response = await square.bookingsApi.retrieveBooking({...});
const booking = response.result.booking;

// searchAvailability
const response = await square.bookingsApi.searchAvailability({...});
const availabilities = response.result.availabilities || [];
```

## Debugging Tips

### 1. Always Check Response Structure First

```javascript
console.log('Response keys:', Object.keys(response));
console.log('Has result?', !!response.result);
console.log('Result keys:', response.result ? Object.keys(response.result) : 'N/A');
```

### 2. Use Safe Fallbacks

```javascript
// Good practice: try result first, fallback to direct property
const items = response.result?.objects || response.objects || [];
```

### 3. Common Response Properties

All responses have these top-level properties:

- `body` - Raw response body
- `headers` - Response headers
- `statusCode` - HTTP status code
- `request` - Original request details
- `result` - **The actual data** (this is what you want!)

## Migration Checklist

When updating code from old SDK to v42+:

- [ ] Change `response.objects` → `response.result.objects`
- [ ] Change `response.employees` → `response.result.employees`
- [ ] Change `response.customers` → `response.result.customers`
- [ ] Change `response.bookings` → `response.result.bookings`
- [ ] Change `response.availabilities` → `response.result.availabilities`
- [ ] Change `response.customer` → `response.result.customer`
- [ ] Change `response.booking` → `response.result.booking`
- [ ] Change `response.cursor` → `response.result.cursor`
- [ ] Change `response.errors` → `response.result.errors`

## Error Handling

Errors are still in `response.result.errors`:

```javascript
if (response.result?.errors && response.result.errors.length > 0) {
  console.error('Square API errors:', response.result.errors);
  // Handle errors
}
```

## Files Already Updated

✅ All files have been updated to use `response.result.*` structure:

- `src/utils/squareUtils.js` - All catalog, employees, customers APIs
- `src/utils/helpers/bookingHelpers.js` - All booking operations
- `src/utils/helpers/availabilityHelpers.js` - Availability search
- `src/controllers/bookingController.js` - Booking controller
- `src/controllers/customerController.js` - Customer controller

## Quick Reference: Response Property by API

| API Method             | Response Property | Full Path                        |
| ---------------------- | ----------------- | -------------------------------- |
| `searchCatalogObjects` | `objects`         | `response.result.objects`        |
| `listEmployees`        | `employees`       | `response.result.employees`      |
| `searchCustomers`      | `customers`       | `response.result.customers`      |
| `createCustomer`       | `customer`        | `response.result.customer`       |
| `updateCustomer`       | `customer`        | `response.result.customer`       |
| `listBookings`         | `bookings`        | `response.result.bookings`       |
| `createBooking`        | `booking`         | `response.result.booking`        |
| `updateBooking`        | `booking`         | `response.result.booking`        |
| `cancelBooking`        | `booking`         | `response.result.booking`        |
| `retrieveBooking`      | `booking`         | `response.result.booking`        |
| `searchAvailability`   | `availabilities`  | `response.result.availabilities` |

---

**Remember:** When debugging any Square API issues, ALWAYS check the response structure first!
