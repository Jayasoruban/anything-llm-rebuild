const { OpenAiProvider } = require("./openAi");
const { GeminiProvider } = require("./gemini");
const { SystemSettings, SETTINGS } = require("../../models/systemSettings");

// Resolves a config value in priority order:  DB > .env > fallback
// - dbValue may be null (no row) or a decrypted secret string
// - envValue is process.env.<X> or undefined
const pick = (dbValue, envValue, fallback = null) =>
  dbValue ?? envValue ?? fallback;

// Async factory — returns the provider instance for the currently configured LLM.
// Called on every chat request, so any settings change takes effect on the next
// message (no restart needed). The whole function is ~20ms of DB I/O.
const getProvider = async () => {
  const [providerName, openAiModel, geminiModel, openAiKey, geminiKey] =
    await Promise.all([
      SystemSettings.get(SETTINGS.LLM_PROVIDER),
      SystemSettings.get(SETTINGS.OPENAI_MODEL),
      SystemSettings.get(SETTINGS.GEMINI_MODEL),
      SystemSettings.getSecret(SETTINGS.OPENAI_API_KEY),
      SystemSettings.getSecret(SETTINGS.GEMINI_API_KEY),
    ]);

  const name = (pick(providerName, process.env.LLM_PROVIDER, "openai")).toLowerCase();

  switch (name) {
    case "openai":
      return new OpenAiProvider({
        apiKey: pick(openAiKey, process.env.OPENAI_API_KEY),
        model: pick(openAiModel, process.env.OPENAI_MODEL),
      });
    case "gemini":
      return new GeminiProvider({
        apiKey: pick(geminiKey, process.env.GEMINI_API_KEY),
        model: pick(geminiModel, process.env.GEMINI_MODEL),
      });
    default:
      throw new Error(`Unsupported LLM_PROVIDER: ${name}`);
  }
};

module.exports = { getProvider };
