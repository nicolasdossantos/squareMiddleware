// shared/squareUtils.js
//
// 🔴 IMPORTANT: Square SDK v42+ Response Structure
// All API responses use response.result.* (NOT direct properties)
// See SQUARE_SDK_V42_RESPONSE_STRUCTURE.md for complete reference
//
const { Client: SquareClient, Environment } = require('square/legacy');
const { logCacheHit, logApiCall, trackException } = require('./telemetry');
const { toBigInt, bigIntReplacer, cleanBigIntFromObject } = require('./helpers/bigIntUtils');
const { logger } = require('./logger');
const circuitBreaker = require('./circuitBreaker');
const queryCoalescer = require('./queryCoalescing');

// Cache TTL constants
const CATALOG_TTL = 24 * 60 * 60 * 1000; // 24 hours
const STAFF_TTL = 24 * 60 * 60 * 1000; // 24 hours (renamed from BARBER_TTL)
const CLIENT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const CLIENT_CACHE_MAX_SIZE = 50;

// Tenant-scoped in-memory caches
// Structure: { [tenantId]: { data: {...}, fetched: timestamp } }
const catalogCaches = new Map();
const staffCaches = new Map(); // Renamed from barberCache
const clientCache = new Map(); // Keyed by accessToken + environment

function pruneClientCache() {
  const now = Date.now();
  for (const [key, entry] of clientCache) {
    if (now - entry.lastUsed > CLIENT_CACHE_TTL) {
      clientCache.delete(key);
    }
  }

  if (clientCache.size <= CLIENT_CACHE_MAX_SIZE) {
    return;
  }

  const sortedKeys = Array.from(clientCache.entries()).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  for (const [key] of sortedKeys) {
    clientCache.delete(key);
    if (clientCache.size <= CLIENT_CACHE_MAX_SIZE) {
      break;
    }
  }
}

/**
 * Create a Square SDK client for a specific tenant
 * @param {string} accessToken - Square API access token
 * @param {string} environment - Square environment (sandbox/production)
 * @returns {SquareClient} Configured Square client instance
 */
function createSquareClient(accessToken, environment = 'production') {
  const normalizedEnvironment = environment === 'sandbox' ? 'sandbox' : 'production';
  const cacheKey = `${accessToken || 'anonymous'}:${normalizedEnvironment}`;

  if (clientCache.has(cacheKey)) {
    const cached = clientCache.get(cacheKey);
    cached.lastUsed = Date.now();
    logger.debug('Reusing cached Square client', {
      environment: normalizedEnvironment,
      hasToken: !!accessToken,
      cacheSize: clientCache.size
    });
    return cached.client;
  }

  logger.debug('Creating new Square client', {
    hasToken: !!accessToken,
    tokenLength: accessToken?.length,
    environment: normalizedEnvironment
  });

  const client = new SquareClient({
    accessToken: accessToken,
    environment: normalizedEnvironment === 'sandbox' ? Environment.Sandbox : Environment.Production
  });

  logger.debug('Square client created', {
    hasCustomers: !!client.customers
  });

  clientCache.set(cacheKey, { client, lastUsed: Date.now() });
  pruneClientCache();

  return client;
}

/**
 * Get tenant-scoped cache
 * @param {Map} cacheMap - Cache map to retrieve from
 * @param {string} tenantId - Tenant identifier
 * @returns {Object} Cache object with data and fetched timestamp
 */
function getTenantCache(cacheMap, tenantId) {
  if (!cacheMap.has(tenantId)) {
    cacheMap.set(tenantId, { data: null, fetched: 0 });
  }
  return cacheMap.get(tenantId);
}

/**
 * Set tenant-scoped cache
 * @param {Map} cacheMap - Cache map to update
 * @param {string} tenantId - Tenant identifier
 * @param {Object} data - Data to cache
 */
function setTenantCache(cacheMap, tenantId, data) {
  cacheMap.set(tenantId, { data, fetched: Date.now() });
}

/**
 * Format ISO timestamp to local time
 * @param {string} iso - ISO timestamp
 * @param {string} timezone - Timezone (defaults to America/New_York)
 * @returns {string} Formatted timestamp
 */
function fmtLocal(iso, timezone = 'America/New_York') {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(iso));
}

/**
 * Validate legacy environment variables (for backward compatibility)
 * @deprecated Use tenant context instead
 */
function validateEnvironment() {
  if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
    throw new Error('Missing Square environment variables');
  }

  // Check for placeholder values
  if (
    process.env.SQUARE_ACCESS_TOKEN.includes('your_square_access_token_here') ||
    process.env.SQUARE_LOCATION_ID.includes('your_square_location_id_here')
  ) {
    throw new Error(
      'Square environment variables contain placeholder values. Please configure real credentials.'
    );
  }

  // Basic validation for Square token format
  if (process.env.SQUARE_ACCESS_TOKEN.length < 20) {
    throw new Error('Square Access Token appears to be invalid (too short)');
  }
}

