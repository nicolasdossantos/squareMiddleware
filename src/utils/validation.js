/**
 * Centralized validation utilities
 * All validation functions are now consolidated in this single module
 */

/**
 * Generic string field validation
 */
function validateStringField(value, fieldName, options = {}) {
  const { minLength = 1, maxLength = 500, required = true, allowEmpty = false, pattern = null } = options;

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

  if (pattern && !pattern.test(trimmed)) {
    return { isValid: false, error: `${fieldName} contains invalid characters` };
  }

  return { isValid: true, value: trimmed };
}

/**
 * Numeric field validation
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
 * Array field validation
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
 * Email address validation
 */
function validateEmailAddress(email, required = true) {
  if (!email) {
    return { isValid: !required, error: required ? 'Email address is required' : null };
  }

  if (typeof email !== 'string') {
    return { isValid: false, error: 'Email address must be a string' };
  }

  const trimmed = email.trim();

  // Basic email validation regex
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(trimmed)) {
    return { isValid: false, error: 'Invalid email address format' };
  }

  // Check length limits
  if (trimmed.length > 254) {
    return { isValid: false, error: 'Email address is too long' };
  }

  return { isValid: true, value: trimmed.toLowerCase() };
}

/**
 * Phone number validation
 */
function validatePhoneNumber(phoneNumber, required = true) {
  const errors = [];

  if (!phoneNumber || phoneNumber === '') {
    if (required) {
      errors.push('Phone number is required');
    }
    return { isValid: !required, errors: required ? errors : null };
  }

  if (typeof phoneNumber !== 'string') {
    errors.push('Phone number must be a string');
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
  const cleanPhone = phoneNumber.replace(/[\s\-() .]/g, '');
  if (!usPhonePattern.test(cleanPhone)) {
    errors.push('Invalid US phone number format. Expected format: +1234567890 or (123) 456-7890');
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : null,
    value: errors.length === 0 ? phoneNumber.trim() : null
  };
}

/**
 * Square ID validation (for service variations, barbers, etc.)
 */
function validateSquareId(id, fieldName, options = {}) {
  const { allowNull = false, minLength = 10, maxLength = 100 } = options;

  if (!id || id === '') {
    if (allowNull) {
      return { isValid: true, value: null };
    }
    return { isValid: false, error: `${fieldName} cannot be empty` };
  }

  if (typeof id !== 'string') {
    return { isValid: false, error: `${fieldName} must be a string` };
  }

  const trimmed = id.trim();

  if (trimmed.length < minLength) {
    return { isValid: false, error: `${fieldName} is too short` };
  }

  if (trimmed.length > maxLength) {
    return { isValid: false, error: `${fieldName} is too long` };
  }

  // Square IDs are typically alphanumeric with underscores and dashes
  if (!/^[A-Z0-9_-]+$/i.test(trimmed)) {
    return { isValid: false, error: `${fieldName} contains invalid characters` };
  }

  return { isValid: true, value: trimmed };
}

/**
 * Days ahead validation (for appointment scheduling)
 */
function validateDaysAhead(days, defaultValue = 10) {
  // If days is not provided, use default
  if (days === null || days === undefined || days === '') {
    return { isValid: true, value: defaultValue };
  }

  if (typeof days !== 'string' && typeof days !== 'number') {
    return { isValid: false, error: 'Days ahead must be a string or number' };
  }

  // Handle string inputs
  if (typeof days === 'string') {
    // Check for whitespace-only strings
    if (days.trim() === '') {
      return { isValid: true, value: defaultValue };
    }
    // Check for non-numeric strings
    if (!/^\s*\d+\s*$/.test(days)) {
      return { isValid: false, error: 'Days ahead must be between 1 and 90' };
    }
  }

  const daysNum = parseInt(days, 10);
  if (isNaN(daysNum) || daysNum < 1 || daysNum > 90) {
    return { isValid: false, error: 'Days ahead must be between 1 and 90' };
  }

  return { isValid: true, value: daysNum };
}

/**
 * Pagination parameters validation
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

const { formatPhoneNumber: smartFormatPhoneNumber } = require('./squareUtils');

/**
 * Format phone number to E.164 format (+1xxxxxxxxxx)
 * Uses the smart formatter from squareUtils
 */
function formatPhoneNumber(phoneNumber) {
  const result = smartFormatPhoneNumber(phoneNumber);
  // Return just the formatted number for backward compatibility
  return result.isValid ? result.formatted : null;
}

/**
 * Sanitize text for logging (remove sensitive data)
 */
function sanitizeForLogs(text) {
  if (typeof text !== 'string') {
    return text;
  }

  return text
    .replace(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '[EMAIL]')
    .replace(/(\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})/g, '[PHONE]')
    .replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, '[CARD]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
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
  // Generic validation
  validateStringField,
  validateNumericField,
  validateArrayField,

  // Specific validation
  validateEmailAddress,
  validatePhoneNumber,
  validateSquareId,
  validateDaysAhead,
  validatePagination,
  validateCustomerInfo,

  // Formatting utilities
  formatPhoneNumber,
  sanitizeForLogs
};
