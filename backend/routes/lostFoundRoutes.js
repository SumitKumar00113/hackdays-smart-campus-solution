const express = require("express");
const router = express.Router();
const upload = require("../middleware/uploadMiddleware");
const {
  createLostFound,
  claimItem,
  searchItems,
} = require("../controllers/lostFoundController");

router.post("/", upload.single("image"), createLostFound);
router.post("/:id/claim", claimItem);
router.get("/search", searchItems);

module.exports = router;
