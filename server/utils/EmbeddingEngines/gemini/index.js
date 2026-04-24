const { GoogleGenAI } = require("@google/genai");

// Same public shape as the LLM provider abstraction.
// Embedder's only job: text → vector. No chat, no streaming.
//
// API: client.models.embedContent({ model, contents })
//   → { embeddings: [{ values: number[] }, ...] }
//
// The model gemini-embedding-001 produces 3072-dim vectors.
// Batch limit per request: 100 texts.
const BATCH_LIMIT = 100;
const DEFAULT_MODEL = "gemini-embedding-001";
const DEFAULT_DIMS = 3072;

class GeminiEmbedder {
  constructor({ apiKey, model } = {}) {
    const key = apiKey ?? process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is missing. Add it to server/.env");
    }
    this.client = new GoogleGenAI({ apiKey: key });
    this.model = model ?? process.env.GEMINI_EMBEDDING_MODEL ?? DEFAULT_MODEL;
    this._dims = DEFAULT_DIMS;
  }

  get dimensions() {
    return this._dims;
  }

  // One text → one vector.
  async embedSingle(text) {
    const [v] = await this.embedMany([text]);
    return v;
  }

  // Many texts → many vectors, preserving order.
  // Splits into batches of 100 to stay within the API limit.
  async embedMany(texts) {
    if (!Array.isArray(texts) || texts.length === 0) return [];

    const out = [];
    for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
      const batch = texts.slice(i, i + BATCH_LIMIT);
      const res = await this.client.models.embedContent({
        model: this.model,
        contents: batch,
      });
      // res.embeddings is an array of { values: number[] }, one per input text.
      for (const emb of res.embeddings ?? []) {
        out.push(emb.values ?? []);
      }
    }

    // Update dims from actual response (in case model returns different size).
    if (out.length > 0 && out[0].length > 0) {
      this._dims = out[0].length;
    }

    return out;
  }
}

module.exports = { GeminiEmbedder };
