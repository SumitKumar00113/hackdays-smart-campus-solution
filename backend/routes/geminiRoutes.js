const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  askGemini,
  geminiAction,
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
  suggestStudySessions,
} = require("../controllers/geminiController");

router.post("/study-suggestions", authMiddleware, suggestStudySessions);
router.post("/ask", askGemini);
router.post("/action", geminiAction);
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
