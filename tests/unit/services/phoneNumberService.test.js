const phoneNumberService = require('../../../src/services/phoneNumberService');
const functionInvoker = require('../../../src/utils/functionInvoker');
const { query } = require('../../../src/services/database');

jest.mock('../../../src/utils/functionInvoker', () => ({
  invokePhoneNumberFunction: jest.fn(),
  isPhoneNumberFunctionConfigured: jest.fn().mockReturnValue(true)
}));

jest.mock('../../../src/services/database', () => ({
  query: jest.fn()
}));

describe('phoneNumberService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws if tenantId missing on purchase', async () => {
    await expect(phoneNumberService.purchasePhoneNumber({})).rejects.toThrow('tenantId is required');
  });

  it('invokes function on purchase', async () => {
    functionInvoker.invokePhoneNumberFunction.mockResolvedValueOnce({
      data: { success: true, phoneNumber: '+18885551234', retellPhoneNumberId: 'pn_123' }
    });

    const result = await phoneNumberService.purchasePhoneNumber({ tenantId: 'tenant-1' });

    expect(functionInvoker.invokePhoneNumberFunction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'purchase', tenantId: 'tenant-1' }),
      undefined,
      expect.any(Object)
    );
    expect(result.phoneNumber).toBe('+18885551234');
  });

  it('links assignment to agent', async () => {
    await phoneNumberService.linkAssignmentToAgent({
      tenantId: 'tenant-1',
      retellAgentId: 'agent-1',
      retellPhoneNumberId: 'pn_123'
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE phone_number_assignments'),
      expect.arrayContaining(['agent-1', 'tenant-1', 'pn_123'])
    );
  });
});
