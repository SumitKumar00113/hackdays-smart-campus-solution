const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_BASE_URL =
  process.env.GEMINI_API_BASE_URL || "https://api.gemini.google.com";
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-pro";
const VISION_MODEL = process.env.GEMINI_VISION_MODEL || "gemini-pro-vision";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const retryOnce = async (fn) => {
  try {
    return await fn();
  } catch (error) {
    console.warn("Gemini request failed, retrying once:", error.message);
    await wait(1000);
    return await fn();
  }
};

const geminiRequest = async (path, payload) => {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required to call Gemini APIs");
  }

  const response = await fetch(`${GEMINI_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GEMINI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}: ${body}`);
  }

  return JSON.parse(body);
};

const textClient = {
  chat: async (messages) =>
    retryOnce(() =>
      geminiRequest(`/v1/models/${TEXT_MODEL}:chat`, {
        messages,
      }),
    ),

  summarize: async (text) =>
    retryOnce(() =>
      geminiRequest(`/v1/models/${TEXT_MODEL}:generateText`, {
        prompt: `Summarize the following text:\n\n${text}`,
      }),
    ),

  analyze: async (text) =>
    retryOnce(() =>
      geminiRequest(`/v1/models/${TEXT_MODEL}:generateText`, {
        prompt: `Analyze the following text and return key points and insights:\n\n${text}`,
      }),
    ),
};

const visionClient = {
  detectMoodFromImage: async (imageBase64) =>
    retryOnce(() =>
      geminiRequest(`/v1/models/${VISION_MODEL}:annotate`, {
        image: {
          content: imageBase64,
        },
        features: ["MOOD_DETECTION"],
      }),
    ),
};

const initGemini = () => ({
  textClient,
  visionClient,
});

module.exports = initGemini;
