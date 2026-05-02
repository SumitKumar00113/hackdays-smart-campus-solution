const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const sendEmail = require("../utils/sendEmail");
const initGemini = require("../config/gemini");

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

const buildWelcomeMessage = async ({ name, role, department }) => {
  const prompt = `Generate a warm welcome email for a new ${role} named ${name} joining the ${department || "campus"} department. Keep the tone friendly and mention helpful next steps for getting started.`;
  const response = await gemini.textClient.chat([
    {
      role: "system",
      content: "You are a friendly campus onboarding assistant.",
    },
    { role: "user", content: prompt },
  ]);
  return (
    extractGeminiText(response) ||
    `Welcome to Smart Campus, ${name}! We're excited to have you.`
  );
};

const buildGettingStartedTip = async ({ name, role, department }) => {
  const prompt = `Create a short personalized getting started tip for ${name}, a new ${role} in the ${department || "campus"} department. Keep it actionable and friendly.`;
  const response = await gemini.textClient.chat([
    { role: "system", content: "You are a helpful campus guide." },
    { role: "user", content: prompt },
  ]);
  return (
    extractGeminiText(response) ||
    "Welcome! Explore your dashboard and start by checking your campus announcements."
  );
};

const registerUser = async (req, res) => {
  const { name, email, password, role, department } = req.body;
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return res.status(400).json({ message: "Email already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role,
    department,
  });

  if (role === "student") {
    try {
      const welcomeText = await buildWelcomeMessage({ name, role, department });
      await sendEmail({
        to: email,
        subject: "Welcome to Smart Campus!",
        text: welcomeText,
        html: `<p>${welcomeText.replace(/\n/g, "<br/>")}</p>`,
      });
    } catch (emailError) {
      console.warn("Welcome email failed:", emailError.message);
    }
  }

  res.status(201).json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    token: generateToken(user._id),
  });
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (user && (await bcrypt.compare(password, user.password))) {
    const now = new Date();
    const firstLogin = !user.lastLogin;
    let gettingStartedTip = null;

    if (firstLogin) {
      try {
        gettingStartedTip = await buildGettingStartedTip({
          name: user.name,
          role: user.role,
          department: user.department,
        });
      } catch (geminiError) {
        console.warn("Gemini tip generation failed:", geminiError.message);
      }
    }

    user.lastLogin = now;
    if (firstLogin) user.isFirstLogin = false;
    await user.save();

    console.log(`User login recorded: ${email} at ${now.toISOString()}`);

    return res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      token: generateToken(user._id),
      loginTime: now,
      gettingStartedTip,
    });
  }

  res.status(401).json({ message: "Invalid credentials" });
};

const logoutUser = async (req, res) => {
  res.json({ message: "Logout successful" });
};

const normalizeStringArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v || "").trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
};

const toPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department || "",
  semester: user.semester || "",
  strongSubjects: Array.isArray(user.strongSubjects) ? user.strongSubjects : [],
  improvementSubjects: Array.isArray(user.improvementSubjects)
    ? user.improvementSubjects
    : [],
});

const getProfile = async (req, res) => {
  const u = req.user;
  res.json({
    ...toPublicUser(u),
    lastLogin: u.lastLogin || null,
    memberSince: u.createdAt || null,
  });
};

const updateProfile = async (req, res) => {
  const {
    name,
    department,
    semester,
    strongSubjects,
    improvementSubjects,
    currentPassword,
    newPassword,
  } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (name !== undefined) {
    const next = String(name).trim();
    if (!next) {
      return res.status(400).json({ message: "Name cannot be empty." });
    }
    user.name = next;
  }

  if (department !== undefined) {
    user.department = String(department).trim() || undefined;
  }

  if (semester !== undefined) {
    user.semester = String(semester).trim() || undefined;
  }

  if (strongSubjects !== undefined) {
    user.strongSubjects = normalizeStringArray(strongSubjects);
  }

  if (improvementSubjects !== undefined) {
    user.improvementSubjects = normalizeStringArray(improvementSubjects);
  }

  if (newPassword) {
    if (!currentPassword) {
      return res.status(400).json({
        message: "Enter your current password to set a new one.",
      });
    }
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      return res.status(400).json({ message: "Current password is incorrect." });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters.",
      });
    }
    user.password = await bcrypt.hash(String(newPassword), 10);
  }

  await user.save();

  res.json({
    ...toPublicUser(user),
    lastLogin: user.lastLogin || null,
    memberSince: user.createdAt || null,
  });
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getProfile,
  updateProfile,
};
