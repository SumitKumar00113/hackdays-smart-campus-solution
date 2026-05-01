const initGemini = require("../config/gemini");
const gemini = initGemini();

const askGemini = async (req, res) => {
  const { prompt } = req.body;
  const response = await gemini.predict(prompt);
  res.json({ result: response.text });
};

module.exports = { askGemini };
