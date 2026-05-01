const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  room: { type: String, required: true },
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  date: { type: Date, required: true },
  timeslot: { type: String, required: true },
  purpose: { type: String },
  status: {
    type: String,
    enum: ["pending", "approved", "cancelled"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ClassroomBooking", bookingSchema);
