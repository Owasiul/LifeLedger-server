import { Router } from "express";
import { ObjectId } from "mongodb";
import { getCollection } from "../config/db.js";
import { verifyFirebaseToken } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../middlewares/error.middleware.js";
import { responseHandler } from "../utils/response-handler.js";
import {
  NotFoundError,
  AuthorizationError,
  BadRequestError,
} from "../utils/errors.js";

const router = Router();

// GET /allLessons - Get all lessons with non-private visibility
router.get(
  "/allLessons",
  asyncHandler(async (req, res) => {
    const lessonsCollection = getCollection("lessons");
    const result = await lessonsCollection
      .find({ visibility: { $ne: "private" } })
      .toArray();
    responseHandler.sendSuccess(res, result);
  }),
);

// GET /lessons - Get first 4 lessons
router.get(
  "/featured-lesson",
  asyncHandler(async (req, res) => {
    const lessonsCollection = getCollection("lessons");
    const result = await lessonsCollection
      .find({ isFeatured: true })
      .limit(4)
      .toArray();
    responseHandler.sendSuccess(res, result);
  }),
);

// GET /lessons/:email - Get lessons created by email (Self only)
router.get(
  "/lessons/:email",
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const decoded_email = req.decoded_email;
    const paramEmail = req.params.email;

    if (paramEmail !== decoded_email) {
      throw new AuthorizationError(
        "Forbidden Access: Cannot view lessons of another user",
      );
    }

    const lessonsCollection = getCollection("lessons");
    const query = { creatorEmail: paramEmail };
    const result = await lessonsCollection.find(query).toArray();
    responseHandler.sendSuccess(res, result);
  }),
);

// GET /filtered-lessons - Filter lessons by category (limit 4)
router.get(
  "/filtered-lessons",
  asyncHandler(async (req, res) => {
    const category = req.query.category;
    if (!category) {
      throw new BadRequestError("Category query parameter is required");
    }

    const lessonsCollection = getCollection("lessons");
    const result = await lessonsCollection
      .find({ category, visibility: { $ne: "private" } })
      .limit(4)
      .toArray();
    responseHandler.sendSuccess(res, result);
  }),
);

// GET /all-lessons - Paginated, sortable, searchable lesson retrieval
router.get(
  "/all-lessons",
  asyncHandler(async (req, res) => {
    const {
      limit = 10,
      skip = 0,
      sort = "createdAt",
      order = "desc",
      search = "",
    } = req.query;

    const sortOption = {};
    sortOption[sort || "createdAt"] = order === "asc" ? 1 : -1;

    const searchQuery = {
      visibility: { $ne: "private" },
      ...(search ? { title: { $regex: search, $options: "i" } } : {}),
    };

    const lessonsCollection = getCollection("lessons");
    const total = await lessonsCollection.countDocuments({
      visibility: { $ne: "private" },
    });

    const result = await lessonsCollection
      .aggregate([
        {
          $addFields: {
            likesCount: {
              $let: {
                vars: { likesField: { $ifNull: ["$likes", []] } },
                in: {
                  $cond: {
                    if: { $isArray: "$$likesField" },
                    then: { $size: "$$likesField" },
                    else: 0,
                  },
                },
              },
            },
          },
        },
        { $match: searchQuery },
        { $sort: sortOption },
        { $skip: Number(skip) },
        { $limit: Number(limit) },
      ])
      .toArray();

    responseHandler.sendSuccess(res, { all_lessons: result, total });
  }),
);

// GET /all-lessons/:id - Get single lesson details by ID
router.get(
  "/all-lessons/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const lessonsCollection = getCollection("lessons");
    const result = await lessonsCollection.findOne({ _id: new ObjectId(id) });

    if (!result) {
      throw new NotFoundError("Lesson");
    }

    responseHandler.sendSuccess(res, result);
  }),
);

// POST /lessons - Create a new lesson
router.post(
  "/lessons",
  asyncHandler(async (req, res) => {
    const lessonsData = req.body;
    if (!lessonsData.creatorEmail) {
      throw new BadRequestError("Creator email is required to create a lesson");
    }

    const lessonsCollection = getCollection("lessons");
    const usersCollection = getCollection("users");

    const lessons = {
      ...lessonsData,
      createdAt: new Date(),
      isFeatured: false,
    };
    const result = await lessonsCollection.insertOne(lessons);

    await usersCollection.updateOne(
      { email: lessonsData.creatorEmail },
      {
        $inc: { contributedLessons: 1 },
        $set: { lastContributed: new Date() },
      },
    );

    responseHandler.sendSuccess(
      res,
      result,
      201,
      "Lesson created successfully",
    );
  }),
);

// PATCH /update-lessons/:id - Update user's own lesson details
router.patch(
  "/update-lessons/:id",
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const lessonData = req.body;
    const { id } = req.params;
    const lessonsCollection = getCollection("lessons");

    // Pre-check ownership or verify details
    const lesson = await lessonsCollection.findOne({ _id: new ObjectId(id) });
    if (!lesson) {
      throw new NotFoundError("Lesson");
    }

    if (lesson.creatorEmail !== req.decoded_email) {
      throw new AuthorizationError(
        "Forbidden Access: Cannot edit other users' lessons",
      );
    }

    const updatedDoc = {
      $set: {
        title: lessonData.title,
        description: lessonData.description,
        visibility: lessonData.visibility,
        accessLevel: lessonData.accessLevel,
      },
    };
    const result = await lessonsCollection.updateOne(
      { _id: new ObjectId(id) },
      updatedDoc,
    );

    responseHandler.sendSuccess(
      res,
      result,
      200,
      "Lesson updated successfully",
    );
  }),
);

// DELETE /lessons/:id - Delete lesson by ID
router.delete(
  "/lessons/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const lessonsCollection = getCollection("lessons");
    const result = await lessonsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      throw new NotFoundError("Lesson");
    }

    responseHandler.sendSuccess(
      res,
      result,
      200,
      "Lesson deleted successfully",
    );
  }),
);

// GET /lessons-growth - Fetch lesson creation growth statistics (Admin)
router.get(
  "/lessons-growth",
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

    const lessonsCollection = getCollection("lessons");
    const result = await lessonsCollection
      .aggregate([
        {
          $group: {
            _id: groupFormat,
            lessons: { $sum: 1 },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.week": 1, "_id.month": 1 },
        },
      ])
      .toArray();

    responseHandler.sendSuccess(res, result);
  }),
);

// PATCH /featured-lesson - Admin featured lesson toggler
router.patch(
  "/featured-lesson",
  asyncHandler(async (req, res) => {
    const { lessonId } = req.body;
    if (!lessonId) {
      throw new BadRequestError("lessonId is required");
    }

    const lessonsCollection = getCollection("lessons");
    const query = { _id: new ObjectId(lessonId) };
    const lesson = await lessonsCollection.findOne(query);

    if (!lesson) {
      throw new NotFoundError("Lesson");
    }

    // Just toggle — no clearing others
    const result = await lessonsCollection.updateOne(query, {
      $set: { isFeatured: !lesson.isFeatured },
    });

    responseHandler.sendSuccess(
      res,
      result,
      200,
      `Lesson ${lesson.isFeatured ? "unfeatured" : "featured"} successfully`,
    );
  }),
);

export default router;
