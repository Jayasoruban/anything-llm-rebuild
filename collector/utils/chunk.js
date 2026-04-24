const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");

// Default chunking config — sensible for retrieval over English prose / docs.
//   chunkSize    : ~1000 chars ≈ 200-250 tokens — small enough to be focused,
//                  big enough to retain context across a few sentences
//   chunkOverlap : 200 chars overlap so a sentence split across chunks still
//                  appears whole in at least one of them
const DEFAULTS = { chunkSize: 1000, chunkOverlap: 200 };

// Splits a long text into overlapping chunks suitable for embedding.
// Uses LangChain's RecursiveCharacterTextSplitter, which tries paragraph →
// sentence → word boundaries before falling back to hard character cuts.
async function splitText(text, opts = {}) {
  const { chunkSize, chunkOverlap } = { ...DEFAULTS, ...opts };
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  });
  const chunks = await splitter.splitText(text);
  return chunks.map((t, i) => ({ index: i, text: t }));
}

module.exports = { splitText };
