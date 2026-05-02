const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: [
      "lost_found_match",
      "lost_found_claim_pending",
      "lost_found_claim_approved",
      "lost_found_claim_rejected",
      "attendance_risk",
      "booking_approved",
      "booking_rejected",
      "booking_cancelled",
      "general",
    ],
    default: "general",
  },
  read: { type: Boolean, default: false },
  metadata: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
