const express = require("express");
const app = express();
const port = process.env.PORT || 3030;
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_Name}:${process.env.DB_Pass}@cluster0.ldvla9s.mongodb.net/?appName=Cluster0`;

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send({ status: "ok", message: "LifeLedger server is running" });
});

const client = new MongoClient(uri);

const admin = require("firebase-admin");

const serviceAccount = require("./lifeledger-9e28d-firebase-adminsdk-fbsvc-f9b74ebfb2.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const stripe = require("stripe")(process.env.Stripe_Pass);

const verifyFirebaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  try {
    const tokenId = authorization.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(tokenId);
    req.decoded_email = decoded.email;
    // console.log(decoded);
    next();
  } catch (error) {
    res.status(401).send({ message: "Unauthorized Access" });
    console.log(error);
  }

  // console.log(authorization);
};

client
  .connect()
  .then(async () => {
    // db name
    const LifeLedgerdb = client.db("LifeLedgerdb");
    const usersCollection = LifeLedgerdb.collection("users");
    const lessonsCollection = LifeLedgerdb.collection("lessons");
    const paymentsCollection = LifeLedgerdb.collection("payments");

    // users
    app.get("/users", verifyFirebaseToken, async (req, res) => {
      try {
        const result = await usersCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error, message: "can't fetch data" });
      }
    });
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        user.role = "user";
        user.isPremium = false;
        user.createdAt = new Date();

        const email = user.email;
        const emailExist = await usersCollection.findOne({ email });
        if (emailExist) {
          return res.status(409).send({ message: "User already exists" });
        }
        const result = await usersCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error, message: "can't fetch data" });
      }
    });
    app.patch("/users/:id", verifyFirebaseToken, async (req, res) => {
      try {
        const { status } = req.body;
        const id = req.params.id;

        const query = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            isPremium: status === "premium",
          },
        };
        const result = await usersCollection.updateOne(query, updatedDoc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error, message: "Failed to update data" });
      }
    });

    // lessons
    app.get("/lessons", async (req, res) => {
      try {
        const result = await lessonsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error, message: "can't fetch data" });
      }
    });

    app.post("/lessons", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
    });

    // payments

    app.post("/create-checkout-session", async (req, res) => {
      try {
        const paymentInfo = req.body;
        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: "bdt",
                unit_amount: 150000,
                product_data: {
                  name: "LifeLedger Premium Subscription",
                  description: "Life time premium access to all features",
                },
              },
              quantity: 1,
            },
          ],

          customer_email: paymentInfo.email,
          mode: "payment",
          success_url: `${process.env.Stripe_Domain}/pricing/payment-success`,
          cancel_url: `${process.env.Stripe_Domain}/pricing/payment-cancel`,
          metadata: {
            userEmail: paymentInfo.email,
          },
        });
        console.log(session);
        res.send({ url: session.url });
      } catch (error) {
        console.log({ error, message: error.message });
      }
    });

    app.patch("/verify-payment-success", async (req, res) => {
      const sessionID = req.query.session_id;
      if (!sessionID) {
        return res.status(400).send({ message: "session Id requard" });
      }
      const session = await stripe.checkout.sessions.retrieve(sessionID);
      if (session.payment_status === "paid") {
        const userEmail = session.customer_email;

        const updateResult = await usersCollection.updateOne(
          { email: userEmail },
          {
            $set: {
              isPremium: true,
            },
          },
        );

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
        res.send({
          success: true,
          isPremium: true,
          paymentStatus: session.payment_status,
        });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
    app.listen(port, () => {
      console.log(`LifeLedger server is listening on port ${port}`);
      console.log(`LifeLedger server connected with DB`);
    });
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  });
