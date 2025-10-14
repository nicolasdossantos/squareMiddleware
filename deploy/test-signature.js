#!/usr/bin/env node

/**
 * Test Signature Generator
 *
 * Generates a valid Retell webhook signature for testing your API endpoints.
 * This mimics what Retell does when sending webhooks.
 */

const crypto = require('crypto');

// Configuration
const RETELL_API_KEY = process.env.RETELL_API_KEY || 'your-retell-api-key-from-keyvault';
const timestamp = Math.floor(Date.now() / 1000);

// Sample webhook payload
const payload = {
  agentId: 'agent123',
  callId: 'call-test-' + Date.now(),
  eventType: 'call_started'
};

const payloadString = JSON.stringify(payload);

// Generate signature (same as Retell does)
const signature = crypto
  .createHmac('sha256', RETELL_API_KEY)
  .update(`${timestamp}.${payloadString}`)
  .digest('hex');

console.log('========================================');
console.log('  Retell Signature Test Generator');
console.log('========================================');
console.log('');
console.log('Use these values to test your API:');
console.log('');
console.log('Headers:');
console.log(`  x-retell-signature: ${signature}`);
console.log(`  x-retell-timestamp: ${timestamp}`);
console.log('  Authorization: Bearer <your-agent-bearer-token>');
console.log('  x-agent-id: agent123');
console.log('  Content-Type: application/json');
console.log('');
console.log('Body:');
console.log(`  ${payloadString}`);
console.log('');
console.log('Full curl command:');
console.log('');
console.log('curl -X POST https://square-middleware-prod-api.azurewebsites.net/api/webhooks/retell/call-started \\');
console.log('  -H "Content-Type: application/json" \\');
console.log(`  -H "x-retell-signature: ${signature}" \\`);
console.log(`  -H "x-retell-timestamp: ${timestamp}" \\`);
console.log('  -H "Authorization: Bearer <YOUR_AGENT_BEARER_TOKEN>" \\');
console.log('  -H "x-agent-id: agent123" \\');
console.log(`  -d '${payloadString}'`);
console.log('');
console.log('⚠️  Replace <YOUR_AGENT_BEARER_TOKEN> with actual token from deploy/agent-tokens.txt');
console.log('');
console.log('For local testing (localhost:3000):');
console.log('');
console.log('curl -X POST http://localhost:3000/api/webhooks/retell/call-started \\');
console.log('  -H "Content-Type: application/json" \\');
console.log(`  -H "x-retell-signature: ${signature}" \\`);
console.log(`  -H "x-retell-timestamp: ${timestamp}" \\`);
console.log('  -H "Authorization: Bearer <YOUR_AGENT_BEARER_TOKEN>" \\');
console.log('  -H "x-agent-id: agent123" \\');
console.log(`  -d '${payloadString}'`);
console.log('');
