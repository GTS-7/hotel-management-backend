import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { v2 as cloudinary } from 'cloudinary';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'; // Import Google Strategy
import cookieParser from 'cookie-parser';

// the database connection
import db from "./config/db.js";

import v1Router from "./routes/v1/index.js";

// Environment variables
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const app = express();

const checkFirebase = async () => {
  try {
    const testDoc = await db.collection("test").doc("initCheck").get(); // Assuming a 'test' collection exists
    console.log(
      "✅ Firebase is connected:",
      testDoc.exists ? "Test document found" : "No test document found",
    );
  } catch (error) {
    console.error("❌ Firebase connection error:", error);
  }
};
checkFirebase();

app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(passport.initialize());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
  scope: ['profile', 'email']
},
  async (accessToken: string, refreshToken: string, profile: any, done: (error: any, user?: any) => void) => {
    // This function is called by Passport after Google successfully authenticates the user.
    // 'profile' contains the user's information from Google.
    // We will find or create the user in our DB here.

    try {
      const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
      const fullName = profile.displayName; // User's name from Google

      if (!email) {
        console.warn("Google profile did not contain an email:", profile);
        // Call done with an error if email is missing
        return done(new Error("Google profile did not contain an email"), null);
      }

      console.log(`Google authenticated user via Passport strategy: ${email}`);

      // --- Logic to find or create user in your Firestore DB ---
      // This logic is similar to your existing registration, but uses Google data.

      const userSnapShot = await db.collection("users").where("email", "==", email).get();

      let user;
      if (!userSnapShot.empty) {
        // User already exists in your database
        const userData = userSnapShot.docs[0].data();
        // Ensure the user object passed to 'done' includes the ID you use for sessions (email)
        user = { id: userSnapShot.docs[0].id, ...userData };
        console.log("Existing user found in DB:", (user as any).email);

        // Optional: Update existing user data if needed (e.g., store googleId if not already there)
        // if (!userData.googleId) {
        //     await userSnapShot.docs[0].ref.update({ googleId: googleId });
        // }

      } else {
        // User does NOT exist, create a new user in your database
        console.log("User not found in DB, creating new user:", email);
        // Use email as document ID as per your likely existing schema
        const newUserRef = db.collection("users").doc(email);
        user = {
          fullName: fullName || 'New User', // Use Google name or a default
          email: email,
          createdAt: new Date().toISOString(),
          // Add any other default fields you need for new users
        };
        await newUserRef.set(user);
        // Ensure the user object has the ID (email) that your session logic expects
        (user as any).id = email;
      }

      // Call 'done' to tell Passport authentication was successful.
      // The 'user' object passed here will be temporarily available as 'req.user'
      // in the route handler for the callback URL (Part 2).
      return done(null, user);

    } catch (error) {
      console.error("Error in Google OAuth verify callback:", error);
      // Call 'done' with an error to indicate authentication failed
      return done(error, null);
    }
  }));

// Minimal serialization/deserialization stubs.
// While we aren't using passport.session(), Passport.initialize() might
// still expect these to be defined. They won't manage persistent sessions
// in this setup, but provide necessary structure for Passport's internal flow.
passport.serializeUser((user, done) => {
  // This function is typically called to decide what data to store in the session.
  // Since we're not using passport sessions for persistence, this might not be heavily used,
  // but we return the user's ID (email) as a minimal requirement.
  console.log("Serializing user (stub):", (user as any).id);
  done(null, (user as any).id);
});

passport.deserializeUser(async (id, done) => {
  // This function is typically called to retrieve the user based on the ID stored in the session.
  // Again, less critical without passport sessions, but we provide the logic to fetch the user.
  console.log("Deserializing user (stub) for ID:", id);
  try {
    const userSnapShot = await db.collection("users").doc(id as string).get();
    if (userSnapShot.exists) {
      const userData = userSnapShot.data();
      done(null, { id: userSnapShot.id, ...userData }); // Pass the user object
    } else {
      done(new Error("User not found"), null);
    }
  } catch (error) {
    console.error("Error deserializing user (stub):", error);
    done(error, null);
  }
});


// routes for api calls
app.use(express.static('public'));
// Make sure this line is AFTER the passport initialization
app.use("/api/v1", v1Router);

// Server initialization completed successfully
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

