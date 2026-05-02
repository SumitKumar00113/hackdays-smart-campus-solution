const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  markAttendance,
  generateQRCode,
  verifyQR,
  enrollFace,
  getFaceEnrollment,
  verifyScan,
  issueRoomCode,
  redeemRoomCode,
  saveMoodSnapshot,
  getAIInsights,
  getAttendancePrediction,
  getAttendance,
  exportAttendance,
} = require("../controllers/attendanceController");

router.post("/", markAttendance);
router.post("/generate-qr", authMiddleware, generateQRCode);
router.post("/room-code/issue", authMiddleware, issueRoomCode);
router.post("/room-code/redeem", authMiddleware, redeemRoomCode);
router.post("/verify-qr", verifyQR);
router.post("/face/enroll", authMiddleware, enrollFace);
router.get("/face/enrollment", authMiddleware, getFaceEnrollment);
router.post("/verify-scan", authMiddleware, verifyScan);
router.post("/mood", saveMoodSnapshot);
router.get("/ai-insights", getAIInsights);
router.get("/predict", getAttendancePrediction);
router.get("/", getAttendance);
router.get("/export", exportAttendance);

module.exports = router;
