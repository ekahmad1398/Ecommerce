import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import env from "../config.js";
import streamifier from "streamifier";
import type { UploadApiResponse } from "cloudinary";

const storage = multer.memoryStorage();

const fileFilter: multer.Options["fileFilter"] = (req, file, callback) => {
  if (file.mimetype.startsWith("image/")) {
    callback(null, true);
  } else {
    callback(new Error("Only images are allowed to be uploaded."));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export default upload;

export const uploadToCloudinary = (
  buffer: Buffer,
): Promise<UploadApiResponse | undefined> => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return Promise.reject(new Error("A non-empty image buffer is required."));
  }

  return new Promise<UploadApiResponse | undefined>((resolve, reject) => {
    const source = streamifier.createReadStream(buffer);
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "for-uploading-ecommerce",
        upload_preset: env.CLOUDINARY_UPLOAD_PRESET,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Cloudinary returned no upload result."));
        resolve(result);
      },
    );
    source.on("error", reject);
    uploadStream.on("error", reject);
    source.pipe(uploadStream);
  });
};

export const deleteFromCloudinary = async (
  publicId: string | null | undefined,
) => {
  try {
    if (!publicId) return null;
    const result = await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.log(
      `failed to delete the asset ${publicId} from cloudinary.`,
      error,
    );
  }
};
