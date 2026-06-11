import { getFirebaseAdmin } from "../config/firebase.js";
import { getCollection } from "../config/db.js";
import { AuthenticationError, AuthorizationError } from "../utils/errors.js";
import { asyncHandler } from "./error.middleware.js";

export const verifyFirebaseToken = asyncHandler(async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    throw new AuthenticationError("Unauthorized Access: Missing or invalid token format");
  }

  try {
    const tokenId = authorization.split(" ")[1];
    const admin = getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(tokenId);
    req.decoded_email = decoded.email;
    next();
  } catch (error) {
    throw new AuthenticationError("Unauthorized Access: Verification failed");
  }
});

export const verifyAdmin = asyncHandler(async (req, res, next) => {
  const email = req.decoded_email;
  if (!email) {
    throw new AuthenticationError("Unauthorized Access: Decoded email missing");
  }

  const usersCollection = getCollection("users");
  const user = await usersCollection.findOne({ email });

  if (!user) {
    throw new AuthorizationError("Forbidden Access: User not found");
  }

  // Explicitly check for admin role (default to "user" if role field is missing)
  const userRole = user.role || "user";
  if (userRole !== "admin") {
    throw new AuthorizationError("Forbidden Access: Admin privileges required");
  }

  next();
});
