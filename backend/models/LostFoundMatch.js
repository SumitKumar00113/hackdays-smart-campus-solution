const mongoose = require("mongoose");

const lostFoundMatchSchema = new mongoose.Schema({
  lostItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LostFound",
    required: true,
  },
  foundItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LostFound",
    required: true,
  },
  score: { type: Number, required: true, min: 0, max: 100 },
  createdAt: { type: Date, default: Date.now },
});

lostFoundMatchSchema.index({ lostItemId: 1, foundItemId: 1 }, { unique: true });

module.exports = mongoose.model("LostFoundMatch", lostFoundMatchSchema);
