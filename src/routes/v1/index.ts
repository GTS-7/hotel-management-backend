import express from "express";
import user from "./user/index.js"
const router = express.Router();

router.post('/user', user);

export default router;
