import db from "../../../../config/db.js";


const getUserDetails = async (req: any, res: any) => {
    try {
        const email = req.email; // Assuming email is set in the request by the verifyUser middleware
        if (!email) return res.status(400).json({ message: "Email is required" });

        const userRef = db.collection("users").doc(email);
        const user = await userRef.get();
        if (!user.exists) return res.status(404).json({ message: "User not found" });

        const userData = user.data();
        if (!userData) return res.status(404).json({ message: "User data not found" });

        res.status(200).json({ message: "User details fetched successfully", userData });
    } catch (error) {
        console.error("Error fetching user details: ", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export default {
    getUserDetails
}
