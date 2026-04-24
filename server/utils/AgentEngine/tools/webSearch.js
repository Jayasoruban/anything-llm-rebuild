// Tool definition sent to the LLM.
const DEFINITION = {
  name: "web_search",
  description:
    "Search the web for current information, news, facts, or anything not in the uploaded documents. " +
    "Use this when the user asks about recent events or topics not covered by workspace documents.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query.",
      },
    },
    required: ["query"],
  },
};

// Execute: calls DuckDuckGo's free instant-answer JSON API.
// Returns a plain-text summary of results the LLM can reason over.
async function run({ query }) {
  try {
    const url =
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}` +
      `&format=json&no_html=1&skip_disambig=1`;

    const res = await fetch(url, {
      headers: { "User-Agent": "AnythingLLM-Rebuild/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return `Web search failed: HTTP ${res.status}`;
    }

    const data = await res.json();
    const parts = [];

    // Abstract — the main instant answer paragraph.
    if (data.AbstractText) {
      parts.push(`Summary: ${data.AbstractText}`);
      if (data.AbstractSource) parts.push(`Source: ${data.AbstractSource}`);
    }

    // Answer — a short direct answer (e.g. for "capital of France").
    if (data.Answer) {
      parts.push(`Answer: ${data.Answer}`);
    }

    // Related topics — up to 5 snippets.
    const topics = (data.RelatedTopics ?? [])
      .filter((t) => t.Text)
      .slice(0, 5)
      .map((t, i) => `[${i + 1}] ${t.Text}${t.FirstURL ? ` (${t.FirstURL})` : ""}`);

    if (topics.length) {
      parts.push("Related:\n" + topics.join("\n"));
    }

    if (!parts.length) {
      return `No instant answer found for "${query}". Try a more specific query.`;
    }

    return parts.join("\n\n");
  } catch (err) {
    return `Web search error: ${err.message}`;
  }
}

module.exports = { DEFINITION, run };
