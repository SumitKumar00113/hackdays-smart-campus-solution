const mongoose = require("mongoose");

const verificationSchema = new mongoose.Schema(
  {
    color: { type: String, trim: true },
    brand: { type: String, trim: true },
    uniqueIdentifier: { type: String, trim: true },
  },
  { _id: false },
);

const lostFoundSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String },
  imageUrl: { type: String },
  imageTags: [{ type: String }],
  location: { type: String },
  locationName: { type: String },
  coordinates: {
    lat: { type: Number },
    lng: { type: Number },
  },
  status: { type: String, enum: ["lost", "found", "claimed"], default: "lost" },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  verification: {
    type: verificationSchema,
    select: false,
  },
  claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("LostFound", lostFoundSchema);
