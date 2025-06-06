import express from 'express';
import roomController from './controllers/roomController.js';
import verifyUser from '../middlewares/verifyUser.js';
import reviewController from './controllers/reviewController.js';
import helperFunctions from '../../../config/helperFunctions.js';

const router = express.Router()

router.get('/', roomController.getRooms);

// Routes that require authentication
router.post('/review', reviewController.handleRoomReviews);

router.use(helperFunctions.asyncHandler(verifyUser));
router
    .get('/room/:id', roomController.getRoomById)
export default router;