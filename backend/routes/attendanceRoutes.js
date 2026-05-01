const express = require("express");
const router = express.Router();
const {
  markAttendance,
  generateQRCode,
  verifyQR,
  saveMoodSnapshot,
  getAIInsights,
  getAttendance,
  exportAttendance,
} = require("../controllers/attendanceController");

router.post("/", markAttendance);
router.post("/generate-qr", generateQRCode);
router.post("/verify-qr", verifyQR);
router.post("/mood", saveMoodSnapshot);
router.get("/ai-insights", getAIInsights);
router.get("/", getAttendance);
router.get("/export", exportAttendance);

module.exports = router;
