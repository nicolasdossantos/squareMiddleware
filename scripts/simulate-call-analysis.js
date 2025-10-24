#!/usr/bin/env node

const path = require('path');
const agentConfigService = require('../src/services/agentConfigService');
const database = require('../src/services/database');
const retellWebhookService = require('../src/services/retellWebhookService');
const retellEmailService = require('../src/services/retellEmailService');

// Stub outbound services so we don't hit external APIs
database.withTransaction = async handler => {
  const queries = [];
  const fakeClient = {
    queries,
    async query(text, params = []) {
      queries.push({ text: text.trim().split('\n')[0], params });

      if (text.includes('FROM customer_profiles WHERE tenant_id = $1 AND square_customer_id = $2')) {
        return { rows: [] };
      }
      if (text.includes('FROM customer_profiles WHERE tenant_id = $1 AND phone_number = $2')) {
        return { rows: [] };
      }
      if (text.includes('INSERT INTO customer_profiles')) {
        return {
          rows: [
            {
              id: 'profile-1',
              tenant_id: params[0],
              square_customer_id: params[1],
              phone_number: params[2],
              email: params[3],
              first_name: params[4],
              last_name: params[5],
              preferred_language: params[6],
              language_confidence: params[7] || 0.5,
              total_calls: 0,
              total_bookings: 0,
              first_call_date: params[8],
              last_call_date: params[9]
            }
          ]
        };
      }
      if (text.includes('UPDATE customer_profiles')) {
        return {
          rows: [
            {
              id: params[0],
              preferred_language: params.includes('pt-BR') ? 'pt-BR' : 'en',
              language_confidence: 0.9,
              total_calls: 1,
              total_bookings: 1
            }
          ]
        };
      }
      if (text.includes('SELECT * FROM call_history WHERE retell_call_id')) {
        return { rows: [] };
      }
      if (text.includes('INSERT INTO call_history')) {
        return {
          rows: [
            {
              id: 'history-1',
              retell_call_id: params[0],
              call_start_time: params[3],
              call_end_time: params[4]
            }
          ]
        };
      }
      if (text.includes('SELECT id, issue_type')) {
        return { rows: [] };
      }
      if (text.includes('SELECT id, call_summary')) {
        return { rows: [] };
      }
      if (text.includes('SELECT context_key')) {
        return { rows: [] };
      }
      if (text.includes('INSERT INTO conversation_context')) {
        return { rows: [] };
      }
      if (text.includes('INSERT INTO open_issues')) {
        return { rows: [] };
      }
      if (text.includes('DELETE FROM open_issues')) {
        return { rows: [] };
      }
      if (text.trim() === 'BEGIN' || text.trim() === 'COMMIT' || text.trim() === 'ROLLBACK') {
        return { rows: [] };
      }

      console.warn('Unhandled query in simulation:', text);
      return { rows: [] };
    }
  };

  const result = await handler(fakeClient);
  console.log('\nSimulated queries executed:', JSON.stringify(fakeClient.queries, null, 2));
  return result;
};

retellWebhookService.processCallAnalysis = async () => ({ summary: 'processed' });
retellEmailService.sendRetellPostCallEmail = async () => ({ ok: true });

process.env.AGENT_CONFIGS = JSON.stringify([
  {
    agentId: 'agent_c6d197382e23c9603d183e0be8',
    bearerToken: 'test-bearer-token',
    squareAccessToken: 'sq0at-simulated-access-token-1234567890',
    squareLocationId: 'L71YZWPR1TD9B',
    squareApplicationId: 'sq0idp-Ha6sz9iU8JwRPwdGhzq9Mmw',
    staffEmail: 'owner@example.com',
    timezone: 'America/New_York',
    businessName: 'Elite Barbershop'
  }
]);

agentConfigService.reload();

const payload = {
  event: 'call_analyzed',
  call: {
    call_id: 'call-simulated',
    from_number: '+12677210098',
    start_timestamp: '1761337980194',
    end_timestamp: '1761338080194',
    duration_ms: 10000,
    call_summary: 'Customer booked a haircut.',
    transcript: 'Sample transcript',
    call_analysis: {
      call_successful: true,
      language_preference: 'English',
      booking_created: true,
      booking_id: 'booking-123',
      user_sentiment: 'positive'
    },
    retell_llm_dynamic_variables: {
      customer_first_name: 'Nick',
      customer_last_name: 'dos Santos',
      customer_email: 'nick@example.com',
      customer_id: '08FAQHFKW4GPWKG6H22SCPFGXM'
    },
    metadata: {
      timestamp: '1761337980194'
    }
  }
};

const eventHandlers = require('../src/controllers/retell/eventHandlers');

eventHandlers
  .handleCallAnalyzed(payload, {
    correlationId: 'simulated-correlation',
    tenant: {
      id: 'default',
      squareAccessToken: 'sq0at-simulated-access-token-1234567890',
      squareLocationId: 'L71YZWPR1TD9B',
      timezone: 'America/New_York',
      businessName: 'Elite Barbershop'
    }
  })
  .then(result => {
    console.log('\nSimulation result:', JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('\nSimulation error:', error);
  });
