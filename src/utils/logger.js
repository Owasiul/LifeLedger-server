import winston from "winston";
import { isDevelopment, isProduction } from "../config/env.js";

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...args } = info;

    const ts = timestamp.slice(0, 19).replace("T", " ");

    if (isProduction()) {
      return JSON.stringify({
        timestamp: ts,
        level,
        message,
        ...(Object.keys(args).length > 0 && { metadata: args }),
      });
    }

    return `${ts} [${level.toUpperCase()}]: ${message} ${
      Object.keys(args).length > 0 ? JSON.stringify(args, null, 2) : ""
    }`;
  }),
);

const transports = [new winston.transports.Console()];

// Add file logging in production
if (isProduction()) {
  transports.push(
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: winston.format.json(),
    }),
    new winston.transports.File({
      filename: "logs/all.log",
      format: winston.format.json(),
    }),
  );
}

const logger = winston.createLogger({
  level: isDevelopment() ? "debug" : "warn",
  levels,
  format,
  transports,
});

export default logger;
