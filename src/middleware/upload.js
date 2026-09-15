import multer from "multer";

// memoryStorage keeps the temporary image in RAM so it can be sent straight to Cloudinary.
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
  // A small limit prevents a large upload from using too much server memory.
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB each, max six
});

export default upload;
