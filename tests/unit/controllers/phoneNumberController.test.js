const phoneNumberController = require('../../../src/controllers/phoneNumberController');
const phoneNumberService = require('../../../src/services/phoneNumberService');

jest.mock('../../../src/services/phoneNumberService');

describe('phoneNumberController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createRes() {
    const json = jest.fn();
    return {
      status: jest.fn().mockReturnValue({ json }),
      json
    };
  }

  it('requires auth to purchase', async () => {
    const res = createRes();
    await phoneNumberController.purchase({ user: null }, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns success on purchase', async () => {
    const res = createRes();
    phoneNumberService.purchasePhoneNumber.mockResolvedValue({ phoneNumber: '+18885551234' });

    await phoneNumberController.purchase({ user: { tenantId: 'tenant-1' }, body: {} }, res);

    expect(res.json).toHaveBeenCalledWith({ success: true, phoneNumber: '+18885551234' });
  });
});
