import express from 'express';
import dotenv from 'dotenv';

// Importing the database connection
import connectDB from './config/db.js';

// Environment variables
dotenv.config();

const app = express();

// Connection with MongoDB
connectDB();
