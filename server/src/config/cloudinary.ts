import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// The CLOUDINARY_URL is automatically picked up if present in process.env.
// However, we can also explicitly configure it if needed.
if (process.env.CLOUDINARY_URL) {
  // It automatically configures from the environment variable
} else {
  console.warn("CLOUDINARY_URL is missing in environment variables.");
}

export default cloudinary;
