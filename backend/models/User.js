const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["student", "teacher", "admin"],
    default: "student",
  },
  department: { type: String },
  semester: { type: String, trim: true },
  strongSubjects: [{ type: String, trim: true }],
  improvementSubjects: [{ type: String, trim: true }],
  /** 128-d face-api faceRecognitionNet descriptor; never returned in API by default */
  faceDescriptor: {
    type: [Number],
    default: undefined,
    select: false,
    validate: {
      validator(v) {
        return (
          v == null ||
          (Array.isArray(v) &&
            v.length === 128 &&
            v.every((n) => typeof n === "number" && Number.isFinite(n)))
        );
      },
      message: "faceDescriptor must be 128 finite numbers",
    },
  },
  faceEnrolledAt: { type: Date, select: false },
  lastLogin: { type: Date },
  isFirstLogin: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
