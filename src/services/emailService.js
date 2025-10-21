/**
 * Email Service
 * Business logic for email notifications and communications
 */

const { logPerformance, logEvent, logError } = require('../utils/logger');
const { config } = require('../config');
const { sendEmail: deliverEmail, verifyTransporter } = require('./emailTransport');

/**
 * Send booking confirmation email to customer
 */
async function sendBookingConfirmation(bookingDetails) {
  const startTime = Date.now();

  try {
    logEvent('email_booking_confirmation_start', {
      customerEmail: bookingDetails.customerEmail,
      serviceRequested: bookingDetails.serviceRequested,
      conversationId: bookingDetails.conversationId
    });

    const mailOptions = {
      from: config.email.from,
      to: bookingDetails.customerEmail,
      subject: 'Booking Request Received',
      html: generateBookingConfirmationHTML(bookingDetails),
      text: generateBookingConfirmationText(bookingDetails)
    };

    const result = await deliverEmail(mailOptions, {
      tenant: bookingDetails.tenant || 'unknown',
      correlationId: bookingDetails.conversationId || null,
      context: 'booking_confirmation'
    });

    logPerformance(null, 'email_booking_confirmation', startTime, {
      customerEmail: bookingDetails.customerEmail,
      messageId: result.messageId,
      transport: result.via
    });

    logEvent('email_booking_confirmation_success', {
      customerEmail: bookingDetails.customerEmail,
      messageId: result.messageId,
      conversationId: bookingDetails.conversationId,
      transport: result.via
    });

    return {
      success: true,
      messageId: result.messageId,
      recipient: bookingDetails.customerEmail
    };
  } catch (error) {
    logError(error, {
      operation: 'sendBookingConfirmation',
      customerEmail: bookingDetails.customerEmail,
      duration: Date.now() - startTime
    });
    throw new Error(`Failed to send booking confirmation email: ${error.message}`);
  }
}

/**
 * Send staff notification email
 */
async function sendStaffNotification(callDetails) {
  const startTime = Date.now();

  try {
    logEvent('email_staff_notification_start', {
      conversationId: callDetails.conversationId,
      priority: callDetails.priority,
      bookingDetected: callDetails.bookingInfo?.hasBookingIntent
    });

    const priorityPrefix = callDetails.priority === 'high' ? '[HIGH PRIORITY] ' : '';
    const subject = `${priorityPrefix}New Customer Call - ${callDetails.conversationId}`;
    const mailOptions = {
      from: config.email.from,
      to: config.email.staffNotificationEmail,
      subject: subject,
      html: generateStaffNotificationHTML(callDetails),
      text: generateStaffNotificationText(callDetails)
    };

    const result = await deliverEmail(mailOptions, {
      tenant: callDetails.tenant || 'unknown',
      correlationId: callDetails.conversationId || null,
      context: 'staff_notification'
    });

    logPerformance(null, 'email_staff_notification', startTime, {
      conversationId: callDetails.conversationId,
      messageId: result.messageId,
      priority: callDetails.priority,
      transport: result.via
    });

    logEvent('email_staff_notification_success', {
      conversationId: callDetails.conversationId,
      messageId: result.messageId,
      priority: callDetails.priority,
      transport: result.via
    });

    return {
      success: true,
      messageId: result.messageId,
      recipient: config.email.staffNotificationEmail
    };
  } catch (error) {
    logError(error, {
      operation: 'sendStaffNotification',
      conversationId: callDetails.conversationId,
      duration: Date.now() - startTime
    });
    throw new Error(`Failed to send staff notification email: ${error.message}`);
  }
}

/**
 * Generate booking confirmation HTML email
 */
