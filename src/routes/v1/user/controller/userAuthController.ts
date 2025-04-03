import db from "../../../../config/db.js";
import bcrypt from "bcrypt";


const handleRegistration = async (req: any, res: any) => {
    try {
        const { fullName, email, password } = req.body;
        if(!fullName || !email || !password) return res.status(400).json({ message: "Please send the required details..." });

        // Check if email already exists
        const userSnapShot = await db.collection("users").where("email", "==", email).get();
        if(!userSnapShot.empty) return res.status(400).json({ message: "Email already registered" });
        
        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const newUserRef = db.collection("users").doc();
        await newUserRef.set({
            fullName,
            email,
            password: passwordHash,
            createdAt: new Date().toISOString()
        })

        res.status(200).json({ message: "User registered successfully" });
    } catch (error) {
        console.log("Error while registering: ", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export default {
    handleRegistration
}
