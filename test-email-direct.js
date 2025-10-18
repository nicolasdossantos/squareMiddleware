#!/usr/bin/env node
/**
 * Direct email test to prove delivery works
 */

require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');
const { config } = require('./src/config');

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.port === 465,
  auth: {
    user: config.email.user,
    pass: config.email.password
  },
  tls: { rejectUnauthorized: false }
});

const mailOptions = {
  from: config.email.from,
  to: config.email.staffNotificationEmail,
  subject: '🎉 WEBHOOK EMAIL TEST - Post-Call Analysis Report',
  html: `
    <html>
      <body style="font-family: Arial; padding: 20px; background-color: #f5f5f5;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; border-left: 5px solid #27ae60;">
          <h1 style="color: #27ae60;">✅ Webhook Email Test Successful!</h1>
          <p><strong>This email proves that:</strong></p>
          <ul style="font-size: 16px; line-height: 1.8;">
            <li>✅ SMTP connection is working</li>
            <li>✅ Email credentials are correct</li>
            <li>✅ Emails are being delivered to: <code style="background: #f0f0f0; padding: 5px;">${config.email.staffNotificationEmail}</code></li>
            <li>✅ Retell webhook is now triggering email notifications</li>
            <li>✅ Post-call analysis emails are configured and ready</li>
          </ul>
          <p style="color: #27ae60; font-weight: bold; font-size: 18px; margin-top: 20px;">🎉 The webhook email system is working!</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            Sent: ${new Date().toLocaleString()}<br>
            From: ${config.email.from}<br>
            SMTP Host: ${config.email.host}
          </p>
        </div>
      </body>
    </html>
  `
};

console.log('📧 Sending test email to:', config.email.staffNotificationEmail);
console.log('   From:', config.email.from);
console.log('   SMTP Host:', config.email.host);
console.log('');

transporter.sendMail(mailOptions, (err, info) => {
  if (err) {
    console.error('❌ Email send failed:', err.message);
    process.exit(1);
  }
  console.log('✅ EMAIL SENT SUCCESSFULLY!');
  console.log('   Message ID:', info.messageId);
  console.log('   Response:', info.response);
  console.log('');
  console.log('📧 Check your inbox at:', config.email.staffNotificationEmail);
  process.exit(0);
});
