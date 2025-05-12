// userAuthController.js
import db from "../../../../config/db.js";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import passport from "passport";
import bcrypt from 'bcrypt';
import { Request, Response } from "express";

const frontendLoginUrl = process.env.FRONTEND_LOGIN_URL || 'http://localhost:3000/login'; // Load frontend URLs from env
const frontendDashboardUrl = process.env.FRONTEND_DASHBOARD_URL || 'http://localhost:3000/dashboard';

const saltRounds = 10;

// --- Handle Registration ---
const handleRegistration = async (req: Request, res: Response) => { // Use req, res directly
  try {
    const { fullName, email, password } = req.body; // Accept password from body

    if (!fullName || !email || !password) // Require password
      return res.status(400).json({ message: "Please send the required details (Full Name, Email, Password)." });

    // Check if email already exists
    const userSnapShot = await db.collection("users").where("email", "==", email).get();
    if (!userSnapShot.empty) return res.status(400).json({ message: "Email already registered" });

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log("Password hashed successfully.");

    // Create user in Firestore
    // Use email as the document ID as per your existing schema
    const newUserRef = db.collection("users").doc(email);
    await newUserRef.set({
      fullName,
      email,
      password: hashedPassword, // Store the hashed password
      createdAt: new Date().toISOString(),
      // Add googleId: null or undefined here if you want to explicitly track auth method
    });
    console.log("New user created in Firestore:", email);

    // --- Generate JWT and set cookie upon successful registration ---
    // This ensures the user is automatically logged in after registering

    const userId = email; // User ID is the email
    const clientDeviceId = uuidv4(); // Generate a device ID for this session

    // Manage sessions (max 2 devices) - Reusing your existing logic
    const sessionSnapshot = await db
      .collection("sessions")
      .where("userId", "==", userId)
      .orderBy("createdAt")
      .get();

    const sessions = sessionSnapshot.docs;
    if (sessions.length >= 2) {
      console.log("Max sessions reached for user", userId, ". Deleting oldest session:", sessions[0].id);
      const oldestSession = sessions[0];
      await db.collection("sessions").doc(oldestSession.id).delete();
    }

    // Create a new session entry in Firestore
    const sessionId = uuidv4(); // Unique ID for the session document
    await db.collection("sessions").doc(sessionId).set({
      userId: userId, // Link session to user ID
      clientDeviceId: clientDeviceId, // Store the device ID associated with this session
      createdAt: new Date().toISOString(),
      ipAddress: req.ip, // May need configuration for proxy servers to get real IP
      userAgent: req.headers["user-agent"],
    });
    console.log(`New session created in Firestore: ${sessionId} for user ${userId}`);

    // Generate JWT token using user email and the generated clientDeviceId
    const tokenSecret = process.env.TOKEN_SECRET; // Ensure this is loaded
    if (!tokenSecret) {
      console.error("TOKEN_SECRET is not defined!");
      return res.status(500).send("Server configuration error.");
    }

    const jwtToken = jwt.sign(
      { email: email, clientDeviceId: clientDeviceId }, // Payload: user email and device ID
      tokenSecret,                                         // Secret key from .env
      { expiresIn: "7d" }                                  // Token expiration (e.g., 7 days)
    );
    console.log("JWT token generated for user", email);

    // Set the authentication cookie in the user's browser
    res.cookie("authToken", jwtToken, {
      httpOnly: true, // Makes the cookie inaccessible to client-side JavaScript (security)
      secure: process.env.NODE_ENV === "production", // Only send cookie over HTTPS in production
      sameSite: "lax", // Helps prevent CSRF (consider 'none' if frontend/backend are on different domains AND you use HTTPS)
      maxAge: 7 * 24 * 60 * 60 * 1000, // Cookie expiration in milliseconds (7 days)
    });
    console.log("Auth cookie 'authToken' set for user", email);

    // Send success response
    res.status(201).json({ message: "User registered and logged in successfully" }); // Use 201 for created

  } catch (error) {
    console.error("Error while registering: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// --- Handle Login ---
const handleLogin = async (req: Request, res: Response) => { // Use req, res directly
  try {
    const { email, password } = req.body; // Accept password from body

    if (!email || !password) // Require password
      return res.status(400).json({ message: "Please provide email and password." });

    const userRef = db.collection("users").doc(email);
    const userSnapShot = await userRef.get();

    if (!userSnapShot.exists) return res.status(400).json({ message: "User not found" });

    const userData = userSnapShot.data();

    if (!userData || !userData.password) {
      console.log("Login failed: User", email, "does not have a password set (likely registered via OAuth).");
      return res.status(401).json({ message: "Invalid credentials" }); // Or "Please sign in with Google"
    }
    // --- END ADDITION ---

    // Compare provided password with the stored hashed password
    const passwordMatch = await bcrypt.compare(password, userData.password);

    if (!passwordMatch) {
      console.log("Login failed: Invalid password for user", email);
      return res.status(401).json({ message: "Invalid credentials" }); // Use 401 for unauthorized
    }
    console.log("Password matched for user", email);


    const userId = userSnapShot.id; // This is the email

    // Manage sessions (max 2 devices)
    const sessionSnapshot = await db
      .collection("sessions")
      .where("userId", "==", userId)
      .orderBy("createdAt")
      .get();

    const sessions = sessionSnapshot.docs;
    if (sessions.length >= 2) {
      console.log("Max sessions reached for user", userId, ". Deleting oldest session:", sessions[0].id);
      const oldestSession = sessions[0];
      await db.collection("sessions").doc(oldestSession.id).delete();
    }

    const sessionId = uuidv4(); // Unique ID for the session document
    await db.collection("sessions").doc(sessionId).set({
      userId, // Link session to user ID (email)
      clientDeviceId: uuidv4(), // Generate a new device ID for this login session
      createdAt: new Date().toISOString(),
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    console.log(`New session created in Firestore: ${sessionId} for user ${userId}`);

    // Generate JWT token
    const tokenSecret = process.env.TOKEN_SECRET; // Ensure this is loaded
    if (!tokenSecret) {
      console.error("TOKEN_SECRET is not defined!");
      return res.status(500).send("Server configuration error.");
    }

    const jwtToken = jwt.sign({ email: userId, clientDeviceId: sessionId }, tokenSecret, { // Use userId (email) and sessionId for clarity in payload
      expiresIn: "7d",
    });
    console.log("JWT token generated for user", userId);

    res.cookie("authToken", jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // Changed from "none" to "lax" - "none" requires HTTPS and is less secure if not needed cross-site
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    console.log("Auth cookie 'authToken' set for user", userId);

    res.status(200).json({ message: "Login successful" }); // Removed sending token in body if using httpOnly cookie
  } catch (error) {
    console.error("Error while logging in: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


// --- Google OAuth Handlers (Keep as is, they are working) ---

const handleGoogleAuth = (req: Request, res: Response, next: Function) => { // Use req, res, next directly
  console.log("Initiating Google OAuth flow...");
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
};

const handleGoogleCallback = (req: Request, res: Response) => { // Use req, res directly
  console.log("Handling Google OAuth callback...");
  passport.authenticate('google', {
    failureRedirect: frontendLoginUrl ,
    session: false
  }, async (err, user) => {
    if (err || !user) {
      console.error("Passport authentication failed in callback:", err);
      return res.redirect(frontendLoginUrl );
    }

    console.log("Passport authentication successful. User:", user.email);

    try {
      // --- Apply session/JWT logic using the 'user' object from Passport ---
      const userId = user.id; // User ID from Passport's verify callback (email)
      const clientDeviceId = uuidv4(); // Generate a new device ID

      // Check and manage sessions
      const sessionSnapshot = await db
        .collection("sessions")
        .where("userId", "==", userId)
        .orderBy("createdAt")
        .get();

      const sessions = sessionSnapshot.docs;
      if (sessions.length >= 2) {
        console.log("Max sessions reached for user", userId, ". Deleting oldest session:", sessions[0].id);
        const oldestSession = sessions[0];
        await db.collection("sessions").doc(oldestSession.id).delete();
      }

      // Create a new session entry
      const sessionId = uuidv4();
      await db.collection("sessions").doc(sessionId).set({
        userId: userId,
        clientDeviceId: clientDeviceId,
        createdAt: new Date().toISOString(),
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      console.log(`New session created in Firestore: ${sessionId} for user ${userId}`);

      // Generate JWT token
      const tokenSecret = process.env.TOKEN_SECRET;
      if (!tokenSecret) {
        console.error("TOKEN_SECRET is not defined!");
        return res.redirect(frontendLoginUrl );
      }

      const jwtToken = jwt.sign(
        { email: user.email, clientDeviceId: clientDeviceId },
        tokenSecret,
        { expiresIn: "7d" }
      );
      console.log("JWT token generated for user", user.email);

      // Set the authentication cookie
      res.cookie("authToken", jwtToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax", // Changed from "none" to "lax"
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      console.log("Auth cookie 'authToken' set for user", user.email);

      // Redirect the user back to the frontend dashboard
      console.log(`Redirecting user to frontend dashboard: ${frontendDashboardUrl}`);
      res.redirect(frontendDashboardUrl);

    } catch (error) {
      console.error("Error during Google OAuth callback custom handler:", error);
      res.redirect(frontendLoginUrl );
    }
  })(req, res); // Call the middleware returned by passport.authenticate with req and res
};
// --- End Google OAuth Handlers ---


// --- Handle Logout ---
const handleLogout = async (req: Request, res: Response) => { // Use req, res directly
  try {
    // Assuming clientDeviceId is sent in the body for logout
    // A more robust logout might use the JWT payload to find the session
    const { clientDeviceId } = req.body;
    if (!clientDeviceId) return res.status(400).json({ message: "Client device ID is required" });

    // Delete the session document based on clientDeviceId
    // Note: Your sessions are indexed by sessionId (uuidv4), not clientDeviceId.
    // You would need to query for the session document by clientDeviceId.
    console.log("Attempting to find and delete session for clientDeviceId:", clientDeviceId);
    const sessionSnapshot = await db.collection("sessions").where("clientDeviceId", "==", clientDeviceId).get();

    if (sessionSnapshot.empty) {
      console.log("Session not found for clientDeviceId:", clientDeviceId);
      // Even if not found, clear the cookie just in case
      res.clearCookie("authToken");
      return res.status(404).json({ message: "Session not found" });
    }

    // Delete the found session document(s)
    const deletePromises = sessionSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);
    console.log(`Deleted ${sessionSnapshot.docs.length} session(s) for clientDeviceId:`, clientDeviceId);

    // Clear the authentication cookie from the browser
    res.clearCookie("authToken");
    console.log("Auth cookie 'authToken' cleared.");


    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Error while logging out: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export default {
  handleRegistration,
  handleLogin,
  handleGoogleAuth,
  handleGoogleCallback,
  handleLogout
};
