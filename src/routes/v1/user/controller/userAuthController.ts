import db from "../../../../config/db.js";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import passport from "passport";

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
const handleGoogleAuth = (req: any, res: any, next: Function) => {
    console.log("Initiating Google OAuth flow...");
    // Use Passport's authenticate middleware directly.
    // It will handle redirecting the user to Google.
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
};

// Handler for the Google OAuth callback
// This function is called AFTER Passport successfully authenticates with Google
// and the verify callback in server.js has completed.
const handleGoogleCallback = (req:any, res:any) => {
    console.log("Handling Google OAuth callback...");
    // req.user is populated by Passport's verify callback in server.js
    // It contains the user object from your database.

    // Use Passport's authenticate middleware again.
    // It will check the state and code from Google.
    // If successful, it calls the next middleware in the chain (which is this function itself).
    // If failure, it redirects to the failureRedirect URL defined in server.js.
    passport.authenticate('google', {
        failureRedirect: process.env.FRONTEND_LOGIN_URL + '?authError=true', // Redirect on Passport auth failure
        session: false // Ensure Passport doesn't try to manage sessions here
    }, async (err, user) => {
        // This custom callback allows us to handle the result of passport.authenticate
        // and then run our custom session/JWT logic.

        if (err || !user) {
            console.error("Passport authentication failed in callback:", err);
            // Redirect to frontend login with error
            return res.redirect(process.env.FRONTEND_LOGIN_URL + '?authError=true');
        }

        console.log("Passport authentication successful. User:", user.email);

        try {
            // --- Apply your existing session/JWT logic here ---
            // This is the same logic as in your handleLogin function,
            // but uses the 'user' object provided by Passport.

            const userId = user.id; // Your user ID (email)
            const clientDeviceId = uuidv4(); // Generate a new device ID for this login session

            // Check and manage sessions (limit to 2)
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
                clientDeviceId: clientDeviceId, // Store the device ID
                createdAt: new Date().toISOString(),
                ipAddress: req.ip, // May need configuration for proxy servers
                userAgent: req.headers["user-agent"],
            });
            console.log(`New session created in Firestore: ${sessionId} for user ${userId}`);


            // Generate JWT token
            const tokenSecret = process.env.TOKEN_SECRET; // Ensure this is loaded
            if (!tokenSecret) {
                 console.error("TOKEN_SECRET is not defined!");
                 // Redirect to frontend login with error
                 return res.redirect(process.env.FRONTEND_LOGIN_URL + '?authError=true');
            }

            const jwtToken = jwt.sign(
                { email: user.email, clientDeviceId: clientDeviceId }, // Payload: user email and device ID
                tokenSecret,                                         // Secret key
                { expiresIn: "7d" }                                  // Token expiration
            );
            console.log("JWT token generated for user", user.email);


            // Set the authentication cookie
            res.cookie("authToken", jwtToken, {
                httpOnly: true, // Makes the cookie inaccessible to client-side JavaScript
                secure: process.env.NODE_ENV === "production", // Only send cookie over HTTPS
                sameSite: "Lax", // Helps prevent CSRF
                maxAge: 7 * 24 * 60 * 60 * 1000, // Cookie expiration
            });
             console.log("Auth cookie 'authToken' set for user", user.email);


            // --- Redirect the user back to the frontend dashboard ---
            console.log(`Redirecting user to frontend dashboard: ${process.env.FRONTEND_DASHBOARD_URL}`);
            const frontendDashboardUrl = process.env.FRONTEND_DASHBOARD_URL || "http://localhost:3000/dashboard";
            res.redirect(frontendDashboardUrl + '?authSuccess=true');

        } catch (error) {
            console.error("Error during Google OAuth callback custom handler:", error);
            // Redirect to frontend login with an error indicator if something goes wrong
            res.redirect(process.env.FRONTEND_LOGIN_URL + '?authError=true');
        }
    })(req, res); // Call the middleware returned by passport.authenticate with req and res

};
// --- End New Google OAuth Handlers ---

const handleLogout = async (req: any, res: any) => {
  try {
    const { clientDeviceId } = req.body;
    if (!clientDeviceId) return res.status(400).json({ message: "Client device ID is required" });

    // Delete the session
    const sessionRef = db.collection("sessions").doc(clientDeviceId);
    await sessionRef.delete();

    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.log("Error while logging out: ", error);
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
