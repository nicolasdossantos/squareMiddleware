/**
 * Retell Payload Normalization Middleware
 * Flattens Retell tool invocation payloads so controllers can consume them
 * as standard REST request bodies / query params.
 */

const { extractRetellPayload, isPlainObject, stripRetellMeta } = require('../utils/retellPayload');

function retellPayloadMiddleware(req, _res, next) {
  // Retell tool calls always include x-retell-call-id
  const callId = req.headers['x-retell-call-id'];

  if (!callId) {
    return next();
  }

  const originalBody = req.body;

  if (!isPlainObject(originalBody)) {
    return next();
  }

  req.retellOriginalBody = originalBody;

  const { payload, metadata } = extractRetellPayload(originalBody);

  const sanitizedPayload = stripRetellMeta(payload);

  if (!isPlainObject(sanitizedPayload) || Object.keys(sanitizedPayload).length === 0) {
    req.retellPayload = null;
    req.retellMetadata = metadata;
    return next();
  }

  req.retellPayload = sanitizedPayload;
  req.retellMetadata = metadata;

  // Expose payload on body for non-GET methods so controllers operate on normalized data
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.body = sanitizedPayload;
  } else {
    // For GET/HEAD requests, merge payload into query parameters, preserving explicit query string values
    req.query = { ...sanitizedPayload, ...req.query };
    req.body = sanitizedPayload;
  }

  return next();
}

module.exports = retellPayloadMiddleware;
