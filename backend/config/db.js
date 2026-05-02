const mongoose = require("mongoose");

const connectDB = async () => {
  const startTime = Date.now();

  mongoose.connection.on("connected", () => {
    const elapsed = Date.now() - startTime;
    console.log(
      `MongoDB connected: ${mongoose.connection.host} (connected in ${elapsed}ms)`,
    );
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected, attempting to reconnect...");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected");
  });

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err.message);
  });

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri || typeof uri !== "string") {
    console.error(
      "Set MONGODB_URI (or MONGO_URI) in backend/.env — e.g. mongodb://127.0.0.1:27017/smart-campus",
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