/**
 * Load service variations from Square catalog
 * @param {Object} context - Request context with logging
 * @param {Object} tenant - Tenant context with credentials
 * @returns {Object} Service catalog data
 */
async function loadServiceVariations(context, tenant) {
  const now = Date.now();
  const startTime = now;

  // Get tenant-specific cache
  const tenantCache = getTenantCache(catalogCaches, tenant.id);

  // Check cache first
  if (tenantCache.data && now - tenantCache.fetched < CATALOG_TTL) {
    logCacheHit(context, 'catalog', true);
    return tenantCache.data;
  }

  logCacheHit(context, 'catalog', false);
  let cursor;
  const allServices = [];

  try {
    // Create tenant-specific Square client
    const square = createSquareClient(
      tenant.accessToken || tenant.squareAccessToken,
      tenant.squareEnvironment || tenant.environment || 'production'
    );

    do {
      const apiStartTime = Date.now();
      const resp = await square.catalogApi.searchCatalogObjects({
        objectTypes: ['ITEM'],
        includeRelatedObjects: true,
        cursor: cursor
      });

      const apiDuration = Date.now() - apiStartTime;

      const objects = resp.result?.objects || [];

      logApiCall(context, 'catalog_search', true, apiDuration, {
        object_count: objects.length,
        tenant_id: tenant.id
      });

      context.log('Catalog response received, object count:', objects.length);

      if (objects.length > 0) {
        allServices.push(...objects);
      }

      cursor = resp.result?.cursor;
    } while (cursor);

    const services = allServices
      .filter(obj => obj.type === 'ITEM' && obj.itemData?.productType === 'APPOINTMENTS_SERVICE')
      .map(item => ({
        id: item.id,
        name: item.itemData.name,
        description: item.itemData.description || '',
        imageIds: item.itemData.imageIds || [],
        variations:
          item.itemData.variations?.map(variation => ({
            id: variation.id,
            name: variation.itemVariationData.name,
            price: variation.itemVariationData.priceMoney?.amount,
            currency: variation.itemVariationData.priceMoney?.currency,
            duration: variation.itemVariationData.serviceDuration,
            teamMemberIds: variation.itemVariationData.teamMemberIds || []
          })) || []
      }));

    context.log(`Loaded ${services.length} appointment services`);

    const processedData = { services };
    setTenantCache(catalogCaches, tenant.id, processedData);
    return processedData;
  } catch (error) {
    const apiDuration = Date.now() - startTime;
    logApiCall(context, 'catalog_search', false, apiDuration);
    trackException(error, { function: 'loadServiceVariations', tenant_id: tenant.id });
    context.log('❌ Error loading service variations:', error);

    // Provide more specific error messages for common issues
    if (error.statusCode === 401 || (error.message && error.message.includes('UNAUTHORIZED'))) {
      throw {
        message: 'Square API authentication failed. Please check your access token.',
        code: 'AUTH_FAILED',
        status: 401
      };
    } else if (error.statusCode === 403) {
      throw {
        message: 'Square API access forbidden. Please check your permissions.',
        code: 'FORBIDDEN',
        status: 403
      };
    } else if (error.statusCode >= 500) {
      throw {
        message: 'Square API server error. Please try again later.',
        code: 'SERVER_ERROR',
        status: 503
      };
    }

    throw {
      message: error.message || 'Failed to load service variations',
      code: error.code || 'SQUARE_ERROR',
      status: error.statusCode || 500
    };
  }
}

/**
 * Load staff members (employees) from Square
 * @param {Object} context - Request context with logging
 * @param {Object} tenant - Tenant context with credentials
 * @returns {Object} Staff members data
 */
