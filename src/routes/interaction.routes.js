import { Router } from "express";
import { ObjectId } from "mongodb";
import { getCollection } from "../config/db.js";
import { verifyFirebaseToken, verifyAdmin } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../middlewares/error.middleware.js";
import { responseHandler } from "../utils/response-handler.js";
import { NotFoundError, BadRequestError } from "../utils/errors.js";

const router = Router();

// POST /lessons/:id/likes - Like a lesson
router.post(
  "/lessons/:id/likes",
  asyncHandler(async (req, res) => {
    const { user } = req.body;
    const lessonId = req.params.id;

    if (!user) {
      throw new BadRequestError("User identifier is required to like a lesson");
    }

    // Validate lessonId is a valid ObjectId
    if (!ObjectId.isValid(lessonId)) {
      throw new BadRequestError("Invalid lesson ID format");
    }

    const lessonsCollection = getCollection("lessons");
    
    // Check if lesson exists first
    const lesson = await lessonsCollection.findOne({ _id: new ObjectId(lessonId) });
    if (!lesson) {
      throw new NotFoundError("Lesson");
    }

    // Use user email as the like identifier (consistent with how likes are stored)
    // The user field from request body should be the user's email
    const result = await lessonsCollection.updateOne(
      { _id: new ObjectId(lessonId) },
      {
        $addToSet: { likes: user },
      }
    );

    responseHandler.sendSuccess(res, result, 200, "Like registered successfully");
  })
);

// ==========================================
// SAVED LESSONS
// ==========================================

// POST /lessons/:id/saved-lessons - Toggle saving a lesson
router.post(
  "/lessons/:id/saved-lessons",
  asyncHandler(async (req, res) => {
    const { user } = req.body;
    const lessonId = req.params.id;

    if (!user || !user.email) {
      throw new BadRequestError("User email is required to save a lesson");
    }

    const lessonsCollection = getCollection("lessons");
    const savedLessonCollection = getCollection("savedLesson");

    const lesson = await lessonsCollection.findOne({
      _id: new ObjectId(lessonId),
    });

    if (!lesson) {
      throw new NotFoundError("Lesson");
    }

    const alreadySaved = await savedLessonCollection.findOne({
      lessonId: new ObjectId(lessonId),
      savedBy: user?.email,
    });

    if (alreadySaved) {
      await savedLessonCollection.deleteOne({ _id: alreadySaved._id });
      return responseHandler.sendSuccess(res, { saved: false }, 200, "Lesson unsaved successfully");
    }

    const result = await savedLessonCollection.insertOne({
      lessonId: new ObjectId(lessonId),
      lessonTitle: lesson.title,
      savedBy: user.email,
      createdAt: new Date(),
    });

    responseHandler.sendSuccess(res, { saved: true, result }, 201, "Lesson saved successfully");
  })
);

// GET /saved-lessons - Retrieve all saved lessons of a user
router.get(
  "/saved-lessons",
  asyncHandler(async (req, res) => {
    const { email } = req.query;
    if (!email) {
      throw new BadRequestError("Email query parameter is required");
    }

    const savedLessonCollection = getCollection("savedLesson");
    const saved = await savedLessonCollection
      .find({ savedBy: email })
      .toArray();

    responseHandler.sendSuccess(res, saved);
  })
);

// DELETE /saved-lessons/:id - Delete a saved lesson reference
router.delete(
  "/saved-lessons/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const savedLessonCollection = getCollection("savedLesson");
    const result = await savedLessonCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      throw new NotFoundError("Saved lesson reference");
    }

    responseHandler.sendSuccess(res, result, 200, "Saved lesson removed successfully");
  })
);

// GET /top-lessons - Fetch top 10 most saved lessons from the past 7 days
router.get(
  "/top-lessons",
  asyncHandler(async (req, res) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const savedLessonCollection = getCollection("savedLesson");
    const result = await savedLessonCollection
      .aggregate([
        { $match: { createdAt: { $gte: weekAgo } } },
        { $group: { _id: "$lessonId", saveCount: { $sum: 1 } } },
        { $sort: { saveCount: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "lessons",
            localField: "_id",
            foreignField: "_id",
            as: "lessonInfo",
          },
        },
        { $unwind: "$lessonInfo" },
        {
          $replaceRoot: {
            newRoot: {
              $mergeObjects: ["$lessonInfo", { saveCount: "$saveCount" }],
            },
          },
        },
      ])
      .toArray();

    responseHandler.sendSuccess(res, result);
  })
);

// ==========================================
// REPORTS
// ==========================================

// POST /reports/:id - Submit a report for a lesson
router.post(
  "/reports/:id",
  asyncHandler(async (req, res) => {
    const { user } = req.body;
    const lessonId = req.params.id;

    if (!user || !user.email) {
      throw new BadRequestError("User email is required to report a lesson");
    }

    const lessonsCollection = getCollection("lessons");
    const reportsCollection = getCollection("reports");

    const lesson = await lessonsCollection.findOne({
      _id: new ObjectId(lessonId),
    });

    if (!lesson) {
      throw new NotFoundError("Lesson");
    }

    const existing = await reportsCollection.findOne({
      lessonId: new ObjectId(lessonId),
      reportedBy: user.email,
    });

    if (existing) {
      throw new BadRequestError("You have already reported this lesson");
    }

    const result = await reportsCollection.insertOne({
      lessonId: new ObjectId(lessonId),
      lessonTitle: lesson?.title,
      reportedBy: user.email,
      createdAt: new Date(),
    });

    responseHandler.sendSuccess(res, result, 201, "Report submitted successfully");
  })
);

// GET /reports - Retrieve all reports (Admin)
router.get(
  "/reports",
  asyncHandler(async (req, res) => {
    const reportsCollection = getCollection("reports");
    const result = await reportsCollection.find().toArray();
    responseHandler.sendSuccess(res, result);
  })
);

// DELETE /reports/:id - Delete a report (Admin only)
router.delete(
  "/reports/:id",
  verifyFirebaseToken,
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const reportsCollection = getCollection("reports");
    const result = await reportsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      throw new NotFoundError("Report");
    }

    responseHandler.sendSuccess(res, result, 200, "Report deleted successfully");
  })
);

// ==========================================
// COMMENTS
// ==========================================

// POST /comments/:id - Create a comment on a lesson
router.post(
  "/comments/:id",
  asyncHandler(async (req, res) => {
    const { user, comment } = req.body;
    const lessonId = req.params.id;

    if (!comment) {
      throw new BadRequestError("Comment content is required");
    }

    const lessonsCollection = getCollection("lessons");
    const commentsCollection = getCollection("comments");

    const lesson = await lessonsCollection.findOne({
      _id: new ObjectId(lessonId),
    });

    if (!lesson) {
      throw new NotFoundError("Lesson");
    }

    const result = await commentsCollection.insertOne({
      lessonId: new ObjectId(lessonId),
      lessonTitle: lesson?.title,
      comment,
      commentedby: user?.displayName,
      userPhotoURL: user?.photoURL,
      createdAt: new Date(),
    });

    responseHandler.sendSuccess(res, result, 201, "Comment added successfully");
  })
);

// GET /comments/:id - Retrieve comments for a specific lesson
router.get(
  "/comments/:id",
  asyncHandler(async (req, res) => {
    const lessonId = req.params.id;
    const commentsCollection = getCollection("comments");
    const query = { lessonId: new ObjectId(lessonId) };
    const result = await commentsCollection.find(query).toArray();
    responseHandler.sendSuccess(res, result);
  })
);

export default router;
