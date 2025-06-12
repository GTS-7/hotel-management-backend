import db from "../../../../config/db.js";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import passport from "passport";
import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from "express"; // Ensure NextFunction is imported

// --- Type Definitions ---
// Define the structure of the data we expect in the JWT payload AND req.user
interface UserPayload {
  email: string;
  clientDeviceId: string;
  // Add any other properties you include in your JWT payload
}

// Define the structure of the user object received from Passport's callback
// Adjust properties based on what your Passport Google Strategy's verify callback passes to 'done()'
interface PassportGoogleUser {
    id: string; // Might be Google ID or your internal user ID (email)
    email: string;
    displayName?: string;
    // Add other relevant properties like photos, provider etc.
}

// --- Constants and Config ---
// Load frontend URLs from env
const frontendLoginUrl = process.env.FRONTEND_LOGIN_URL || 'http://localhost:3000/login';
const frontendDashboardUrl = process.env.FRONTEND_DASHBOARD_URL || 'http://localhost:3000/dashboard';

const saltRounds = 10;

// --- Handle Registration ---
// Added NextFunction to the function signature type
const handleRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fullName, email, password, phone } = req.body;
    console.log("Registration request received:", { fullName, email }); // Don't log password
    if (!fullName || !email || !password || !phone)
      return res.status(400).json({ message: "Please send the required details (Full Name, Email, Password, Phone)." });

    // Check if email already exists
    const userSnapShot = await db.collection("users").where("email", "==", email).get();
    if (!userSnapShot.empty) return res.status(400).json({ message: "Email already registered" });

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log("Password hashed successfully.");

    // Create user in Firestore
    // Use email as the document ID
    const newUserRef = db.collection("users").doc(email);
    await newUserRef.set({
      fullName,
      email,
      password: hashedPassword, // Store the hashed password
      phone, 
      createdAt: new Date().toISOString(),
      // Add googleId: null or undefined here if you want to explicitly track auth method
    });
    console.log("New user created in Firestore:", email);

    // --- Generate JWT and set cookie upon successful registration ---
    // This ensures the user is automatically logged in after registering

    const userId = email; // User ID is the email for session linkage
    const clientDeviceId = uuidv4(); // Generate a unique device ID for this session instance

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

    // Create a new session entry in Firestore
    // Use a UUID as the session document ID, store userId (email) and clientDeviceId inside
    const sessionId = uuidv4(); // Unique ID for the session document in Firestore
    await db.collection("sessions").doc(sessionId).set({
      userId: userId, // Link session to user ID (email)
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

    // *** FIX: Ensure JWT payload is consistent (email + clientDeviceId) ***
    const jwtToken = jwt.sign(
      { email: userId, clientDeviceId: clientDeviceId } satisfies UserPayload, // Payload: user email and device ID. Use 'satisfies' for type safety.
      tokenSecret,
      { expiresIn: "7d" } // Token expiration (e.g., 7 days)
    );
    console.log("JWT token generated for user", userId);

    // Set the authentication cookie in the user's browser
    res.cookie("authToken", jwtToken, {
      httpOnly: true, // Makes the cookie inaccessible to client-side JavaScript (security)
      secure: process.env.NODE_ENV === "production", // Only send cookie over HTTPS in production
      sameSite: "lax", // Helps prevent CSRF (consider 'lax' if frontend/backend are on different domains AND you use HTTPS)
      maxAge: 7 * 24 * 60 * 60 * 1000, // Cookie expiration in milliseconds (7 days)
    });
    console.log("Auth cookie 'authToken' set for user", userId);

    // Send success response
    res.status(201).json({ message: "User registered and logged in successfully" }); // Use 201 for created

  } catch (error) {
    console.error("Error while registering: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// --- Handle Login ---
// Added NextFunction to the function signature type
const handleLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Please provide email and password." });

    const userRef = db.collection("users").doc(email);
    const userSnapShot = await userRef.get();

    if (!userSnapShot.exists) return res.status(400).json({ message: "User not found" });

    const userData = userSnapShot.data();

    if (!userData || !userData.password) {
      console.log("Login failed: User", email, "does not have a password set (likely registered via OAuth).");
      return res.status(401).json({ message: "Invalid credentials" }); // Or "Please sign in with Google"
    }

    // Compare provided password with the stored hashed password
    const passwordMatch = await bcrypt.compare(password, userData.password);

    if (!passwordMatch) {
      console.log("Login failed: Invalid password for user", email);
      return res.status(401).json({ message: "Invalid credentials" }); // Use 401 for unauthorized
    }
    console.log("Password matched for user", email);

    const userId = userSnapShot.id; // This is the email
    const clientDeviceId = uuidv4(); // Generate a new device ID for this login session

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

    // Create a new session entry in Firestore
    const sessionId = uuidv4(); // Unique ID for the session document
    await db.collection("sessions").doc(sessionId).set({
      userId, // Link session to user ID (email)
      clientDeviceId: clientDeviceId, // Store the generated device ID
      createdAt: new Date().toISOString(),
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    console.log(`New session created in Firestore: ${sessionId} for user ${userId}`);

    // Generate JWT token
    const tokenSecret = process.env.TOKEN_SECRET;
    if (!tokenSecret) {
      console.error("TOKEN_SECRET is not defined!");
      return res.status(500).send("Server configuration error.");
    }

    // *** FIX: Ensure JWT payload is consistent (email + clientDeviceId) ***
    const jwtToken = jwt.sign(
      { email: userId, clientDeviceId: clientDeviceId } satisfies UserPayload, // Payload: user email and the generated clientDeviceId
      tokenSecret,
      { expiresIn: "7d" }
    );
    console.log("JWT token generated for user", userId);

    res.cookie("authToken", jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    console.log("Auth cookie 'authToken' set for user", userId);

    res.status(200).json({ message: "Login successful" });
  } catch (error) {
    console.error("Error while logging in: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


// --- Google OAuth Handlers ---

// This handler initiates the Google OAuth flow. It requires the NextFunction signature.
const handleGoogleAuth = (req: Request, res: Response, next: NextFunction) => {
  console.log("Initiating Google OAuth flow...");
  // Passport authenticate returns a middleware function which needs req, res, next
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
};

// This handler receives the callback from Google. It doesn't explicitly need NextFunction
// in its own signature because it calls passport.authenticate with a custom callback
// which handles the response termination (redirect).
const handleGoogleCallback = (req: Request, res: Response) => {
  console.log("Handling Google OAuth callback...");
  // Use the passport.authenticate middleware directly in the callback
  passport.authenticate('google', {
    failureRedirect: frontendLoginUrl,
    session: false // We are using JWTs/cookies, not Passport sessions
  }, async (err, user: PassportGoogleUser | false | null) => { // Added type for 'user'
    if (err || !user) {
      console.error("Passport authentication failed in callback:", err);
      // Redirect to login page on failure
      return res.redirect(frontendLoginUrl);
    }

    // 'user' object comes from your Passport Google Strategy's verify callback
    // Assuming user.email and user.id are available
    console.log("Passport authentication successful. User email:", user.email);

    try {
      const userId = user.email; // Use email as the internal user ID
      const clientDeviceId = uuidv4(); // Generate a new device ID for this OAuth session

      // Check and manage sessions (max 2 devices)
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
      const sessionId = uuidv4(); // Unique ID for the session document
      await db.collection("sessions").doc(sessionId).set({
        userId: userId, // Link session to user ID (email)
        clientDeviceId: clientDeviceId, // Store the device ID associated with this session
        createdAt: new Date().toISOString(),
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      console.log(`New session created in Firestore: ${sessionId} for user ${userId}`);

      // Generate JWT token
      const tokenSecret = process.env.TOKEN_SECRET;
      if (!tokenSecret) {
        console.error("TOKEN_SECRET is not defined!");
        return res.redirect(frontendLoginUrl);
      }

      // *** Keep: JWT payload is already consistent (email + clientDeviceId) ***
      const jwtToken = jwt.sign(
        { email: user.email, clientDeviceId: clientDeviceId } satisfies UserPayload, // Payload: user email and device ID
        tokenSecret,
        { expiresIn: "7d" }
      );
      console.log("JWT token generated for user", user.email);

      // Set the authentication cookie
      res.cookie("authToken", jwtToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      console.log("Auth cookie 'authToken' set for user", user.email);

      // Redirect the user back to the frontend dashboard
      console.log(`Redirecting user to frontend dashboard: ${frontendDashboardUrl}`);
      res.redirect(frontendDashboardUrl);

    } catch (error) {
      console.error("Error during Google OAuth callback custom handler:", error);
      res.redirect(frontendLoginUrl); // Redirect to login on server error
    }
  })(req, res); // Call the middleware returned by passport.authenticate with req and res
};
// --- End Google OAuth Handlers ---


// --- Handle Logout ---
// This route MUST be protected by the verifyUser middleware.
// Added NextFunction to the function signature type.
const handleLogout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // *** FIX: Get user info (email, clientDeviceId) from req.user populated by verifyUser middleware ***
    if (!req.user) {
      // This case should ideally not happen if middleware is applied correctly,
      // but good for safety.
      res.clearCookie("authToken"); // Clear cookie just in case
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Use type assertion to tell TypeScript that req.user has the UserPayload structure
    const { email, clientDeviceId } = req.user as UserPayload; // Get session identifiers from validated token

    console.log(`Attempting to find and delete session for user ${email}, device ${clientDeviceId}`);

    // *** FIX: Query sessions by userId (email) AND clientDeviceId ***
    const sessionSnapshot = await db
      .collection("sessions")
      .where("userId", "==", email)
      .where("clientDeviceId", "==", clientDeviceId)
      .get();

    if (sessionSnapshot.empty) {
      console.log(`Session not found for user ${email}, device ${clientDeviceId}.`);
      // Even if not found, clear the cookie as they tried to log out
      res.clearCookie("authToken");
      // It's arguable if this should be 404 or 200. 200 implies "they are now logged out"
      return res.status(200).json({ message: "Session not found, but cookie cleared." });
    }

    // Delete the found session document(s)
    const deletePromises = sessionSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);
    console.log(`Deleted ${sessionSnapshot.docs.length} session(s) for user ${email}, device ${clientDeviceId}`);

    // Clear the authentication cookie from the browser
    res.clearCookie("authToken");
    console.log("Auth cookie 'authToken' cleared.");

    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Error while logging out: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// --- Handle Verify (Protected by verifyUser) ---
// This route endpoint is called to check if a user is authenticated
// and return basic user information.
// Added NextFunction to the function signature type.
const handleVerify = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // At this point, the verifyUser middleware has already:
    // 1. Checked for the authToken cookie.
    // 2. Verified the JWT signature and expiry.
    // 3. Validated that a session with the matching email and clientDeviceId exists in Firestore.
    // 4. Attached the decoded JWT payload (email, clientDeviceId) to req.user.

    // *** FIX: Check req.user and extract email and clientDeviceId ***
    if (!req.user) {
       // This case should ideally not happen if middleware is applied correctly,
       // but good for safety. verifyUser should handle the 401 before this.
      return res.status(401).json({
        success: false,
        message: 'User not authenticated by middleware.'
      });
    }

    // Use type assertion to tell TypeScript that req.user has the UserPayload structure
    const { email, clientDeviceId } = req.user as UserPayload; // Get email and clientDeviceId from the decoded token

    console.log(`Verifying user ${email}, device ${clientDeviceId}`);

    // You can optionally fetch more user data from Firestore here if needed
    // for the frontend (e.g., full name, profile picture URL, etc.)
    // For example:
    // const userDoc = await db.collection("users").doc(email).get();
    // const userData = userDoc.data();
    // if (!userDoc.exists || !userData) {
    //    // Handle case where user document is missing (unlikely if session exists)
    //    console.error(`User document not found for email: ${email}`);
    //    res.clearCookie('authToken'); // Clear cookie if user doc is gone
    //    return res.status(404).json({ success: false, message: 'User profile not found.' });
    // }


    // Return user data from the token payload (and potentially fetched user doc)
    // Include clientDeviceId so the frontend knows which session ID to use for logout
    return res.status(200).json({
      success: true,
      email: email,
      clientDeviceId: clientDeviceId, // Return clientDeviceId so frontend can use it for specific logout
      // If you fetched more user data, you can include it here:
      // fullName: userData?.fullName,
      // Add any other NON-SENSITIVE user fields you want to expose
    });
  } catch (error) {
    console.error('Error fetching user data in handleVerify:', error);
    // Note: Most token validation errors are caught by verifyUser middleware
    // This catch block would handle errors specifically during the handler execution
    return res.status(500).json({
      success: false,
      message: 'Server error while verifying user session'
    });
  }
}

export default {
  handleRegistration,
  handleLogin,
  handleGoogleAuth,
  handleGoogleCallback,
  handleLogout,
  handleVerify
};