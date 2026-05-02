import axiosInstance from "./axiosInstance";

export const askGemini = (prompt) =>
  axiosInstance.post("/gemini/ask", { prompt });

export const performGeminiAction = (message, options = {}) =>
  axiosInstance.post("/gemini/action", { message, ...options });

/** Auth required — uses server user profile + open public bookings */
export const fetchStudySuggestions = (payload = {}) =>
  axiosInstance.post("/gemini/study-suggestions", payload);
