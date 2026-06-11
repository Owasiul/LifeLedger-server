import logger from "../utils/logger.js";
import { responseHandler } from "../utils/response-handler.js";
import { AppError } from "../utils/errors.js";

export const errorMiddleware = (err, req, res, next) => {
  if (err.isOperational) {
    logger.warn("Operational error", {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
    });

    return responseHandler.sendError(res, err, err.statusCode);
  }

  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const genericError = new AppError(
    "Internal server error",
    500,
    "INTERNAL_ERROR",
  );
  responseHandler.sendError(res, genericError, 500);
};

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
