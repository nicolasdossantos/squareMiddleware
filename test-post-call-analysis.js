#!/usr/bin/env node
/**
 * Test script for Retell post-call analysis webhook
 * Tests the call_analyzed event and email sending
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Retell } = require('retell-sdk');
require('dotenv').config({ path: '.env.local' });

// Get Retell API key from environment
const RETELL_API_KEY = process.env.RETELL_API_KEY;

if (!RETELL_API_KEY) {
  console.error('❌ ERROR: RETELL_API_KEY not found in .env.local');
  console.error('Please add RETELL_API_KEY to your .env.local file');
  process.exit(1);
}

const DEFAULT_WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhooks/retell';

/**
 * Generate Retell signature for webhook
 */
function generateRetellSignature(payloadString) {
  return Retell.sign(payloadString, RETELL_API_KEY);
}

// Sample call_analyzed webhook payload from Retell AI
const sampleCallAnalyzed = {
  event: 'call_analyzed',
  call: {
    call_id: 'test_call_' + Date.now(),
    agent_id: '895480dde586e4c3712bd4c770',
    call_type: 'phone_call',
    call_status: 'ended',
    direction: 'inbound',
    from_number: '+12677210098',
    to_number: '+15555555555',
    start_timestamp: Date.now() - 180000, // 3 minutes ago
    end_timestamp: Date.now(),
    transcript: `
Agent: Thank you for calling Elite Barber Boutique, am I speaking to Nick?
Customer: Yes, this is Nick.
Agent: Great! How can I help you today?
Customer: I'd like to schedule a haircut for tomorrow around 2 PM if possible.
Agent: Let me check our availability for tomorrow at 2 PM. What's your preferred barber?
Customer: I usually go with Tony.
Agent: Perfect! I have Tony available tomorrow at 2:15 PM. Does that work for you?
Customer: Yes, that's perfect!
Agent: Great! I've booked you for tomorrow at 2:15 PM with Tony for a haircut. You'll receive a confirmation text shortly.
Customer: Awesome, thank you so much!
Agent: You're welcome! See you tomorrow!
    `.trim(),
    transcript_with_tool_calls: [
      {
        role: 'agent',
        content: 'Thank you for calling Elite Barber Boutique, am I speaking to Nick?'
      },
      {
        role: 'user',
        content: 'Yes, this is Nick.'
      },
      {
        role: 'agent',
        content: 'Great! How can I help you today?'
      },
      {
        role: 'user',
        content: "I'd like to schedule a haircut for tomorrow around 2 PM if possible."
      },
      {
        role: 'agent',
        content: "Let me check our availability for tomorrow at 2 PM. What's your preferred barber?"
      },
      {
        role: 'user',
        content: 'I usually go with Tony.'
      },
      {
        role: 'tool_call',
        tool_name: 'check_availability',
        arguments: {
          date: '2025-10-18',
          time: '14:00',
          barber: 'Tony'
        }
      },
      {
        role: 'agent',
        content: 'Perfect! I have Tony available tomorrow at 2:15 PM. Does that work for you?'
      },
      {
        role: 'user',
        content: "Yes, that's perfect!"
      },
      {
        role: 'tool_call',
        tool_name: 'create_booking',
        arguments: {
          customer_phone: '+12677210098',
          date: '2025-10-18',
          time: '14:15',
          barber: 'Tony',
          service: 'Haircut'
        }
      },
      {
        role: 'agent',
        content:
          "Great! I've booked you for tomorrow at 2:15 PM with Tony for a haircut. You'll receive a confirmation text shortly."
      },
      {
        role: 'user',
        content: 'Awesome, thank you so much!'
      },
      {
        role: 'agent',
        content: "You're welcome! See you tomorrow!"
      }
    ],
    call_analysis: {
      call_successful: true,
      call_summary:
        'Customer Nick called to schedule a haircut appointment. Successfully booked for tomorrow at 2:15 PM with barber Tony.',
      in_voicemail: false,
      user_sentiment: 'Positive',
      call_completion_rating: 5,
      extracted_info: {
        name: 'Nick',
        phone: '+12677210098',
        service: 'Haircut',
        date: '2025-10-18',
        time: '14:15',
        barber: 'Tony'
      },
      intent: 'booking',
      needs_follow_up: false
    },
    call_cost: {
      combined_cost: 245, // $2.45 in cents
      product_costs: [
        { product: 'llm_gpt_4o', cost: 180 },
        { product: 'tts_elevenlabs', cost: 65 }
      ]
    },
    latency: {
      e2e: {
        p50: 850,
        p90: 1200,
        p95: 1500,
        p99: 2000,
        max: 2500,
        min: 600,
        num: 12
      },
      llm: {
        p50: 650,
        p90: 900,
        p95: 1100,
        p99: 1500,
        max: 1800,
        min: 400,
        num: 12
      }
    },
    retell_llm_dynamic_variables: {
      customer_first_name: 'Nick',
      customer_full_name: 'Nick Dos Santos',
      customer_phone: '+12677210098',
      customer_email: 'nick@example.com',
      business_name: 'Elite Barber Boutique',
      is_returning_customer: 'true'
    },
    collected_dynamic_variables: {
      booking_confirmed: 'true',
      booking_date: '2025-10-18',
      booking_time: '14:15',
      barber_name: 'Tony'
    }
  }
};

