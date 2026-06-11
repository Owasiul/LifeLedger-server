import helmet from "helmet";
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again after 15 minutes",
});

function sanitizeXss(val) {
  if (typeof val === "string") {
    return val
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;");
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeXss);
  }
  if (typeof val === "object" && val !== null) {
    const sanitized = {};
    for (const key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        sanitized[key] = sanitizeXss(val[key]);
      }
    }
    return sanitized;
  }
  return val;
}

const xssSanitizerMiddleware = (req, res, next) => {
  if (req.body) req.body = sanitizeXss(req.body);
  if (req.query) req.query = sanitizeXss(req.query);
  if (req.params) req.params = sanitizeXss(req.params);
  next();
};

function sanitizeNoSQL(val) {
  if (Array.isArray(val)) {
    return val.map(sanitizeNoSQL);
  }
  if (typeof val === "object" && val !== null) {
    const sanitized = {};
    for (const key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        let sanitizedKey = key;
        if (key.startsWith("$") || key.includes(".")) {
          sanitizedKey = key.replace(/^\$/, "_").replace(/\./g, "_");
        }
        sanitized[sanitizedKey] = sanitizeNoSQL(val[key]);
      }
    }
    return sanitized;
  }
  return val;
}

const mongoSanitizeMiddleware = (req, res, next) => {
  if (req.body) req.body = sanitizeNoSQL(req.body);
  if (req.query) req.query = sanitizeNoSQL(req.query);
  if (req.params) req.params = sanitizeNoSQL(req.params);
  next();
};

export const securityMiddleware = [
  limiter,
  xssSanitizerMiddleware,
  mongoSanitizeMiddleware,
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    frameguard: { action: "deny" },
    xssFilter: false, // removed in Helmet v7+, don't pass true
  }),
];
