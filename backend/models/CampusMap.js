const mongoose = require("mongoose");

const campusMapSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  category: {
    type: String,
    enum: ["building", "parking", "landmark", "service"],
    default: "building",
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("CampusMap", campusMapSchema);
