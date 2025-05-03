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
        const email = req.email;
        const { roomId, startDate, endDate } = req.body;
        if (!roomId || !startDate || !endDate) {
            return res.status(400).json({ message: "All fields are required" });
        }
        if (new Date(startDate) >= new Date(endDate)) {
            return res.status(400).json({ message: "Start date must be before end date" });
        }

        // Validate dates
        const bookingData = {
            userId: email,
            roomId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
        };

        // Check if the room is available for the given dates
        const isRoomAvailable = await checkRoomAvailability(bookingData.roomId, bookingData.startDate, bookingData.endDate);
        if (!isRoomAvailable) {
            return res.status(400).json({ message: "Room is not available for the selected dates" });
        }

        // Proceed to create the booking
        const bookingRef = db.collection("bookings").doc();
        await bookingRef.set({
            ...bookingData,
            createdAt: new Date(),
        });

        return res.status(201).json({ message: "Booking Completed Successfully", bookingId: bookingRef.id });
    } catch (error) {
        console.error("Error handling booking:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

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
        const { bookingId, startDate, endDate } = req.body;
        if (!bookingId || !startDate || !endDate) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (new Date(startDate) >= new Date(endDate)) {
            return res.status(400).json({ message: "Start date must be before end date" });
        }

        const bookingRef = db.collection("bookings").doc(bookingId);
        const bookingSnapshot = await bookingRef.get();
        if (!bookingSnapshot.exists) {
            return res.status(404).json({ message: "Booking not found" });
        }

        const bookingData = bookingSnapshot.data();
        if (bookingData?.startDate.getTime() === new Date(startDate).getTime() && bookingData.endDate.getTime() === new Date(endDate).getTime()) {
            return res.status(400).json({ message: "No changes detected" });
        }

        // Check if the room is available for the new dates
        const isRoomAvailable = await checkRoomAvailability(bookingData?.roomId, new Date(startDate), new Date(endDate));
        if (!isRoomAvailable) {
            return res.status(400).json({ message: "Room is not available for the selected dates" });
        }

        // Proceed to update the booking
        await bookingSnapshot.ref.update({
            startDate: new Date(startDate),
            endDate: new Date(endDate),
        });

        return res.status(200).json({ message: "Booking updated successfully" });
    } catch (error) {
        console.error("Error updating booking:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

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
