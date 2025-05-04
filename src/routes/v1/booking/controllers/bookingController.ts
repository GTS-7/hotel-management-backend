import db from "../../../../config/db.js";
import helperFunction from "../../../../config/helperFunctions.js";

const checkRoomAvailability = async (roomId: string, startDate: Date, endDate: Date) => {
    try {
        const bookingRef = db.collection("bookings");
        const snapshot = await bookingRef.where("roomId", "==", roomId)
            .where("startDate", "<", endDate)
            .where("endDate", ">", startDate)
            .get();

        if (snapshot.empty) {
            return true; // Room is available
        }

        return false; // Room is not available
    } catch (error) {
        console.error("Error checking room availability:", error);
        throw new Error("Internal server error");
    }
}

const handleBooking = async (req: any, res: any) => {
    try {
        // Authentication middleware should populate req.email
        const email = req.email;

        // req.body should contain these fields (likely sent as strings from frontend)
        const { roomId, startDate, endDate } = req.body;

        // Basic validation
        if (!roomId || !startDate || !endDate) {
            return res.status(400).json({ message: "All fields are required (roomId, startDate, endDate)" });
        }

        // --- Parse dates and perform validation using Date objects ---
        // Create Date objects from the incoming strings for validation
        const startDateTime = new Date(startDate);
        const endDateTime = new Date(endDate);

        // Check if the strings were successfully parsed into valid dates
         if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
              return res.status(400).json({ message: "Invalid date format provided." });
         }


        if (startDateTime >= endDateTime) {
            return res.status(400).json({ message: "Start date must be before end date" });
        }

        // Optional: Add a check to prevent booking a start date in the past
         const today = new Date();
         // To compare dates only, set hours/minutes/seconds to 0
         today.setHours(0, 0, 0, 0);
         const startDay = new Date(startDateTime);
         startDay.setHours(0, 0, 0, 0);
         if (startDay < today) {
             return res.status(400).json({ message: "Start date cannot be in the past." });
         }

        // --- End of Validation ---


        // Check if the room is available for the given dates
        // NOTE: Your checkRoomAvailability function needs to correctly compare
        // the provided startDateTime and endDateTime (which are Date objects)
        // against the dates stored in the database (which will now be numbers/milliseconds).
        // You'll need to convert the stored milliseconds back to Date objects within checkRoomAvailability.
        const isRoomAvailable = await checkRoomAvailability(roomId, startDateTime, endDateTime);
        if (!isRoomAvailable) {
            return res.status(400).json({ message: "Room is not available for the selected dates" });
        }

        // --- Prepare data for Firestore, storing dates as milliseconds since epoch ---
        const bookingData = {
            userId: email, // Assuming email is the user identifier
            roomId,
            // Store dates as numbers (milliseconds since epoch)
            startDate: startDateTime.getTime(), // Get milliseconds from Date object
            endDate: endDateTime.getTime(),   // Get milliseconds from Date object
            // NEW: Store createdAt as milliseconds since epoch as well
            createdAt: new Date().getTime(),
        };

        // Proceed to create the booking
        const bookingRef = db.collection("bookings").doc(); // Auto-generate a unique ID
        await bookingRef.set(bookingData); // Set the prepared data object directly

        // Return success response
        return res.status(201).json({ message: "Booking Completed Successfully", bookingId: bookingRef.id });

    } catch (error) {
        console.error("Error handling booking:", error);
        // Catch any unexpected errors during the process
        res.status(500).json({ message: "Internal server error" });
    }
};

