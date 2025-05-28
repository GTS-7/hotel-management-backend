import express, { Request, Response, NextFunction, RequestHandler } from "express";
const router = express.Router();

// custom controllers
import userAuthController from "./controller/userAuthController.js"
import verifyUser from "../middlewares/verifyUser.js";
import userController from "./controller/userController.js";
import roomController from "../rooms/controllers/roomController.js";

// Type assertion helper to handle Express route handlers
// This converts a function that returns Promise<Response> to a standard Express RequestHandler
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler => 
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Google OAuth routes
router.get("/auth/google", userAuthController.handleGoogleAuth as RequestHandler);
// Google OAuth callback route
router.get("/auth/google/callback", userAuthController.handleGoogleCallback as RequestHandler);

// Routes without middleware checks
router.post("/register", asyncHandler(userAuthController.handleRegistration));
router.post("/login", asyncHandler(userAuthController.handleLogin));

// Apply authentication middleware for all routes below this point
router.use(asyncHandler(verifyUser));

// Authenticated routes for user
router.get("/me", asyncHandler(userAuthController.handleVerify));
router.post("/logout", asyncHandler(userAuthController.handleLogout));

// Other routes that require authentication
router.get("/user", asyncHandler(userController.getUserDetails));
router.put("/user", asyncHandler(userController.updateUserDetails));



// Commented out cart routes
// router.post("/cart", asyncHandler(userController.handleCart));
// router.get("/cart", asyncHandler(userController.getCartItems));
// router.delete("/cart", asyncHandler(userController.deleteCartItem));

export default router;