const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const optionalAuth = require("../middleware/optionalAuthMiddleware");
const {
  createBooking,
  joinBooking,
  joinBookingPost,
  leaveBookingPost,
  getBookingChat,
  cancelBooking,
  getBookings,
  updateBookingStatus,
} = require("../controllers/bookingController");

router.post("/", createBooking);
router.post("/join/:bookingId", authMiddleware, joinBookingPost);
router.post("/leave/:bookingId", authMiddleware, leaveBookingPost);
router.get("/", optionalAuth, getBookings);
router.get("/:id/chat", authMiddleware, getBookingChat);
router.patch("/:id/join", joinBooking);
router.patch("/:id/status", updateBookingStatus);
router.delete("/:id", cancelBooking);

module.exports = router;
