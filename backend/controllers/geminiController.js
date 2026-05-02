const initGemini = require("../config/gemini");
const {
  DEFAULT_SYSTEM_INSTRUCTION,
} = require("../config/gemini");
const { parseIntent } = require("../utils/intentParser");
const ClassroomBooking = require("../models/ClassroomBooking");
const {
  getAttendance,
  getAvailableRooms,
  getNotices,
} = require("../services/campusActionService");

const gemini = initGemini();

const extractGeminiText = (result) => {
  if (!result) return null;
  if (typeof result === "string") return result;
  if (result.outputText) return result.outputText;
  if (result.text) return result.text;
  if (result.candidates?.[0]?.content?.parts?.[0]?.text)
    return result.candidates[0].content.parts
      .map((part) => part.text)
      .filter(Boolean)
      .join("\n");
  if (result.candidates?.[0]?.content?.[0]?.text)
    return result.candidates[0].content[0].text;
  if (result.choices?.[0]?.message?.content)
    return result.choices[0].message.content;

  return JSON.stringify(result);
};

const runChat = async (message, systemPrompt = DEFAULT_SYSTEM_INSTRUCTION) => {
  try {
    const response = await gemini.textClient.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ]);

    const text =
      extractGeminiText(response) ||
      response?.text ||
      "";
    if (text.trim()) return text.trim();

    return "The model returned an empty reply. Try a shorter question, or check server logs.";
  } catch (error) {
    console.warn("Gemini chat failed:", error.message);
    const msg = error.message || "Unknown error";
    if (msg.includes("GEMINI_API_KEY")) {
      return `${msg} Then restart the backend.`;
    }
    return `AI error: ${msg.slice(0, 400)}`;
  }
};

const askGemini = async (req, res) => {
  const prompt = req.body.prompt || req.body.message;

  if (!prompt) {
    return res.status(400).json({ message: "prompt is required" });
  }

  const reply = await runChat(prompt);
  res.json({ result: reply });
};

const geminiAction = async (req, res) => {
  const message = req.body.message || req.body.prompt;

  if (!message) {
    return res.status(400).json({ message: "message is required" });
  }

  const parsed = parseIntent(message);
  const parameters = {
    ...parsed.params,
    ...(req.body.date ? { date: req.body.date } : {}),
    ...(req.body.time ? { time: req.body.time } : {}),
  };

  try {
    if (parsed.intent === "attendance") {
      const userId = req.user?._id || req.body.userId || req.body.studentId;
      if (!userId) {
        return res.status(400).json({
          type: "attendance",
          parameters,
          error:
            "Sign in first so we can look up your attendance, or ask a general question without the word “attendance”.",
        });
      }
      const data = await getAttendance(userId, parameters);

      return res.json({
        type: "attendance",
        parameters,
        data,
      });
    }

    if (parsed.intent === "booking") {
      const data = await getAvailableRooms(parameters.time, parameters.date);

      return res.json({
        type: "booking",
        parameters,
        data,
      });
    }

    if (parsed.intent === "notice") {
      const data = await getNotices(parameters);

      return res.json({
        type: "notice",
        parameters,
        data,
      });
    }

    const reply = await runChat(message);
    return res.json({
      type: "chat",
      parameters,
      data: { reply },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      type: parsed.type,
      parameters,
      error: error.message,
    });
  }
};

const campusChat = async (req, res) => {
  const message = req.body.message || req.body.prompt;
  if (!message) {
    return res.status(400).json({ message: "message is required" });
  }

  const reply = await runChat(message);
  res.json({ type: "chat", data: { reply }, result: reply });
};

const runPromptController = (systemPrompt, buildPrompt) => async (req, res) => {
  const prompt = buildPrompt(req.body);

  if (!prompt) {
    return res.status(400).json({ message: "prompt input is required" });
  }

  const reply = await runChat(prompt, systemPrompt);
  res.json({ result: reply });
};

const summarizeNotice = runPromptController(
  "You summarize campus notices clearly and concisely.",
  (body) => body.text || body.body || body.notice?.body,
);

const matchLostItem = runPromptController(
  "You compare lost and found item descriptions and explain likely matches.",
  (body) => body.description || body.prompt || JSON.stringify(body.items || body),
);

const suggestRoom = async (req, res) => {
  if (req.body.time || req.body.date) {
    const data = await getAvailableRooms(req.body.time, req.body.date);
    return res.json({ type: "booking", data });
  }

  const reply = await runChat(
    req.body.message || req.body.prompt || "Suggest a suitable classroom.",
    "You suggest campus rooms based on class needs and availability.",
  );
  res.json({ result: reply });
};

const burnoutCheck = runPromptController(
  "You are a supportive campus wellness assistant. Keep advice practical and kind.",
  (body) => body.message || body.prompt || body.text,
);

const generateRoadmap = runPromptController(
  "You create short, actionable learning roadmaps for students.",
  (body) => body.goal || body.prompt || body.message,
);

const runMockInterview = runPromptController(
  "You run mock interviews and ask one focused question at a time.",
  (body) => body.role || body.prompt || body.message,
);

const evaluateAnswer = runPromptController(
  "You evaluate interview answers with concise feedback and next steps.",
  (body) => body.answer || body.prompt || body.message,
);

const classifySOSThreat = runPromptController(
  "Classify campus SOS messages as low, medium, or high risk and explain briefly.",
  (body) => body.message || body.prompt || body.text,
);

const aiPeerMatch = runPromptController(
  "You match students with compatible study peers based on goals and interests.",
  (body) => body.profile || body.prompt || body.message || JSON.stringify(body),
);

/** POST /api/gemini/study-suggestions — auth; uses profile + open bookings. */
const suggestStudySessions = async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Sign in for personalized suggestions." });
  }

  const extraSubjects = Array.isArray(req.body.subjects)
    ? req.body.subjects.filter((s) => typeof s === "string" && s.trim())
    : [];

  const openSessions = await ClassroomBooking.find({
    isPublic: true,
    status: { $in: ["approved", "pending"] },
    $expr: {
      $lt: [
        { $size: { $ifNull: ["$participants", []] } },
        "$maxParticipants",
      ],
    },
  })
    .sort({ date: 1 })
    .limit(15)
    .populate("bookedBy", "name")
    .lean();

  if (!openSessions.length) {
    return res.json({
      suggestion:
        "No open study sessions with free seats right now. Create one from Room Booking — classmates can join you in real time.",
      sessions: [],
    });
  }

  const catalog = openSessions.map(
    (b) =>
      `- ${b.subject || "Study session"} | ${b.room} | ${b.timeslot}${b.date ? ` | ${new Date(b.date).toLocaleDateString()}` : ""} | Host: ${b.bookedBy?.name || "—"} | ${(b.participants || []).length}/${b.maxParticipants} joined${b.description ? ` | Topic: ${b.description}` : ""}`,
  );

  const profileBits = [
    user.department && `Department: ${user.department}.`,
    extraSubjects.length && `Interests: ${extraSubjects.join(", ")}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const prompt = `Student profile: ${profileBits || "General undergraduate."}

Open study sessions:
${catalog.join("\n")}

Choose the single best session for this student (prefer subject/topic match). Answer in 1–2 short, friendly sentences starting with a recommendation like "You might want to join…" and include room and time. If nothing matches well, still name the best option and one reason.`;

  const suggestion = await runChat(
    prompt,
    "You help students find study sessions on campus. Be concise and practical.",
  );

  res.json({ suggestion, sessions: openSessions });
};

module.exports = {
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
};
