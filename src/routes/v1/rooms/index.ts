import express from 'express';
import roomController from './controllers/roomController.js';


const router = express.Router()

router
.get('/room', roomController.getRooms)
.get('/room/:id', roomController.getRoomById)
export default router;