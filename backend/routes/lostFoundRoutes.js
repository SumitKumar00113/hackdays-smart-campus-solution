const express = require("express");
const router = express.Router();
const upload = require("../middleware/uploadMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const {
  createLostFound,
  searchItems,
  matchLostFoundItems,
  getNearbyLostFoundItems,
  listLostFoundItems,
} = require("../controllers/lostFoundController");
const {
  claimItem,
  getClaims,
  getPendingClaims,
  reviewClaim,
  submitClaim,
} = require("../controllers/lostFoundClaimController");

router.get("/", listLostFoundItems);
router.post("/", upload.single("image"), createLostFound);
router.post("/claim", submitClaim);
router.get(
  "/claims/pending",
  authMiddleware,
  roleMiddleware(["admin"]),
  getPendingClaims,
);
router.get("/claims", authMiddleware, roleMiddleware(["admin"]), getClaims);
router.patch(
  "/claims/:claimId/status",
  authMiddleware,
  roleMiddleware(["admin"]),
  reviewClaim,
);
router.post("/match", matchLostFoundItems);
router.post("/:id/claim", claimItem);
router.get("/nearby", getNearbyLostFoundItems);
router.get("/search", searchItems);

module.exports = router;
