import { MongoClient, ServerApiVersion } from "mongodb";
import { getEnv } from "./env.js";
import logger from "../utils/logger.js";

let client = null;
let db = null;

export async function connectDB() {
  if (db) return db;
  try {
    const env = getEnv();
    const uri = `mongodb+srv://${encodeURIComponent(env.DB_Name)}:${encodeURIComponent(env.DB_Pass)}@cluster0.ldvla9s.mongodb.net/?appName=Cluster0`;

    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      maxPoolSize: 10,
      minPoolSize: 2,
    });

    await client.connect();
    db = client.db("LifeLedgerdb");
    logger.info("MongoDB connected successfully to LifeLedgerdb");
    return db;
  } catch (error) {
    logger.error("MongoDB connection failed", { error: error.message });
    throw error;
  }
}

export function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call connectDB() first.");
  }
  return db;
}

export function getCollection(name) {
  return getDb().collection(name);
}

export async function closeDB() {
  if (client) {
    await client.close();
    logger.info("MongoDB connection closed");
    client = null;
    db = null;
  }
}
