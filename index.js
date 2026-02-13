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
    const reportsCollection = LifeLedgerdb.collection("reports");

    //verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // users
    app.get("/users/:email/roles", verifyFirebaseToken, async (req, res) => {
      try {
        const email = req.decoded_email;
        const query = { email };
        const user = await usersCollection.findOne(query);
        res.send(user);
      } catch (error) {
        console.log(error);
      }
    });

    app.patch(
      "/users/:id/role",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const id = req.params.id;
          console.log(id);
          const roleInfo = req.body.role;
          console.log(roleInfo);
          const query = { _id: new ObjectId(id) };
          const updatedDoc = {
            $set: {
              role: roleInfo,
            },
          };
          const result = await usersCollection.updateOne(query, updatedDoc);
          res.send(result);
        } catch (error) {
          console.log(error);
        }
      },
    );

    app.get("/users", verifyFirebaseToken, async (req, res) => {
      try {
        const result = await usersCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error, message: "can't fetch data" });
      }
    });

    app.get("/top-contributers", verifyFirebaseToken, async (req, res) => {
      try {
        const result = await usersCollection
          .find()
          .sort({ contributedLessons: -1 })
          .limit(5)
          .toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // get users by email
    app.get("/users/:email", verifyFirebaseToken, async (req, res) => {
      try {
        const email = req.params.email;
        const tokenEmail = req.decoded_email;
        if (email !== tokenEmail) {
          res.status(403).send({ error, message: "Forbidden Access" });
        }
        const query = { email };

        const result = await usersCollection.findOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error, message: error.message });
      }
    });

    app.post("/users", async (req, res) => {
      try {
        const { email, displayName, photoURL } = req.body;
        if (!email) {
          res.status(400).send({ message: "Email needed" });
        }
        const user = await usersCollection.findOne({ email });
        if (!user) {
          user = await usersCollection.insertOne({
            email,
            displayName,
            photoURL,
            isPremium: false,
            role: "user",
            contributedLessons: 0,
            createdAt: new Date(),
          });
        }
        res.send(user);
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
        const result = await lessonsCollection.find().limit(6).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error, message: "can't fetch data" });
      }
    });

    app.get("/lessons/:name", async (req, res) => {
      try {
        const name = req.params.name;
        const query = { creatorName: name };
        const result = await lessonsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error, message: "can't fetch data" });
      }
    });

    app.get("/filtered-lessons", async (req, res) => {
      try {
        const category = req.query.category;
        const result = await lessonsCollection
          .find({ category })
          .limit(4)
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error, message: "can't fetch data" });
      }
    });

    app.get("/all-lessons", async (req, res) => {
      try {
        const result = await lessonsCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error, message: "can't fetch data" });
      }
    });

    app.get("/all-lessons/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const query = { _id: new ObjectId(id) };

        const result = await lessonsCollection.findOne(query);

        res.send(result);
      } catch (error) {
        res.status(500).send({ error, message: "can't fetch data" });
      }
    });

    app.post("/lessons", async (req, res) => {
      try {
        const lessonsData = req.body;
        const lessons = { ...lessonsData, createdAt: new Date() };
        const result = await lessonsCollection.insertOne(lessons);

        await usersCollection.updateOne(
          { email: lessonsData.creatorEmail },
          { $inc: { contributedLessons: 1 } },
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({ error, message: error.message });
      }
    });
    // delete
    app.delete("/lessons/:id", async (req, res) => {
      try {
        const id = req.query.id;
        const query = { _id: new ObjectId(id) };
        const result = await lessonsCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error, message: error.message });
      }
    });
    // likes
    app.post("/lessons/:id/likes", async (req, res) => {
      const { user } = req.body;
      const lessonId = req.params.id;
      try {
        const result = await lessonsCollection.updateOne(
          { _id: new ObjectId(lessonId) },
          {
            $addToSet: { likes: new ObjectId(user) },
          },
        );
        res.send(result);
      } catch (error) {
        console.log({ error, message: error.message });
      }
    });
    // report
    app.post("/reports/:id", async (req, res) => {
      const { user } = req.body;
      const lessonId = req.params.id;
      const lesson = await lessonsCollection.findOne({
        _id: new ObjectId(lessonId),
      });
      try {
        const existing = await reportsCollection.findOne({
          lessonId: new ObjectId(lessonId),
          reportedBy: user.email,
        });

        if (existing) {
          return res
            .status(400)
            .send({ message: "You have already reported this lesson." });
        }
        const result = await reportsCollection.insertOne({
          lessonId: new ObjectId(lessonId),
          lessonTitle: lesson?.title,
          reportedBy: user.email,
          createdAt: new Date(),
        });

        res.send(result);
      } catch (error) {
        console.log({ error, message: error.message });
      }
    });

    app.get("/reports", async (req, res) => {
      try {
        const result = await reportsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error({ error, message: error.message });
        res.status(500).send({ error: error.message });
      }
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
          success_url: `${process.env.Stripe_Domain}/payments/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.Stripe_Domain}/payments/payment-cancel`,
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
      console.log("session is:", session);
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
