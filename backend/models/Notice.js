const mongoose = require("mongoose");

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  audience: {
    type: String,
    enum: ["all", "students", "teachers"],
    default: "all",
  },
  publishedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Notice", noticeSchema);
