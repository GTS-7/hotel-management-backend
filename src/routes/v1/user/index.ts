import express from "express";
const router = express.Router();

// custom controllers
import userAuthController from "./controller/userAuthController.js";

// Routes without middleware checks
router
    .post("/register", userAuthController.handleRegistration)

export default router;
