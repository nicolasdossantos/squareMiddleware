/**
 * SMS Controller Basic Tests
 * Simple tests for SMS controller validation
 */

const smsController = require('../../src/controllers/smsController');

describe('SMS Controller Basic Tests', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      body: {},
      headers: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('sendMessage validation', () => {
    it('should return 400 for missing fields', async () => {
      mockReq.body = {}; // Missing required fields

      await smsController.sendMessage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Missing required fields: to, message'
        })
      );
    });

    it('should return 400 for invalid phone number', async () => {
      mockReq.body = {
        to: 'invalid-phone',
        message: 'Test message'
      };

      await smsController.sendMessage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid phone number format'
        })
      );
    });
  });

  describe('sendBookingConfirmation validation', () => {
    it('should return 400 for missing fields', async () => {
      mockReq.body = {}; // Missing required fields

      await smsController.sendBookingConfirmation(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Missing required fields: bookingId, customerPhone'
        })
      );
    });
  });

  describe('controller functions exist', () => {
    it('should have sendMessage function', () => {
      expect(typeof smsController.sendMessage).toBe('function');
    });

    it('should have sendBookingConfirmation function', () => {
      expect(typeof smsController.sendBookingConfirmation).toBe('function');
    });

    it('should have sendCustomerMessage function', () => {
      expect(typeof smsController.sendCustomerMessage).toBe('function');
    });
  });
});
