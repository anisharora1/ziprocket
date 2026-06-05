import multer from "multer";

const storage = multer.memoryStorage();

export const uploadMenuImages = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
}).array("images", 2); // Accept up to 2 files under the field name 'images'
