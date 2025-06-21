import db from "../../../../config/db.js";
import helperFunction from "../../../../config/helperFunctions.js";

/**
 * Handles room booking.
 */
const handleBooking = async (req: any, res: any) => {
  const transaction = db.runTransaction(async (t) => {
    try {
      const email = req.email;
      const { roomIds, startDate, endDate, children, adult, elder, totalAmount } = req.body;

      // Validate required fields
      if (
        !roomIds ||
        !Array.isArray(roomIds) ||
        roomIds.length === 0 ||
        !startDate ||
        !endDate ||
        !totalAmount
      ) {
        throw { status: 400, message: "Missing required fields." };
      }

      // Parse and validate dates
      const startDateTime = new Date(startDate);
      const endDateTime = new Date(endDate);

      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        throw { status: 400, message: "Invalid date format." };
      }
      if (startDateTime >= endDateTime) {
        throw { status: 400, message: "Start date must be before end date." };
      }
      if (startDateTime < new Date(new Date().setHours(0, 0, 0, 0))) {
        throw { status: 400, message: "Start date cannot be in the past." };
      }

      // Check room availability within transaction
      const roomsRef = db.collection("rooms");
      const unavailableRooms: string[] = [];

      for (const id of roomIds) {
        const roomDoc = await t.get(roomsRef.doc(id));
        if (!roomDoc.exists) {
          throw { status: 404, message: `Room ${id} not found.` };
        }
        if (roomDoc.data()?.isBooked === true) {
          unavailableRooms.push(id);
        }
      }

      if (unavailableRooms.length > 0) {
        throw { status: 400, message: `Rooms not available: ${unavailableRooms.join(", ")}` };
      }

      // Create booking and update room status
      const bookingRef = db.collection("bookings").doc();
      const bookingData = {
        userId: email,
        roomIds,
        startDate: startDateTime.getTime(),
        endDate: endDateTime.getTime(),
        children: children || 0,
        adult: adult || 0,
        elder: elder || 0,
        totalAmount,
        createdAt: new Date().getTime(),
        status: "confirmed",
      };

      t.set(bookingRef, bookingData);

      for (const id of roomIds) {
        t.update(roomsRef.doc(id), { isBooked: true });
      }

      return { status: 201, message: "Booking completed successfully", bookingId: bookingRef.id };
    } catch (error: any) {
      throw error;
    }
  });

  try {
    const result = await transaction;
    res.status(result.status).json({ message: result.message, bookingId: result.bookingId });
  } catch (error: any) {
    console.error("Booking transaction error:", error);
    res
      .status(error.status || 500)
      .json({ message: error.message || "Internal server error during booking." });
  }
};

/**
 * Updates an existing booking.
 */