// Sample spam call scenario
const sampleSpamCall = {
  event: 'call_analyzed',
  call: {
    call_id: 'spam_call_' + Date.now(),
    agent_id: '895480dde586e4c3712bd4c770',
    call_type: 'phone_call',
    call_status: 'ended',
    direction: 'inbound',
    from_number: '+15551234567',
    to_number: '+15555555555',
    start_timestamp: Date.now() - 30000, // 30 seconds ago
    end_timestamp: Date.now(),
    transcript: `
Agent: Thank you for calling Elite Barber Boutique, who am I speaking with today?
Customer: Yeah, is this the car warranty department?
Agent: No, this is Elite Barber Boutique, a barbershop. Can I help you with a haircut or grooming service?
Customer: Oh sorry, wrong number. *click*
    `.trim(),
    transcript_with_tool_calls: [
      {
        role: 'agent',
        content: 'Thank you for calling Elite Barber Boutique, who am I speaking with today?'
      },
      {
        role: 'user',
        content: 'Yeah, is this the car warranty department?'
      },
      {
        role: 'agent',
        content:
          'No, this is Elite Barber Boutique, a barbershop. Can I help you with a haircut or grooming service?'
      },
      {
        role: 'user',
        content: 'Oh sorry, wrong number.'
      }
    ],
    call_analysis: {
      call_successful: false,
      call_summary: 'Caller was looking for car warranty department. Wrong number. Call ended quickly.',
      in_voicemail: false,
      user_sentiment: 'Neutral',
      call_completion_rating: 1
    },
    call_cost: {
      combined_cost: 45, // $0.45 in cents
      product_costs: [
        { product: 'llm_gpt_4o', cost: 30 },
        { product: 'tts_elevenlabs', cost: 15 }
      ]
    },
    latency: {
      e2e: { p50: 800, num: 3 },
      llm: { p50: 600, num: 3 }
    },
    retell_llm_dynamic_variables: {
      business_name: 'Elite Barber Boutique'
    },
    collected_dynamic_variables: {
      current_agent_state: 'identify_spam_call'
    }
  }
};

function printUsageAndExit(exitCode) {
  console.log('Usage: node test-post-call-analysis.js [scenario] [--payload <path>] [--url <webhookUrl>]');
  console.log('  scenario: success | spam (default: success). Ignored when --payload is provided.');
  console.log('  --payload, -p: Path to a JSON payload to replay (e.g. tests/fixtures/retell-call-analyzed.json).');
  console.log(`  --url, -u: Target webhook URL (default: ${DEFAULT_WEBHOOK_URL}).`);
  process.exit(exitCode);
}

