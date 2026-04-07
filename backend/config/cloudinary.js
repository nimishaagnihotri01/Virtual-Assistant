import { v2 as cloudinary } from 'cloudinary';
import { promises as fs } from "fs";

const uploadOnCloudinary = async (filePath) => {
  if (!filePath) {
    return null;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  try {
    const uploadResult = await cloudinary.uploader.upload(filePath, {
      folder: "virtual-assistant",
      resource_type: "image",
    });

    return uploadResult.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error("Failed to upload assistant image");
  } finally {
    await fs.rm(filePath, { force: true });
  }
}

export default uploadOnCloudinary
