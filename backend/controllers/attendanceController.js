const crypto = require("crypto");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const generateQR = require("../utils/generateQR");
const sendEmail = require("../utils/sendEmail");
const initGemini = require("../config/gemini");

const gemini = initGemini();

const normalizeDateRange = (date = new Date()) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const parseQR = (qrCode) => {
  const prefix = "QR_CODE_FOR_";
  if (!qrCode?.startsWith(prefix)) {
    throw new Error("Invalid QR format");
  }

  const payload = Buffer.from(qrCode.slice(prefix.length), "base64").toString(
    "utf8",
  );
  return JSON.parse(payload);
};

const extractMood = (response) => {
  if (!response) return "neutral";

  const traverse = (node) => {
    if (typeof node === "string") {
      const lowered = node.toLowerCase();
      if (lowered.includes("happy")) return "happy";
      if (
        lowered.includes("distressed") ||
        lowered.includes("anxious") ||
        lowered.includes("sad")
      )
        return "distressed";
      if (
        lowered.includes("disengaged") ||
        lowered.includes("bored") ||
        lowered.includes("unfocused")
      )
        return "disengaged";
      if (lowered.includes("neutral")) return "neutral";
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        const value = traverse(item);
        if (value) return value;
      }
    }
    if (typeof node === "object" && node !== null) {
      if (node.mood) return traverse(node.mood);
      if (node.label) return traverse(node.label);
      for (const key of Object.keys(node)) {
        const value = traverse(node[key]);
        if (value) return value;
      }
    }
    return null;
  };

  return traverse(response) || "neutral";
};

const formatCSV = (rows) => {
  const header = [
    "Student Name",
    "Email",
    "Classroom",
    "Date",
    "Status",
    "Mood",
  ].join(",");
  const lines = rows.map((row) =>
    [
      `"${row.student.name}"`,
      `"${row.student.email}"`,
      `"${row.classroom}"`,
      `"${row.date.toISOString()}"`,
      `"${row.status}"`,
      `"${row.currentMood || ""}"`,
    ].join(","),
  );
  return [header, ...lines].join("\n");
};

