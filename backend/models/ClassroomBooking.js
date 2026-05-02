const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  room: { type: String, required: true },
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  subject: { type: String, trim: true },
  description: { type: String, trim: true },
  isPublic: { type: Boolean, default: true },
  maxParticipants: { type: Number, min: 1, default: 20 },
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  chatMessages: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      text: { type: String, required: true, maxlength: 2000 },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  date: { type: Date, required: true },
  timeslot: { type: String, required: true },
  purpose: { type: String },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "cancelled"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
});

bookingSchema.pre("save", function (next) {
  if (!this.participants) {
    this.participants = [];
  }

  if (this.isNew) {
    const creatorId = this.bookedBy?.toString();
    if (
      creatorId &&
      !this.participants.some(
        (participant) => participant?.toString() === creatorId,
      )
    ) {
      this.participants.push(this.bookedBy);
    }
  }

  next();
});

module.exports = mongoose.model("ClassroomBooking", bookingSchema);
