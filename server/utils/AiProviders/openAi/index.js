const OpenAI = require("openai");

// Thin wrapper around the OpenAI SDK. Every other part of the app talks to
// an "AI provider" through this interface — swapping to Anthropic/Ollama later
// only means adding a sibling file with the same two methods.
class OpenAiProvider {
  constructor({ apiKey, model } = {}) {
    const key = apiKey ?? process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        "OPENAI_API_KEY is missing. Add it to server/.env"
      );
    }
    this.client = new OpenAI({ apiKey: key });
    this.model = model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  }

  // messages: [{ role: "system"|"user"|"assistant", content: "..." }]
  // Returns the assistant's reply as a string.
  async sendChat(messages, { temperature = 0.7 } = {}) {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature,
    });
    return res.choices?.[0]?.message?.content ?? "";
  }

  // Token-by-token generator. Wired to SSE later (Step 10).
  async *streamChat(messages, { temperature = 0.7 } = {}) {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature,
      stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}

module.exports = { OpenAiProvider };
