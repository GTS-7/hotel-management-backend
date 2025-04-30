import express from "express";
const router = express.Router();

// Importing the admin authentication controller
import adminAuthController from "./controllers/adminAuthController.js";
import verifyAdmin from "../middlewares/verifyAdmin.js";
import adminController from "./controllers/adminController.js";

// Routes for admin registration and login
router
  .post("/register", adminAuthController.handleRegistration)
  .post("/login", adminAuthController.handleLogin);

// Authenticated routes for admin
router.use(verifyAdmin);

// Other routes that require authentication
router
  .post("/room", adminController.handleCreateRoom)
  .get("/room", adminController.getRooms)
  .put("/room", adminController.handleUpdateRoom)
  .delete("/room/:roomId", adminController.handleDeleteRoom);

export default router;
