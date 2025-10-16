/**
 * Webhook Controller Unit Tests
 */

const webhookController = require('../../../src/controllers/webhookController');
const {
  verifyWebhookSignature,
  processElevenLabsPostCall
} = require('../../../src/services/comprehensiveWebhookService');
const webhookService = require('../../../src/services/webhookService');
const { sendSuccess, sendError } = require('../../../src/utils/responseBuilder');
const { logEvent, logSecurityEvent, logPerformance } = require('../../../src/utils/logger');
const { config } = require('../../../src/config');

// Mock dependencies
jest.mock('../../../src/services/comprehensiveWebhookService');
jest.mock('../../../src/services/webhookService');
jest.mock('../../../src/utils/responseBuilder');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/config');

describe('Webhook Controller', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    mockReq = {
      body: {},
      headers: {},
      correlationId: 'test-correlation-id'
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Mock config
    config.elevenlabs = {
      webhookSecret: 'test-secret'
    };

    jest.clearAllMocks();
  });

  describe('handleElevenLabsPostCall', () => {
    beforeEach(() => {
      mockReq.body = {
        type: 'post_call_transcription',
        data: {
          conversation_id: 'conv123',
          agent_id: 'agent-1',
          status: 'completed'
        }
      };
    });

    it('should process ElevenLabs webhook successfully', async () => {
      const mockResult = {
        processed: true,
        conversationId: 'conv123',
        customerName: 'John Doe',
        emailSent: true,
        toolsProcessed: 2,
        type: 'post_call_transcription',
        summary: 'Processed post-call transcription for John Doe (conv123)'
      };

      verifyWebhookSignature.mockReturnValue(true);
      processElevenLabsPostCall.mockResolvedValue(mockResult);

      await webhookController.handleElevenLabsPostCall(mockReq, mockRes);

      expect(logEvent).toHaveBeenCalledWith('elevenlabs_webhook_received', {
        correlationId: 'test-correlation-id',
        type: 'post_call_transcription',
        hasData: true,
        conversationId: 'conv123'
      });
      expect(processElevenLabsPostCall).toHaveBeenCalledWith(mockReq.body, 'test-correlation-id');
      expect(sendSuccess).toHaveBeenCalledWith(mockRes, mockResult, 'Webhook processed successfully');
    });

    it('should validate required fields', async () => {
      mockReq.body = { conversation_id: 'conv123' }; // Missing type and data

      processElevenLabsPostCall.mockRejectedValue(new Error('Missing required fields: type and data'));

      await webhookController.handleElevenLabsPostCall(mockReq, mockRes);

      expect(sendError).toHaveBeenCalledWith(
        mockRes,
        'Failed to process webhook',
        500,
        'Missing required fields: type and data'
      );
    });

    it('should verify webhook signature if present', async () => {
      mockReq.headers['elevenlabs-signature'] = 'valid-signature';
      verifyWebhookSignature.mockReturnValue(true);
      processElevenLabsPostCall.mockResolvedValue({ processed: true });

      await webhookController.handleElevenLabsPostCall(mockReq, mockRes);

      expect(verifyWebhookSignature).toHaveBeenCalledWith(
        JSON.stringify(mockReq.body),
        'valid-signature',
        'test-secret'
      );
    });

    it('should reject invalid signatures', async () => {
      mockReq.headers['elevenlabs-signature'] = 'invalid-signature';
      verifyWebhookSignature.mockReturnValue(false);

      await webhookController.handleElevenLabsPostCall(mockReq, mockRes);

      expect(logSecurityEvent).toHaveBeenCalledWith(
        'invalid_webhook_signature',
        {
          source: 'elevenlabs',
          signature: 'invalid-...'
        },
        mockReq
      );

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Invalid webhook signature', 401);
    });

    it('should handle processing errors', async () => {
      const error = new Error('Processing failed');
      processElevenLabsPostCall.mockRejectedValue(error);

      await webhookController.handleElevenLabsPostCall(mockReq, mockRes);

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Failed to process webhook', 500, 'Processing failed');
    });
  });

  describe('handleSquarePayment', () => {
    beforeEach(() => {
      mockReq.body = {
        type: 'payment.created',
        merchant_id: 'merchant123'
      };
      mockReq.headers['x-square-signature'] = 'valid-signature';
    });

    it('should process Square payment webhook successfully', async () => {
      const mockResult = {
        processed: true,
        summary: 'Payment processed'
      };
      webhookService.verifySquareSignature.mockResolvedValue(true);
      webhookService.processSquarePayment.mockResolvedValue(mockResult);

      await webhookController.handleSquarePayment(mockReq, mockRes);

      expect(logEvent).toHaveBeenCalledWith('square_payment_webhook_received', {
        correlationId: 'test-correlation-id',
        eventType: 'payment.created',
        merchantId: 'merchant123'
      });

      expect(webhookService.verifySquareSignature).toHaveBeenCalledWith(
        mockReq.body,
        'valid-signature',
        undefined
      );

      expect(sendSuccess).toHaveBeenCalledWith(mockRes, mockResult, 'Payment webhook processed successfully');
    });

    it('should require signature', async () => {
      delete mockReq.headers['x-square-signature'];

      await webhookController.handleSquarePayment(mockReq, mockRes);

      expect(logSecurityEvent).toHaveBeenCalledWith(
        'missing_webhook_signature',
        { source: 'square_payment' },
        mockReq
      );

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Missing webhook signature', 401);
    });

    it('should reject invalid signatures', async () => {
      webhookService.verifySquareSignature.mockResolvedValue(false);

      await webhookController.handleSquarePayment(mockReq, mockRes);

      expect(logSecurityEvent).toHaveBeenCalledWith(
        'invalid_webhook_signature',
        {
          source: 'square_payment',
          signature: 'valid-signature'
        },
        mockReq
      );

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Invalid webhook signature', 401);
    });

    it('should handle processing errors', async () => {
      webhookService.verifySquareSignature.mockResolvedValue(true);
      const error = new Error('Payment processing failed');
      webhookService.processSquarePayment.mockRejectedValue(error);

      await webhookController.handleSquarePayment(mockReq, mockRes);

      expect(sendError).toHaveBeenCalledWith(
        mockRes,
        'Failed to process payment webhook',
        500,
        'Payment processing failed'
      );
    });
  });

  describe('handleSquareBooking', () => {
    beforeEach(() => {
      mockReq.body = {
        type: 'booking.created',
        merchant_id: 'merchant123'
      };
      mockReq.headers['x-square-signature'] = 'valid-signature';
    });

    it('should process Square booking webhook successfully', async () => {
      const mockResult = {
        processed: true,
        summary: 'Booking processed'
      };
      webhookService.verifySquareSignature.mockResolvedValue(true);
      webhookService.processSquareBooking.mockResolvedValue(mockResult);

      await webhookController.handleSquareBooking(mockReq, mockRes);

      expect(logEvent).toHaveBeenCalledWith('square_booking_webhook_received', {
        correlationId: 'test-correlation-id',
        eventType: 'booking.created',
        merchantId: 'merchant123'
      });

      expect(sendSuccess).toHaveBeenCalledWith(mockRes, mockResult, 'Booking webhook processed successfully');
    });

    it('should require signature', async () => {
      delete mockReq.headers['x-square-signature'];

      await webhookController.handleSquareBooking(mockReq, mockRes);

      expect(logSecurityEvent).toHaveBeenCalledWith(
        'missing_webhook_signature',
        { source: 'square_booking' },
        mockReq
      );

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Missing webhook signature', 401);
    });

    it('should reject invalid signatures', async () => {
      webhookService.verifySquareSignature.mockResolvedValue(false);

      await webhookController.handleSquareBooking(mockReq, mockRes);

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Invalid webhook signature', 401);
    });

    it('should handle processing errors', async () => {
      webhookService.verifySquareSignature.mockResolvedValue(true);
      const error = new Error('Booking processing failed');
      webhookService.processSquareBooking.mockRejectedValue(error);

      await webhookController.handleSquareBooking(mockReq, mockRes);

      expect(sendError).toHaveBeenCalledWith(
        mockRes,
        'Failed to process booking webhook',
        500,
        'Booking processing failed'
      );
    });
  });

  describe('healthCheck', () => {
    it('should return health status successfully', async () => {
      await webhookController.healthCheck(mockReq, mockRes);

      expect(logEvent).toHaveBeenCalledWith('webhook_health_check', {
        correlationId: 'test-correlation-id',
        status: 'healthy'
      });

      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        {
          status: 'healthy',
          timestamp: expect.any(String),
          webhooks: {
            elevenlabs: 'active',
            square_payment: 'active',
            square_booking: 'active'
          }
        },
        'Webhook service is healthy'
      );
    });

    it('should handle health check errors', async () => {
      // Force an error by mocking logEvent to throw
      logEvent.mockImplementation(() => {
        throw new Error('Logging failed');
      });

      await webhookController.healthCheck(mockReq, mockRes);

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Health check failed', 500, 'Logging failed');
    });
  });
});
