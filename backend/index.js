const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorMiddleware");

dotenv.config();
connectDB();

const app = express();
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

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
