import express from "express";
import user from "./user/index.js";
import admin from "./admin/index.js";
const router = express.Router();

router.use("/user", user).use("/admin", admin);

export default router;
