const mongoose = require("mongoose");

const claimAnswerSchema = new mongoose.Schema(
  {
    color: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    uniqueIdentifier: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const fieldComparisonSchema = new mongoose.Schema(
  {
    expectedPresent: { type: Boolean, default: false },
    providedPresent: { type: Boolean, default: false },
    match: { type: Boolean, default: false },
    confidence: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false },
);

const claimComparisonSchema = new mongoose.Schema(
  {
    score: { type: Number, default: 0, min: 0, max: 100 },
    passed: { type: Boolean, default: false },
    threshold: { type: Number, default: 70 },
    fields: {
      color: fieldComparisonSchema,
      brand: fieldComparisonSchema,
      uniqueIdentifier: fieldComparisonSchema,
    },
    missingOriginalFields: [{ type: String }],
    riskFlags: [{ type: String }],
  },
  { _id: false },
);

const lostFoundClaimSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LostFound",
      required: true,
    },
    claimant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    answers: {
      type: claimAnswerSchema,
      required: true,
    },
    comparison: {
      type: claimComparisonSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: { type: Date },
    adminNote: { type: String, trim: true },
  },
  { timestamps: true },
);

lostFoundClaimSchema.index({ itemId: 1, status: 1, createdAt: -1 });
lostFoundClaimSchema.index({ claimant: 1, createdAt: -1 });

module.exports = mongoose.model("LostFoundClaim", lostFoundClaimSchema);
