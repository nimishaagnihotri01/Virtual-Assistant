import fs from "fs";
import path from "path";
import multer from "multer"

const uploadDirectory = path.resolve("uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDirectory)
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "-").replace(/[^\w.-]/g, "");
    cb(null, `${Date.now()}-${safeName || "assistant-image"}`)
  }
})

const fileFilter = (_req, file, cb) => {
  const isImage = file.mimetype?.startsWith("image/");
  cb(isImage ? null : new Error("Only image files are allowed"), isImage);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
})

export default upload
