import db from "../../../../config/db.js";

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
        const { userId, roomId, startDate, endDate } = req.body;
        if (!userId || !roomId || !startDate || !endDate) {
            return res.status(400).json({ message: "All fields are required" });
        }
        if (new Date(startDate) >= new Date(endDate)) {
            return res.status(400).json({ message: "Start date must be before end date" });
        }

        // Validate dates
        const bookingData = {
            userId,
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

export default {
    handleBooking,
    checkAvailability,
}
