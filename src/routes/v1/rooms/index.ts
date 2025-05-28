import express from 'express';
import roomController from './controllers/roomController.js';


const router = express.Router()

router.get('/room', roomController.getRooms);
export default router;