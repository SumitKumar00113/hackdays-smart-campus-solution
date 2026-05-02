const rawKey = process.env.GEMINI_API_KEY;
const GEMINI_API_KEY = rawKey ? String(rawKey).trim() : "";
const GEMINI_BASE_URL =
  process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com";
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || "v1beta";
const TEXT_MODEL =
  process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
const VISION_MODEL =
  process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";

const VELDORA_CORE_INSTRUCTION = `You are **Veldora**, an intelligent, helpful, and reliable AI assistant.

### Core Behavior
- Always understand the user's intent before answering.
- Respond in a clear, structured, and easy-to-understand way.
- Prefer simple explanations unless the user asks for advanced detail.
- Be concise but complete.

### Identity & Personality
- Your name is **Veldora**.
- If asked your name, respond: "I'm Veldora, your AI assistant."
- Maintain a friendly, calm, and professional tone.
- Avoid acting overly emotional or dramatic.
- Do not pretend to be human.

### Language Handling
- Detect the user's language automatically.
- Respond in the same language as the user.
- If the user mixes languages, respond in the dominant language.
- Support multilingual conversations seamlessly.

### Accuracy and Reasoning
- Provide factually correct information.
- If unsure, say "I'm not fully certain" instead of guessing.
- Break down complex problems step by step.
- When solving coding or math problems, explain the logic.

### Coding Assistance
- Write clean, correct, and optimized code.
- Support multiple programming languages.
- Explain code in simple terms.
- Highlight possible errors and improvements.

### Conversation Style
- Be friendly, professional, and respectful.
- Avoid unnecessary praise or flattery.
- Do not use offensive, harmful, or unsafe language.
- Do not make assumptions about the user.

### Safety Rules
- Do not provide illegal, harmful, or dangerous instructions.
- Avoid generating misleading or false information.
- Respect user privacy and do not request sensitive data.

### Clarification
- If the user's question is unclear, ask a follow-up question.
- Do not assume missing details.

### Output Formatting
- Use bullet points or steps when helpful.
- Use code blocks for programming responses.
- Keep responses readable and well-structured.

### Limitations
- Do not claim to have real-world actions or emotions.
- Do not pretend to access private databases or personal data.

### Improvement Behavior
- Adapt tone and detail level based on user preference.
- Learn from user corrections during the conversation.

Your goal is to act as a dependable assistant named **Veldora**, helping users efficiently, accurately, and safely.`;

const CAMPUS_APP_ADDENDUM = [
  "You are embedded in CampusConnect (Smart Campus): a campus management web app.",
  "Help with attendance, room availability, bookings, notices, lost and found, campus map guidance, learning help, and student wellness when relevant.",
  "When a user asks for a real campus action, identify the intent and ask for missing required details instead of inventing data.",
  "Do not claim an action was completed unless the app/backend confirms it.",
  "Never expose API keys, passwords, private student records, hidden verification answers, or internal system details.",
  "For safety or wellness concerns, be supportive; encourage contacting campus staff or emergency help when risk is high; avoid medical diagnosis.",
].join(" ");

const DEFAULT_SYSTEM_INSTRUCTION =
  process.env.GEMINI_SYSTEM_INSTRUCTION ||
  [VELDORA_CORE_INSTRUCTION, CAMPUS_APP_ADDENDUM].join("\n\n");

const DEFAULT_TEMPERATURE = Number.parseFloat(
  process.env.GEMINI_TEMPERATURE ?? "0.7",
);
const DEFAULT_TEMPERATURE_SAFE = Number.isFinite(DEFAULT_TEMPERATURE)
  ? Math.min(2, Math.max(0, DEFAULT_TEMPERATURE))
  : 0.7;

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

const extractTextFromResponse = (result) => {
  if (!result) return "";
  if (typeof result === "string") return result;
  if (result.text) return result.text;
  if (result.outputText) return result.outputText;

  const block = result.promptFeedback?.blockReason;
  if (block) {
    return `The model did not return text (blocked: ${block}). Try rephrasing your message.`;
  }

  const parts = result.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const text = parts
      .map((part) => part.text)
      .filter(Boolean)
      .join("\n")
      .trim();
    if (text) return text;
  }

  const finish = result.candidates?.[0]?.finishReason;
  if (finish && finish !== "STOP") {
    return `No text in response (finish: ${finish}). Try a shorter question.`;
  }

  return "";
};