async function loadStaffMembers(context, tenant) {
  const now = Date.now();
  const startTime = now;

  // Get tenant-specific cache
  const tenantCache = getTenantCache(staffCaches, tenant.id);

  // Check cache first
  if (tenantCache.data && now - tenantCache.fetched < STAFF_TTL) {
    logCacheHit(context, 'staff_members', true);
    return tenantCache.data;
  }

  logCacheHit(context, 'staff_members', false);

  // Use query coalescing to prevent redundant API calls
  const coalescingKey = `staff-${tenant.id}`;
  const result = await queryCoalescer.coalesce(
    coalescingKey,
    async () => {
      // Create tenant-specific Square client
      const square = createSquareClient(
        tenant.accessToken || tenant.squareAccessToken,
        tenant.squareEnvironment || tenant.environment || 'production'
      );

      const locationId = tenant.locationId || tenant.squareLocationId;
      const staffMembers = [];

      try {
        const apiStartTime = Date.now();
        const resp = await square.employeesApi.listEmployees(locationId, 'ACTIVE');
        const apiDuration = Date.now() - apiStartTime;

        const employees = resp.result?.employees || [];

        logApiCall(context, 'employees_list', true, apiDuration, {
          employee_count: employees.length,
          tenant_id: tenant.id
        });

        context.log(`Staff members response received, employee count: ${employees.length}`);

        employees.forEach(employee => {
          staffMembers.push({
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            fullName: `${employee.firstName} ${employee.lastName}`.trim(),
            email: employee.email,
            phoneNumber: employee.phoneNumber,
            isOwner: employee.isOwner || false,
            status: employee.status,
            locationIds: employee.locationIds || []
          });
        });
      } catch (employeesError) {
        const apiDuration = Date.now() - startTime;
        logApiCall(context, 'employees_list', false, apiDuration);
        trackException(employeesError, {
          function: 'loadStaffMembers_employeesApi',
          tenant_id: tenant.id
        });
        context.log('⚠️  employeesApi failed, attempting teamMembersApi fallback', employeesError);

        try {
          const fallbackStart = Date.now();
          const resp = await square.teamMembersApi.searchTeamMembers({
            query: {
              filter: {
                locationIds: locationId ? [locationId] : undefined,
                status: 'ACTIVE'
              }
            }
          });
          const fallbackDuration = Date.now() - fallbackStart;

          const teamMembers = resp.result?.teamMembers || [];

          logApiCall(context, 'team_members_search', true, fallbackDuration, {
            team_member_count: teamMembers.length,
            tenant_id: tenant.id
          });

          context.log(`Team members fallback response received, count: ${teamMembers.length}`);

          teamMembers.forEach(member => {
            staffMembers.push({
              id: member.id,
              firstName: member.givenName,
              lastName: member.familyName,
              fullName: `${member.givenName || ''} ${member.familyName || ''}`.trim(),
              email: member.emailAddress,
              phoneNumber: member.phoneNumber,
              isOwner: member.isOwner || false,
              status: member.status,
              locationIds: member.assignedLocations?.locationIds || []
            });
          });
        } catch (teamMembersError) {
          trackException(teamMembersError, {
            function: 'loadStaffMembers_teamMembersFallback',
            tenant_id: tenant.id
          });
          context.log(
            '❌ Both employeesApi and teamMembersApi failed to load staff members',
            teamMembersError
          );
          throw teamMembersError;
        }
      }

      context.log(`Loaded ${staffMembers.length} active staff members`);

      const processedData = { staffMembers };
      setTenantCache(staffCaches, tenant.id, processedData);
      return processedData;
    },
    5000 // 5 second TTL for query coalescing
  );

  return result;
}

/**
 * @deprecated Use loadStaffMembers instead
 * Kept for backward compatibility
 */
async function loadBarbers(context, tenant) {
  context.log?.warn?.('loadBarbers is deprecated, use loadStaffMembers instead');
  return loadStaffMembers(context, tenant);
}

// Validation Functions

function validateServiceVariationId(serviceVariationId, servicesArray = null) {
  // Basic format validation first
  if (!serviceVariationId || typeof serviceVariationId !== 'string') {
    return { isValid: false, error: 'Invalid service variation ID' };
  }

  // Check for empty strings after trimming
  if (serviceVariationId.trim() === '') {
    return { isValid: false, error: 'Service variation ID cannot be empty' };
  }

  // Square IDs should have minimum length (typically 16+ characters)
  if (serviceVariationId.length < 10) {
    return { isValid: false, error: 'Service variation ID is too short' };
  }

  // Check maximum length
  if (serviceVariationId.length > 100) {
    return { isValid: false, error: 'Service variation ID is too long' };
  }

  // Basic format validation for Square IDs (typically alphanumeric)
  if (!/^[A-Z0-9_-]+$/i.test(serviceVariationId)) {
    return { isValid: false, error: 'Service variation ID contains invalid characters' };
  }

  // If services array is provided, validate against actual catalog
  if (servicesArray && Array.isArray(servicesArray)) {
    const serviceExists = servicesArray.some(
      service =>
        service.variations && service.variations.some(variation => variation.id === serviceVariationId)
    );

    if (!serviceExists) {
      return { isValid: false, error: 'Service variation ID not found in catalog' };
    }
  }

  return { isValid: true };
}

/**
 * Validate staff member ID
 * @param {Object} context - Request context
 * @param {Object} tenant - Tenant context
 * @param {string} staffMemberId - Staff member ID to validate
 * @param {Array} staffMembersArray - Optional pre-loaded staff members array
 * @returns {Object} Validation result
 */
