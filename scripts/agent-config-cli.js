#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');

function printHelp() {
  console.log(
    'Usage: node scripts/agent-config-cli.js --file=./agents.json [--vault=my-vault] [--secret=AGENT_CONFIGS] [--key=<hex|base64>] [--no-upload]\n\nOptions:\n  --file           Path to agent configuration JSON file (required)\n  --vault          Azure Key Vault name or full https URL\n  --secret         Secret name to store the payload (default: AGENT_CONFIGS)\n  --key            Encryption key (32-byte hex or base64). Defaults to env AGENT_CONFIG_ENCRYPTION_KEY\n  --no-upload      Skip Key Vault upload and print encrypted payload\n  --dry-run        Validate and encrypt, but do not upload (implies --no-upload)\n  --help           Show this message\n'
  );
}

function parseArgs(argv) {
  const options = {
    secret: 'AGENT_CONFIGS'
  };

  argv.forEach(arg => {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return;
    }
    if (arg === '--no-upload') {
      options.noUpload = true;
      return;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      options.noUpload = true;
      return;
    }

    const match = arg.match(/^--([^=]+)=(.+)$/);
    if (match) {
      const [, key, value] = match;
      options[key] = value;
      return;
    }

    // Support space separated flags (e.g., --file ./agents.json)
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      options.pendingKey = key;
      return;
    }

    if (options.pendingKey) {
      options[options.pendingKey] = arg;
      delete options.pendingKey;
      return;
    }
  });

  if (options.pendingKey) {
    throw new Error(`Missing value for flag --${options.pendingKey}`);
  }

  return options;
}

function loadConfigFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('Agent config file must contain a JSON array of agent definitions');
  }

  const requiredFields = [
    'agentId',
    'bearerToken',
    'squareAccessToken',
    'squareLocationId',
    'squareApplicationId',
    'timezone'
  ];

  const invalidEntries = parsed
    .map((agent, index) => {
      const missing = requiredFields.filter(field => !agent[field]);
      return missing.length > 0 ? { index, agentId: agent.agentId || 'unknown', missing } : null;
    })
    .filter(Boolean);

  if (invalidEntries.length > 0) {
    const details = invalidEntries
      .map(entry => `  - index ${entry.index}: agentId=${entry.agentId} missing ${entry.missing.join(', ')}`)
      .join('\n');
    throw new Error(`Invalid agent configuration entries:\n${details}`);
  }

  return {
    absolutePath,
    agents: parsed
  };
}

function resolveKey(rawKey) {
  if (!rawKey) {
    throw new Error(
      'Encryption key is required. Pass --key=<value> or set AGENT_CONFIG_ENCRYPTION_KEY environment variable.'
    );
  }

  let buffer;
  const trimmed = rawKey.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    buffer = Buffer.from(trimmed, 'hex');
  } else {
    buffer = Buffer.from(trimmed, 'base64');
  }

  if (buffer.length !== 32) {
    throw new Error('Encryption key must resolve to 32 bytes for AES-256-GCM');
  }

  return buffer;
}

function encryptPayload(plaintext, keyBuffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    algorithm: 'AES-256-GCM',
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: authTag.toString('base64'),
    createdAt: new Date().toISOString()
  };
}

async function uploadToKeyVault(vault, secretName, payload) {
  const vaultUrl = vault.startsWith('https://') ? vault : `https://${vault}.vault.azure.net`;
  const credential = new DefaultAzureCredential();
  const client = new SecretClient(vaultUrl, credential);
  await client.setSecret(secretName, JSON.stringify(payload));
}

(async () => {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
      printHelp();
      process.exit(0);
    }

    if (!options.file) {
      throw new Error('Missing required --file argument');
    }

    const { absolutePath, agents } = loadConfigFile(options.file);
    const plaintext = JSON.stringify(agents);

    const encryptionKey = resolveKey(options.key || process.env.AGENT_CONFIG_ENCRYPTION_KEY || '');
    const encryptedPayload = encryptPayload(plaintext, encryptionKey);

    console.log('✅ Agent configuration file validated:', absolutePath);
    console.log(`🔐 Encrypted payload generated at ${encryptedPayload.createdAt}`);

    if (options.noUpload) {
      console.log('\nEncrypted payload (store this string in AGENT_CONFIGS or upload manually):');
      console.log(JSON.stringify(encryptedPayload, null, 2));
      process.exit(0);
    }

    if (!options.vault) {
      throw new Error('Missing --vault argument. Provide the Key Vault name or URL, or use --no-upload.');
    }

    const secretName = options.secret || 'AGENT_CONFIGS';

    if (options.dryRun) {
      console.log('\n[DRY RUN] Skipping Key Vault upload. Payload ready for secret:', secretName);
      console.log(JSON.stringify(encryptedPayload, null, 2));
      process.exit(0);
    }

    await uploadToKeyVault(options.vault, secretName, encryptedPayload);
    console.log(`🚀 Uploaded encrypted payload to ${options.vault} (secret: ${secretName})`);
  } catch (error) {
    console.error('❌ agent-config-cli failed:', error.message);
    process.exit(1);
  }
})();
