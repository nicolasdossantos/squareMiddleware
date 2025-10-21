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

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SMTP_HOST,
      port: parseInt(process.env.EMAIL_SMTP_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_SMTP_USER,
        pass: process.env.EMAIL_SMTP_PASS
      }
    });
  }
  return transporter;
}

module.exports = async function (context, req) {
  context.log('Email sender function triggered');

  try {
    // Validate request body
    const { to, subject, text, html, from, tenant } = req.body;

    if (!to || !subject || (!text && !html)) {
      context.res = {
        status: 400,
        body: {
          error: 'Missing required fields: to, subject, and text or html'
        }
      };
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
      duration
    });

    context.res = {
      status: 200,
      body: {
        success: true,
        messageId: info.messageId,
        duration,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    context.log.error('Email sending failed:', error.message);

    context.res = {
      status: 500,
      body: {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    };
  }
};
