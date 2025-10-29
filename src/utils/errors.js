/**
 * Application Error Utilities
 * Normalises error handling by providing consistent Error subclasses.
 */

class AppError extends Error {
  /**
   * @param {string} message
   * @param {object} [options]
   * @param {number} [options.statusCode=500]
   * @param {string} [options.code='APP_ERROR']
   * @param {*} [options.details]
   * @param {Error} [options.cause]
   */
  constructor(message, { statusCode = 500, code = 'APP_ERROR', details, cause } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;

    if (details !== undefined) {
      this.details = details;
    }

    if (cause) {
      this.cause = cause;
    }

    Error.captureStackTrace?.(this, this.constructor);
  }

  /**
   * Create an AppError from an existing error, applying sensible defaults.
   * @param {Error} error
   * @param {object} [defaults]
   * @param {string} [defaults.message]
   * @param {number} [defaults.statusCode]
   * @param {string} [defaults.code]
   * @param {*} [defaults.details]
   * @returns {AppError}
   */
  static from(error, defaults = {}) {
    if (error instanceof AppError) {
      return error;
    }

    const {
      message: defaultMessage = 'Internal server error',
      statusCode: defaultStatusCode = 500,
      code: defaultCode = 'APP_ERROR',
      details: defaultDetails
    } = defaults;

    const message = error?.message || defaultMessage;
    const statusCode = error?.statusCode || error?.status || defaultStatusCode;
    const code = error?.code || defaultCode;
    const details = error?.details || defaultDetails;

    return new AppError(message, {
      statusCode,
      code,
      details,
      cause: error instanceof Error ? error : undefined
    });
  }
}

class ValidationError extends AppError {
  constructor(message, { code = 'VALIDATION_ERROR', details } = {}) {
    super(message, {
      statusCode: 400,
      code,
      details
    });
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', { code = 'UNAUTHORIZED', details } = {}) {
    super(message, {
      statusCode: 401,
      code,
      details
    });
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', { code = 'FORBIDDEN', details } = {}) {
    super(message, {
      statusCode: 403,
      code,
      details
    });
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError
};
