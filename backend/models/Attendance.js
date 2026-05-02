const mongoose = require("mongoose");

const moodSnapshotSchema = new mongoose.Schema({
  mood: {
    type: String,
    enum: ["happy", "distressed", "disengaged", "neutral"],
    required: true,
  },
  timestamp: { type: Date, default: Date.now },
});

const attendanceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  classroom: { type: String, required: true },
  date: { type: Date, required: true },
  status: {
    type: String,
    enum: ["present", "absent", "late"],
    default: "present",
  },
  currentMood: {
    type: String,
    enum: ["happy", "distressed", "disengaged", "neutral"],
  },
  moodSnapshots: [moodSnapshotSchema],
  /** How the row was created: manual form, QR+face, or in-room session code */
  checkInMethod: {
    type: String,
    enum: ["manual", "qr_face", "room_code"],
    default: "manual",
  },
  /** Server session id from issue-room-code (audit / anti-abuse) */
  roomSessionId: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Attendance", attendanceSchema);
