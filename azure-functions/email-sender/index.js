/**
 * Azure Function: Email Sender
 *
 * Asynchronous email sending via HTTP trigger
 * Offloads email delivery from main API for better performance
 *
 * Free tier: 1M executions/month
 */

const nodemailer = require('nodemailer');

// Create reusable transporter
let transporter = null;

function ensureEmailConfig() {
  const host = process.env.EMAIL_SMTP_HOST;
  const user = process.env.EMAIL_SMTP_USER;
  const pass = process.env.EMAIL_SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('EMAIL_SMTP_HOST, EMAIL_SMTP_USER, and EMAIL_SMTP_PASS must be configured');
  }

  return {
    host,
    port: parseInt(process.env.EMAIL_SMTP_PORT, 10) || 587,
    secure: process.env.EMAIL_SMTP_SECURE === 'true' || process.env.EMAIL_SMTP_PORT === '465',
    auth: {
      user,
      pass
    }
  };
}

function getTransporter() {
  if (!transporter) {
    const transportConfig = ensureEmailConfig();
    transporter = nodemailer.createTransport(transportConfig);
  }
  return transporter;
}

module.exports = async function (context, req) {
  const correlationId =
    req.headers?.['x-correlation-id'] ||
    req.headers?.['x-correlationid'] ||
    req.headers?.['x_correlation_id'] ||
    null;

  context.log('Email sender function triggered', {
    correlationId
  });

  try {
    ensureEmailConfig();

    // Validate request body
    const { to, subject, text, html, from, tenant } = req.body || {};

    if (!to || typeof to !== 'string') {
      context.res = {
        status: 400,
        body: {
          error: 'Missing required field: to'
        }
      };
      context.log.warn('Email request missing recipient', {
        correlationId
      });
      return;
    }

    if (!subject || typeof subject !== 'string') {
      context.res = {
        status: 400,
        body: {
          error: 'Missing required field: subject'
        }
      };
      context.log.warn('Email request missing subject', {
        correlationId,
        to,
        tenant
      });
      return;
    }

    if (!text && !html) {
      context.res = {
        status: 400,
        body: {
          error: 'Missing email content: text or html required'
        }
      };
      context.log.warn('Email request missing body content', {
        correlationId,
        to,
        subject,
        tenant
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      context.res = {
        status: 400,
        body: {
          error: 'Invalid email address format'
        }
      };
      context.log.warn('Email request failed validation', {
        correlationId,
        to,
        subject,
        tenant
      });
      return;
    }

    // Send email
    const transport = getTransporter();

    const mailOptions = {
      from: from || process.env.EMAIL_FROM || '"Square Middleware" <noreply@fluentfront.ai>',
      to,
      subject,
      text,
      html
    };

    const startTime = Date.now();
    const info = await transport.sendMail(mailOptions);
    const duration = Date.now() - startTime;

    context.log('Email sent successfully', {
      messageId: info.messageId,
      to,
      subject,
      tenant,
      duration,
      correlationId
    });

    context.res = {
      status: 200,
      body: {
        success: true,
        messageId: info.messageId,
        duration,
        timestamp: new Date().toISOString(),
        correlationId
      }
    };
  } catch (error) {
    context.log.error('Email sending failed', {
      message: error.message,
      stack: error.stack,
      correlationId
    });

    context.res = {
      status: 500,
      body: {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        correlationId
      }
    };
  }
};
