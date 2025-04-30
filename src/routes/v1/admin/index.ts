import express from "express";
const router = express.Router();

// Importing the admin authentication controller
import adminAuthController from "./controllers/adminAuthController.js";
import verifyAdmin from "../middlewares/verifyAdmin.js";
import adminController from "./controllers/adminController.js";
import bookingController from "../booking/controllers/bookingController.js";

// Routes for admin registration and login
router
  .post("/register", adminAuthController.handleRegistration)
  .post("/login", adminAuthController.handleLogin);

// Authenticated routes for admin
router.use(verifyAdmin);

// Other routes that require authentication

// Room management routes
router
  .post("/room", adminController.handleCreateRoom)
  .get("/room", adminController.getRooms)
  .put("/room", adminController.handleUpdateRoom)
  .delete("/room/:roomId", adminController.handleDeleteRoom);

// Booking management routes
router
  .get("/booking", bookingController.getAllBookings)
  .delete("/booking/:bookingId", bookingController.deleteBooking)
  .put("/booking/:bookingId", bookingController.updateBooking);

export default router;
