const { GoogleGenAI } = require("@google/genai");

// Wrapper with the *same public shape* as OpenAiProvider.
// Gemini's API differs from OpenAI in three ways:
//   - OpenAI roles are user/assistant/system → Gemini calls them user/model (+ systemInstruction)
//   - Messages go in a `contents` array where each item has { role, parts: [{text}] }
//   - System prompt is a top-level parameter, not a message
// We normalize here so the rest of the app never notices.
class GeminiProvider {
  constructor({ apiKey, model } = {}) {
    const key = apiKey ?? process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is missing. Add it to server/.env");
    }
    this.client = new GoogleGenAI({ apiKey: key });
    this.model = model ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  }

  // Convert OpenAI-shaped messages → Gemini's format.
  _translate(messages) {
    const systemInstruction = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n") || undefined;

    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    return { systemInstruction, contents };
  }

  async sendChat(messages, { temperature = 0.7 } = {}) {
    const { systemInstruction, contents } = this._translate(messages);
    const res = await this.client.models.generateContent({
      model: this.model,
      contents,
      config: { systemInstruction, temperature },
    });
    return res.text ?? "";
  }

  async *streamChat(messages, { temperature = 0.7 } = {}) {
    const { systemInstruction, contents } = this._translate(messages);
    const stream = await this.client.models.generateContentStream({
      model: this.model,
      contents,
      config: { systemInstruction, temperature },
    });
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield text;
    }
  }
}

module.exports = { GeminiProvider };
