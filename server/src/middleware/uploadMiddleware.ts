import multer from "multer";
import { Request } from "express";

const storage = multer.memoryStorage();

const imageFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only images are allowed (JPEG, PNG, WEBP, and GIF)"));
  }
};

/**
 * Reusable middleware for single image upload with file size validation.
 */
export const uploadSingle = (fieldName: string, maxSize = 5 * 1024 * 1024) => {
  return multer({
    storage,
    limits: { fileSize: maxSize },
    fileFilter: imageFilter,
  }).single(fieldName);
};

/**
 * Reusable middleware for multiple image uploads with max count and file size validation.
 */
export const uploadArray = (fieldName: string, maxCount = 5, maxSize = 2 * 1024 * 1024) => {
  return multer({
    storage,
    limits: { fileSize: maxSize },
    fileFilter: imageFilter,
  }).array(fieldName, maxCount);
};

// Backwards compatibility for existing menu and grocery routes
export const uploadMenuImages = uploadArray("images", 2, 2 * 1024 * 1024);

/**
 * Middleware for restaurant media uploads (Cover Image, Logo, and Gallery).
 */
export const uploadRestaurantImages = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: imageFilter,
}).fields([
  { name: "image", maxCount: 1 },
  { name: "logo", maxCount: 1 },
  { name: "gallery", maxCount: 5 }
]);


