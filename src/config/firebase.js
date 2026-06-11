import admin from "firebase-admin";
import { getEnv } from "./env.js";
import logger from "../utils/logger.js";

let firebaseAdmin = null;

export function initializeFirebase() {
  if (firebaseAdmin) return firebaseAdmin;
  try {
    const env = getEnv();
    if (!env.FB_SERVICE_KEY) {
      throw new Error("FB_SERVICE_KEY is missing in environment variables");
    }

    let decoded;
    try {
      decoded = Buffer.from(env.FB_SERVICE_KEY, "base64").toString("utf8");
    } catch (error) {
      throw new Error("FB_SERVICE_KEY is not valid base64 encoding");
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(decoded);
    } catch (error) {
      throw new Error("FB_SERVICE_KEY does not contain valid JSON");
    }

    // Validate required fields in service account
    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
      throw new Error("FB_SERVICE_KEY is missing required fields (project_id, private_key, client_email)");
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    logger.info("Firebase Admin initialized successfully");
    firebaseAdmin = admin;
    return firebaseAdmin;
  } catch (error) {
    logger.error("Firebase Admin initialization failed", { error: error.message });
    throw error;
  }
}

export function getFirebaseAdmin() {
  if (!firebaseAdmin) {
    throw new Error("Firebase Admin not initialized. Call initializeFirebase() first.");
  }
  return firebaseAdmin;
}
