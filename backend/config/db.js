import mongoose from "mongoose"

const connectDb = async () => {
  const mongoUrl = process.env.MONGODB_URL;

  if (!mongoUrl) {
    throw new Error("MONGODB_URL is missing from backend/.env");
  }

  try {
    await mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log("Database connected");
  } catch (error) {
    if (error?.code === "ENOTFOUND") {
      const safeHost = mongoUrl.match(/@([^/?]+)/)?.[1] || "unknown host";
      const configError = new Error(
        `MongoDB host "${safeHost}" could not be resolved. Update MONGODB_URL in backend/.env with a valid Atlas connection string or use a local MongoDB URL.`,
      );
      configError.cause = error;
      console.error("DB connection error:", configError.message);
      throw configError;
    }

    console.error("DB connection error:", error);
    throw error;
  }
};


export default connectDb