function generateBookingConfirmationHTML(bookingDetails) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Booking Confirmation</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .booking-details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { background-color: #ecf0f1; padding: 15px; text-align: center; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Booking Confirmation</h1>
            <p>Your booking request has been received!</p>
        </div>
        
        <div class="content">
            <p>Dear ${bookingDetails.customerName || 'Valued Customer'},</p>
            
            <p>
              Thank you for your call! We've received your booking request and
              will contact you within 24 hours to confirm your appointment.
            </p>
            
            <div class="booking-details">
                <h3>Booking Request Details:</h3>
                ${
                  bookingDetails.serviceRequested
                    ? `<p><strong>Service:</strong> ${bookingDetails.serviceRequested}</p>`
                    : ''
                }
                ${
                  bookingDetails.preferredDate
                    ? `<p><strong>Preferred Date:</strong> ${bookingDetails.preferredDate}</p>`
                    : ''
                }
                ${
                  bookingDetails.preferredTime
                    ? `<p><strong>Preferred Time:</strong> ${bookingDetails.preferredTime}</p>`
                    : ''
                }
                <p><strong>Request ID:</strong> ${bookingDetails.conversationId}</p>
            </div>
            
            <p>If you have any questions or need to make changes, please call us at <strong>(555) 123-4567</strong>.</p>
            
            <p>We look forward to seeing you soon!</p>
            
            <p>Best regards,<br>Your Service Team</p>
        </div>
        
        <div class="footer">
            <p>For questions or changes, please contact us.</p>
        </div>
    </body>
    </html>
  `;
}

/**
 * Generate booking confirmation text email
 */
function generateBookingConfirmationText(bookingDetails) {
  return `
Booking Request Received

Dear ${bookingDetails.customerName || 'Valued Customer'},

Thank you for your call! We've received your booking request and
will contact you within 24 hours to confirm your appointment.

Booking Request Details:
${bookingDetails.serviceRequested ? `Service: ${bookingDetails.serviceRequested}` : ''}
${bookingDetails.preferredDate ? `Preferred Date: ${bookingDetails.preferredDate}` : ''}
${bookingDetails.preferredTime ? `Preferred Time: ${bookingDetails.preferredTime}` : ''}
Request ID: ${bookingDetails.conversationId}

If you have any questions or need to make changes, please call us at (555) 123-4567.

We look forward to seeing you soon!

Best regards,
Your Service Team

For questions or changes, please contact us.
  `;
}

/**
 * Generate staff notification HTML email
 */
function generateStaffNotificationHTML(callDetails) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>New Customer Call - ${callDetails.conversationId}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { 
              background-color: ${callDetails.priority === 'high' ? '#e74c3c' : '#3498db'}; 
              color: white; padding: 20px; text-align: center; 
            }
            .content { padding: 20px; }
            .call-details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .booking-info { 
              background-color: #d4edda; padding: 15px; border-radius: 5px; 
              margin: 20px 0; border-left: 4px solid #28a745; 
            }
            .priority-high { border-left: 4px solid #dc3545; background-color: #f8d7da; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>${callDetails.priority === 'high' ? '[HIGH PRIORITY] ' : ''}New Customer Call</h1>
            <p>Conversation ID: ${callDetails.conversationId}</p>
        </div>
        
        <div class="content">
            <div class="call-details">
                <h3>Call Details:</h3>
                <p><strong>Phone Number:</strong> ${callDetails.customerPhone || 'Not provided'}</p>
                <p><strong>Duration:</strong> ${callDetails.callDuration} seconds</p>
                <p><strong>Summary:</strong> ${callDetails.summary}</p>
                <p><strong>Priority:</strong> ${callDetails.priority}</p>
            </div>
            
            ${
              callDetails.bookingInfo?.hasBookingIntent
                ? `
            <div class="booking-info">
                <h3>🗓️ Booking Request Detected!</h3>
                ${
                  callDetails.bookingInfo.serviceRequested
                    ? `<p><strong>Service:</strong> ${callDetails.bookingInfo.serviceRequested}</p>`
                    : ''
                }
                ${
                  callDetails.bookingInfo.customerName
                    ? `<p><strong>Customer Name:</strong> ${callDetails.bookingInfo.customerName}</p>`
                    : ''
                }
                ${
                  callDetails.bookingInfo.customerEmail
                    ? `<p><strong>Email:</strong> ${callDetails.bookingInfo.customerEmail}</p>`
                    : ''
                }
                ${
                  callDetails.bookingInfo.preferredDate
                    ? `<p><strong>Preferred Date:</strong> ${callDetails.bookingInfo.preferredDate}</p>`
                    : ''
                }
                ${
                  callDetails.bookingInfo.preferredTime
                    ? `<p><strong>Preferred Time:</strong> ${callDetails.bookingInfo.preferredTime}</p>`
                    : ''
                }
                ${
                  callDetails.bookingInfo.needsFollowUp
                    ? '<p><strong>⚠️ Requires follow-up to confirm details</strong></p>'
                    : ''
                }
            </div>
            `
                : ''
            }
            
            <p><strong>Next Actions:</strong></p>
            <ul>
                ${
                  callDetails.bookingInfo?.hasBookingIntent
                    ? '<li>Contact customer to confirm booking details</li>'
                    : ''
                }
                ${callDetails.bookingInfo?.needsFollowUp ? '<li>Follow up within 24 hours</li>' : ''}
                <li>Review call recording if available</li>
            </ul>
        </div>
    </body>
    </html>
  `;
}

/**
 * Generate staff notification text email
 */
function generateStaffNotificationText(callDetails) {
  const priorityPrefix = callDetails.priority === 'high' ? '[HIGH PRIORITY] ' : '';
  return `
${priorityPrefix}New Customer Call - ${callDetails.conversationId}

Call Details:
- Phone Number: ${callDetails.customerPhone || 'Not provided'}
- Duration: ${callDetails.callDuration} seconds
- Summary: ${callDetails.summary}
- Priority: ${callDetails.priority}

${
  callDetails.bookingInfo?.hasBookingIntent
    ? `
BOOKING REQUEST DETECTED!
${callDetails.bookingInfo.serviceRequested ? `Service: ${callDetails.bookingInfo.serviceRequested}` : ''}
${callDetails.bookingInfo.customerName ? `Customer Name: ${callDetails.bookingInfo.customerName}` : ''}
${callDetails.bookingInfo.customerEmail ? `Email: ${callDetails.bookingInfo.customerEmail}` : ''}
${callDetails.bookingInfo.preferredDate ? `Preferred Date: ${callDetails.bookingInfo.preferredDate}` : ''}
${callDetails.bookingInfo.preferredTime ? `Preferred Time: ${callDetails.bookingInfo.preferredTime}` : ''}
${callDetails.bookingInfo.needsFollowUp ? 'WARNING: Requires follow-up to confirm details' : ''}
`
    : ''
}

Next Actions:
${callDetails.bookingInfo?.hasBookingIntent ? '- Contact customer to confirm booking details' : ''}
${callDetails.bookingInfo?.needsFollowUp ? '- Follow up within 24 hours' : ''}
- Review call recording if available

Business Staff Notification System
  `;
}

/**
 * Test email configuration
 */
async function testEmailConfiguration() {
  try {
    await verifyTransporter();

    logEvent('email_configuration_test_success');
    return { success: true, message: 'Email configuration is valid' };
  } catch (error) {
    logError(error, {
      operation: 'testEmailConfiguration'
    });
    return { success: false, message: error.message };
  }
}

module.exports = {
  sendBookingConfirmation,
  sendStaffNotification,
  testEmailConfiguration
};
