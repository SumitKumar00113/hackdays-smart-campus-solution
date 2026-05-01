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

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoReconnect: true,
      reconnectTries: Number.MAX_VALUE,
      reconnectInterval: 1000,
    });
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
