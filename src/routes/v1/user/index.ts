import express from "express";
const router = express.Router();

// custom controllers
import userAuthController from "./controller/userAuthController.js";

// Routes without middleware checks
router
    .post("/register", userAuthController.handleRegistration)
    .post("/login", userAuthController.handleLogin);

export default router;