async function validateStaffMemberId(context, tenant, staffMemberId, staffMembersArray = null) {
  // Null/undefined are allowed (optional parameter)
  if (staffMemberId === null || staffMemberId === undefined) {
    return { isValid: true };
  }

  if (typeof staffMemberId !== 'string') {
    return { isValid: false, error: 'Invalid staff member ID' };
  }

  // Check for empty strings
  if (staffMemberId.trim() === '') {
    return { isValid: false, error: 'Staff member ID cannot be empty when provided' };
  }

  // Square IDs should have minimum length
  if (staffMemberId.length < 10) {
    return { isValid: false, error: 'Staff member ID is too short' };
  }

  // Check maximum length
  if (staffMemberId.length > 100) {
    return { isValid: false, error: 'Staff member ID is too long' };
  }

  // Basic format validation for Square IDs (typically alphanumeric)
  if (!/^[A-Z0-9_-]+$/i.test(staffMemberId)) {
    return { isValid: false, error: 'Staff member ID contains invalid characters' };
  }

  // If staffMembersArray is provided, validate against actual catalog
  // If not provided, try to load the staff members to validate
  let staffMembers = staffMembersArray;
  if (!staffMembers && context && tenant) {
    try {
      const staffData = await loadStaffMembers(context, tenant);
      staffMembers = staffData.staffMembers;
    } catch (error) {
      context.log?.warn?.('Could not load staff members for validation:', error.message);
      // If we can't load staff members, fall back to format validation only
      return { isValid: true };
    }
  }

  if (staffMembers && Array.isArray(staffMembers)) {
    const staffMemberExists = staffMembers.some(member => member.id === staffMemberId);

    if (!staffMemberExists) {
      return { isValid: false, error: 'Staff member ID not found in catalog' };
    }
  }

  return { isValid: true };
}

/**
 * @deprecated Use validateStaffMemberId instead
 * Kept for backward compatibility
 */
async function validateBarberId(context, barberId, barbersArray = null) {
  // For backward compatibility, create a mock tenant from environment if available
  const tenant = {
    id: 'legacy',
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    locationId: process.env.SQUARE_LOCATION_ID
  };
  return validateStaffMemberId(context, tenant, barberId, barbersArray);
}

function validateDaysAhead(days) {
  // If days is not provided, use default of 10
  if (days === null || days === undefined || days === '') {
    return { isValid: true, value: 10 };
  }
  if (typeof days !== 'string' && typeof days !== 'number') {
    return { isValid: false, error: 'Days ahead must be a string or number' };
  }

  // Handle string inputs more strictly
  if (typeof days === 'string') {
    // Check for whitespace-only strings
    if (days.trim() === '') {
      return { isValid: true, value: 10 }; // Default for empty strings too
    }
    // Check for non-numeric strings or mixed strings - but still use the original error
    if (!/^\s*\d+\s*$/.test(days)) {
      return { isValid: false, error: 'Days ahead must be between 1 and 90' };
    }
  }

  const daysNum = parseInt(days);
  if (isNaN(daysNum) || daysNum < 1 || daysNum > 90) {
    return { isValid: false, error: 'Days ahead must be between 1 and 90' };
  }
  return { isValid: true, value: daysNum };
}

// Customer Management Functions

/**
 * Smart phone number formatter - automatically formats phone numbers to E.164 format
 * Handles various input formats and converts them to +1XXXXXXXXXX for US numbers
 */
