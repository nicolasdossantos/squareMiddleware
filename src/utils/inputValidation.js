/**
 * Centralized input validation utilities
 */

/**
 * Validate string length and content
 */
function validateStringField(value, fieldName, options = {}) {
  const { minLength = 1, maxLength = 500, required = true, allowEmpty = false } = options;

  if (required && (value === undefined || value === null)) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  if (!required && (value === undefined || value === null)) {
    return { isValid: true, value: null };
  }

  if (typeof value !== 'string') {
    return { isValid: false, error: `${fieldName} must be a string` };
  }

  const trimmed = value.trim();

  if (!allowEmpty && trimmed.length === 0) {
    return { isValid: false, error: `${fieldName} cannot be empty` };
  }

  if (trimmed.length < minLength) {
    return { isValid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }

  if (trimmed.length > maxLength) {
    return { isValid: false, error: `${fieldName} must be no more than ${maxLength} characters` };
  }

  return { isValid: true, value: trimmed };
}

/**
 * Validate numeric fields with range checking
 */
function validateNumericField(value, fieldName, options = {}) {
  const { min, max, required = true, allowDecimals = true } = options;

  if (required && (value === undefined || value === null)) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  if (!required && (value === undefined || value === null)) {
    return { isValid: true, value: null };
  }

  const num = Number(value);
  if (isNaN(num)) {
    return { isValid: false, error: `${fieldName} must be a valid number` };
  }

  if (!allowDecimals && !Number.isInteger(num)) {
    return { isValid: false, error: `${fieldName} must be an integer` };
  }

  if (min !== undefined && num < min) {
    return { isValid: false, error: `${fieldName} must be at least ${min}` };
  }

  if (max !== undefined && num > max) {
    return { isValid: false, error: `${fieldName} must be no more than ${max}` };
  }

  return { isValid: true, value: num };
}

/**
 * Validate array fields
 */
function validateArrayField(value, fieldName, options = {}) {
  const { minLength = 0, maxLength = 100, required = true } = options;

  if (required && (value === undefined || value === null)) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  if (!required && (value === undefined || value === null)) {
    return { isValid: true, value: [] };
  }

  if (!Array.isArray(value)) {
    return { isValid: false, error: `${fieldName} must be an array` };
  }

  if (value.length < minLength) {
    return { isValid: false, error: `${fieldName} must have at least ${minLength} items` };
  }

  if (value.length > maxLength) {
    return { isValid: false, error: `${fieldName} must have no more than ${maxLength} items` };
  }

  return { isValid: true, value };
}

/**
 * Validate pagination parameters
 */
function validatePagination(query) {
  const errors = [];
  const result = {};

  // Validate limit
  if (query.limit !== undefined) {
    const limitValidation = validateNumericField(query.limit, 'limit', {
      min: 1,
      max: 100,
      required: false,
      allowDecimals: false
    });
    if (limitValidation.isValid) {
      result.limit = limitValidation.value;
    } else {
      errors.push(limitValidation.error);
    }
  } else {
    result.limit = 50; // Default
  }

  // Validate offset
  if (query.offset !== undefined) {
    const offsetValidation = validateNumericField(query.offset, 'offset', {
      min: 0,
      required: false,
      allowDecimals: false
    });
    if (offsetValidation.isValid) {
      result.offset = offsetValidation.value;
    } else {
      errors.push(offsetValidation.error);
    }
  } else {
    result.offset = 0; // Default
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : null,
    pagination: errors.length === 0 ? result : null
  };
}

/**
 * Sanitize potentially dangerous input
 */
function sanitizeForLogs(input) {
  if (typeof input !== 'string') {
    return input;
  }

  // Remove potential log injection patterns
  return input
    .replace(/[\r\n\t]/g, ' ') // Replace newlines/tabs with spaces
    .replace(/[<>]/g, '') // Remove angle brackets
    .slice(0, 1000); // Limit length for logs
}

/**
 * Validate customer information for updates
 */
function validateCustomerInfo(req) {
  const errors = [];
  const body = req.body || {};

  // All fields are optional for updates, but if provided must be valid
  if (body.givenName !== undefined) {
    const nameValidation = validateStringField(body.givenName, 'givenName', {
      required: false,
      minLength: 1,
      maxLength: 100,
      allowEmpty: true
    });
    if (!nameValidation.isValid) {
      errors.push(nameValidation.error);
    }
  }

  if (body.familyName !== undefined) {
    const nameValidation = validateStringField(body.familyName, 'familyName', {
      required: false,
      minLength: 1,
      maxLength: 100,
      allowEmpty: true
    });
    if (!nameValidation.isValid) {
      errors.push(nameValidation.error);
    }
  }

  if (body.emailAddress !== undefined) {
    const emailValidation = validateStringField(body.emailAddress, 'emailAddress', {
      required: false,
      minLength: 3,
      maxLength: 255,
      allowEmpty: true
    });
    if (!emailValidation.isValid) {
      errors.push(emailValidation.error);
    } else if (body.emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.emailAddress)) {
      errors.push('emailAddress must be a valid email format');
    }
  }

  if (body.phoneNumber !== undefined) {
    const phoneValidation = validateStringField(body.phoneNumber, 'phoneNumber', {
      required: false,
      minLength: 10,
      maxLength: 20,
      allowEmpty: true
    });
    if (!phoneValidation.isValid) {
      errors.push(phoneValidation.error);
    }
  }

  if (body.note !== undefined) {
    const noteValidation = validateStringField(body.note, 'note', {
      required: false,
      maxLength: 1000,
      allowEmpty: true
    });
    if (!noteValidation.isValid) {
      errors.push(noteValidation.error);
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

module.exports = {
  validateStringField,
  validateNumericField,
  validateArrayField,
  validatePagination,
  validateCustomerInfo,
  sanitizeForLogs
};
