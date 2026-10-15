import { v2 as cloudinary } from "cloudinary";
import env from "../config.js";
// Cloudinary uses these server-only credentials to upload and manage images.
// Keep them in .env; never send API_SECRET to the frontend.
cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
});
export default cloudinary;
