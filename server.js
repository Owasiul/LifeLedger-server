import { initializeEnv, getEnv } from "./src/config/env.js";

// Initialize environment variables as early as possible
initializeEnv();

import app from "./app.js";
import { connectDB, closeDB } from "./src/config/db.js";
import { initializeFirebase } from "./src/config/firebase.js";
import logger from "./src/utils/logger.js";

let server;
let isInitialized = false;

async function bootstrap() {
  if (isInitialized) return;

  logger.info("Initializing system configurations...");
  await connectDB();
  initializeFirebase();
  isInitialized = true;
}

function setupGracefulShutdown() {
  const signals = ["SIGTERM", "SIGINT"];

  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`${signal} received, shutting down gracefully...`);

      if (server) {
        server.close(async () => {
          logger.info("HTTP server closed");

          try {
            await closeDB();
          } catch (error) {
            logger.error("Error closing MongoDB connection during shutdown", {
              error: error.message,
            });
          }

          process.exit(0);
        });

        setTimeout(() => {
          logger.error("Forceful shutdown triggered");
          process.exit(1);
        }, 10000);
      } else {
        process.exit(0);
      }
    });
  });
}

// Bootstrap DB/Firebase before handling requests (local + Vercel)
await bootstrap();

export default app;

// Only start HTTP listener when running locally (not on Vercel serverless)
if (!process.env.VERCEL) {
  const env = getEnv();
  server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT}`, {
      environment: env.NODE_ENV,
    });
  });

  setupGracefulShutdown();
}
