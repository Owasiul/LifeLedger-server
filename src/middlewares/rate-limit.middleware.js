import rateLimit from "express-rate-limit";
import logger from "../utils/logger.js";

const handleLimitReached = (req, res, options) => {
  logger.warn("Rate limit exceeded", {
    ip: req.ip,
    path: req.path,
    method: req.method,
  });
  res.status(429).json({
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests. Please try again later.",
    },
  });
};

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP",
  standardHeaders: false,
  skip: (req) => process.env.NODE_ENV === "testing",
  handler: handleLimitReached,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts",
  standardHeaders: false,
  skip: (req) => process.env.NODE_ENV === "testing",
  handler: handleLimitReached,
});

export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: "Too many payment attempts",
  standardHeaders: false,
  skip: (req) => process.env.NODE_ENV === "testing",
  handler: handleLimitReached,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many API requests",
  standardHeaders: false,
  skip: (req) => process.env.NODE_ENV === "testing",
  handler: handleLimitReached,
});
