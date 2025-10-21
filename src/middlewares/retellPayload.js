/**
 * Retell Payload Normalization Middleware
 * Flattens Retell tool invocation payloads so controllers can consume them
 * as standard REST request bodies / query params.
 */

const { extractRetellPayload, isPlainObject, stripRetellMeta } = require('../utils/retellPayload');

function retellPayloadMiddleware(req, _res, next) {
  // Skip normalization for Retell webhook events so controllers receive the raw payload
  if (req.path && req.path.startsWith('/api/webhooks/retell')) {
    return next();
  }

  const callId = req.headers['x-retell-call-id'];

  const originalBody = req.body;

  if (!isPlainObject(originalBody)) {
    return next();
  }

  const looksLikeRetellPayload =
    callId ||
    Object.prototype.hasOwnProperty.call(originalBody, 'args') ||
    Object.prototype.hasOwnProperty.call(originalBody, 'call') ||
    Object.prototype.hasOwnProperty.call(originalBody, 'tool') ||
    Object.prototype.hasOwnProperty.call(originalBody, 'name');

  if (!looksLikeRetellPayload) {
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

  if (callId && !req.retellMetadata.call) {
    req.retellMetadata.call = { call_id: callId };
  }

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
