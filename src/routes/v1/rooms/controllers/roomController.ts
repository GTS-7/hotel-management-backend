import db from "../../../../config/db.js";

const getRoomTypes = async (req: any, res: any) => {
    try {
        const roomTypesRef = db.collection("roomTypes");
        const roomTypesSnapshot = await roomTypesRef.get();
        if (roomTypesSnapshot.empty) {
            return res.status(404).json({ message: "No room types found" });
        }

        const roomTypes: any[] = [];
        roomTypesSnapshot.forEach((doc) => {
            const data = doc.data();
            roomTypes.push({ id: doc.id, ...data });
        });

        res.status(200).json({ message: "Room types fetched successfully", roomTypes });
    } catch (error) {
        console.error("Error fetching room types: ", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export default {
    getRoomTypes,
}
