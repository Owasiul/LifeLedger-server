import { Router } from "express";
import { ObjectId } from "mongodb";
import { getCollection } from "../config/db.js";
import { verifyFirebaseToken, verifyAdmin } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../middlewares/error.middleware.js";
import { responseHandler } from "../utils/response-handler.js";
import { NotFoundError, AuthorizationError, BadRequestError } from "../utils/errors.js";

const router = Router();

// GET /users/:email/roles - Check roles of the authenticated user
router.get(
  "/users/:email/roles",
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const email = req.decoded_email;
    const usersCollection = getCollection("users");
    const user = await usersCollection.findOne({ email });

    if (!user) {
      throw new NotFoundError("User");
    }

    responseHandler.sendSuccess(res, user);
  })
);

// PATCH /users/:id/role - Update user role (Admin only)
router.patch(
  "/users/:id/role",
  verifyFirebaseToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      throw new BadRequestError("Role is required");
    }

    const usersCollection = getCollection("users");
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { role } }
    );

    if (result.matchedCount === 0) {
      throw new NotFoundError("User");
    }

    responseHandler.sendSuccess(res, result, 200, "User role updated successfully");
  })
);

// GET /users - Get all users
router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const usersCollection = getCollection("users");
    const result = await usersCollection.find().toArray();
    responseHandler.sendSuccess(res, result);
  })
);

// GET /top-contributers - Get top 3 contributors based on weekly lesson creation
router.get(
  "/top-contributers",
  asyncHandler(async (req, res) => {
    const lastweek = new Date();
    lastweek.setDate(lastweek.getDate() - 7);

    const lessonsCollection = getCollection("lessons");
    const result = await lessonsCollection
      .aggregate([
        { $match: { createdAt: { $gte: lastweek } } },
        {
          $group: {
            _id: "$creatorEmail",
            lessonsThisWeek: { $sum: 1 },
          },
        },
        { $sort: { lessonsThisWeek: -1 } },
        { $limit: 3 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "email",
            as: "userInfo",
          },
        },
        // Use $unwind with preserveNullAndEmptyArrays to handle cases where user doesn't exist
        { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: { $ifNull: ["$userInfo._id", "$_id"] },
            displayName: { $ifNull: ["$userInfo.displayName", "Unknown"] },
            photoURL: { $ifNull: ["$userInfo.photoURL", ""] },
            email: { $ifNull: ["$userInfo.email", "$_id"] },
            lessonsThisWeek: 1,
          },
        },
      ])
      .toArray();

    responseHandler.sendSuccess(res, result);
  })
);

// GET /users/:email - Get users by email (Self only)
router.get(
  "/users/:email",
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { email } = req.params;
    const tokenEmail = req.decoded_email;

    if (email !== tokenEmail) {
      throw new AuthorizationError("Forbidden Access: Cannot view other users' data");
    }

    const usersCollection = getCollection("users");
    const user = await usersCollection.findOne({ email });

    if (!user) {
      throw new NotFoundError("User");
    }

    responseHandler.sendSuccess(res, user);
  })
);

// POST /users - Create or upsert user details on login
router.post(
  "/users",
  asyncHandler(async (req, res) => {
    const { email, displayName, photoURL } = req.body;

    if (!email) {
      throw new BadRequestError("Email is required");
    }

    const usersCollection = getCollection("users");
    const result = await usersCollection.updateOne(
      { email },
      {
        $set: { displayName, photoURL },
        $setOnInsert: {
          email,
          isPremium: false,
          role: "user",
          contributedLessons: 0,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    responseHandler.sendSuccess(res, result, 200, "User saved successfully");
  })
);

// PATCH /users/:id - Update user premium status
router.patch(
  "/users/:id",
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const usersCollection = getCollection("users");
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          isPremium: status === "premium",
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new NotFoundError("User");
    }

    responseHandler.sendSuccess(res, result, 200, "User premium status updated successfully");
  })
);

// PATCH /update-user - Update user display profile details
router.patch(
  "/update-user",
  asyncHandler(async (req, res) => {
    const user = req.body;

    if (!user.email) {
      throw new BadRequestError("User email is required for profile update");
    }

    const usersCollection = getCollection("users");
    const result = await usersCollection.updateOne(
      { email: user.email },
      {
        $set: {
          displayName: user.displayName,
          photoURL: user.photoURL,
        },
      }
    );

    responseHandler.sendSuccess(res, result, 200, "Profile updated successfully");
  })
);

// GET /users-growth - Fetch user growth statistics
router.get(
  "/users-growth",
  asyncHandler(async (req, res) => {
    const type = req.query.type || "monthly";
    let groupFormat;

    if (type === "weekly") {
      groupFormat = {
        year: { $year: { $toDate: "$createdAt" } },
        week: { $week: { $toDate: "$createdAt" } },
      };
    } else {
      groupFormat = {
        year: { $year: { $toDate: "$createdAt" } },
        month: { $month: { $toDate: "$createdAt" } },
      };
    }

    const usersCollection = getCollection("users");
    const result = await usersCollection
      .aggregate([
        {
          $group: {
            _id: groupFormat,
            users: { $sum: 1 },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.week": 1, "_id.month": 1 },
        },
      ])
      .toArray();

    responseHandler.sendSuccess(res, result);
  })
);

export default router;
