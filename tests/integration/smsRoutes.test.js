/**
 * SMS Routes Basic Integration Tests
 * Tests for basic SMS API functionality without complex mocking
 */

const request = require('supertest');
const express = require('express');
const smsRoutes = require('../../src/routes/sms');

describe('SMS Routes Basic Integration', () => {
  let app;

  beforeEach(() => {
    // Create express app with SMS routes
    app = express();
    app.use(express.json());
    app.use('/api/sms', smsRoutes);
  });

  describe('Validation Tests', () => {
    it('should validate required fields for SMS send', async () => {
      const response = await request(app).post('/api/sms/send').send({}).expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed'
      });
      expect(response.body.details).toContain('Field "to" is required and must be a string');
      expect(response.body.details).toContain('Field "message" is required and must be a string');
    });

    it('should validate phone number format', async () => {
      const response = await request(app)
        .post('/api/sms/send')
        .send({
          to: 'invalid-phone',
          message: 'Test message'
        })
        .expect(400);

      expect(response.body.details).toContain(
        'Field "to" must be a valid phone number in format +1234567890'
      );
    });

    it('should validate message length', async () => {
      const longMessage = 'A'.repeat(1601); // > 1600 characters

      const response = await request(app)
        .post('/api/sms/send')
        .send({
          to: '+12677210098',
          message: longMessage
        })
        .expect(400);

      expect(response.body.details).toContain('Field "message" cannot exceed 1600 characters');
    });

    it('should validate customer message fields', async () => {
      const response = await request(app).post('/api/sms/customer-message').send({}).expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed'
      });
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          'Field "customerFirstName" is required and must be a string',
          'Field "customerLastName" is required and must be a string',
          'Field "customerPhoneNumber" is required and must be a string',
          'Field "message" is required and must be a string'
        ])
      );
    });

    it('should validate optional messageTo format', async () => {
      const response = await request(app)
        .post('/api/sms/customer-message')
        .send({
          customerFirstName: 'João',
          customerLastName: 'Silva',
          customerPhoneNumber: '+5511987654321',
          message: 'Test message',
          messageTo: 'invalid-phone'
        })
        .expect(400);

      expect(response.body.details).toContain(
        'Field "messageTo" must be a valid phone number in format +1234567890'
      );
    });
  });

  describe('Route Structure Tests', () => {
    it('should have all expected SMS routes', () => {
      // These tests verify the routes are properly configured
      // The actual SMS sending is tested in the controller and service tests
      const routePaths = smsRoutes.stack.map(layer => layer.route?.path).filter(Boolean);

      expect(routePaths).toContain('/send');
      expect(routePaths).toContain('/booking-confirmation');
      expect(routePaths).toContain('/customer-message');
    });
  });
});