const markAttendance = async (req, res) => {
  const { student, classroom, date, status } = req.body;
  if (!student || !classroom || !status) {
    return res
      .status(400)
      .json({ message: "student, classroom, and status are required" });
  }

  const attendanceDate = date ? new Date(date) : new Date();
  const { start, end } = normalizeDateRange(attendanceDate);

  const record = await Attendance.findOneAndUpdate(
    { student, classroom, date: { $gte: start, $lte: end } },
    { student, classroom, date: attendanceDate, status },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  res.status(201).json(record);
};

const generateQRCode = async (req, res) => {
  const { classroom, durationMinutes = 15 } = req.body;
  if (!classroom) {
    return res.status(400).json({ message: "classroom is required" });
  }

  const payload = {
    sessionId: crypto.randomUUID(),
    classroom,
    expiresAt: Date.now() + durationMinutes * 60 * 1000,
  };
  const qrCode = await generateQR(payload);

  res.json({ qrCode, ...payload });
};

const verifyQR = async (req, res) => {
  const { qrCode, studentId } = req.body;
  if (!qrCode || !studentId) {
    return res
      .status(400)
      .json({ message: "qrCode and studentId are required" });
  }

  let payload;
  try {
    payload = parseQR(qrCode);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  if (Date.now() > payload.expiresAt) {
    return res.status(400).json({ message: "QR code has expired" });
  }

  const { start, end } = normalizeDateRange(new Date());
  const record = await Attendance.findOneAndUpdate(
    {
      student: studentId,
      classroom: payload.classroom,
      date: { $gte: start, $lte: end },
    },
    {
      student: studentId,
      classroom: payload.classroom,
      date: new Date(),
      status: "present",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  res.json({ message: "Attendance marked present", record });
};

const saveMoodSnapshot = async (req, res) => {
  const { studentId, classroom, imageBase64 } = req.body;
  if (!studentId || !imageBase64) {
    return res
      .status(400)
      .json({ message: "studentId and imageBase64 are required" });
  }

  const user = await User.findById(studentId);
  if (!user) {
    return res.status(404).json({ message: "Student not found" });
  }

  let visionResult;
  try {
    visionResult = await gemini.visionClient.detectMoodFromImage(imageBase64);
  } catch (error) {
    console.warn("Gemini vision error:", error.message);
    return res.status(500).json({ message: "Failed to analyze mood" });
  }

  const mood = extractMood(visionResult);
  const recordDate = new Date();
  const { start, end } = normalizeDateRange(recordDate);

  const record = await Attendance.findOneAndUpdate(
    {
      student: studentId,
      classroom: classroom || "general",
      date: { $gte: start, $lte: end },
    },
    {
      $set: {
        currentMood: mood,
        classroom: classroom || "general",
        date: recordDate,
      },
      $push: { moodSnapshots: { mood, timestamp: new Date() } },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (mood === "distressed") {
    const teacherEmail = process.env.TEACHER_EMAIL;
    if (teacherEmail) {
      try {
        await sendEmail({
          to: teacherEmail,
          subject: `Distressed mood alert for ${user.name}`,
          text: `Student ${user.name} appears distressed at ${new Date().toISOString()} in classroom ${record.classroom}. Mood analysis indicates: ${mood}.`,
          html: `<p>Student <strong>${user.name}</strong> appears distressed at ${new Date().toISOString()} in classroom <strong>${record.classroom}</strong>.</p><p>Detected mood: <strong>${mood}</strong>.</p>`,
        });
      } catch (emailError) {
        console.warn("Teacher alert email failed:", emailError.message);
      }
    }
  }

  res.json({ message: "Mood snapshot saved", mood, record });
};

const getAIInsights = async (req, res) => {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const records = await Attendance.find({ date: { $gte: since } }).populate(
    "student",
    "name email",
  );

  const classroomStats = records.reduce((stats, record) => {
    const key = record.classroom;
    if (!stats[key]) {
      stats[key] = { total: 0, present: 0, absent: 0, late: 0 };
    }
    stats[key].total += 1;
    stats[key][record.status] += 1;
    return stats;
  }, {});

  const flagged = Object.entries(classroomStats).map(([classroom, stat]) => {
    const attendancePercent = stat.total
      ? (stat.present / stat.total) * 100
      : 0;
    return {
      classroom,
      attendancePercent: Number(attendancePercent.toFixed(1)),
      reason:
        attendancePercent < 75 ? "Below 75% attendance" : "Good attendance",
    };
  });

  const belowThreshold = flagged.filter((item) => item.attendancePercent < 75);
  const prompt = `Analyze the following classroom attendance rates for the last 30 days and provide study tips for any classes below 75% attendance:\n${JSON.stringify(belowThreshold, null, 2)}`;

  let aiResponse;
  try {
    const analysis = await gemini.textClient.analyze(prompt);
    aiResponse =
      analysis?.text || analysis?.outputText || JSON.stringify(analysis);
  } catch (error) {
    console.warn("Gemini analysis failed:", error.message);
    aiResponse = "Unable to generate AI insights at this time.";
  }

  res.json({
    summary: flagged,
    insights: belowThreshold,
    aiTips: aiResponse,
  });
};

const getAttendance = async (req, res) => {
  const records = await Attendance.find().populate("student", "name email");
  res.json(records);
};

const exportAttendance = async (req, res) => {
  const { classroom } = req.query;
  const filter = classroom ? { classroom } : {};
  const records = await Attendance.find(filter).populate(
    "student",
    "name email",
  );
  const csv = formatCSV(records);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="attendance_${classroom || "all"}.csv"`,
  );
  res.send(csv);
};

module.exports = {
  markAttendance,
  generateQRCode,
  verifyQR,
  saveMoodSnapshot,
  getAIInsights,
  getAttendance,
  exportAttendance,
};
