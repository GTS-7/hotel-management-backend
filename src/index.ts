import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// Importing the database connection
import firebaseAdmin from './config/db.js';

import v1Router from './routes/v1/index.js';

// Environment variables
dotenv.config();

// express app initialization
const app = express();

// Check Firebase connection on first run
const checkFirebase = async () => {
    try {
        const db = firebaseAdmin.firestore();
        const testDoc = await db.collection("test").doc("initCheck").get();
        console.log("✅ Firebase is connected:", testDoc.exists ? "Connected" : "No test document found");
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
app.use('/api/v1', v1Router);

// Server initialization completed successfully
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
