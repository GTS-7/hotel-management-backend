const express = require("express");
const router = express.Router();

// Importing the booking controller
const bookingController = require("./controllers/bookingController.js");
const verifyUser = require("../middlewares/verifyUser.js");
const verifyAdmin = require("../middlewares/verifyAdmin.js");


// Routes for booking for users
router.use(verifyUser);

router
    .post("/", bookingController.handleBooking)
    .get("/availability", bookingController.checkAvailability)
    .get("/user", bookingController.getUserBookings)
    .put("/:bookingId", bookingController.updateBooking)
    .delete("/:bookingId", bookingController.deleteBooking);

export default router;