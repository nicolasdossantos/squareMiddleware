/**
 * Customer Controller Unit Tests
 */

const customerController = require('../../../src/controllers/customerController');
const customerService = require('../../../src/services/customerService');
const { sendSuccess, sendError, sendNotFound } = require('../../../src/utils/responseBuilder');
const logger = require('../../../src/utils/logger');

// Mock dependencies
jest.mock('../../../src/services/customerService');
jest.mock('../../../src/utils/responseBuilder');
jest.mock('../../../src/utils/logger');

describe('Customer Controller', () => {
  let mockReq, mockRes, mockTenant;

  beforeEach(() => {
    // Mock tenant context
    mockTenant = {
      id: 'test-tenant',
      squareAccessToken: 'test-token',
      squareLocationId: 'test-location',
      squareEnvironment: 'sandbox',
      timezone: 'America/New_York'
    };

    mockReq = {
      params: {},
      query: {},
      body: {},
      correlationId: 'test-correlation-id',
      tenant: mockTenant // Add tenant context for HTTP handlers
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Setup customerService mock methods
    customerService.getCustomerInfo = jest.fn();
    customerService.updateCustomerInfo = jest.fn();
    customerService.getCustomerBookings = jest.fn();
    customerService.cancelBooking = jest.fn();
    customerService.createCustomer = jest.fn();
    customerService.listCustomers = jest.fn();

    jest.clearAllMocks();
  });

  describe('getCustomerById', () => {
    it('should return customer data successfully', async () => {
      const mockCustomer = { id: 'cust123', givenName: 'John', familyName: 'Doe' };
      customerService.getCustomerInfo.mockResolvedValue(mockCustomer);

      const result = await customerController.getCustomerById(mockTenant, 'cust123');

      expect(customerService.getCustomerInfo).toHaveBeenCalledWith(mockTenant, 'cust123');
      expect(result).toEqual(mockCustomer);
    });

    it('should throw error when customer service fails', async () => {
      const error = new Error('Database error');
      customerService.getCustomerInfo.mockRejectedValue(error);

      try {
        await customerController.getCustomerById(mockTenant, 'cust123');
        fail('Should have thrown an error');
      } catch (thrownError) {
        expect(thrownError.message).toBe('Failed to get customer');
        expect(thrownError.code).toBe('CUSTOMER_SEARCH_FAILED');
      }
      expect(logger.error).toHaveBeenCalledWith('Error getting customer by ID:', error);
    });
  });

  describe('getCustomerByPhone', () => {
    it('should return customer data successfully', async () => {
      const mockCustomer = { id: 'cust123', phoneNumber: '+1234567890' };
      customerService.getCustomerInfo.mockResolvedValue(mockCustomer);

      const result = await customerController.getCustomerByPhone(mockTenant, '+1234567890');

      expect(customerService.getCustomerInfo).toHaveBeenCalledWith(mockTenant, '+1234567890');
      expect(result).toEqual(mockCustomer);
    });

    it('should throw error when customer service fails', async () => {
      const error = new Error('Phone validation error');
      customerService.getCustomerInfo.mockRejectedValue(error);

      try {
        await customerController.getCustomerByPhone(mockTenant, 'invalid');
        fail('Should have thrown an error');
      } catch (thrownError) {
        expect(thrownError.message).toBe('Failed to get customer by phone');
        expect(thrownError.code).toBe('CUSTOMER_SEARCH_FAILED');
      }
      expect(logger.error).toHaveBeenCalledWith('Error getting customer by phone:', error);
    });
  });

  describe('createCustomer', () => {
    it('should create customer successfully', async () => {
      const customerData = { givenName: 'Jane', familyName: 'Smith' };
      const mockCreatedCustomer = { id: 'cust456', ...customerData };
      customerService.createCustomer.mockResolvedValue(mockCreatedCustomer);

      const result = await customerController.createCustomer(mockTenant, customerData);

      expect(customerService.createCustomer).toHaveBeenCalledWith(mockTenant, customerData);
      expect(result).toEqual(mockCreatedCustomer);
    });

    it('should throw error when creation fails', async () => {
      const error = new Error('Creation failed');
      customerService.createCustomer.mockRejectedValue(error);

      try {
        await customerController.createCustomer(mockTenant, {});
        fail('Should have thrown an error');
      } catch (thrownError) {
        expect(thrownError.message).toBe('Failed to create customer');
        expect(thrownError.code).toBe('CUSTOMER_CREATION_FAILED');
      }
      expect(logger.error).toHaveBeenCalledWith('Error creating customer:', error);
    });
  });

  describe('updateCustomer', () => {
    it('should update customer successfully', async () => {
      const updateData = { givenName: 'Updated Name' };
      const mockUpdatedCustomer = { id: 'cust123', ...updateData };
      customerService.updateCustomerInfo.mockResolvedValue(mockUpdatedCustomer);

      const result = await customerController.updateCustomer(mockTenant, 'cust123', updateData);

      expect(customerService.updateCustomerInfo).toHaveBeenCalledWith(mockTenant, 'cust123', updateData);
      expect(result).toEqual(mockUpdatedCustomer);
    });

    it('should throw error when update fails', async () => {
      const error = new Error('Update failed');
      customerService.updateCustomerInfo.mockRejectedValue(error);

      try {
        await customerController.updateCustomer(mockTenant, 'cust123', {});
        fail('Should have thrown an error');
      } catch (thrownError) {
        expect(thrownError.message).toBe('Failed to update customer');
        expect(thrownError.code).toBe('CUSTOMER_UPDATE_FAILED');
      }
      expect(logger.error).toHaveBeenCalledWith('Error updating customer:', error);
    });
  });

  describe('listCustomers', () => {
    it('should list customers successfully', async () => {
      const mockCustomers = [{ id: 'cust1' }, { id: 'cust2' }];
      customerService.listCustomers.mockResolvedValue(mockCustomers);

      const result = await customerController.listCustomers(mockTenant);

      expect(customerService.listCustomers).toHaveBeenCalledWith(mockTenant, {});
      expect(result).toEqual(mockCustomers);
    });

    it('should list customers with filters', async () => {
      const filters = { emailAddress: 'test@example.com' };
      const mockCustomers = [{ id: 'cust1' }];
      customerService.listCustomers.mockResolvedValue(mockCustomers);

      const result = await customerController.listCustomers(mockTenant, filters);

      expect(customerService.listCustomers).toHaveBeenCalledWith(mockTenant, filters);
      expect(result).toEqual(mockCustomers);
    });

    it('should throw error when listing fails', async () => {
      const error = new Error('List failed');
      customerService.listCustomers.mockRejectedValue(error);

      try {
        await customerController.listCustomers(mockTenant);
        fail('Should have thrown an error');
      } catch (thrownError) {
        expect(thrownError.message).toBe('Failed to list customers');
        expect(thrownError.code).toBe('CUSTOMER_SEARCH_FAILED');
      }
      expect(logger.error).toHaveBeenCalledWith('Error listing customers:', error);
    });
  });

  describe('updateCustomerInfo (Express handler)', () => {
    it('should update customer via query parameter', async () => {
      mockReq.query.customerId = 'cust123';
      mockReq.body = { givenName: 'Updated Name' };
      const mockUpdatedCustomer = { id: 'cust123', givenName: 'Updated Name' };
      customerService.updateCustomerInfo.mockResolvedValue(mockUpdatedCustomer);

      await customerController.updateCustomerInfo(mockReq, mockRes);

      expect(customerService.updateCustomerInfo).toHaveBeenCalledWith(mockTenant, 'cust123', {
        givenName: 'Updated Name'
      });
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockUpdatedCustomer,
        'Customer information updated successfully'
      );
    });

    it('should update customer via params', async () => {
      mockReq.params.customerId = 'cust123';
      mockReq.body = { familyName: 'Updated Last' };
      const mockUpdatedCustomer = { id: 'cust123', familyName: 'Updated Last' };
      customerService.updateCustomerInfo.mockResolvedValue(mockUpdatedCustomer);

      await customerController.updateCustomerInfo(mockReq, mockRes);

      expect(customerService.updateCustomerInfo).toHaveBeenCalledWith(mockTenant, 'cust123', {
        familyName: 'Updated Last'
      });
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockUpdatedCustomer,
        'Customer information updated successfully'
      );
    });

    it('should update customer via body customer_id (Azure Functions compatibility)', async () => {
      mockReq.body = { customer_id: 'cust123', givenName: 'Updated Name' };
      const mockUpdatedCustomer = { id: 'cust123', givenName: 'Updated Name' };
      customerService.updateCustomerInfo.mockResolvedValue(mockUpdatedCustomer);

      await customerController.updateCustomerInfo(mockReq, mockRes);

      expect(customerService.updateCustomerInfo).toHaveBeenCalledWith(mockTenant, 'cust123', {
        givenName: 'Updated Name'
      });
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockUpdatedCustomer,
        'Customer information updated successfully'
      );
    });

    it('should return 400 when customer ID is missing', async () => {
      mockReq.body = { givenName: 'Test' };

      await customerController.updateCustomerInfo(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Customer ID is required',
        timestamp: expect.any(String)
      });
    });

    it('should handle customer not found error', async () => {
      mockReq.query.customerId = 'nonexistent';
      mockReq.body = { givenName: 'Test' };
      const error = new Error('Customer not found');
      customerService.updateCustomerInfo.mockRejectedValue(error);

      await customerController.updateCustomerInfo(mockReq, mockRes);

      expect(sendNotFound).toHaveBeenCalledWith(mockRes, 'Customer', 'Customer not found');
    });

    it('should handle general errors', async () => {
      mockReq.query.customerId = 'cust123';
      mockReq.body = { givenName: 'Test' };
      const error = new Error('Database error');
      customerService.updateCustomerInfo.mockRejectedValue(error);

      await customerController.updateCustomerInfo(mockReq, mockRes);

      expect(sendError).toHaveBeenCalledWith(
        mockRes,
        'Failed to update customer information',
        500,
        'Database error'
      );
    });
  });

  describe('getCustomerBookings', () => {
    beforeEach(() => {
      mockReq.params.customerId = 'cust123';
      mockReq.query = { status: 'ACCEPTED', limit: '10' };
    });

    it('should get customer bookings successfully', async () => {
      const mockBookings = [{ id: 'booking1' }, { id: 'booking2' }];
      customerService.getCustomerBookings.mockResolvedValue(mockBookings);

      await customerController.getCustomerBookings(mockReq, mockRes);

      expect(customerService.getCustomerBookings).toHaveBeenCalledWith(mockTenant, 'cust123', {
        status: 'ACCEPTED',
        startDate: undefined,
        endDate: undefined,
        limit: 10
      });
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockBookings,
        'Customer bookings retrieved successfully'
      );
    });

    it('should handle errors in getting bookings', async () => {
      const error = new Error('Booking fetch failed');
      customerService.getCustomerBookings.mockRejectedValue(error);

      await customerController.getCustomerBookings(mockReq, mockRes);

      expect(sendError).toHaveBeenCalledWith(
        mockRes,
        'Failed to retrieve customer bookings',
        500,
        'Booking fetch failed'
      );
    });
  });

  describe('cancelBooking', () => {
    beforeEach(() => {
      mockReq.params = { customerId: 'cust123', bookingId: 'booking456' };
    });

    it('should cancel booking successfully', async () => {
      const mockResult = { success: true, bookingId: 'booking456' };
      customerService.cancelBooking.mockResolvedValue(mockResult);

      await customerController.cancelBooking(mockReq, mockRes);

      expect(customerService.cancelBooking).toHaveBeenCalledWith(mockTenant, 'cust123', 'booking456');
      expect(sendSuccess).toHaveBeenCalledWith(mockRes, mockResult, 'Booking cancelled successfully');
    });

    it('should handle booking not found', async () => {
      const error = new Error('Booking not found');
      customerService.cancelBooking.mockRejectedValue(error);

      await customerController.cancelBooking(mockReq, mockRes);

      expect(sendNotFound).toHaveBeenCalledWith(mockRes, 'Booking', 'Booking not found');
    });

    it('should handle general cancellation errors', async () => {
      const error = new Error('Cancellation failed');
      customerService.cancelBooking.mockRejectedValue(error);

      await customerController.cancelBooking(mockReq, mockRes);

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Failed to cancel booking', 500, 'Cancellation failed');
    });
  });

  describe('getCustomerInfo (Express handler)', () => {
    it('should get customer by phone from query', async () => {
      mockReq.query.phone = '+1234567890';
      const mockCustomer = { id: 'cust123', phoneNumber: '+1234567890' };
      customerService.getCustomerInfo = jest.fn().mockResolvedValue(mockCustomer);
      customerController.getCustomerByPhone = jest.fn().mockResolvedValue(mockCustomer);

      await customerController.getCustomerInfo(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: mockCustomer,
        timestamp: expect.any(String)
      });
    });

    it('should get customer by ID from body', async () => {
      mockReq.body.customer_id = 'cust123';
      const mockCustomer = { id: 'cust123' };
      customerService.getCustomerInfo.mockResolvedValue(mockCustomer);

      await customerController.getCustomerInfo(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: mockCustomer,
        timestamp: expect.any(String)
      });
    });

    it('should return 400 when both phone and customer_id are missing', async () => {
      await customerController.getCustomerInfo(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Either phone or customer_id is required',
        timestamp: expect.any(String)
      });
    });

    it('should return 404 when customer not found', async () => {
      mockReq.query.phone = '+1234567890';
      customerController.getCustomerByPhone = jest.fn().mockResolvedValue(null);

      await customerController.getCustomerInfo(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Customer not found',
        timestamp: expect.any(String)
      });
    });

    it('should handle errors', async () => {
      mockReq.query.phone = '+1234567890';
      const error = new Error('Service error');
      customerService.getCustomerInfo.mockRejectedValue(error);

      await customerController.getCustomerInfo(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error',
        error: 'Failed to get customer by phone',
        timestamp: expect.any(String)
      });
    });
  });
});
