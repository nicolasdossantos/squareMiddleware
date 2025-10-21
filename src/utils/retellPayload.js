/**
 * Retell Payload Utilities
 * Normalize Retell tool invocation bodies into flat payloads.
 */

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  const startsWithBrace = trimmed.startsWith('{') && trimmed.endsWith('}');
  const startsWithBracket = trimmed.startsWith('[') && trimmed.endsWith(']');

  if (!startsWithBrace && !startsWithBracket) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return value;
  }
}

function tryGetPath(source, path) {
  let current = source;

  for (const key of path) {
    if (!isPlainObject(current)) {
      return null;
    }

    current = parseMaybeJson(current[key]);

    if (!isPlainObject(current)) {
      return null;
    }
  }

  return current;
}

const RETELL_META_KEYS = new Set([
  'execution_message',
  'executionMessage',
  'toolCallId',
  'tool_call_id',
  'tool',
  'call',
  'call_id',
  'callId',
  'name',
  'metadata',
  'rawArguments',
  'args',
  'input'
]);

function stripRetellMeta(value) {
  if (Array.isArray(value)) {
    return value.map(stripRetellMeta);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.entries(value).reduce((accumulator, [key, entryValue]) => {
    if (RETELL_META_KEYS.has(key) || key.startsWith('retell_') || key.startsWith('tool_')) {
      return accumulator;
    }

    accumulator[key] = stripRetellMeta(entryValue);
    return accumulator;
  }, {});
}

function extractRetellPayload(body) {
  if (!isPlainObject(body)) {
    return { payload: null, metadata: {} };
  }

  const metadata = {};

  if (isPlainObject(body.call)) {
    metadata.call = body.call;
  }

  if (typeof body.name === 'string') {
    metadata.toolName = body.name;
  }

  const candidatePaths = [
    ['args', 'input'],
    ['args', 'arguments'],
    ['args', 'payload'],
    ['args', 'data'],
    ['args'],
    ['input'],
    ['payload'],
    ['parameters'],
    ['data']
  ];

  for (const path of candidatePaths) {
    const candidate = tryGetPath(body, path);
    if (candidate) {
      return { payload: candidate, metadata };
    }
  }

  // If args is a JSON string, attempt to parse it
  if (body.args) {
    const parsedArgs = parseMaybeJson(body.args);
    if (isPlainObject(parsedArgs)) {
      return { payload: parsedArgs, metadata };
    }
  }

  // Fallback: remove known metadata fields from a shallow clone
  const clone = { ...body };
  delete clone.call;
  delete clone.name;
  delete clone.tool;
  delete clone.toolCallId;
  delete clone.tool_call_id;
  delete clone.metadata;

  if (clone.args) {
    const parsedArgs = parseMaybeJson(clone.args);
    if (isPlainObject(parsedArgs)) {
      return { payload: parsedArgs, metadata };
    }
    delete clone.args;
  }

  return { payload: clone, metadata };
}

module.exports = {
  extractRetellPayload,
  isPlainObject,
  parseMaybeJson,
  stripRetellMeta
};
