import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { v2 as cloudinary } from 'cloudinary';

// Importing the database connection
import db from "./config/db.js";

import v1Router from "./routes/v1/index.js";

// Environment variables
dotenv.config();

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true // Recommended for HTTPS
});

// express app initialization
const app = express();

// Check Firebase connection on first run
const checkFirebase = async () => {
  try {
    const testDoc = await db.collection("test").doc("initCheck").get();
    console.log(
      "✅ Firebase is connected:",
      testDoc.exists ? "Connected" : "No test document found",
    );
  } catch (error) {
    console.error("❌ Firebase connection error:", error);
  }
};
checkFirebase(); // Run this check only once at startup

// Middleware to parse JSON requests
app.use(express.json());

// Middleware to parse URL-encoded requests
app.use(express.urlencoded({ extended: true }));

// Middleware to handle CORS issues
app.use(cors());

// routes for api calls
app.use("/api/v1", v1Router);

// Server initialization completed successfully
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
