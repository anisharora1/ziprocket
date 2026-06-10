import cloudinary from "../config/cloudinary";
import streamifier from "streamifier";

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

/**
 * Uploads a file buffer directly to Cloudinary in the specified subfolder.
 * Automatically applies default optimizations like quality auto.
 */
export const uploadToCloudinary = (
  buffer: Buffer,
  folder: string
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `ziprocket/${folder}`,
        quality: "auto",
        fetch_format: "auto",
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        } else {
          reject(new Error("Cloudinary upload returned no result."));
        }
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

/**
 * Deletes an image from Cloudinary by its public ID.
 */
export const deleteFromCloudinary = async (publicId: string): Promise<boolean> => {
  try {
    if (!publicId) return false;
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === "ok";
  } catch (error) {
    console.error(`Failed to delete image with public ID ${publicId} from Cloudinary:`, error);
    return false;
  }
};
