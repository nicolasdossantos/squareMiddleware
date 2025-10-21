class FunctionError extends Error {
  constructor(message, { functionName, status, code, response, originalError, correlationId } = {}) {
    super(message || 'Function invocation failed');
    this.name = 'FunctionError';
    this.functionName = functionName;
    this.status = status || null;
    this.code = code || 'FUNCTION_INVOCATION_FAILED';
    this.response = response;
    this.originalError = originalError;
    this.correlationId = correlationId;
    this.isFunctionError = true;
    this.isFunctionInvocationError = true;
  }
}

module.exports = {
  FunctionError
};