function parseArgs(args) {
  let scenario = 'success';
  let payloadPath;
  let url = DEFAULT_WEBHOOK_URL;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printUsageAndExit(0);
    } else if (arg === '--payload' || arg === '-p') {
      payloadPath = args[i + 1];
      i += 1;
      if (!payloadPath) {
        console.error('❌ Missing value for --payload option');
        printUsageAndExit(1);
      }
    } else if (arg.startsWith('--payload=')) {
      payloadPath = arg.slice('--payload='.length);
      if (!payloadPath) {
        console.error('❌ Missing value for --payload option');
        printUsageAndExit(1);
      }
    } else if (arg === '--url' || arg === '-u') {
      url = args[i + 1];
      i += 1;
      if (!url) {
        console.error('❌ Missing value for --url option');
        printUsageAndExit(1);
      }
    } else if (arg.startsWith('--url=')) {
      url = arg.slice('--url='.length);
      if (!url) {
        console.error('❌ Missing value for --url option');
        printUsageAndExit(1);
      }
    } else if (arg.startsWith('-')) {
      console.error(`❌ Unknown option: ${arg}`);
      printUsageAndExit(1);
    } else {
      scenario = arg;
    }
  }

  return { scenario, payloadPath, url };
}

function resolvePayload({ scenario, payloadPath }) {
  if (payloadPath) {
    const absolutePath = path.resolve(payloadPath);
    let payloadString;

    try {
      payloadString = fs.readFileSync(absolutePath, 'utf8');
    } catch (error) {
      console.error(`❌ Unable to read payload file: ${absolutePath}`);
      console.error(error.message);
      process.exit(1);
    }

    let payloadObject;
    try {
      payloadObject = JSON.parse(payloadString);
    } catch (error) {
      console.error(`❌ Payload file is not valid JSON: ${absolutePath}`);
      console.error(error.message);
      process.exit(1);
    }

    return {
      payloadObject,
      payloadString,
      scenarioLabel: 'custom',
      payloadSource: absolutePath
    };
  }

  if (!['success', 'spam'].includes(scenario)) {
    console.error(`❌ Unknown scenario "${scenario}".`);
    printUsageAndExit(1);
  }

  const payloadObject = scenario === 'spam' ? sampleSpamCall : sampleCallAnalyzed;
  const payloadString = JSON.stringify(payloadObject);

  return {
    payloadObject,
    payloadString,
    scenarioLabel: scenario,
    payloadSource: 'inline sample'
  };
}

function describeCall(payload) {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const call = payload.call || {};
  return {
    event: payload.event,
    callId: call.call_id,
    from: call.from_number,
    to: call.to_number,
    agent: call.agent_id
  };
}

async function testPostCallWebhook({
  scenarioLabel,
  payloadObject,
  payloadString,
  payloadSource,
  url
}) {
  const { event, callId, from, to } = describeCall(payloadObject);
  const sizeKb = (Buffer.byteLength(payloadString, 'utf8') / 1024).toFixed(1);

  console.log('\n🧪 Testing Retell Post-Call Analysis Webhook');
  console.log('='.repeat(60));
  console.log(`📋 Scenario: ${scenarioLabel}`);
  if (payloadSource) {
    console.log(`� Payload source: ${payloadSource}`);
  }
  if (event) console.log(`🎯 Event: ${event}`);
  if (callId) console.log(`📞 Call ID: ${callId}`);
  if (from) console.log(`📱 From: ${from}`);
  if (to) console.log(`� To: ${to}`);
  console.log(`📦 Payload size: ${sizeKb} KB`);
  console.log('='.repeat(60));

  const signature = generateRetellSignature(payloadString);
  console.log(`🔐 Generated signature: ${signature.substring(0, 50)}...`);

  console.log(`\n📤 Sending webhook to: ${url}`);

  try {
    const response = await axios.post(url, payloadString, {
      headers: {
        'Content-Type': 'application/json',
        'x-retell-signature': signature
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      transformRequest: data => data
    });

    console.log('\n✅ Response Status:', response.status);
    console.log('📦 Response Data:', JSON.stringify(response.data, null, 2));
    console.log('\n✅ TEST PASSED');
    console.log('📧 Check your email inbox for the post-call analysis report!');
  } catch (error) {
    console.error('\n❌ TEST FAILED');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

const parsedArgs = parseArgs(process.argv.slice(2));
const { payloadObject, payloadString, scenarioLabel, payloadSource } = resolvePayload({
  scenario: parsedArgs.scenario,
  payloadPath: parsedArgs.payloadPath
});

testPostCallWebhook({
  scenarioLabel,
  payloadObject,
  payloadString,
  payloadSource,
  url: parsedArgs.url
}).catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
