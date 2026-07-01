import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// The CLOUDINARY_URL is automatically picked up if present in process.env,
// but due to hoisting in ES modules/TypeScript, the library is instantiated
// before dotenv.config() runs. So we configure it explicitly here.
const url = process.env.CLOUDINARY_URL;
if (url) {
  const matches = url.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
  if (matches) {
    cloudinary.config({
      api_key: matches[1],
      api_secret: matches[2],
      cloud_name: matches[3],
      secure: true
    });
  } else {
    console.error("CLOUDINARY_URL format is invalid.");
  }
} else {
  console.warn("CLOUDINARY_URL is missing in environment variables.");
}

export default cloudinary;
