// This middleware handles errors thrown in the application and sends appropriate HTTP responses to the client.
// It also provides a utility function to wrap async route handlers to catch errors and pass them to this error handler.

const PRISMA_UNIQUE_CONSTRAINT = "P2002";

const PRISMA_RECORD_NOT_FOUND = "P2025";

function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.details || [],
    });
  }

  if (err.name === "NotFoundError") {
    return res.status(404).json({
      success: false,
      message: err.message || "Resource not found",
    });
  }

  if (err.name === "BusinessRuleError") {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // Prisma-specific errors.
  if (err.code === PRISMA_UNIQUE_CONSTRAINT) {
    return res.status(400).json({
      success: false,
      message: "A daily record for this house and date already exists.",
    });
  }

  if (err.code === PRISMA_RECORD_NOT_FOUND) {
    return res.status(404).json({
      success: false,
      message: "Resource not found",
    });
  }

  // Fallback: unexpected server error.
  return res.status(500).json({
    success: false,
    message: "An unexpected error occurred. Please try again.",
  });
}

function catchAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, catchAsync };
