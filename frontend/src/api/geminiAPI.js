import axiosInstance from "./axiosInstance";

export const askGemini = (prompt) =>
  axiosInstance.post("/gemini/ask", { prompt });
