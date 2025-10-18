#!/usr/bin/env node
require('dotenv').config({path: '.env.local'});
const nodemailer = require('nodemailer');
const {config} = require('./src/config');

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.port === 465,
  auth: { user: config.email.user, pass: config.email.password },
  tls: { rejectUnauthorized: false }
});

const mailOptions = {
  from: config.email.from,
  to: config.email.staffNotificationEmail,
  subject: '✅ Retell Webhook Email System Verified',
  html: `<h1>✅ Webhook emails are working!</h1><p>All Retell call_analyzed events will now send detailed post-call reports to: <strong>${config.email.staffNotificationEmail}</strong></p><p>Time: ${new Date().toISOString()}</p>`
};

transporter.sendMail(mailOptions, (err, info) => {
  if (err) { 
    console.error('❌ Failed:', err.message); 
    process.exit(1); 
  }
  console.log('✅ TEST EMAIL SENT');
  console.log('   To:', config.email.staffNotificationEmail);
  console.log('   Message ID:', info.messageId);
  process.exit(0);
});
