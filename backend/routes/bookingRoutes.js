const express = require("express");
const router = express.Router();
const {
  createBooking,
  cancelBooking,
  getBookings,
} = require("../controllers/bookingController");

router.post("/", createBooking);
router.delete("/:id", cancelBooking);
router.get("/", getBookings);

module.exports = router;
