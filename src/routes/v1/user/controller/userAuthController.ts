import db from "../../../../config/db.js";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";

// Token secret
const tokenSecret = process.env.TOKEN_SECRET || "default-secret";

const handleRegistration = async (req: any, res: any) => {
  try {
    const { fullName, email } = req.body;
    if (!fullName || !email)
      return res.status(400).json({ message: "Please send the required details..." });

    // Check if email already exists
    const userSnapShot = await db.collection("users").where("email", "==", email).get();
    if (!userSnapShot.empty) return res.status(400).json({ message: "Email already registered" });

    // Create user
    const newUserRef = db.collection("users").doc(email);
    await newUserRef.set({
      fullName,
      email,
      createdAt: new Date().toISOString(),
    });

    res.status(200).json({ message: "User registered successfully" });
  } catch (error) {
    console.log("Error while registering: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// login function
const handleLogin = async (req: any, res: any) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Please send the required details..." });

    const clientDeviceId = uuidv4();
    if (!clientDeviceId) return res.status(400).json({ message: "Error creating device id..." });

    const userRef = db.collection("users").doc(email);
    const userSnapShot = await userRef.get();

    if (!userSnapShot.exists) return res.status(400).json({ message: "User not found" });

    const userId = userSnapShot.id;

    // Manage sessions (max 2 devices)
    const sessionSnapshot = await db
      .collection("sessions")
      .where("userId", "==", userId)
      .orderBy("createdAt")
      .get();

    const sessions = sessionSnapshot.docs;
    if (sessions.length >= 2) {
      const oldestSession = sessions[0];
      await db.collection("sessions").doc(oldestSession.id).delete();
    }

    // Create new session
    const sessionId = uuidv4();
    await db.collection("sessions").doc(sessionId).set({
      userId,
      clientDeviceId,
      createdAt: new Date().toISOString(),
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Generate JWT token
    const jwtToken = jwt.sign({ email, clientDeviceId }, tokenSecret, {
      expiresIn: "7d",
    });

    res.cookie("authToken", jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ message: "Login successful", token: jwtToken });
  } catch (error) {
    console.log("Error while logging in: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export default {
  handleRegistration,
  handleLogin,
};
