import db from "../../../../config/db.js";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

// Token secret
const tokenSecret = process.env.TOKEN_SECRET || "default-secret";

const handleRegistration = async (req: any, res: any) => {
    try {
        const { email, password } = req.body;
        if(!email || !password) return res.status(400).json({ message: "Please send the required details..." });

        // Check if email already exists
        const adminSnapShot = await db.collection("admin").where("email", "==", email).get();
        if(!adminSnapShot.empty) return res.status(400).json({ message: "Email already registered" });

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create admin
        const newAdminRef = db.collection("admin").doc(email);
        await newAdminRef.set({
            email,
            hashedPassword,
            createdAt: new Date().toISOString()
        })

        res.status(200).json({ message: "User registered successfully" });
    } catch (error) {
        console.log("Error while registering: ", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// login function
const handleLogin = async (req: any, res: any) => {
    try {
        const email = req.email;
        if(!email) return res.status(400).json({ message: "Please send the required details..." });
        const { password } = req.body;
        if(!password) return res.status(400).json({ message: "Please send the required details..." });

        // Check if email exists
        const adminRef = db.collection("admin").doc(email);
        const adminSnapShot = await adminRef.get();
        if(!adminSnapShot.exists) return res.status(400).json({ message: "Email not registered" });

        // Get the admin data
        const admin = adminSnapShot.data();
        if(!admin) return res.status(400).json({ message: "Email not registered" });

        // Check if the password is correct
        const checkPassword = await bcrypt.compare(password, admin.hashedPassword);
        if(!checkPassword) return res.status(400).json({ message: "Invalid Credentials" });

        // Manage sessions (max 2 devices)
        const sessionSnapshot = await db
            .collection("sessions")
            .where("adminEmail", "==", email)
            .orderBy("createdAt")
            .get();

        const sessions = sessionSnapshot.docs;
        if (sessions.length >= 2) {
            const oldestSession = sessions[0];
            await db.collection("sessions").doc(oldestSession.id).delete();
        }

        // Create a new session
        const clientDeviceId = uuidv4();
        if (!clientDeviceId) return res.status(400).json({ message: "Error creating device id..." });
        const newSessionRef = db.collection("sessions").doc(clientDeviceId);
        await newSessionRef.set({
            adminEmail: email,
            clientDeviceId,
            createdAt: new Date().toISOString()
        });

        // Generate JWT token
        const token = jwt.sign({ email }, tokenSecret, { expiresIn: "1h" });
        if (!token) return res.status(400).json({ message: "Error creating token..." });

        res.status(200).json({ message: "Admin logged in successfully", token, clientDeviceId });

    } catch (error) {
        console.log("Error while logging in: ", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export default {
    handleRegistration,
    handleLogin,
}
