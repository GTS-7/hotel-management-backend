import express from "express";
const router = express.Router();

// Importing the admin authentication controller
import adminAuthController from "./controllers/adminAuthController.js";
import verifyAdmin from "../middlewares/verifyAdmin.js";
import adminController from "./controllers/adminController.js";
import bookingController from "../booking/controllers/bookingController.js";
import upload from "../../../config/multer.js";

// Routes for admin registration and login
router
  .post("/register", adminAuthController.handleRegistration)
  .post("/login", adminAuthController.handleLogin);

// Authenticated routes for admin
router.use(verifyAdmin);

// Other routes that require authentication

// Admin routes
router
  .get("/logout", adminAuthController.handleLogout)
  .get("/", adminAuthController.getAdminDetails)
  .get("/users", adminAuthController.getUserDetails)
  .get("/totalUsers", adminController.getTotalUsers)
  .delete("/user/:userId", adminController.handleDeleteUser)
  .put("/user/:userId", adminController.handleUpdateUser);

// Room management routes
router
  .post("/room", upload.array("photos", 10), adminController.handleCreateRoom)
  .get("/room", adminController.getRooms)
  .get("/totalRoom", adminController.getTotalRooms)
  .put("/room", upload.array("photos", 10), adminController.handleUpdateRoom)
  .delete("/room/:roomId", adminController.handleDeleteRoom);

// Booking management routes
router
  .get("/booking", bookingController.getAllBookings)
  .get("/totalBooking", adminController.getTotalBookings)
  // .delete("/booking/:bookingId", bookingController.deleteBooking)
  .put("/booking", bookingController.updateBooking);

export default router;
