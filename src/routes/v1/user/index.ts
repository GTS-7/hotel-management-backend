import express from "express";
const router = express.Router();

// custom controllers
import userAuthController from "./controller/userAuthController.js";
import verifyUser from "../middlewares/verifyUser.js";
import userController from "./controller/userController.js";
import adminController from "../admin/controllers/adminController.js";

// Google Oauth routes
router.get("/auth/google", userAuthController.handleGoogleAuth);
// Google Oauth callback route
router.get("/auth/google/callback", userAuthController.handleGoogleCallback);


// Routes without middleware checks
router
  .post("/register", userAuthController.handleRegistration)
  .post("/login", userAuthController.handleLogin)
// Authenticated routes for user
router.use(verifyUser);

// Other routes that require authentication
router
  .get("/user", userController.getUserDetails)
  .put("/user", userController.updateUserDetails);

// Room management routes
router
  .get("/room", adminController.getRooms)

// Cart routes
router
  .post("/cart", userController.handleCart)
  .get("/cart", userController.getCartItems)
  .delete("/cart", userController.deleteCartItem);

export default router;
