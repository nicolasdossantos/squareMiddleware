/**
 * Correlation ID Middleware Unit Tests
 */

const correlationIdMiddleware = require('../../../src/middlewares/correlationId');

describe('Correlation ID Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      headers: {}
    };
    mockRes = {
      setHeader: jest.fn()
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should use existing correlation ID from x-correlation-id header', () => {
    mockReq.headers['x-correlation-id'] = 'existing-correlation-id';

    correlationIdMiddleware(mockReq, mockRes, mockNext);

    expect(mockReq.correlationId).toBe('existing-correlation-id');
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('should generate new ID when only x-request-id header is present', () => {
    mockReq.headers['x-request-id'] = 'request-id-123';

    correlationIdMiddleware(mockReq, mockRes, mockNext);

    expect(mockReq.correlationId).toBeDefined();
    expect(mockReq.correlationId).not.toBe('request-id-123');
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('should use x-correlation-id and ignore x-request-id', () => {
    mockReq.headers['x-correlation-id'] = 'correlation-id-123';
    mockReq.headers['x-request-id'] = 'request-id-456';

    correlationIdMiddleware(mockReq, mockRes, mockNext);

    expect(mockReq.correlationId).toBe('correlation-id-123');
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('should generate new correlation ID when none provided', () => {
    correlationIdMiddleware(mockReq, mockRes, mockNext);

    expect(mockReq.correlationId).toBeDefined();
    expect(typeof mockReq.correlationId).toBe('string');
    expect(mockReq.correlationId.length).toBeGreaterThan(0);
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('should generate different correlation IDs for different requests', () => {
    const mockReq1 = { headers: {} };
    const mockReq2 = { headers: {} };

    correlationIdMiddleware(mockReq1, mockRes, mockNext);
    correlationIdMiddleware(mockReq2, mockRes, mockNext);

    expect(mockReq1.correlationId).toBeDefined();
    expect(mockReq2.correlationId).toBeDefined();
    expect(mockReq1.correlationId).not.toBe(mockReq2.correlationId);
  });

  it('should generate new ID for uppercase header (headers are case-sensitive in code)', () => {
    mockReq.headers['X-Correlation-ID'] = 'case-insensitive-id';

    correlationIdMiddleware(mockReq, mockRes, mockNext);

    expect(mockReq.correlationId).toBeDefined();
    expect(mockReq.correlationId).not.toBe('case-insensitive-id');
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('should handle empty correlation ID header by generating new one', () => {
    mockReq.headers['x-correlation-id'] = '';

    correlationIdMiddleware(mockReq, mockRes, mockNext);

    expect(mockReq.correlationId).toBeDefined();
    expect(mockReq.correlationId).not.toBe('');
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('should handle null correlation ID header by generating new one', () => {
    mockReq.headers['x-correlation-id'] = null;

    correlationIdMiddleware(mockReq, mockRes, mockNext);

    expect(mockReq.correlationId).toBeDefined();
    expect(mockReq.correlationId).not.toBeNull();
    expect(mockNext).toHaveBeenCalledWith();
  });
});
