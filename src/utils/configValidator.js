/**
 * Configuration Validator
 *
 * Validates all required and optional configuration at startup
 * Provides clear error messages for missing/invalid configuration
 * Implements fail-fast behavior to prevent running with invalid config
 */

/**
 * Configuration schema defining required and optional variables per environment
 */
const CONFIG_SCHEMA = {
  // Required in all environments
  required: {
    database: {
      connectionString: {
        env: [
          'PG_CONNECTION_STRING',
          'PG_CONN_STRING',
          'POSTGRES_CONNECTION_STRING',
          'DATABASE_URL'
        ],
        description: 'PostgreSQL database connection string',
        validate: value => typeof value === 'string' && value.length > 0
      }
    },
    retell: {
      apiKey: {
        env: 'RETELL_API_KEY',
        description: 'Retell AI API key for call operations',
        validate: value => typeof value === 'string' && value.length > 10
      }
    }
  },

  // Required in production only (for multi-tenant deployments)
  production: {
    square: {
      applicationId: {
        env: 'SQUARE_APPLICATION_ID',
        description: 'Square OAuth application ID',
        validate: value => typeof value === 'string' && value.length > 0
      },
      applicationSecret: {
        env: 'SQUARE_APPLICATION_SECRET',
        description: 'Square OAuth application secret',
        validate: value => typeof value === 'string' && value.length > 0
      },
      webhookSignatureKey: {
        env: 'SQUARE_WEBHOOK_SIGNATURE_KEY',
        description: 'Square webhook signature key for validating webhooks',
        validate: value => typeof value === 'string' && value.length > 0
      }
    },
    security: {
      corsOrigins: {
        env: 'ALLOWED_ORIGINS',
        description: 'Comma-separated list of allowed CORS origins',
        validate: value => typeof value === 'string' && value.length > 0
      }
    }
  },

  // Recommended for full functionality
  recommended: {
    twilio: {
      accountSid: {
        env: 'TWILIO_ACCOUNT_SID',
        description: 'Twilio account SID for SMS/WhatsApp',
        feature: 'SMS and WhatsApp notifications'
      },
      authToken: {
        env: 'TWILIO_AUTH_TOKEN',
        description: 'Twilio auth token',
        feature: 'SMS and WhatsApp notifications'
      }
    },
    email: {
      smtpHost: {
        env: 'EMAIL_SMTP_HOST',
        description: 'SMTP server hostname for email',
        feature: 'Email notifications'
      },
      smtpUser: {
        env: 'EMAIL_SMTP_USER',
        description: 'SMTP server username',
        feature: 'Email notifications'
      },
      smtpPass: {
        env: 'EMAIL_SMTP_PASS',
        description: 'SMTP server password',
        feature: 'Email notifications'
      },
      from: {
        env: 'EMAIL_FROM',
        description: 'Email sender address',
        feature: 'Email notifications'
      }
    },
    azure: {
      appInsights: {
        env: 'APPLICATIONINSIGHTS_CONNECTION_STRING',
        description: 'Azure Application Insights connection string',
        feature: 'Application monitoring and diagnostics'
      }
    }
  }
};

/**
 * Get environment variable value from one or more possible names
 * @param {string|string[]} envVars - Environment variable name(s) to check
 * @returns {string|null} The value if found, null otherwise
 */
function getEnvValue(envVars) {
  const vars = Array.isArray(envVars) ? envVars : [envVars];
  for (const varName of vars) {
    if (process.env[varName]) {
      return process.env[varName];
    }
  }
  return null;
}

/**
 * Validate a configuration requirement
 * @param {string} name - Config name (for error messages)
 * @param {string|string[]} envVars - Environment variable name(s)
 * @param {Function} validate - Validation function
 * @returns {Object} { valid: boolean, value: string|null, error: string|null }
 */
function validateConfigOption(name, envVars, validate) {
  const value = getEnvValue(envVars);

  if (!value) {
    const varList = Array.isArray(envVars) ? envVars.join(' or ') : envVars;
    return {
      valid: false,
      value: null,
      error: `Missing required configuration: ${name} (set via ${varList})`
    };
  }

  if (validate && !validate(value)) {
    return {
      valid: false,
      value: null,
      error: `Invalid configuration: ${name} value is not in correct format`
    };
  }

  return { valid: true, value, error: null };
}

/**
 * Validate all required configuration
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
function validateConfiguration() {
  const environment = process.env.NODE_ENV || 'development';
  const errors = [];
  const warnings = [];

  // Validate all required configurations
  for (const [section, configs] of Object.entries(CONFIG_SCHEMA.required)) {
    for (const [key, config] of Object.entries(configs)) {
      const result = validateConfigOption(`${section}.${key}`, config.env, config.validate);
      if (!result.valid) {
        errors.push(result.error);
      }
    }
  }

  // Validate production-specific requirements
  if (environment === 'production') {
    for (const [section, configs] of Object.entries(CONFIG_SCHEMA.production)) {
      for (const [key, config] of Object.entries(configs)) {
        const result = validateConfigOption(`${section}.${key}`, config.env, config.validate);
        if (!result.valid) {
          errors.push(result.error);
        }
      }
    }
  }

  // Check recommended configurations and warn if missing
  for (const [section, configs] of Object.entries(CONFIG_SCHEMA.recommended)) {
    for (const [key, config] of Object.entries(configs)) {
      const value = getEnvValue(config.env);
      if (!value && config.feature) {
        warnings.push(
          `⚠️  ${config.feature} will be disabled: ${config.description} not configured (set via ${config.env})`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    environment
  };
}

/**
 * Format validation results for display
 * @param {Object} result - Validation result from validateConfiguration()
 * @returns {string} Formatted error/warning message
 */
function formatValidationMessage(result) {
  const lines = [];

  if (result.errors.length > 0) {
    lines.push(
      '\n❌ CONFIGURATION VALIDATION FAILED\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
    );
    lines.push(`Environment: ${result.environment}`);
    lines.push(`Missing/Invalid Settings: ${result.errors.length}\n`);

    result.errors.forEach((error, index) => {
      lines.push(`${index + 1}. ${error}`);
    });

    lines.push(
      '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    );
  }

  if (result.warnings.length > 0) {
    if (result.errors.length === 0) {
      lines.push('\n⚠️  CONFIGURATION WARNINGS\n');
    } else {
      lines.push('\n⚠️  ADDITIONAL WARNINGS\n');
    }

    result.warnings.forEach(warning => {
      lines.push(warning);
    });

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Check if configuration is critical for running
 * @param {Object} result - Validation result
 * @returns {boolean} True if config is invalid and app should not start
 */
function isConfigurationCritical(result) {
  return result.errors.length > 0;
}

/**
 * Main validation function - validates and logs results
 * @param {Object} logger - Logger instance
 * @returns {Object} Validation result
 */
function validateStartup(logger) {
  const result = validateConfiguration();
  const message = formatValidationMessage(result);

  if (message.trim()) {
    if (result.errors.length > 0) {
      if (logger && logger.error) {
        logger.error(message);
      } else {
        console.error(message);
      }
    } else if (result.warnings.length > 0) {
      if (logger && logger.warn) {
        logger.warn(message);
      } else {
        console.warn(message);
      }
    }
  }

  return result;
}

module.exports = {
  validateConfiguration,
  validateStartup,
  formatValidationMessage,
  isConfigurationCritical,
  getEnvValue,
  validateConfigOption,
  CONFIG_SCHEMA
};
