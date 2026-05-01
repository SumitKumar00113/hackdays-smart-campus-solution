const express = require("express");
const router = express.Router();
const {
  createNotice,
  updateNotice,
  deleteNotice,
  getNotices,
} = require("../controllers/noticeController");

router.post("/", createNotice);
router.put("/:id", updateNotice);
router.delete("/:id", deleteNotice);
router.get("/", getNotices);

module.exports = router;
