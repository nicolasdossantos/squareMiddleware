#!/usr/bin/env node
/**
 * Smoke tests for deployment validation
 * These tests verify critical functionality after deployment
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;

class SmokeTestRunner {
  constructor() {
    this.results = [];
    this.failed = false;
  }

  async runTest(name, testFn) {
    console.log(`🧪 Running: ${name}`);
    const startTime = performance.now();

    try {
      await testFn();
      const duration = Math.round(performance.now() - startTime);
      console.log(`✅ ${name} - ${duration}ms`);
      this.results.push({ name, status: 'PASS', duration });
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      console.log(`❌ ${name} - ${error.message} - ${duration}ms`);
      this.results.push({ name, status: 'FAIL', duration, error: error.message });
      this.failed = true;
    }
  }

  async testHealthEndpoint() {
    const response = await this.makeRequest('GET', '/api/health');

    if (response.status !== 200) {
      throw new Error(`Health check failed with status ${response.status}`);
    }

    if (!response.data || !response.data.status) {
      throw new Error('Health response missing status field');
    }

    if (response.data.status !== 'healthy') {
      throw new Error(`API not healthy: ${response.data.status}`);
    }
  }

  async testServiceAvailability() {
    const response = await this.makeRequest('GET', '/api/service-availability', {
      params: {
        serviceId: 'haircut',
        date: '2024-12-31'
      }
    });

    // Should return 200 with data or 400 for invalid request
    if (![200, 400].includes(response.status)) {
      throw new Error(`Unexpected status code: ${response.status}`);
    }
  }

  async testCustomerEndpoint() {
    // Test with a non-existent customer (should return 404)
    const response = await this.makeRequest('GET', '/api/customer/smoke-test-customer');

    if (![200, 404].includes(response.status)) {
      throw new Error(`Unexpected status code: ${response.status}`);
    }
  }

  async testWebhookEndpoint() {
    const testPayload = {
      event_type: 'call_ended',
      call_id: 'smoke-test-call',
      customer_data: {}
    };

    const response = await this.makeRequest('POST', '/api/webhook/elevenlabs', {
      data: testPayload
    });

    // Should return 200, 400 (invalid signature), or 401 (unauthorized)
    if (![200, 400, 401].includes(response.status)) {
      throw new Error(`Unexpected status code: ${response.status}`);
    }
  }

  async testResponseTimes() {
    const startTime = performance.now();
    await this.makeRequest('GET', '/api/health');
    const responseTime = performance.now() - startTime;

    if (responseTime > 2000) {
      throw new Error(`Response time too slow: ${Math.round(responseTime)}ms`);
    }
  }

  async makeRequest(method, path, config = {}) {
    const url = `${API_BASE_URL}${path}`;
    const requestConfig = {
      method,
      url,
      timeout: TIMEOUT,
      validateStatus: () => true, // Don't throw on HTTP errors
      ...config
    };

    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await axios(requestConfig);
        return response;
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES) {
          console.log(`🔄 Retry ${attempt}/${MAX_RETRIES} for ${method} ${path}`);
          await this.sleep(1000 * attempt); // Exponential backoff
        }
      }
    }

    throw new Error(`Request failed after ${MAX_RETRIES} attempts: ${lastError.message}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async run() {
    console.log(`🚀 Starting smoke tests against: ${API_BASE_URL}`);
    console.log('='.repeat(60));

    await this.runTest('Health Endpoint', () => this.testHealthEndpoint());
    await this.runTest('Service Availability', () => this.testServiceAvailability());
    await this.runTest('Customer Endpoint', () => this.testCustomerEndpoint());
    await this.runTest('Webhook Endpoint', () => this.testWebhookEndpoint());
    await this.runTest('Response Times', () => this.testResponseTimes());

    this.printSummary();

    if (this.failed) {
      process.exit(1);
    }
  }

  printSummary() {
    console.log('='.repeat(60));
    console.log('📊 Test Summary:');

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const avgDuration = Math.round(
      this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length
    );

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Average Duration: ${avgDuration}ms`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  - ${r.name}: ${r.error}`));
    }

    console.log(`\n🎯 Overall: ${this.failed ? 'FAILED' : 'PASSED'}`);
  }
}

// Run smoke tests if called directly
if (require.main === module) {
  const runner = new SmokeTestRunner();
  runner.run().catch(error => {
    console.error('💥 Smoke tests crashed:', error.message);
    process.exit(1);
  });
}

module.exports = SmokeTestRunner;
