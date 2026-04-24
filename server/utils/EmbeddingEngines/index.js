const { GeminiEmbedder } = require("./gemini");
const { SystemSettings, SETTINGS } = require("../../models/systemSettings");

const pick = (dbValue, envValue, fallback = null) =>
  dbValue ?? envValue ?? fallback;

// Async factory — mirrors getProvider() for LLMs.
// Priority: DB > .env > hardcoded default.
// API keys for embedders are reused from the corresponding LLM provider
// (Gemini chat + Gemini embeddings use the same GEMINI_API_KEY).
const getEmbedder = async () => {
  const [providerName, modelOverride, geminiKey] = await Promise.all([
    SystemSettings.get(SETTINGS.EMBEDDING_PROVIDER),
    SystemSettings.get(SETTINGS.EMBEDDING_MODEL),
    SystemSettings.getSecret(SETTINGS.GEMINI_API_KEY),
  ]);

  const name = (pick(providerName, process.env.EMBEDDING_PROVIDER, "gemini"))
    .toLowerCase();

  switch (name) {
    case "gemini":
      return new GeminiEmbedder({
        apiKey: pick(geminiKey, process.env.GEMINI_API_KEY),
        model: pick(modelOverride, process.env.GEMINI_EMBEDDING_MODEL),
      });
    default:
      throw new Error(`Unsupported EMBEDDING_PROVIDER: ${name}`);
  }
};

module.exports = { getEmbedder };
