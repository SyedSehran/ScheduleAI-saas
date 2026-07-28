const axios = require("axios");

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "neural-chat";

async function callOllama(prompt, systemPrompt = "") {
  try {
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    
    const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: fullPrompt,
      stream: false,
      temperature: 0,
    }, {
      timeout: 60000, // 60 second timeout for large models
    });

    return response.data.response || "";
  } catch (error) {
    console.error("Ollama API error:", error.message);
    throw new Error(`Ollama request failed: ${error.message}`);
  }
}

async function checkOllamaStatus() {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 5000,
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

module.exports = {
  callOllama,
  checkOllamaStatus,
  OLLAMA_BASE_URL,
  OLLAMA_MODEL,
};
