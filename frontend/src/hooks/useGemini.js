import { useState } from "react";
import { askGemini } from "../api/geminiAPI";

const useGemini = () => {
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const queryGemini = async (prompt) => {
    setLoading(true);
    const result = await askGemini(prompt);
    setResponse(result.data);
    setLoading(false);
  };

  return { response, loading, queryGemini };
};

export default useGemini;
