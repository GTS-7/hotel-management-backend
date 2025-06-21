import express, { Request, Response, NextFunction, RequestHandler } from "express";
import helperFunctions from "../../../config/helperFunctions.js";
const router = express.Router();

// custom controllers
import userAuthController from "./controller/userAuthController.js";
import verifyUser from "../middlewares/verifyUser.js";
import userController from "./controller/userController.js";

// Type assertion helper to handle Express route handlers
// This converts a function that returns Promise<Response> to a standard Express RequestHandler
// Google OAuth routes
router.get("/auth/google", userAuthController.handleGoogleAuth as RequestHandler);
// Google OAuth callback route
router.get("/auth/google/callback", userAuthController.handleGoogleCallback as RequestHandler);

// Routes without middleware checks
router.post("/register", helperFunctions.asyncHandler(userAuthController.handleRegistration));
router.post("/login", helperFunctions.asyncHandler(userAuthController.handleLogin));

// Apply authentication middleware for all routes below this point
router.use(helperFunctions.asyncHandler(verifyUser));

// Authenticated routes for user
router.get("/me", helperFunctions.asyncHandler(userAuthController.handleVerify));
router.post("/logout", helperFunctions.asyncHandler(userAuthController.handleLogout));

// Other routes that require authentication
router.get("/", helperFunctions.asyncHandler(userController.getUserDetails));
router.put("/", helperFunctions.asyncHandler(userController.updateUserDetails));

// Commented out cart routes
// router.post("/cart", asyncHandler(userController.handleCart));
// router.get("/cart", asyncHandler(userController.getCartItems));
// router.delete("/cart", asyncHandler(userController.deleteCartItem));

export default router;
