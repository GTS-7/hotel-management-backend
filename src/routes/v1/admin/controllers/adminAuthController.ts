import db from "../../../../config/db.js";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { get } from "http";

// Token secret
const tokenSecret = process.env.TOKEN_SECRET || "default-secret";

const handleRegistration = async (req: any, res: any) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Please send the required details..." });

    // Check if email already exists
    const adminSnapShot = await db.collection("admin").where("email", "==", email).get();
    if (!adminSnapShot.empty) return res.status(400).json({ message: "Email already registered" });

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin
    const newAdminRef = db.collection("admin").doc(email);
    await newAdminRef.set({
      email,
      hashedPassword,
      name,
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
    const { password, email } = req.body;
    if (!password || !email) return res.status(400).json({ message: "Please send the required details..." });

    // Check if email exists
    const adminRef = db.collection("admin").doc(email);
    const adminSnapShot = await adminRef.get();
    if (!adminSnapShot.exists) return res.status(400).json({ message: "Email not registered" });

    // Get the admin data
    const admin = adminSnapShot.data();
    if (!admin) return res.status(400).json({ message: "Email not registered" });

    // Check if the password is correct
    const checkPassword = await bcrypt.compare(password, admin.hashedPassword);
    if (!checkPassword) return res.status(400).json({ message: "Invalid Credentials" });

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
      createdAt: new Date().toISOString(),
    });

    // Generate JWT token
    const token = jwt.sign({ email }, tokenSecret, { expiresIn: "7d" });
    if (!token) return res.status(400).json({ message: "Error creating token..." });

    res
      .cookie("authToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .status(200)
      .json({ message: "Admin logged in successfully", token, clientDeviceId });

  } catch (error) {
    console.log("Error while logging in: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getAdminDetails = async (req: any, res: any) => {
  try {
    const email = req.email;
    
    const adminRef = db.collection("admin").doc(email);
    
    const adminSnapShot = await adminRef.get();
    // Check if the admin exists
    if (!adminSnapShot.exists) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Get the admin data
    const adminData = adminSnapShot.data();

    if (!adminData) {
      return res.status(404).json({ message: "Admin not found" });
    }
    const { hashedPassword, ...adminDetails } = adminData; // Exclude hashed password from response
    res.status(200).json({ admin: adminDetails });
  } catch (error) {
    console.log("Error while getting admin details: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

const getUserDetails = async (req: any, res: any) => {
  try {
    const userRef = db.collection("users");
    const userSnapShot = await userRef.get();

    if (userSnapShot.empty) {
      return res.status(404).json({ message: "No users found" });
    }

    const users = userSnapShot.docs.map(doc => {
      const userData = doc.data();
      const { hashedPassword, ...userDetails } = userData; // Exclude hashed password from response
      return { id: doc.id, ...userDetails };
    });

    res.status(200).json({ users });
  } catch (error) {
    console.log("Error while getting user details: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

const handleLogout = async (req: any, res: any) => {
  try {
    const email = req.email;

    const foundAdmin = await db.collection("admin").doc(email).get();
    if (!foundAdmin.exists) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Clear the session
    res.clearCookie("authToken", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });

    return res.status(200).json({ message: "Admin logged out successfully" });
  } catch (error) {
    console.log("Error while logging out: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export default {
  handleRegistration,
  handleLogin,
  getAdminDetails,
  getUserDetails,
  handleLogout
};
