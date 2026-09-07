// define custom error types for different error scenarios in our application.
// These errors can be thrown in controllers or services and caught by the error-handling middleware send responses to clients.
class NotFoundError extends Error {
  constructor(message = "Resource not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

class ValidationError extends Error {
  constructor(details) {
    super("Validation failed");
    this.name = "ValidationError";
    this.details = details;
  }
}

class BusinessRuleError extends Error {
  constructor(message) {
    super(message);
    this.name = "BusinessRuleError";
  }
}

module.exports = { NotFoundError, ValidationError, BusinessRuleError };
