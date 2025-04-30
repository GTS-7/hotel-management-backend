import express from "express";
import user from "./user/index.js";
import admin from "./admin/index.js";
import booking from "./booking/index.js";
const router = express.Router();

router
    .use("/user", user)
    .use("/admin", admin)
    .use("/booking", booking);

export default router;
