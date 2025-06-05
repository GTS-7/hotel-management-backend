import express, { RequestHandler } from 'express';
import roomController from './controllers/roomController.js';
import verifyUser from '../middlewares/verifyUser.js';
import reviewController from './controllers/reviewController.js';


const router = express.Router()

router.get('/', roomController.getRooms);

router.use(verifyUser as RequestHandler);

// Routes that require authentication
router.post('/review', reviewController.handleRoomReviews);

router
.get('/room', roomController.getRooms)
.get('/room/:id', roomController.getRoomById)
export default router;