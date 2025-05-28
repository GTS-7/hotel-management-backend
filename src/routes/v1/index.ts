import express from "express";
import user from "./user/index.js";
import admin from "./admin/index.js";
import booking from "./booking/index.js";
import rooms from "./rooms/index.js"; // Assuming rooms routes are under user
const router = express.Router();

router
    .use("/user", user)
    .use("/rooms", rooms) 
    .use("/admin", admin)
    .use("/booking", booking);

export default router;
