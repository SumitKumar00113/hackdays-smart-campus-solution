const LostFound = require("../models/LostFound");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const initGemini = require("../config/gemini");
const sendEmail = require("../utils/sendEmail");

const gemini = initGemini();

const buildDataUri = (file) =>
  `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

const extractGeminiText = (response) => {
  if (!response) return "";
  if (typeof response === "string") return response;
  if (response.text) return response.text;
  if (response.outputText) return response.outputText;
  if (response.message?.content) return response.message.content;
  if (response.choices?.[0]?.message?.content)
    return response.choices[0].message.content;
  return JSON.stringify(response);
};

const parseGeminiJson = (text) => {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
};

const uploadPhotoToCloudinary = async (file) => {
  if (!file) return null;
  const uploadResponse = await cloudinary.uploader.upload(buildDataUri(file), {
    folder: "campus/lostfound",
    resource_type: "image",
  });
  return uploadResponse.secure_url || uploadResponse.url;
};

const createLostFound = async (req, res) => {
  const imageUrl = req.file
    ? await uploadPhotoToCloudinary(req.file)
    : req.body.imageUrl;
  const postedBy = req.user?._id || req.body.postedBy;
  const item = await LostFound.create({
    ...req.body,
    postedBy,
    imageUrl,
  });

  res.status(201).json(item);

  void runGeminiMatchBackground(item);
};

const runGeminiMatchBackground = async (item) => {
  try {
    const oppositeStatus = item.status === "lost" ? "found" : "lost";
    const candidates = await LostFound.find({
      status: oppositeStatus,
      _id: { $ne: item._id },
      location: { $regex: item.location || "", $options: "i" },
    })
      .limit(10)
      .populate("postedBy", "name email");

    if (!candidates.length) {
      return;
    }

    for (const candidate of candidates) {
      const prompt = `You are a campus lost-and-found match assistant. Compare a newly posted item with an existing candidate item. Respond only with valid JSON using keys matchScore (number 0-100) and matchReason (string).\n\nNew item:\nTitle: ${item.title}\nDescription: ${item.description}\nLocation: ${item.location || "N/A"}\nStatus: ${item.status}\nImageUrl: ${item.imageUrl || "N/A"}\n\nCandidate item:\nTitle: ${candidate.title}\nDescription: ${candidate.description}\nLocation: ${candidate.location || "N/A"}\nStatus: ${candidate.status}\nImageUrl: ${candidate.imageUrl || "N/A"}`;

      const response = await gemini.textClient.chat([
        {
          role: "system",
          content:
            "You are a match scoring assistant for campus lost and found.",
        },
        { role: "user", content: prompt },
      ]);

      const text = extractGeminiText(response);
      const matchResult = parseGeminiJson(text);
      if (!matchResult || typeof matchResult.matchScore !== "number") {
        continue;
      }

      const threshold = 80;
      if (matchResult.matchScore > threshold) {
        await notifyUsersOfMatch(item, candidate, matchResult);
        break;
      }
    }
  } catch (error) {
    console.warn("Gemini lost/found background match failed:", error.message);
  }
};

const notifyUsersOfMatch = async (item, candidate, matchResult) => {
  const poster = await User.findById(item.postedBy);
  const candidatePoster = await User.findById(candidate.postedBy);

  if (!poster || !candidatePoster || !poster.email || !candidatePoster.email) {
    return;
  }

  const subject = "Smart Campus Lost & Found Match Alert";
  const bodyForPoster = `Hello ${poster.name || "Campus user"},\n\nWe found a strong match (${matchResult.matchScore}%) between your posted item \"${item.title}\" and another lost/found entry.\n\nMatch reason: ${matchResult.matchReason}\n\nPlease review the candidate item and follow up through the app.`;
  const bodyForCandidate = `Hello ${candidatePoster.name || "Campus user"},\n\nA strong match (${matchResult.matchScore}%) was found between your posted item \"${candidate.title}\" and a newly submitted lost/found entry.\n\nMatch reason: ${matchResult.matchReason}\n\nPlease review the match and confirm in the app.`;

  try {
    await Promise.all([
      sendEmail({ to: poster.email, subject, text: bodyForPoster }),
      sendEmail({ to: candidatePoster.email, subject, text: bodyForCandidate }),
    ]);
  } catch (error) {
    console.warn(
      "Failed to send lost/found match notifications:",
      error.message,
    );
  }
};

const claimItem = async (req, res) => {
  const item = await LostFound.findById(req.params.id).populate(
    "postedBy",
    "name email",
  );
  if (!item) {
    return res.status(404).json({ message: "Item not found" });
  }

  item.status = "claimed";
  item.claimedBy = req.body.userId || req.user?._id;
  await item.save();

  if (item.postedBy?.email) {
    await sendEmail({
      to: item.postedBy.email,
      subject: "Thank you for helping with a lost and found item",
      text: `Hello ${item.postedBy.name || "Campus user"},\n\nThank you for reporting this item. It has been marked resolved and the claim process completed successfully. Your help keeps campus property safe.`,
    });
  }

  res.json(item);
};

const searchItems = async (req, res) => {
  const query = req.query.q || "";
  const results = await LostFound.find({
    $or: [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
      { location: { $regex: query, $options: "i" } },
    ],
  }).sort({ createdAt: -1 });
  res.json(results);
};

module.exports = { createLostFound, claimItem, searchItems };
