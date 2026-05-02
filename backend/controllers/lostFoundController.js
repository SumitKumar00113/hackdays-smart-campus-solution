const LostFound = require("../models/LostFound");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const initGemini = require("../config/gemini");
const { sendEmail } = require("../utils/sendEmail");
const {
  findNearbyItems,
  matchItems,
} = require("../services/lostFoundService");
const {
  normalizeVerificationInput,
} = require("../services/lostFoundClaimService");

const gemini = initGemini();

const buildDataUri = (file) =>
  `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

const extractGeminiText = (response) => {
  if (!response) return "";
  if (typeof response === "string") return response;
  if (response.text) return response.text;
  if (response.outputText) return response.outputText;
  if (response.candidates?.[0]?.content?.parts?.[0]?.text)
    return response.candidates[0].content.parts
      .map((part) => part.text)
      .filter(Boolean)
      .join("\n");
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

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const normalizeLocationPayload = (body) => {
  const coordinates =
    typeof body.coordinates === "string"
      ? safeJsonParse(body.coordinates)
      : body.coordinates;
  const lat =
    coordinates?.lat ??
    coordinates?.latitude ??
    body.lat ??
    body.latitude;
  const lng =
    coordinates?.lng ??
    coordinates?.lon ??
    coordinates?.longitude ??
    body.lng ??
    body.lon ??
    body.longitude;

  if (lat === undefined || lng === undefined) {
    return body;
  }

  return {
    ...body,
    coordinates: {
      lat: Number(lat),
      lng: Number(lng),
    },
  };
};

const createLostFound = async (req, res) => {
  let imageUrl = req.body.imageUrl || null;
  if (req.file) {
    try {
      imageUrl = await uploadPhotoToCloudinary(req.file);
    } catch (uploadErr) {
      console.warn("Lost & found image upload skipped:", uploadErr.message);
      imageUrl = null;
    }
  }
  const postedBy = req.user?._id || req.body.postedBy;
  const verification = normalizeVerificationInput(req.body);
  const item = await LostFound.create({
    ...normalizeLocationPayload(req.body),
    postedBy,
    imageUrl,
    verification,
  });

  const safeItem = item.toObject();
  delete safeItem.verification;

  res.status(201).json(safeItem);

  void runGeminiMatchBackground(item);
};

const matchLostFoundItems = async (req, res) => {
  try {
    const newItem = normalizeLocationPayload(req.body);
    if (req.body.id && !newItem._id) {
      newItem._id = req.body.id;
    }
    const matches = await matchItems(newItem);
    res.json({ matches });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getNearbyLostFoundItems = async (req, res) => {
  try {
    const nearby = await findNearbyItems({
      itemId: req.query.itemId,
      lat: req.query.lat,
      lng: req.query.lng,
      radiusMeters: req.query.radiusMeters || req.query.radius || 500,
      status: req.query.status,
      limit: req.query.limit,
    });

    res.json(nearby);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const runGeminiMatchBackground = async (item) => {
  try {
    const matches = await matchItems(item);
    const candidates = matches.slice(0, 10);

    if (!candidates.length) {
      return;
    }

    for (const match of candidates) {
      const candidate = match.item;
      const prompt = `You are a campus lost-and-found match assistant. Compare a newly posted item with an existing candidate item. Respond only with valid JSON using keys matchScore (number 0-100) and matchReason (string).\n\nNew item:\nTitle: ${item.title}\nDescription: ${item.description}\nLocation: ${item.locationName || item.location || "N/A"}\nStatus: ${item.status}\nImageUrl: ${item.imageUrl || "N/A"}\n\nCandidate item:\nTitle: ${candidate.title}\nDescription: ${candidate.description}\nLocation: ${candidate.locationName || candidate.location || "N/A"}\nStatus: ${candidate.status}\nImageUrl: ${candidate.imageUrl || "N/A"}\nDistanceMeters: ${match.distanceMeters ?? "N/A"}\nNearbyWithin500m: ${match.nearby ? "yes" : "no"}\nRuleBasedScore: ${match.score}`;

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

      if (match.nearby) {
        matchResult.matchScore = Math.min(matchResult.matchScore + 10, 100);
        matchResult.matchReason = `${matchResult.matchReason} Nearby location increased confidence.`;
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

const searchItems = async (req, res) => {
  const query = req.query.q || "";
  const results = await LostFound.find({
    $or: [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
      { location: { $regex: query, $options: "i" } },
      { locationName: { $regex: query, $options: "i" } },
    ],
  })
    .sort({ createdAt: -1 })
    .populate("postedBy", "name")
    .select("-verification");
  res.json(results);
};

const listLostFoundItems = async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 60, 100);
  const items = await LostFound.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("postedBy", "name")
    .select("-verification");
  res.json(items);
};

module.exports = {
  createLostFound,
  searchItems,
  matchLostFoundItems,
  getNearbyLostFoundItems,
  listLostFoundItems,
};
