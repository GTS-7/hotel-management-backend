import db from "../../../../config/db.js";


const handleCreateRoom = async (req: any, res: any) => {
    try {
        const { roomName, roomType, beds, price, photos, highlights } = req.body;
        if (!roomName || !roomType || !beds || !price || !photos || !highlights) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const newRoomRecord = await db.collection('rooms').add({
            roomName,
            roomType,
            beds,
            price,
            photos,
            highlights,
            createdAt: new Date(),
        });
        if (!newRoomRecord) {
            return res.status(500).json({ message: 'Failed to create room' });
        }

        return res.status(201).json({
            message: 'Room created successfully',
            roomId: newRoomRecord.id,
        });
    } catch (error) {
        console.error('Error creating room:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

const getRooms = async (req: any, res: any) => {
    try {
        const roomsSnapshot = await db.collection('rooms').get();
        if (roomsSnapshot.empty) {
            return res.status(404).json({ message: 'No rooms found' });
        }

        // Map through the documents and return an array of room objects
        const rooms = roomsSnapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data(),
        }));

        res.status(200).json(rooms);
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

export default {
    handleCreateRoom,
    getRooms,
}