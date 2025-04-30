import express from "express";
import verifyUser from "../middlewares/verifyUser.js";
import bookingController from "./controllers/bookingController.js";
const router = express.Router();

// Importing the booking controller



// Routes for booking for users
router.use(verifyUser);

router
    .post("/", bookingController.handleBooking)
    .get("/availability", bookingController.checkAvailability)
    .put("/:bookingId", bookingController.updateBooking)
    .delete("/:bookingId", bookingController.deleteBooking);

export default router;