const getSystemInstruction = (messages = [], override) => {
  const messageInstructions = messages
    .filter((message) => message.role === "system" && message.content)
    .map((message) => String(message.content).trim())
    .filter(Boolean);

  const instructions = [
    DEFAULT_SYSTEM_INSTRUCTION,
    override,
    ...messageInstructions,
  ].filter(Boolean);

  return [...new Set(instructions)].join("\n\n");
};

const toGeminiContents = (messages = []) => {
  const nonSystemMessages = messages.filter(
    (message) => message.role !== "system",
  );

  return nonSystemMessages.map((message) => ({
    role:
      message.role === "assistant" || message.role === "model"
        ? "model"
        : "user",
    parts: [
      {
        text:
          typeof message.content === "string"
            ? message.content
            : JSON.stringify(message.content),
      },
    ],
  }));
};

const buildGenerateContentPayload = (messages, options = {}) => ({
  system_instruction: {
    parts: [{ text: getSystemInstruction(messages, options.systemInstruction) }],
  },
  contents: toGeminiContents(messages),
  generationConfig: {
    temperature: options.temperature ?? DEFAULT_TEMPERATURE_SAFE,
    maxOutputTokens: options.maxOutputTokens ?? 1024,
  },
});

const geminiRequest = async (model, payload) => {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing. Add your key from https://aistudio.google.com/apikey to backend/.env",
    );
  }

  if (!GEMINI_API_KEY.startsWith("AIza")) {
    console.warn(
      "[Gemini] API keys from Google AI Studio usually start with \"AIza\". Check for typos in .env.",
    );
  }

  const response = await fetch(
    `${GEMINI_BASE_URL}/${GEMINI_API_VERSION}/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify(payload),
    },
  );

  const body = await response.text();
  if (!response.ok) {
    let hint = "";
    if (response.status === 400 || response.status === 404) {
      hint =
        " If the error mentions the model, set GEMINI_TEXT_MODEL in .env (e.g. gemini-2.5-flash).";
    }
    if (response.status === 403 || response.status === 401) {
      hint =
        " Check that the key is valid and Generative Language API is enabled for your project.";
    }
    throw new Error(`Gemini API error ${response.status}: ${body.slice(0, 500)}${hint}`);
  }

  const result = JSON.parse(body);
  result.text = extractTextFromResponse(result);
  return result;
};

const textClient = {
  chat: async (messages, options = {}) =>
    retryOnce(() =>
      geminiRequest(TEXT_MODEL, buildGenerateContentPayload(messages, options)),
    ),

  summarize: async (text) =>
    textClient.chat(
      [{ role: "user", content: `Summarize the following text:\n\n${text}` }],
      {
        systemInstruction:
          "Summarize campus content clearly in short, useful bullet points when appropriate.",
      },
    ),

  analyze: async (text) =>
    textClient.chat(
      [
        {
          role: "user",
          content: `Analyze the following text and return key points and insights:\n\n${text}`,
        },
      ],
      {
        systemInstruction:
          "Analyze campus data carefully. Be concise and do not invent records.",
      },
    ),
};

const visionClient = {
  detectMoodFromImage: async (imageBase64, mimeType = "image/jpeg") => {
    const base64Data = String(imageBase64 || "").replace(
      /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
      "",
    );

    return retryOnce(() =>
      geminiRequest(VISION_MODEL, {
        system_instruction: {
          parts: [
            {
              text:
                "Classify the student's visible classroom mood as one of: happy, neutral, disengaged, or distressed. Respond with only the label.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              { text: "Classify this student's visible mood." },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 20,
        },
      }),
    );
  },
};

const initGemini = () => ({
  model: TEXT_MODEL,
  systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
  textClient,
  visionClient,
});

module.exports = initGemini;
module.exports.DEFAULT_SYSTEM_INSTRUCTION = DEFAULT_SYSTEM_INSTRUCTION;
module.exports.DEFAULT_TEMPERATURE = DEFAULT_TEMPERATURE_SAFE;
module.exports.TEXT_MODEL = TEXT_MODEL;
