import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Importing the database connection
import connectDB from './config/db.js';

// Environment variables
dotenv.config();

const app = express();

// Connection with MongoDB
connectDB();

// Checking the connection is connected or not with the database
mongoose.connection.once('open', () => {
    console.log('Connected to MongoDB');

    // Start server
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
});