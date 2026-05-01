const express = require("express");
const router = express.Router();
const {
  campusChat,
  summarizeNotice,
  matchLostItem,
  suggestRoom,
  burnoutCheck,
  generateRoadmap,
  runMockInterview,
  evaluateAnswer,
  classifySOSThreat,
  aiPeerMatch,
} = require("../controllers/geminiController");

router.post("/campus-chat", campusChat);
router.post("/summarize-notice", summarizeNotice);
router.post("/match-lost-item", matchLostItem);
router.post("/suggest-room", suggestRoom);
router.post("/burnout-check", burnoutCheck);
router.post("/generate-roadmap", generateRoadmap);
router.post("/mock-interview", runMockInterview);
router.post("/evaluate-answer", evaluateAnswer);
router.post("/classify-sos-threat", classifySOSThreat);
router.post("/peer-match", aiPeerMatch);

module.exports = router;
