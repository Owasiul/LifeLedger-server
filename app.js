import express from "express";
import cors from "cors";
import { getEnv } from "./src/config/env.js";
import { securityMiddleware } from "./src/middlewares/security.middleware.js";
import { requestLoggerMiddleware } from "./src/middlewares/request-logger.middleware.js";
import { errorMiddleware } from "./src/middlewares/error.middleware.js";
import logger from "./src/utils/logger.js";
import { NotFoundError } from "./src/utils/errors.js";

// Import routers
import userRoutes from "./src/routes/user.routes.js";
import lessonRoutes from "./src/routes/lesson.routes.js";
import paymentRoutes from "./src/routes/payment.routes.js";
import interactionRoutes from "./src/routes/interaction.routes.js";

const app = express();

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://life-ledger-client.vercel.app",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

app.use(cors());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use(...securityMiddleware);
app.use(requestLoggerMiddleware);

// Base root endpoint to confirm running status (as in original index.js)
app.get("/", (req, res) => {
  res.send({ status: "ok", message: "LifeLedger server is running" });
});

// API health endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res, next) => {
  logger.debug("Request received", {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Mount routers under root "/" for backward compatibility with frontend
app.use("/", userRoutes);
app.use("/", lessonRoutes);
app.use("/", paymentRoutes);
app.use("/", interactionRoutes);

// Fallback 404 handler for unmatched routes
app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.originalUrl}`));
});

// Global error handler middleware
app.use(errorMiddleware);

export default app;
