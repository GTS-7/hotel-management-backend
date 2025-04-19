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
    .post('/create-room', adminController.handleCreateRoom)
    .get('/rooms', adminController.getRooms)
    .put('/update-room', adminController.handleUpdateRoom)
    .delete('/delete-room', adminController.handleDeleteRoom)

export default router;