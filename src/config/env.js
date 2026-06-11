import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3030),
  NODE_ENV: z
    .enum(["development", "production", "testing"])
    .default("development"),
  DB_Name: z.string().min(1, "DB_Name is required"),
  DB_Pass: z.string().min(1, "DB_Pass is required"),
  Stripe_Pass: z.string().min(1, "Stripe_Pass is required"),
  Stripe_Domain: z.string().url("Stripe_Domain must be a valid URL"),
  FB_SERVICE_KEY: z.string().min(1, "FB_SERVICE_KEY is required"),
  // Optional payment configuration
  PREMIUM_CURRENCY: z.string().default("bdt"),
  PREMIUM_UNIT_AMOUNT: z.string().optional(),
  PREMIUM_PRODUCT_NAME: z.string().optional(),
  PREMIUM_PRODUCT_DESCRIPTION: z.string().optional(),
});

let config = null;

export function initializeEnv() {
  if (config) return config;
  try {
    config = envSchema.parse(process.env);
    return config;
  } catch (error) {
    console.error("Environment validation failed:");
    if (error.issues) {
      error.issues.forEach((err) => {
        console.error(`  ${err.path.join(".")}: ${err.message}`);
      });
    }
    throw new Error("Invalid environment configuration");
  }
}

export function getEnv() {
  if (!config) {
    initializeEnv();
  }
  return config;
}

export function isProduction() {
  return getEnv().NODE_ENV === "production";
}

export function isDevelopment() {
  return getEnv().NODE_ENV === "development";
}

export function isTesting() {
  return getEnv().NODE_ENV === "testing";
}
