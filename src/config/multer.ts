// utils/upload.ts
import multer from "multer";

const storage = multer.memoryStorage(); // store files in memory for Cloudinary upload
const upload = multer({ storage });

export default upload;
