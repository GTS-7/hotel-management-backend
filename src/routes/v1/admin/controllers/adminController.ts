import db from "../../../../config/db.js";

const handleCreateRoom = async (req: any, res: any) => {
  try {
    const { roomName, roomType, beds, price, photos, highlights } = req.body;
    if (!roomName || !roomType || !beds || !price || !photos || !highlights) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newRoomRecord = await db.collection("rooms").add({
      roomName,
      roomType,
      beds,
      price,
      photos,
      highlights,
      createdAt: new Date(),
    });
    if (!newRoomRecord) {
      return res.status(500).json({ message: "Failed to create room" });
    }

    return res.status(201).json({
      message: "Room created successfully",
      roomId: newRoomRecord.id,
    });
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getRooms = async (req: any, res: any) => {
  try {
    const roomsSnapshot = await db.collection("rooms").get();
    if (roomsSnapshot.empty) {
      return res.status(404).json({ message: "No rooms found" });
    }

    // Map through the documents and return an array of room objects
    const rooms = roomsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json(rooms);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const handleUpdateRoom = async (req: any, res: any) => {
  try {
    const { roomId, roomName, roomType, beds, price, photos, highlights } = req.body;
    if (!roomId) {
      return res.status(400).json({ message: "Room ID is required" });
    }

    let updatedRoomData: any;
    if (roomName) updatedRoomData.roomName = roomName;
    if (roomType) updatedRoomData.roomType = roomType;
    if (beds) updatedRoomData.beds = beds;
    if (price) updatedRoomData.price = price;
    if (photos) updatedRoomData.photos = photos;
    if (highlights) updatedRoomData.highlights = highlights;

    const roomRef = db.collection("rooms").doc(roomId);
    const roomDoc = await roomRef.get();
    if (!roomDoc.exists) {
      return res.status(404).json({ message: "Room not found" });
    }
    await roomRef.update(updatedRoomData);

    res.status(200).json({ message: "Room updated successfully" });
  } catch (error) {
    console.error("Error updating room:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const handleDeleteRoom = async (req: any, res: any) => {
  try {
    const { roomId } = req.body;
    if (!roomId) {
      return res.status(400).json({ message: "Room ID is required" });
    }
    const roomRef = db.collection("rooms").doc(roomId);
    const roomDoc = await roomRef.get();
    if (!roomDoc.exists) {
      return res.status(404).json({ message: "Room not found" });
    }
    await roomRef.delete();
    res.status(200).json({ message: "Room deleted successfully" });
  } catch (error) {
    console.error("Error deleting room:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default {
  handleCreateRoom,
  getRooms,
  handleUpdateRoom,
  handleDeleteRoom,
};
