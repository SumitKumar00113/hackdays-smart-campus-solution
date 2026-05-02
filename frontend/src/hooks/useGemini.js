import { useState } from "react";
import { performGeminiAction } from "../api/geminiAPI";

const useGemini = () => {
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const queryGemini = async (message, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const result = await performGeminiAction(message, options);
      setResponse(result.data);
      return result.data;
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message;
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { response, loading, error, queryGemini };
};

export default useGemini;
