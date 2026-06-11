import Stripe from "stripe";
import { getEnv } from "./env.js";

let stripeInstance = null;

export function getStripe() {
  if (!stripeInstance) {
    const env = getEnv();
    if (!env.Stripe_Pass) {
      throw new Error("Stripe_Pass is missing in environment variables");
    }
    stripeInstance = new Stripe(env.Stripe_Pass);
  }
  return stripeInstance;
}
