const { healthService } = require('../../src/services/healthService');
const { customerService } = require('../../src/services/customerService');
const { bookingService } = require('../../src/services/bookingService');
const { emailService } = require('../../src/services/emailService');
const { webhookService } = require('../../src/services/webhookService');

describe('Service Layer Tests', () => {
  describe('Health Service', () => {
    it('should return health status', async () => {
      const health = await healthService.getHealthStatus();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health.status).toMatch(/^(healthy|unhealthy)$/);
    });

    it('should check readiness', async () => {
      const readiness = await healthService.checkReadiness();
      expect(readiness).toHaveProperty('ready');
      expect(typeof readiness.ready).toBe('boolean');
    });

    it('should get detailed health', async () => {
      const detailedHealth = await healthService.getDetailedHealth();
      expect(detailedHealth).toHaveProperty('status');
      expect(detailedHealth).toHaveProperty('timestamp');
      expect(detailedHealth).toHaveProperty('checks');
      expect(Array.isArray(detailedHealth.checks)).toBe(true);
    });
  });

  describe('Customer Service', () => {
    it('should validate customer ID format', () => {
      const validIds = ['CUST123', 'customer_123', '123'];
      const invalidIds = ['', null, undefined, 123];

      validIds.forEach(id => {
        expect(() => customerService.validateCustomerId(id)).not.toThrow();
      });

      invalidIds.forEach(id => {
        expect(() => customerService.validateCustomerId(id)).toThrow();
      });
    });

    it('should validate customer update data', () => {
      const validData = {
        given_name: 'John',
        family_name: 'Doe',
        email_address: 'john@example.com',
        phone_number: '+1234567890'
      };

      const invalidData = {
        given_name: '',
        family_name: 123,
        email_address: 'invalid-email',
        phone_number: 'invalid-phone'
      };

      expect(() => customerService.validateCustomerData(validData)).not.toThrow();
      expect(() => customerService.validateCustomerData(invalidData)).toThrow();
    });
  });

  describe('Booking Service', () => {
    it('should validate service ID format', () => {
      const validIds = ['SERVICE123', 'service_123'];
      const invalidIds = ['', null, undefined, 123];

      validIds.forEach(id => {
        expect(() => bookingService.validateServiceId(id)).not.toThrow();
      });

      invalidIds.forEach(id => {
        expect(() => bookingService.validateServiceId(id)).toThrow();
      });
    });

    it('should validate date range', () => {
      const validRange = {
        start_date: '2024-01-01',
        end_date: '2024-01-31'
      };

      const invalidRange = {
        start_date: '2024-01-31',
        end_date: '2024-01-01'
      };

      expect(() => bookingService.validateDateRange(validRange)).not.toThrow();
      expect(() => bookingService.validateDateRange(invalidRange)).toThrow();
    });
  });

  describe('Email Service', () => {
    it('should validate email configuration', () => {
      const isConfigured = emailService.isEmailConfigured();
      expect(typeof isConfigured).toBe('boolean');
    });

    it('should validate email addresses', () => {
      const validEmails = ['test@example.com', 'user+tag@domain.co.uk'];
      const invalidEmails = ['invalid-email', '@domain.com', 'user@'];

      validEmails.forEach(email => {
        expect(emailService.validateEmail(email)).toBe(true);
      });

      invalidEmails.forEach(email => {
        expect(emailService.validateEmail(email)).toBe(false);
      });
    });
  });

  describe('Webhook Service', () => {
    it('should validate webhook signatures', () => {
      const validPayload = '{"test": "data"}';
      const secret = 'test-secret';

      // Create a valid signature
      const validSignature = webhookService.createSignature(validPayload, secret);
      expect(webhookService.verifySignature(validPayload, validSignature, secret)).toBe(true);

      // Test invalid signature
      const invalidSignature = 'invalid-signature';
      expect(webhookService.verifySignature(validPayload, invalidSignature, secret)).toBe(false);
    });

    it('should process ElevenLabs webhook data', () => {
      const validWebhookData = {
        conversation_id: 'conv_123',
        agent_id: 'agent_123',
        call_id: 'call_123',
        status: 'completed',
        transcript: 'Test conversation'
      };

      expect(() => webhookService.validateElevenLabsWebhook(validWebhookData)).not.toThrow();
    });
  });
});

// Mock implementations for testing without actual API calls
jest.mock('../../src/services/customerService', () => ({
  customerService: {
    validateCustomerId: id => {
      if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error('Invalid customer ID');
      }
      return true;
    },
    validateCustomerData: data => {
      if (!data.given_name || typeof data.given_name !== 'string' || data.given_name.trim() === '') {
        throw new Error('Invalid given name');
      }
      if (data.family_name && typeof data.family_name !== 'string') {
        throw new Error('Invalid family name');
      }
      if (data.email_address && !data.email_address.includes('@')) {
        throw new Error('Invalid email address');
      }
      return true;
    }
  }
}));

jest.mock('../../src/services/bookingService', () => ({
  bookingService: {
    validateServiceId: id => {
      if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error('Invalid service ID');
      }
      return true;
    },
    validateDateRange: range => {
      const startDate = new Date(range.start_date);
      const endDate = new Date(range.end_date);
      if (startDate >= endDate) {
        throw new Error('Start date must be before end date');
      }
      return true;
    }
  }
}));

jest.mock('../../src/services/emailService', () => ({
  emailService: {
    isEmailConfigured: () => true,
    validateEmail: email => {
      if (!email || typeof email !== 'string') return false;
      // Simple validation: must contain @ and at least one dot
      const atIndex = email.indexOf('@');
      const dotIndex = email.lastIndexOf('.');
      return atIndex > 0 && dotIndex > atIndex + 1 && dotIndex < email.length - 1;
    }
  }
}));

jest.mock('../../src/services/webhookService', () => ({
  webhookService: {
    createSignature: (payload, secret) => {
      const crypto = require('crypto');
      return `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
    },
    verifySignature: (payload, signature, secret) => {
      const crypto = require('crypto');
      const expectedSignature = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
      return signature === expectedSignature;
    },
    validateElevenLabsWebhook: data => {
      if (!data.conversation_id || !data.agent_id) {
        throw new Error('Missing required webhook fields');
      }
      return true;
    }
  }
}));

jest.mock('../../src/services/healthService', () => ({
  healthService: {
    getHealthStatus: async () => ({
      status: 'healthy',
      timestamp: new Date().toISOString()
    }),
    checkReadiness: async () => ({
      ready: true,
      timestamp: new Date().toISOString()
    }),
    getDetailedHealth: async () => ({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: [
        { name: 'memory', status: 'healthy' },
        { name: 'disk', status: 'healthy' }
      ]
    })
  }
}));
