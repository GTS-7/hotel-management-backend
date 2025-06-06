// src/middlewares/verifyUser.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import db from "../../../config/db.js";


interface UserPayload {
  id: string;
  email: string;
  clientDeviceId: string;
  // Add any other properties you include in your JWT payload
}

// Extend the Express Request interface to include our custom 'user' property
// We include Express.User in the union type just in case Passport also
// sets req.user elsewhere in your application flow.
declare global {
  namespace Express {
    interface User {
      id: string;
      email?: string;
      clientDeviceId?: string;
    }
  }
}
/**
 * Middleware to verify JWT token from httpOnly cookie and validate against session store.
 * Assumes `cookie-parser` middleware is used.
 * Attaches decoded user payload (email, clientDeviceId) to req.user if valid.
 * @param req - Express request object (now includes our custom 'user' property thanks to express.d.ts)
 * @param res - Express response object
 * @param next - Express next middleware function
 */
const verifyUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Get token from cookie
    const token = req.cookies.authToken;
    console.log("Token from cookie:", token);
    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided, authorization denied",
      });
    }

    // 2. Get token secret from environment variables
    const tokenSecret = process.env.TOKEN_SECRET;
    if (!tokenSecret) {
      console.error("TOKEN_SECRET is not defined!");
      // This should ideally be checked on app startup
      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    // 3. Verify token signature and expiry
    // jwt.verify returns the decoded payload if valid.
    // We assert its type using `as UserPayload`.
    let decoded: UserPayload;
    try {
        decoded = jwt.verify(token, tokenSecret) as UserPayload;
        // Basic check to ensure expected fields are present after decoding
        if (!decoded.email || !decoded.clientDeviceId) {
             console.warn("Token decoded successfully but missing required fields (email or clientDeviceId).");
             console.warn("Token decoded successfully but missing required fields (email or clientDeviceId).");
             res.clearCookie("authToken");
             return res.status(401).json({
                success: false,
                message: "Invalid token structure. Please log in again.",
             });
        }
    } catch (jwtError: any) {
        console.error("JWT verification failed:", jwtError.message);
        res.clearCookie("authToken"); // Clear cookie on invalid token
        return res.status(401).json({
            success: false,
            message: "Token is invalid or expired. Please log in again.",
        });
    }


    // 4. Session Validation (Database Check)
    // Check if a session with the matching user ID (email) AND clientDeviceId exists.
    console.log(`Attempting to validate session for user ${decoded.email}, device ${decoded.clientDeviceId}`);
    const sessionSnapshot = await db
      .collection("sessions")
      .where("userId", "==", decoded.email) // Assuming userId in sessions is the email
      .where("clientDeviceId", "==", decoded.clientDeviceId)
      .get();

    if (sessionSnapshot.empty) {
      // Session not found or has been deleted (e.g., via logout from another device)
      console.warn(
        `Session validation failed for user ${decoded.email}, device ${decoded.clientDeviceId}. Session not found in DB.`
      );
      res.clearCookie("authToken"); // Clear the invalid session cookie
      return res.status(401).json({
        success: false,
        message: "Your session has expired or is invalid. Please log in again.",
      });
    }
    console.log(`Session validated for user ${decoded.email}, device ${decoded.clientDeviceId}.`);

    // 5. Add user data (from the validated token payload) to request object
    // This is safe because our .d.ts file declares req.user can be UserPayload
    req.user = decoded;

    // 6. Move to next middleware or route handler
    next();

  } catch (error: any) {
    // Catch any unexpected errors during the process (e.g., database issues)
    console.error("Error in verifyUser middleware:", error);
    // Optionally clear cookie on *any* error in middleware flow, though less specific
    // res.clearCookie("authToken");
    return res.status(500).json({
      success: false,
      message: "Internal Server Error during authentication check.",
    });
  }
};

export default verifyUser;