const checkAvailability = async (req: any, res: any) => {
    try {
        const { roomId, startDate, endDate } = req.query;
        if (!roomId || !startDate || !endDate) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (new Date(startDate) >= new Date(endDate)) {
            return res.status(400).json({ message: "Start date must be before end date" });
        }

        const isRoomAvailable = await checkRoomAvailability(roomId, new Date(startDate), new Date(endDate));
        if (isRoomAvailable) {
            return res.status(200).json({ message: "Room is available" });
        } else {
            return res.status(400).json({ message: "Room is not available" });
        }
    } catch (error) {
        console.error("Error checking availability:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

const updateBooking = async (req: any, res: any) => {
    try {
        const { bookingId, startDate, endDate } = req.body; // startDate and endDate are incoming strings

        // Basic validation
        if (!bookingId || !startDate || !endDate) {
            return res.status(400).json({ message: "All fields are required (bookingId, startDate, endDate)" });
        }

        // --- Parse incoming dates and perform validation using Date objects ---
        const newStartDateTime = new Date(startDate);
        const newEndDateTime = new Date(endDate);

        // Check if date parsing resulted in valid dates
        if (isNaN(newStartDateTime.getTime()) || isNaN(newEndDateTime.getTime())) {
             return res.status(400).json({ message: "Invalid date format provided." });
        }

        if (newStartDateTime >= newEndDateTime) {
            return res.status(400).json({ message: "Start date must be before end date" });
        }
         // Add a check to prevent booking past the current date for start date (optional)
         if (newStartDateTime < new Date()) {
             const today = new Date();
             today.setHours(0, 0, 0, 0);
             const newStartDay = new Date(newStartDateTime);
             newStartDay.setHours(0, 0, 0, 0);

             if (newStartDay < today) {
                return res.status(400).json({ message: "Start date cannot be in the past." });
             }
         }

        // --- Fetch the existing booking ---
        const bookingRef = db.collection("bookings").doc(bookingId);
        const bookingSnapshot = await bookingRef.get();

        // Check if booking exists
        if (!bookingSnapshot.exists) {
            return res.status(404).json({ message: "Booking not found" });
        }

        const bookingData = bookingSnapshot.data(); // Data fetched from Firestore

        // --- Compare new dates with existing dates (which are numbers/milliseconds) ---
        // Access existing dates directly as numbers and compare with new dates converted to milliseconds
        if (bookingData?.startDate === newStartDateTime.getTime() && bookingData?.endDate === newEndDateTime.getTime()) {
             // Optional: Check if the fetched data has the expected date properties
             if (typeof bookingData?.startDate !== 'number' || typeof bookingData?.endDate !== 'number') {
                  console.warn(`Booking ${bookingId} has unexpected date format. Expected numbers, got:`, bookingData?.startDate, bookingData?.endDate);
                  // Decide if you want to return an error or attempt to proceed
                  // For now, we'll let it proceed but log the warning.
             } else {
                 return res.status(400).json({ message: "No changes detected in dates" });
             }
        }


        // --- Check room availability for the new dates ---
        // NOTE: Your checkRoomAvailability function needs to correctly compare
        // the provided newStartDateTime and newEndDateTime (which are Date objects)
        // against the dates stored in the database (which are numbers/milliseconds).
        // Inside checkRoomAvailability, you MUST convert the stored milliseconds
        // back to Date objects using `new Date(milliseconds)` for comparison.
        const isRoomAvailable = await checkRoomAvailability(bookingData?.roomId, newStartDateTime, newEndDateTime); // Pass bookingId to exclude current booking from availability check
        if (!isRoomAvailable) {
             return res.status(400).json({ message: "Room is not available for the selected dates" });
        }


        // --- Proceed to update the booking, storing dates as milliseconds ---
        await bookingSnapshot.ref.update({
            startDate: newStartDateTime.getTime(), // Save new start date as milliseconds
            endDate: newEndDateTime.getTime(),   // Save new end date as milliseconds
            // Optionally update an 'updatedAt' field
            updatedAt: new Date().getTime(), // Store update time as milliseconds
        });

        // Return success response
        return res.status(200).json({ message: "Booking updated successfully" });

    } catch (error) {
        console.error("Error updating booking:", error);
        // Catch any unexpected errors during the process
        res.status(500).json({ message: "Internal server error" });
    }
};

const getBooking = async (req: any, res: any) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const bookingRef = db.collection("bookings").where("userId", "==", userId);
        const bookingSnapshot = await bookingRef.get();
        if (bookingSnapshot.empty) {
            return res.status(404).json({ message: "No bookings found for this user" });
        }

        const bookings = bookingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json({ bookings });
    } catch (error) {
        console.error("Error getting booking:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

const deleteBooking = async (req: any, res: any) => {
    try {
        const { bookingId } = req.params;
        if (!bookingId) {
            return res.status(400).json({ message: "Booking ID is required" });
        }

        const bookingRef = db.collection("bookings").doc(bookingId);
        const bookingSnapshot = await bookingRef.get();
        if (!bookingSnapshot.exists) {
            return res.status(404).json({ message: "Booking not found" });
        }

        await bookingRef.delete();

        return res.status(200).json({ message: "Booking deleted successfully" });
    } catch (error) {
        console.error("Error deleting booking:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

const getAllBookings = async (req: any, res: any) => {
    // This controller fetches all bookings and is likely the one used by your admin dashboard.
    try {
        const bookingsSnapshot = await db.collection("bookings").get();

        // Return an empty array if no bookings found
        if (bookingsSnapshot.empty) {
            // Changed 404 to 200 and return an empty array
            return res.status(200).json([]);
        }

        // Map through the documents and format date fields to ISO strings
        const bookings = bookingsSnapshot.docs.map((doc: any) => {
             const data = doc.data();

             // Use the safeToDate helper to convert Firebase Timestamp objects to Date objects
             const startDate = helperFunction.safeToDate(data.startDate);
             const endDate = helperFunction.safeToDate(data.endDate);
             const createdAt = helperFunction.safeToDate(data.createdAt);

             return {
                 id: doc.id,
                 userId: data.userId,
                 roomId: data.roomId,
                 // Format valid Date objects to ISO strings, otherwise return null
                 startDate: startDate ? startDate.toISOString() : null,
                 endDate: endDate ? endDate.toISOString() : null,
                 createdAt: createdAt ? createdAt.toISOString() : null,
             };
        });

        // Return the array of formatted bookings directly
        res.status(200).json(bookings);
    } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export default {
    handleBooking,
    checkAvailability,
    updateBooking,
    getBooking,
    deleteBooking,
    getAllBookings,
}
