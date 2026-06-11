import { Router } from "express";
import { getStripe } from "../config/stripe.js";
import { getEnv } from "../config/env.js";
import { getCollection } from "../config/db.js";
import { asyncHandler } from "../middlewares/error.middleware.js";
import { responseHandler } from "../utils/response-handler.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";

const router = Router();

// POST /create-checkout-session - Generate Stripe checkout session URL
router.post(
  "/create-checkout-session",
  asyncHandler(async (req, res) => {
    const paymentInfo = req.body;
    if (!paymentInfo.email) {
      throw new BadRequestError("Customer email is required for payment checkout session");
    }

    const stripe = getStripe();
    const env = getEnv();
    
    // Get configurable payment settings from environment
    const currency = env.PREMIUM_CURRENCY || "bdt";
    const unitAmount = env.PREMIUM_UNIT_AMOUNT ? parseInt(env.PREMIUM_UNIT_AMOUNT, 10) : 150000;
    const productName = env.PREMIUM_PRODUCT_NAME || "LifeLedger Premium Subscription";
    const productDescription = env.PREMIUM_PRODUCT_DESCRIPTION || "Life time premium access to all features";

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: {
              name: productName,
              description: productDescription,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: paymentInfo.email,
      mode: "payment",
      success_url: `${env.Stripe_Domain}/payments/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.Stripe_Domain}/payments/payment-cancel`,
      metadata: {
        userEmail: paymentInfo.email,
      },
    });

    responseHandler.sendSuccess(res, { url: session.url });
  })
);

// PATCH /verify-payment-success - Verify checkout session and assign premium role
router.patch(
  "/verify-payment-success",
  asyncHandler(async (req, res) => {
    const sessionID = req.query.session_id;
    if (!sessionID) {
      throw new BadRequestError("session_id query parameter is required");
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionID);

    if (session.payment_status === "paid") {
      const userEmail = session.customer_email || session.metadata?.userEmail;
      if (!userEmail) {
        throw new BadRequestError("Customer email could not be resolved from checkout session");
      }

      const usersCollection = getCollection("users");
      const paymentsCollection = getCollection("payments");

      const updateResult = await usersCollection.updateOne(
        { email: userEmail },
        {
          $set: {
            isPremium: true,
          },
        }
      );

      if (updateResult.matchedCount === 0) {
        throw new NotFoundError("User corresponding to this payment session");
      }

      // Check if payment already recorded to avoid duplicates
      const existingPayment = await paymentsCollection.findOne({
        sessionId: sessionID,
      });

      if (!existingPayment) {
        await paymentsCollection.insertOne({
          email: userEmail,
          amount: session.amount_total / 100,
          payment_status: "completed",
          sessionId: sessionID,
          paymentIntentId: session.payment_intent,
          createdAt: new Date(),
        });
      }

      responseHandler.sendSuccess(
        res,
        {
          success: true,
          isPremium: true,
          paymentStatus: session.payment_status,
        },
        200,
        "Payment verified successfully and user upgraded to premium"
      );
    } else {
      throw new BadRequestError("Checkout session has not been paid");
    }
  })
);

export default router;
