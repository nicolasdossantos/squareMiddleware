/**
 * Centralized BigInt utilities
 * Handles BigInt conversion, serialization, and cleaning operations
 */

/**
 * Safely convert BigInt to string
 * @param {*} value - Value to convert
 * @returns {string} String representation
 */
function bigIntToString(value) {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value === null || value === undefined) {
    return '0';
  }
  return value.toString();
}

/**
 * Safely convert value to BigInt for Square API
 * @param {*} value - Value to convert
 * @returns {BigInt} BigInt value
 */
function toBigInt(value) {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return BigInt(value);
  }
  if (typeof value === 'string') {
    return BigInt(parseInt(value, 10));
  }
  throw new Error(`Cannot convert ${typeof value} to BigInt: ${value}`);
}

/**
 * JSON.stringify replacer function for BigInt values
 * @param {string} key - Object key
 * @param {*} value - Object value
 * @returns {*} Serializable value
 */
function bigIntReplacer(key, value) {
  return typeof value === 'bigint' ? value.toString() : value;
}

/**
 * Recursively clean BigInt values from objects for API responses
 * @param {*} obj - Object to clean
 * @returns {*} Cleaned object with BigInt values converted to strings
 */
function cleanBigIntFromObject(obj) {
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanBigIntFromObject);
  }
  if (obj !== null && typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key] = cleanBigIntFromObject(value);
    }
    return cleaned;
  }
  return obj;
}

/**
 * Convert BigInts in object for JSON serialization
 * @param {*} obj - Object to convert
 * @returns {*} Object with BigInts converted to strings
 */
function convertBigIntsToStrings(obj) {
  return JSON.parse(JSON.stringify(obj, bigIntReplacer));
}

/**
 * Safely handle price conversion from BigInt to formatted string
 * @param {*} price - Price value (potentially BigInt)
 * @returns {string} Formatted price string (e.g., "$12.34")
 */
function formatPrice(price) {
  if (!price) return '$0.00';

  const priceInCents =
    typeof price === 'bigint' ? Number(price) : typeof price === 'string' ? parseInt(price, 10) : price;

  return `$${(priceInCents / 100).toFixed(2)}`;
}

/**
 * Safely handle duration conversion from BigInt to minutes
 * @param {*} duration - Duration value in milliseconds (potentially BigInt)
 * @returns {number} Duration in minutes
 */
function durationToMinutes(duration) {
  if (!duration) return 0;

  const durationMs =
    typeof duration === 'bigint' ? Number(duration) : typeof duration === 'string' ? parseInt(duration, 10) : duration;

  return Math.round(durationMs / 60000);
}

module.exports = {
  bigIntToString,
  toBigInt,
  bigIntReplacer,
  cleanBigIntFromObject,
  convertBigIntsToStrings,
  formatPrice,
  durationToMinutes
};
