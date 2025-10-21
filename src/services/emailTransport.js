const nodemailer = require('nodemailer');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const { invokeEmailFunction, isEmailFunctionConfigured } = require('../utils/functionInvoker');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    if (!config.email.host || !config.email.user) {
      throw new Error('Email SMTP configuration is missing');
    }

    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: Boolean(config.email.secure),
      auth: {
        user: config.email.user,
        pass: config.email.password
      }
    });
  }

  return transporter;
}

async function sendEmail(
  mailOptions,
  { correlationId = null, tenant = 'unknown', context = 'general' } = {}
) {
  const payload = {
    ...mailOptions,
    tenant
  };

  if (isEmailFunctionConfigured()) {
    try {
      const response = await invokeEmailFunction(payload, correlationId);
      const responseData = response?.data || {};
      const messageId =
        responseData.messageId || responseData.MessageId || responseData.id || `function-${Date.now()}`;

      logger.info('Email delivered via Azure Function', {
        to: mailOptions.to,
        subject: mailOptions.subject,
        correlationId,
        context,
        messageId,
        status: response?.status
      });

      return {
        success: true,
        via: 'function',
        messageId
      };
    } catch (error) {
      if (error.isFunctionNotConfigured) {
        logger.info('Email function not configured; using SMTP fallback', {
          context,
          correlationId
        });
      } else {
        logger.warn('Email function failed, falling back to SMTP', {
          context,
          correlationId,
          error: error.message,
          status: error.status,
          functionName: error.functionName
        });
      }
    }
  }

  const smtpTransporter = getTransporter();
  const result = await smtpTransporter.sendMail(mailOptions);

  logger.info('Email delivered via SMTP fallback', {
    to: mailOptions.to,
    subject: mailOptions.subject,
    correlationId,
    context,
    messageId: result.messageId
  });

  return {
    success: true,
    via: 'smtp',
    messageId: result.messageId
  };
}

async function verifyTransporter() {
  const smtpTransporter = getTransporter();
  await smtpTransporter.verify();
  return true;
}

module.exports = {
  sendEmail,
  verifyTransporter
};