function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return { isValid: false, error: 'Phone number is required and must be a string' };
  }

  // Remove all non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '');

  // Handle different input formats
  let formattedNumber = '';

  if (digitsOnly.length === 10) {
    // US number without country code: 2159324398 -> +12159324398
    formattedNumber = `+1${digitsOnly}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    // US number with country code: 12159324398 -> +12159324398
    formattedNumber = `+${digitsOnly}`;
  } else if (phoneNumber.startsWith('+1') && digitsOnly.length === 11) {
    // Already properly formatted: +12159324398
    formattedNumber = phoneNumber;
  } else if (phoneNumber.startsWith('+') && digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    // International number (keep as-is if valid)
    formattedNumber = phoneNumber;
  } else {
    return {
      isValid: false,
      error: `Invalid phone number format. Got ${digitsOnly.length} digits. 
      Expected 10-digit US number (e.g., 2159324398) or international format (+1234567890)`
    };
  }

  // Validate the formatted number
  const validation = validatePhoneNumberFormat(formattedNumber);
  if (!validation.isValid) {
    return validation;
  }

  return {
    isValid: true,
    formatted: formattedNumber,
    original: phoneNumber
  };
}

/**
 * Validates phone number format (used internally after formatting)
 */
function validatePhoneNumberFormat(phoneNumber) {
  const errors = [];

  if (!phoneNumber || typeof phoneNumber !== 'string') {
    errors.push('Phone number is required and must be a string');
    return { isValid: false, errors };
  }

  // Remove all non-digit characters for validation
  const digitsOnly = phoneNumber.replace(/\D/g, '');

  // Check for minimum length (10 digits for US numbers)
  if (digitsOnly.length < 10) {
    errors.push('Phone number must have at least 10 digits');
  }

  // Check for maximum length (15 digits per international standard)
  if (digitsOnly.length > 15) {
    errors.push('Phone number cannot exceed 15 digits');
  }

  // US phone number pattern (optional +1, then 10 digits)
  const usPhonePattern = /^\+?1?[2-9]\d{2}[2-9]\d{2}\d{4}$/;
  if (!usPhonePattern.test(phoneNumber.replace(/[\s\-() .]/g, ''))) {
    errors.push('Invalid US phone number format. Expected format: +1234567890 or (123) 456-7890');
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : null
  };
}

/**
 * Validates phone number format (backward compatibility)
 */
function validatePhoneNumber(phoneNumber) {
  // First try to format the phone number
  const formatResult = formatPhoneNumber(phoneNumber);
  if (formatResult.isValid) {
    return { isValid: true, errors: null, formatted: formatResult.formatted };
  } else {
    return { isValid: false, errors: [formatResult.error] };
  }
}

/**
 * Helper function to sanitize customer data
 */
function sanitizeCustomerData(customer) {
  return {
    id: customer.id,
    given_name: customer.givenName,
    family_name: customer.familyName,
    email_address: customer.emailAddress,
    phone_number: customer.phoneNumber,
    created_at: customer.createdAt,
    updated_at: customer.updatedAt,
    preferences: customer.preferences,
    creation_source: customer.creationSource
    // Don't return sensitive fields like addresses unless needed
  };
}

/**
 * Validate email address format
 */
function validateEmailAddress(email) {
  if (!email) {
    return { isValid: false, error: 'Email address is required' };
  }

  if (typeof email !== 'string') {
    return { isValid: false, error: 'Email address must be a string' };
  }

  // Basic email validation regex
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return { isValid: false, error: 'Invalid email address format' };
  }

  // Check length limits
  if (email.length > 254) {
    return { isValid: false, error: 'Email address is too long' };
  }

  return { isValid: true };
}

/**
 * Create a new customer in Square
 * @param {Object} context - Request context
 * @param {Object} tenant - Tenant context with credentials
 * @param {Object} customerData - Customer data to create
 * @returns {Object} Created customer data
 */
async function createCustomer(context, tenant, customerData) {
  const startTime = Date.now();

  try {
    // Validate required data
    const { firstName, lastName, email, phoneNumber } = customerData;

    // Phone number is required
    if (!phoneNumber) {
      throw new Error('Phone number is required for customer creation');
    }

    // At least one of firstName, lastName, or email is also required
    if (!firstName && !lastName && !email) {
      throw new Error('At least one of firstName, lastName, or email is required along with phoneNumber');
    }

    // Validate email if provided
    if (email) {
      const emailValidation = validateEmailAddress(email);
      if (!emailValidation.isValid) {
        throw new Error(`Invalid email: ${emailValidation.error}`);
      }
    }

    // Validate and format phone number if provided
    let formattedPhone = null;
    if (phoneNumber) {
      const phoneValidation = validatePhoneNumber(phoneNumber);
      if (!phoneValidation.isValid) {
        throw new Error(`Invalid phone number: ${phoneValidation.errors.join(', ')}`);
      }
      formattedPhone = phoneValidation.formatted;
    }

    // Build the customer creation request - ensure at least one required field is present
    const requestBody = {};

    // Always add the note
    requestBody.note = 'Customer created via booking system';

    // Add fields only if they have valid values - create fresh strings to avoid reference issues
    if (firstName && firstName.trim()) {
      requestBody.givenName = String(firstName.trim());
    }
    if (lastName && lastName.trim()) {
      requestBody.familyName = String(lastName.trim());
    }
    if (email && email.trim()) {
      requestBody.emailAddress = String(email.trim().toLowerCase());
    }
    if (formattedPhone) {
      requestBody.phoneNumber = String(formattedPhone);
    }

    // Verify we have at least one required field before making the request
    const hasRequiredField =
      requestBody.givenName || requestBody.familyName || requestBody.emailAddress || requestBody.phoneNumber;
    if (!hasRequiredField) {
      throw new Error('Customer creation failed: No valid customer data provided.');
    }

    // Create a completely fresh request object - Square SDK expects direct object, not wrapped in body
    const createRequest = JSON.parse(JSON.stringify(requestBody)); // Deep clone to avoid any reference issues

    // Create tenant-specific Square client
    const square = createSquareClient(
      tenant.accessToken || tenant.squareAccessToken,
      tenant.squareEnvironment || tenant.environment || 'production'
    );

    const apiStartTime = Date.now();
    const response = await square.customersApi.createCustomer(createRequest);
    const apiDuration = Date.now() - apiStartTime;

    logApiCall(context, 'customers_create', true, apiDuration, {
      customer_id: response.result?.customer?.id || response.customer?.id,
      has_email: !!email,
      has_phone: !!phoneNumber,
      tenant_id: tenant.id
    });

    // Try multiple possible response structures
    const customer = response.result?.customer || response.customer || response;
    if (!customer || !customer.id) {
      throw new Error('No customer returned from Square API');
    }

    context.log(
      `✅ Successfully created customer: ${customer.id} (${customer.givenName} ${customer.familyName})`
    );

    // Clean BigInt values before returning
    return sanitizeCustomerData(cleanBigIntFromObject(customer));
  } catch (error) {
    const apiDuration = Date.now() - startTime;
    logApiCall(context, 'customers_create', false, apiDuration);

    context.error('Error creating customer:', error);

    if (error.statusCode === 400) {
      throw new Error(`Invalid customer data: ${error.message}`);
    } else if (error.statusCode === 401) {
      throw new Error('Square API authentication failed');
    } else if (error.statusCode === 409) {
      throw new Error('Customer with this email or phone already exists');
    } else if (error.statusCode >= 500) {
      throw new Error('Square API server error. Please try again later.');
    }

    throw new Error(`Square API error: ${error.message}`);
  }
}

/**
 * Update an existing customer in Square
 * Supports sparse updates - only provide fields you want to update
 * @param {Object} context - Request context
 * @param {Object} tenant - Tenant context with credentials
 * @param {string} customerId - Customer ID to update
 * @param {Object} updateData - Fields to update
 * @returns {Object} Updated customer data
 */
async function updateCustomer(context, tenant, customerId, updateData) {
  const startTime = Date.now();

  try {
    // Validate required customerId
    if (!customerId || typeof customerId !== 'string') {
      throw new Error('Customer ID is required and must be a string');
    }

    // Field mapping - support both formats
    const fieldMapping = {
      email: 'emailAddress',
      givenName: 'firstName',
      familyName: 'lastName'
    };

    // Apply reverse mapping to incoming data
    const mappedData = {};
    for (const [key, value] of Object.entries(updateData)) {
      // If key matches a mapped field name, use the canonical name
      const canonicalKey = Object.keys(fieldMapping).find(k => fieldMapping[k] === key) || key;
      mappedData[canonicalKey] = value;
    }

    // Validate that we have some data to update
    const { firstName, lastName, email, emailAddress, phoneNumber, note, givenName, familyName, version } =
      mappedData;

    // Support both naming conventions
    const actualFirstName = firstName || givenName;
    const actualLastName = lastName || familyName;
    const actualEmail = email || emailAddress;

    // Check if any field is provided (including explicit null/empty string for clearing)
    const hasUpdates =
      actualFirstName !== undefined ||
      actualLastName !== undefined ||
      actualEmail !== undefined ||
      phoneNumber !== undefined ||
      note !== undefined ||
      version !== undefined;

    if (!hasUpdates) {
      throw new Error('At least one field must be provided for update');
    }

    // Validate email if provided
    if (actualEmail !== undefined && actualEmail !== null) {
      if (actualEmail === '') {
        // Allow clearing email with empty string
      } else {
        const emailValidation = validateEmailAddress(actualEmail);
        if (!emailValidation.isValid) {
          throw new Error(`Invalid email: ${emailValidation.error}`);
        }
      }
    }

    // Validate and format phone number if provided
    let formattedPhone = undefined;
    if (phoneNumber !== undefined && phoneNumber !== null) {
      if (phoneNumber === '') {
        // Allow clearing phone with empty string
        formattedPhone = null;
      } else {
        const phoneValidation = validatePhoneNumber(phoneNumber);
        if (!phoneValidation.isValid) {
          throw new Error(`Invalid phone number: ${phoneValidation.errors.join(', ')}`);
        }
        formattedPhone = phoneValidation.formatted;
      }
    }

    // Build the customer update body (Square SDK v42+ expects separate parameters)
    const customerBody = {};

    // Only add fields that have meaningful values - omit null/undefined/empty to preserve existing data
    if (actualFirstName !== undefined && actualFirstName !== null && actualFirstName !== '') {
      customerBody.givenName = actualFirstName.trim();
    }

    if (actualLastName !== undefined && actualLastName !== null && actualLastName !== '') {
      customerBody.familyName = actualLastName.trim();
    }

    if (actualEmail !== undefined && actualEmail !== null && actualEmail !== '') {
      customerBody.emailAddress = actualEmail.trim().toLowerCase();
    }

    if (formattedPhone !== undefined && formattedPhone !== null && formattedPhone !== '') {
      customerBody.phoneNumber = formattedPhone;
    }

    if (note !== undefined && note !== null && note !== '') {
      customerBody.note = note;
    }

    if (version !== undefined) {
      customerBody.version = typeof version === 'number' ? toBigInt(version) : version;
    }

    context.log('Updating customer with data:', {
      customerId,
      updateFields: Object.keys(customerBody)
    });

    // Create tenant-specific Square client
    const square = createSquareClient(
      tenant.accessToken || tenant.squareAccessToken,
      tenant.squareEnvironment || tenant.environment || 'production'
    );

    const apiStartTime = Date.now();
    // ⚠️ Square SDK v42+: Pass customerId and body as separate parameters
    const response = await square.customersApi.updateCustomer(customerId.trim(), customerBody);
    const apiDuration = Date.now() - apiStartTime;

    logApiCall(context, 'customers_update', true, apiDuration, {
      customer_id: customerId,
      tenant_id: tenant.id,
      fields_updated: Object.keys(customerBody).length,
      has_email: actualEmail !== undefined,
      has_phone: phoneNumber !== undefined
    });

    // Handle different response structures - check both paths
    const customer = response.result?.customer || response.customer;
    if (!customer) {
      context.log('❌ No customer found in response:', {
        hasResult: !!response.result,
        hasDirectCustomer: !!response.customer,
        responseKeys: Object.keys(response)
      });
      throw new Error('No customer returned from Square API');
    }

    context.log(
      `✅ Successfully updated customer: ${customer.id} (${customer.givenName} ${customer.familyName})`
    );

    return sanitizeCustomerData(customer);
  } catch (error) {
    const apiDuration = Date.now() - startTime;
    logApiCall(context, 'customers_update', false, apiDuration);

    context.error('Error updating customer:', error);

    if (error.statusCode === 400) {
      throw new Error(`Invalid update data: ${error.message}`);
    } else if (error.statusCode === 401) {
      throw new Error('Square API authentication failed');
    } else if (error.statusCode === 404) {
      throw new Error('Customer not found');
    } else if (error.statusCode === 409) {
      throw new Error(
        'Customer update conflict - customer may have been updated by another process (version mismatch)'
      );
    } else if (error.statusCode >= 500) {
      throw new Error('Square API server error. Please try again later.');
    }

    throw new Error(`Square API error: ${error.message}`);
  }
}

/**
 * Search for customers by phone number using Square Search API (much faster than pagination)
 * Handles both formats: +12677210098 and (267) 721-0098
 * @param {Object} context - Request context
 * @param {Object} tenant - Tenant context with credentials
 * @param {string} phoneNumber - Phone number to search
 * @returns {Object|null} Customer data or null if not found
 */
async function searchCustomerByPhone(context, tenant, phoneNumber) {
  const startTime = Date.now();

  try {
    // Validate and sanitize phone number
    const validation = validatePhoneNumber(phoneNumber);
    if (!validation.isValid) {
      throw new Error(`Invalid phone number: ${validation.errors.join(', ')}`);
    }

    const phoneFormatResult = formatPhoneNumber(phoneNumber);
    const formattedPhone = phoneFormatResult.isValid ? phoneFormatResult.formatted : phoneNumber;

    context.log(`🔍 Searching for customer with phone number: ${phoneNumber}`);

    // Format phone number to E164 for exact search (Square API requirement)
    context.log(`🔍 Formatted phone for exact search: ${formattedPhone}`);

    // Create tenant-specific Square client
    logger.debug('[squareUtils] Creating Square client for tenant', {
      tenantId: tenant.id,
      hasAccessToken: !!(tenant.accessToken || tenant.squareAccessToken),
      accessTokenLength: (tenant.accessToken || tenant.squareAccessToken)?.length,
      tenantKeys: Object.keys(tenant)
    });
    const square = createSquareClient(
      tenant.accessToken || tenant.squareAccessToken,
      tenant.squareEnvironment || tenant.environment || 'production'
    );

    // First try exact search with E164 formatted phone number
    const apiStartTime = Date.now();
    let searchResponse = await square.customersApi.searchCustomers({
      query: {
        filter: {
          phoneNumber: {
            exact: formattedPhone
          }
        }
      }
    });
    const apiDuration = Date.now() - apiStartTime;

    const customers = searchResponse.result?.customers || [];

    logApiCall(context, 'customers_search_exact', true, apiDuration, {
      phone_number: phoneNumber,
      customer_count: customers.length,
      tenant_id: tenant.id
    });

    // Check if exact search found a customer
    if (customers.length > 0) {
      const customer = customers[0]; // Take the first match
      context.log(
        `✅ Found customer (exact match): ${customer.givenName || 'N/A'} ` +
          `${customer.familyName || 'N/A'} (${customer.phoneNumber})`
      );

      const totalApiDuration = Date.now() - startTime;
      logApiCall(context, 'customers_search_by_phone', true, totalApiDuration, {
        phone_number: phoneNumber,
        search_type: 'exact',
        customer_found: true,
        customer_id: customer.id
      });

      return sanitizeCustomerData(customer);
    }

    context.log(`📄 Exact search returned ${customers.length} customers`);

    // If exact search didn't find anything, try fuzzy search with normalized digits
    const normalizedPhone = phoneNumber.replace(/\D/g, '');
    context.log(`🔍 Trying fuzzy search with normalized digits: ${normalizedPhone}`);

    const fuzzyApiStartTime = Date.now();
    searchResponse = await square.customersApi.searchCustomers({
      query: {
        filter: {
          phoneNumber: {
            fuzzy: normalizedPhone
          }
        }
      }
    });
    const fuzzyApiDuration = Date.now() - fuzzyApiStartTime;

    const fuzzyCustomers = searchResponse.result?.customers || [];

    logApiCall(context, 'customers_search_fuzzy', true, fuzzyApiDuration, {
      phone_number: normalizedPhone,
      customer_count: fuzzyCustomers.length
    });

    context.log(`📄 Fuzzy search returned ${fuzzyCustomers.length} customers`);

    // If fuzzy search found customers, find the best match
    if (fuzzyCustomers.length > 0) {
      // Normalize the search phone number for comparison
      const searchPhoneDigits = normalizedPhone;

      // Find the best match by comparing normalized phone numbers
      for (const customer of fuzzyCustomers) {
        if (!customer.phoneNumber) continue;

        // Normalize customer phone number to digits only
        const customerPhoneDigits = customer.phoneNumber.replace(/\D/g, '');

        // Check for exact match with normalized numbers
        const isExactMatch = customerPhoneDigits === searchPhoneDigits;

        // Also check if one number is the US version of the other (with/without country code)
        const isUSMatch =
          (customerPhoneDigits.length === 11 &&
            customerPhoneDigits.startsWith('1') &&
            customerPhoneDigits.substring(1) === searchPhoneDigits) ||
          (searchPhoneDigits.length === 11 &&
            searchPhoneDigits.startsWith('1') &&
            searchPhoneDigits.substring(1) === customerPhoneDigits) ||
          (customerPhoneDigits.length === 10 &&
            searchPhoneDigits.length === 10 &&
            customerPhoneDigits === searchPhoneDigits);

        if (isExactMatch || isUSMatch) {
          context.log(
            `✅ Found matching customer (fuzzy match): ${customer.givenName || 'N/A'} ` +
              `${customer.familyName || 'N/A'} (${customer.phoneNumber})`
          );

          const totalApiDuration = Date.now() - startTime;
          logApiCall(context, 'customers_search_by_phone', true, totalApiDuration, {
            phone_number: phoneNumber,
            search_type: 'fuzzy',
            customer_found: true,
            customer_id: customer.id,
            customers_checked: fuzzyCustomers.length
          });

          return sanitizeCustomerData(customer);
        }
      }

      // If we have fuzzy results but no exact match, log the issue
      context.log(`⚠️ Fuzzy search found ${fuzzyCustomers.length} customers but none matched exactly`);
    }

    // No customer found
    context.log(`❌ No customer found for phone number: ${phoneNumber}`);

    const totalApiDuration = Date.now() - startTime;
    logApiCall(context, 'customers_search_by_phone', true, totalApiDuration, {
      phone_number: phoneNumber,
      search_type: 'both',
      customer_found: false
    });

    return null;
  } catch (error) {
    const apiDuration = Date.now() - startTime;
    logApiCall(context, 'customers_search_by_phone', false, apiDuration);

    context.log('❌ Error in searchCustomerByPhone:', error);

    if (error.statusCode === 400) {
      throw new Error('Invalid search parameters for Square API');
    } else if (error.statusCode === 401) {
      throw new Error('Square API authentication failed');
    } else if (error.statusCode === 404) {
      return null;
    } else if (error.statusCode === 429) {
      throw new Error('Square API rate limit exceeded');
    }

    throw new Error(`Square API error: ${error.message}`);
  }
}

module.exports = {
  // Multi-tenant functions (new)
  createSquareClient,
  loadStaffMembers,
  validateStaffMemberId,

  // Core functions (updated for multi-tenant)
  fmtLocal,
  validateEnvironment,
  validateServiceVariationId,
  validateDaysAhead,
  validatePhoneNumber,
  validateEmailAddress,
  formatPhoneNumber,
  loadServiceVariations,
  searchCustomerByPhone,
  createCustomer,
  updateCustomer,
  sanitizeCustomerData,

  // Backward compatibility (deprecated)
  loadBarbers, // Use loadStaffMembers instead
  validateBarberId, // Use validateStaffMemberId instead

  // Cache management
  getTenantCache,
  setTenantCache,

  // Circuit breaker
  withCircuitBreaker: (tenantId, apiCall, operationName) =>
    circuitBreaker.execute(tenantId, apiCall, operationName),
  getCircuitState: tenantId => circuitBreaker.getState(tenantId),
  getAllCircuitStates: () => circuitBreaker.getAllStates(),

  // Telemetry
  logCacheHit,
  logApiCall,
  trackException,

  // Constants
  CATALOG_TTL,
  STAFF_TTL
};
