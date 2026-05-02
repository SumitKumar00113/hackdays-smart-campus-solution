const crypto = require("crypto");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const {
  generateQR,
  verifyAttendanceSessionToken,
} = require("../utils/generateQR");
const { isValidDescriptor, compareDescriptors } = require("../utils/faceMatch");
const { sendEmail } = require("../utils/sendEmail");
const initGemini = require("../config/gemini");
const {
  predictAttendanceRisk,
} = require("../services/attendancePredictionService");
const { notifyAttendanceRisk } = require("../services/notificationService");
const {
  issueRoomSessionCode,
  redeemRoomSessionCode,
} = require("../services/roomSessionCodeService");

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
    {
      student,
      classroom,
      date: attendanceDate,
      status,
      checkInMethod: "manual",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  res.status(201).json(record);
};

const generateQRCode = async (req, res) => {
  const { classroom, durationMinutes = 45 } = req.body;
  if (!classroom?.trim()) {
    return res.status(400).json({ message: "classroom is required" });
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + Number(durationMinutes) * 60 * 1000;

  try {
    const { qrBase64, token, payload } = await generateQR({
      sessionId,
      classroom: classroom.trim(),
      expiresAt,
    });

    res.json({
      qrImage: qrBase64,
      token,
      sessionId,
      classroom: payload.classroom,
      expiresAt: payload.expiresAt,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const verifyQR = async (req, res) => {
  const { qrCode, studentId, token } = req.body;
  const raw = (token || qrCode || "").trim();
  if (!raw || !studentId) {
    return res.status(400).json({
      message: "qrCode or token, and studentId are required",
    });
  }

  let classroom;
  try {
    if (raw.startsWith("QR_CODE_FOR_")) {
      const payload = parseQR(raw);
      if (Date.now() > payload.expiresAt) {
        return res.status(400).json({ message: "QR code has expired" });
      }
      classroom = payload.classroom;
    } else {
      const session = verifyAttendanceSessionToken(raw);
      classroom = session.classroom;
    }
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const { start, end } = normalizeDateRange(new Date());
  const record = await Attendance.findOneAndUpdate(
    {
      student: studentId,
      classroom,
      date: { $gte: start, $lte: end },
    },
    {
      student: studentId,
      classroom,
      date: new Date(),
      status: "present",
      checkInMethod: "qr_face",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  res.json({ message: "Attendance marked present", record });
};

const enrollFace = async (req, res) => {
  const { descriptor } = req.body;
  const userId = req.user._id;

  if (!isValidDescriptor(descriptor)) {
    return res.status(400).json({
      message:
        "descriptor must be an array of 128 numbers (face-api recognition vector)",
    });
  }

  await User.findByIdAndUpdate(userId, {
    faceDescriptor: descriptor,
    faceEnrolledAt: new Date(),
  });

  res.json({ message: "Face enrollment saved", enrolled: true });
};

const getFaceEnrollment = async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "+faceDescriptor +faceEnrolledAt",
  );
  const enrolled = Boolean(user?.faceDescriptor?.length === 128);
  res.json({
    enrolled,
    enrolledAt: user?.faceEnrolledAt || null,
  });
};

const verifyScan = async (req, res) => {
  const { token, faceDescriptor } = req.body;
  const studentId = req.user._id;

  if (!token || typeof token !== "string") {
    return res
      .status(400)
      .json({ message: "token (scanned QR payload) is required" });
  }

  if (!isValidDescriptor(faceDescriptor)) {
    return res.status(400).json({
      message:
        "faceDescriptor must be a 128-number vector from the same model as enrollment",
    });
  }

  let session;
  try {
    session = verifyAttendanceSessionToken(token.trim());
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const user = await User.findById(studentId).select("+faceDescriptor");
  if (!user?.faceDescriptor?.length) {
    return res.status(400).json({
      message: "Enroll your face before using QR check-in.",
    });
  }

  const { distance, match } = compareDescriptors(
    user.faceDescriptor,
    faceDescriptor,
  );

  if (!match) {
    return res.status(403).json({
      message:
        "Face verification failed. Use the same lighting as enrollment and face the camera.",
      distance,
    });
  }

  const { start, end } = normalizeDateRange(new Date());
  const record = await Attendance.findOneAndUpdate(
    {
      student: studentId,
      classroom: session.classroom,
      date: { $gte: start, $lte: end },
    },
    {
      student: studentId,
      classroom: session.classroom,
      date: new Date(),
      status: "present",
      checkInMethod: "qr_face",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  res.json({
    message: "Attendance marked present (QR + face verified)",
    record,
    sessionId: session.sessionId,
    distance,
  });
};

/** POST body: { classroom, durationMinutes } — instructor shows code in the selected room only. */
const issueRoomCode = async (req, res) => {
  try {
    const { classroom, durationMinutes = 45 } = req.body;
    const out = issueRoomSessionCode({
      classroom,
      durationMinutes,
      issuedBy: req.user._id,
    });
    res.json(out);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/** POST body: { code } — student must be in class to see the code; binds to that room. */
const redeemRoomCode = async (req, res) => {
  const studentId = req.user._id;
  const { code } = req.body;

  try {
    const { classroom, sessionId } = redeemRoomSessionCode({
      code,
      studentId,
    });
    const { start, end } = normalizeDateRange(new Date());
    const record = await Attendance.findOneAndUpdate(
      {
        student: studentId,
        classroom,
        date: { $gte: start, $lte: end },
      },
      {
        student: studentId,
        classroom,
        date: new Date(),
        status: "present",
        checkInMethod: "room_code",
        roomSessionId: sessionId,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.json({
      message: `Present — checked in for ${classroom} using the room session code.`,
      record,
      classroom,
      sessionId,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
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

const getAttendancePrediction = async (req, res) => {
  const { totalClasses, attendedClasses, upcomingClasses, threshold } = req.query;

  try {
    const prediction = predictAttendanceRisk({
      totalClasses,
      attendedClasses,
      upcomingClasses,
      threshold,
    });

    if (req.query.explain === "true") {
      try {
        const response = await gemini.textClient.chat([
          {
            role: "system",
            content:
              "You explain attendance risk to students in one concise, supportive paragraph.",
          },
          {
            role: "user",
            content: `Explain this attendance prediction: ${JSON.stringify(prediction)}`,
          },
        ]);

        prediction.aiExplanation = extractGeminiText(response);
      } catch (error) {
        console.warn("Gemini attendance prediction explanation failed:", error.message);
        prediction.aiExplanation = "AI explanation is unavailable right now.";
      }
    }

    const userId = req.user?._id || req.query.userId || req.query.studentId;
    if (prediction.risk && userId) {
      const notification = await notifyAttendanceRisk({
        userId,
        prediction,
        email: req.query.email,
      });
      if (notification) {
        prediction.notification = notification;
      }
    }

    res.json(prediction);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
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
  enrollFace,
  getFaceEnrollment,
  verifyScan,
  issueRoomCode,
  redeemRoomCode,
  saveMoodSnapshot,
  getAIInsights,
  getAttendancePrediction,
  getAttendance,
  exportAttendance,
};
