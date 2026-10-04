import multer from "multer";
import cloudinary from "../config/cloudinary.js"
import streamifier from "streamifier"

const storage = multer.memoryStorage();

const fileFilter = (req, file, callback) => {
  if (file.mimetype.startsWith("image/")) {
    callback(null, true);
  } else {
    callback(new Error("Only images are allowed to be uploaded."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export default upload;

export const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "photo-api",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

export const deleteFromCloudinary = async ( publicId ) => {
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