const updateBooking = async (req: any, res: any) => {
  const transaction = db.runTransaction(async (t) => {
    try {
      const { bookingId, startDate, endDate, children, adult, elder, roomId } = req.body;

      if (!bookingId) {
        throw { status: 400, message: "Booking ID is required." };
      }

      const bookingRef = db.collection("bookings").doc(bookingId);
      const bookingSnapshot = await t.get(bookingRef);

      if (!bookingSnapshot.exists) {
        throw { status: 404, message: "Booking not found." };
      }

      const existingBookingData = bookingSnapshot.data();
      const existingRoomIds: string[] = Array.isArray(existingBookingData?.roomIds)
        ? existingBookingData?.roomIds
        : existingBookingData?.roomIds
          ? [existingBookingData.roomIds]
          : [];

      let newStartDateTime: Date | undefined = existingBookingData?.startDate
        ? new Date(existingBookingData.startDate)
        : undefined;
      let newEndDateTime: Date | undefined = existingBookingData?.endDate
        ? new Date(existingBookingData.endDate)
        : undefined;
      let newRoomIds: string[] = existingRoomIds;

      // Validate new dates if provided
      if (startDate && endDate) {
        newStartDateTime = new Date(startDate);
        newEndDateTime = new Date(endDate);

        if (isNaN(newStartDateTime.getTime()) || isNaN(newEndDateTime.getTime())) {
          throw { status: 400, message: "Invalid date format." };
        }
        if (newStartDateTime >= newEndDateTime) {
          throw { status: 400, message: "Start date must be before end date." };
        }
        if (newStartDateTime < new Date(new Date().setHours(0, 0, 0, 0))) {
          throw { status: 400, message: "Start date cannot be in the past." };
        }
      }

      // Handle room change
      if (roomId !== undefined && (existingRoomIds.length === 0 || roomId !== existingRoomIds[0])) {
        newRoomIds = [roomId];

        const newRoomDoc = await t.get(db.collection("rooms").doc(roomId));
        if (!newRoomDoc.exists) {
          throw { status: 404, message: `New room ${roomId} not found.` };
        }
        if (newRoomDoc.data()?.isBooked === true) {
          throw { status: 400, message: `New room ${roomId} is not available.` };
        }
      }

      let updatedData: { [key: string]: any } = {};
      if (roomId !== undefined && (existingRoomIds.length === 0 || roomId !== existingRoomIds[0])) {
        updatedData.roomIds = newRoomIds;
      }
      if (startDate && endDate) {
        updatedData.startDate = newStartDateTime?.getTime();
        updatedData.endDate = newEndDateTime?.getTime();
      }
      if (children !== undefined) updatedData.children = children;
      if (adult !== undefined) updatedData.adult = adult;
      if (elder !== undefined) updatedData.elder = elder;
      updatedData.updatedAt = new Date().getTime();

      t.update(bookingRef, updatedData);

      // Update room status for old/new rooms if changed
      if (roomId !== undefined && (existingRoomIds.length === 0 || roomId !== existingRoomIds[0])) {
        for (const oldId of existingRoomIds) {
          t.update(db.collection("rooms").doc(oldId), { isBooked: false });
        }
        t.update(db.collection("rooms").doc(roomId), { isBooked: true });
      }

      return { status: 200, message: "Booking updated successfully." };
    } catch (error: any) {
      throw error;
    }
  });

  try {
    const result = await transaction;
    res.status(result.status).json({ message: result.message });
  } catch (error: any) {
    console.error("Update booking transaction error:", error);
    res
      .status(error.status || 500)
      .json({ message: error.message || "Internal server error during booking update." });
  }
};

/**
 * Gets bookings for a user.
 */
const getBooking = async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    const bookingRef = db.collection("bookings").where("userId", "==", userId);
    const bookingSnapshot = await bookingRef.get();
    if (bookingSnapshot.empty) {
      return res.status(404).json({ message: "No bookings found for this user." });
    }

    const bookings = bookingSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        roomIds: Array.isArray(data.roomIds) ? data.roomIds : data.roomIds ? [data.roomIds] : [],
        startDate: helperFunction.safeToDate(data.startDate)?.toISOString() || null,
        endDate: helperFunction.safeToDate(data.endDate)?.toISOString() || null,
        createdAt: helperFunction.safeToDate(data.createdAt)?.toISOString() || null,
        updatedAt: helperFunction.safeToDate(data.updatedAt)?.toISOString() || null,
      };
    });
    return res.status(200).json({ bookings });
  } catch (error) {
    console.error("Error getting booking:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

/**
 * Fetches all bookings.
 */
const getAllBookings = async (req: any, res: any) => {
  try {
    const bookingsSnapshot = await db.collection("bookings").get();

    if (bookingsSnapshot.empty) {
      return res.status(200).json([]);
    }

    const bookings = bookingsSnapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        roomIds: Array.isArray(data.roomIds) ? data.roomIds : data.roomIds ? [data.roomIds] : [],
        startDate: helperFunction.safeToDate(data.startDate)?.toISOString() || null,
        endDate: helperFunction.safeToDate(data.endDate)?.toISOString() || null,
        createdAt: helperFunction.safeToDate(data.createdAt)?.toISOString() || null,
        updatedAt: helperFunction.safeToDate(data.updatedAt)?.toISOString() || null,
      };
    });

    res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching all bookings:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

export default {
  handleBooking,
  updateBooking,
  getBooking,
  getAllBookings,
};
