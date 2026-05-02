const http = require("http");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorMiddleware");
const { attachSocketIO } = require("./socket/socketServer");

dotenv.config();

const start = async () => {
  if (!process.env.JWT_SECRET) {
    console.error("Set JWT_SECRET in backend/.env (used to sign login tokens).");
    process.exit(1);
  }

  await connectDB();

  const app = express();

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:5174",
    "http://localhost:5174",
  ].filter(Boolean);

  app.use(
    cors({
      origin: allowedOrigins.length ? allowedOrigins : true,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/", (req, res) => {
    res.json({ message: "Smart Campus backend is running." });
  });

  app.use("/api/auth", require("./routes/authRoutes"));
  app.use("/api/attendance", require("./routes/attendanceRoutes"));
  app.use("/api/bookings", require("./routes/bookingRoutes"));
  app.use("/api/notices", require("./routes/noticeRoutes"));
  app.use("/api/lostfound", require("./routes/lostFoundRoutes"));
  app.use("/api/campus-map", require("./routes/campusMapRoutes"));
  app.use("/api/dashboard", require("./routes/dashboardRoutes"));
  app.use("/api/gemini", require("./routes/geminiRoutes"));
  app.use("/api/notifications", require("./routes/notificationRoutes"));

  app.use(errorHandler);

  const PORT = Number(process.env.PORT) || 5000;
  const server = http.createServer(app);

  attachSocketIO(server, { corsOrigins: allowedOrigins.length ? allowedOrigins : true });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Backend running at http://127.0.0.1:${PORT}`);
    console.log(`Socket.IO attached (same port, path /socket.io)`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `\nPort ${PORT} is already in use (another backend or app is listening).\n` +
          `Fix: close that process, or set PORT=5001 in backend/.env and restart.\n` +
          `If the frontend uses Vite, set VITE_API_PROXY_TARGET=http://127.0.0.1:5001 in frontend/.env.development\n` +
          `Windows: netstat -ano | findstr :${PORT}  then taskkill /PID <pid> /F\n`,
      );
      process.exit(1);
    }
    throw err;
  });
};

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
