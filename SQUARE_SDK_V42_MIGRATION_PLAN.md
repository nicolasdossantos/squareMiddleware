# Square SDK v42+ Migration Plan

## Summary

The Square SDK v42+ has breaking changes in both API object names AND method names. This document outlines all
required changes.

## API Object Name Changes (✅ COMPLETED)

- `square.customers` → `square.customersApi`
- `square.bookings` → `square.bookingsApi`
- `square.catalog` → `square.catalogApi`
- `square.locations` → `square.locationsApi`
- `square.team` → `square.teamApi`

## Method Name Changes Required

### 1. Employees API (❌ NOT FIXED)

**File:** `src/utils/squareUtils.js` line 221

**Current:**

```javascript
const resp = await square.employees.list({
  locationId: tenant.locationId,
  status: 'ACTIVE'
});
```

**Fix Required:**

```javascript
const resp = await square.employeesApi.listEmployees({
  locationId: tenant.locationId,
  status: 'ACTIVE'
});
```

### 2. Catalog API - Missing Parameters (❌ NOT FIXED)

**File:** `src/utils/squareUtils.js` line 135

**Current:**

```javascript
const resp = await square.catalogApi.searchCatalogObjects();
```

**Problem:** The v42+ SDK requires a body parameter object.

**Fix Required:**

```javascript
const resp = await square.catalogApi.searchCatalogObjects({
  objectTypes: ['ITEM_VARIATION'],
  includeRelatedObjects: true,
  cursor: cursor
});
```

### 3. Customers API (✅ COMPLETED)

- ✅ `customersApi.search()` → `customersApi.searchCustomers()`
- ✅ `customersApi.create()` → `customersApi.createCustomer()`
- ✅ `customersApi.update()` → `customersApi.updateCustomer()`

### 4. Bookings API (✅ COMPLETED)

- ✅ `bookingsApi.list()` → `bookingsApi.listBookings()`
- ✅ `bookingsApi.create()` → `bookingsApi.createBooking()`
- ✅ `bookingsApi.update()` → `bookingsApi.updateBooking()`
- ✅ `bookingsApi.cancel()` → `bookingsApi.cancelBooking()`
- ✅ `bookingsApi.get()` → `bookingsApi.retrieveBooking()`
- ✅ `bookingsApi.searchAvailability()` - Already correct!

### 5. Locations API (✅ ALREADY CORRECT)

- ✅ `locationsApi.listLocations()` - Already correct!

## Files Requiring Changes

### Priority 1 - Breaking Current Functionality

1. **src/utils/squareUtils.js**
   - Line 221: Fix `square.employees.list` → `square.employeesApi.listEmployees`
   - Line 135: Fix `square.catalogApi.searchCatalogObjects()` to include required parameters

### Priority 2 - Verification

2. **src/utils/helpers/bookingHelpers.js** - ✅ Already fixed
3. **src/utils/helpers/availabilityHelpers.js** - ✅ Already fixed
4. **src/controllers/customerController.js** - ✅ Already fixed
5. **src/controllers/bookingController.js** - ✅ Already fixed

## Execution Plan

### Step 1: Fix Employees API (CURRENT)

Replace `square.employees.list` with `square.employeesApi.listEmployees` in squareUtils.js line 221

### Step 2: Fix Catalog API Parameters

Add required body parameter to `catalogApi.searchCatalogObjects()` call in squareUtils.js line 135

### Step 3: Test Customer Lookup

Test with:
`curl -X POST http://localhost:3000/api/customers/info -H "Authorization: Bearer test-bearer-token-elite" -H "x-agent-id: 895480dde586e4c3712bd4c770" -d '{"phone": "+12677210098"}'`

### Step 4: Run Full Test Suite

Execute `npm test` to ensure all 509 tests pass

## Available SDK Methods Reference

### customersApi

- listCustomers, searchCustomers, createCustomer, updateCustomer, deleteCustomer, retrieveCustomer
- bulkCreateCustomers, bulkDeleteCustomers, bulkRetrieveCustomers, bulkUpdateCustomers

### bookingsApi

- listBookings, createBooking, updateBooking, cancelBooking, retrieveBooking
- searchAvailability, bulkRetrieveBookings
- Business/Location/TeamMember profile methods

### catalogApi

- searchCatalogObjects, searchCatalogItems, listCatalog
- createCatalogImage, updateCatalogImage, deleteCatalogObject
- batchDeleteCatalogObjects, batchRetrieveCatalogObjects, batchUpsertCatalogObjects

### employeesApi

- listEmployees, retrieveEmployee

### locationsApi

- listLocations, createLocation, updateLocation, retrieveLocation

### teamApi

- searchTeamMembers, createTeamMember, updateTeamMember, retrieveTeamMember
- bulkCreateTeamMembers, bulkUpdateTeamMembers
- Job management methods
