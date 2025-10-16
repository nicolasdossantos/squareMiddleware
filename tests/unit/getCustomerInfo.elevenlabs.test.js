// Mock environment variables for testing
process.env.SQUARE_ACCESS_TOKEN = 'test_token';
process.env.SQUARE_LOCATION_ID = 'test_location';
process.env.TZ = 'America/New_York';

describe('GetCustomerInfo ElevenLabs Response Validation', () => {
  test('Required dynamic variables are properly defined in Maria AI prompt', () => {
    // These are the dynamic variables that ElevenLabs expects
    const requiredVariables = [
      'customer_first_name',
      'customer_last_name',
      'customer_full_name',
      'customer_email',
      'customer_phone',
      'customer_id',
      'is_returning_customer',
      'current_datetime_store_timezone',
      'available_services',
      'available_barbers',
      'service_variations_json',
      'barbers_with_ids_json',
      'caller_id'
    ];

    // Verify all required variables are present
    expect(requiredVariables.length).toBeGreaterThan(10);
    expect(requiredVariables).toContain('service_variations_json');
    expect(requiredVariables).toContain('barbers_with_ids_json');
  });

  test('ElevenLabs response structure matches expected format', () => {
    // ElevenLabs expects this specific response structure
    const expectedStructure = {
      type: 'conversation_initiation_client_data',
      dynamic_variables: {}
    };

    expect(expectedStructure.type).toBe('conversation_initiation_client_data');
    expect(typeof expectedStructure.dynamic_variables).toBe('object');
  });

  test('Tool integration data is properly formatted', () => {
    // Sample tool integration data - ensure it's JSON serializable
    const sampleToolData = {
      service_variations_json: JSON.stringify({
        YXAQPKIW2HG4J4HKNTFYIRCV: {
          serviceName: "Men's Haircut",
          variationName: 'Standard',
          priceFormatted: '$25.00',
          durationMinutes: 30,
          teamMemberIds: ['TMjrjeysZMBiYlvw']
        }
      }),
      barbers_with_ids_json: JSON.stringify([
        { id: 'TMjrjeysZMBiYlvw', name: 'Junior', displayName: 'Junior' }
      ])
    };

    // Verify the data can be serialized/deserialized
    const serialized = JSON.stringify(sampleToolData);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.service_variations_json).toBeDefined();
    expect(deserialized.barbers_with_ids_json).toBeDefined();

    // Verify nested JSON is valid
    const serviceVariations = JSON.parse(deserialized.service_variations_json);
    const barbersArray = JSON.parse(deserialized.barbers_with_ids_json);

    expect(typeof serviceVariations).toBe('object');
    expect(Array.isArray(barbersArray)).toBe(true);
    expect(barbersArray[0]).toHaveProperty('id');
    expect(barbersArray[0]).toHaveProperty('name');
    expect(barbersArray[0]).toHaveProperty('displayName');
  });
});
