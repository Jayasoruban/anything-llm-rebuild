const { OpenAiProvider } = require("./openAi");

// Factory — returns the configured provider based on env.
// Phase 1 supports only OpenAI; adding Anthropic later = new case here.
const getProvider = () => {
  const name = (process.env.LLM_PROVIDER ?? "openai").toLowerCase();
  switch (name) {
    case "openai":
      return new OpenAiProvider();
    default:
      throw new Error(`Unsupported LLM_PROVIDER: ${name}`);
  }
};

module.exports = { getProvider };
