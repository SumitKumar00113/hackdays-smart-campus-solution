const mongoose = require("mongoose");
const LostFound = require("../models/LostFound");
const LostFoundClaim = require("../models/LostFoundClaim");
const {
  compareClaimAnswers,
  validateClaimAnswers,
} = require("../services/lostFoundClaimService");
const {
  notifyLostFoundClaimStatus,
  notifyLostFoundClaimSubmitted,
} = require("../services/notificationService");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const populateClaim = (query) =>
  query
    .populate("itemId", "title description category imageUrl location locationName status postedBy claimedBy")
    .populate("claimant", "name email role")
    .populate("reviewedBy", "name email role");

const submitClaim = async (req, res) => {
  try {
    const itemId = req.body.itemId || req.params.id;
    const claimant = req.user?._id || req.body.userId || req.body.claimant;

    if (!itemId || !isValidObjectId(itemId)) {
      return res.status(400).json({ message: "Valid itemId is required" });
    }

    if (!claimant || !isValidObjectId(claimant)) {
      return res.status(400).json({ message: "Valid userId is required" });
    }

    const { answers, errors, isValid } = validateClaimAnswers(req.body);
    if (!isValid) {
      return res.status(400).json({
        message: "Claim verification answers are required",
        errors,
        requiredFields: ["color", "brand", "uniqueIdentifier"],
      });
    }

    const item = await LostFound.findById(itemId)
      .select("+verification")
      .populate("postedBy", "name email");

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (item.status === "claimed") {
      return res.status(409).json({ message: "Item is already claimed" });
    }

    const existingPendingClaim = await LostFoundClaim.findOne({
      itemId,
      claimant,
      status: "pending",
    });

    if (existingPendingClaim) {
      const claim = await populateClaim(
        LostFoundClaim.findById(existingPendingClaim._id),
      );

      return res.status(409).json({
        message: "A pending claim already exists for this item",
        claim,
      });
    }

    const comparison = compareClaimAnswers({ item, answers });
    const claim = await LostFoundClaim.create({
      itemId,
      claimant,
      answers,
      comparison,
      status: "pending",
    });

    const notifications = await notifyLostFoundClaimSubmitted({
      claim,
      item,
      comparison,
      email: req.body.email || req.query.email,
    });
    const populatedClaim = await populateClaim(LostFoundClaim.findById(claim._id));

    res.status(201).json({
      message: "Claim submitted for admin approval",
      claim: populatedClaim,
      notifications,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getClaims = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const claims = await populateClaim(
      LostFoundClaim.find(filter).sort({ createdAt: -1 }),
    );

    res.json({
      count: claims.length,
      claims,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getPendingClaims = async (req, res) => {
  req.query.status = "pending";
  return getClaims(req, res);
};

const reviewClaim = async (req, res) => {
  try {
    const { status, adminNote } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        message: "status must be approved or rejected",
      });
    }

    const claim = await LostFoundClaim.findById(req.params.claimId);
    if (!claim) {
      return res.status(404).json({ message: "Claim not found" });
    }

    if (claim.status !== "pending") {
      return res.status(409).json({
        message: `Claim has already been ${claim.status}`,
      });
    }

    const item = await LostFound.findById(claim.itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (status === "approved" && item.status === "claimed") {
      return res.status(409).json({
        message: "Item is already claimed",
      });
    }

    claim.status = status;
    claim.reviewedBy = req.user?._id || req.body.adminId;
    claim.reviewedAt = new Date();
    claim.adminNote = adminNote;
    await claim.save();

    if (status === "approved") {
      item.status = "claimed";
      item.claimedBy = claim.claimant;
      await item.save();

      await LostFoundClaim.updateMany(
        {
          _id: { $ne: claim._id },
          itemId: claim.itemId,
          status: "pending",
        },
        {
          status: "rejected",
          reviewedBy: claim.reviewedBy,
          reviewedAt: claim.reviewedAt,
          adminNote: "Rejected automatically because another claim was approved.",
        },
      );
    }

    const notification = await notifyLostFoundClaimStatus({
      claim,
      item,
      email: req.body.email || req.query.email,
    });
    const populatedClaim = await populateClaim(LostFoundClaim.findById(claim._id));

    res.json({
      message: `Claim ${status}`,
      claim: populatedClaim,
      item,
      notification,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const claimItem = async (req, res) => {
  req.body = {
    ...req.body,
    itemId: req.params.id,
  };

  return submitClaim(req, res);
};

module.exports = {
  claimItem,
  getClaims,
  getPendingClaims,
  reviewClaim,
  submitClaim,
};
