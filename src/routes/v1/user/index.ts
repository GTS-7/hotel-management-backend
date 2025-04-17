import express from "express";
const router = express.Router();

// custom controllers
import userAuthController from "./controller/userAuthController.js";
import verifyUser from "../middlewares/verifyUser.js";
import userController from "./controller/userController.js";

// Routes without middleware checks
router
    .post("/register", userAuthController.handleRegistration)
    .post("/login", userAuthController.handleLogin);

// Authenticated routes for user
router.use(verifyUser)

// Other routes that require authentication
router
    .get("/user", userController.getUserDetails)

export default router;
