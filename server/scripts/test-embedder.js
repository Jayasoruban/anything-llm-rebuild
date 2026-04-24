#!/usr/bin/env node
// CLI smoke test for the embedding engine.
//   node scripts/test-embedder.js
//
// Embeds 3 sentences and prints pairwise cosine similarity. We expect:
//   similar(A,B) > 0.8   (same meaning, different words)
//   similar(A,C) < 0.5   (unrelated topics)

require("dotenv").config();
const { getEmbedder } = require("../utils/EmbeddingEngines");

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

(async () => {
  const embedder = await getEmbedder();
  const sentences = [
    "How do I cancel my subscription?",
    "How can I unsubscribe from this service?",
    "What is the capital of France?",
  ];

  console.log(`[>] model: ${embedder.model}`);
  console.log(`[>] expected dims: ${embedder.dimensions}`);

  const vecs = await embedder.embedMany(sentences);

  vecs.forEach((v, i) => {
    console.log(`[<] vec${i + 1} len=${v.length}  first8=${v.slice(0, 8).map((n) => n.toFixed(4)).join(", ")}`);
  });

  console.log(`[<] cos(A,B) similar meaning   = ${cosine(vecs[0], vecs[1]).toFixed(3)}`);
  console.log(`[<] cos(A,C) unrelated topics  = ${cosine(vecs[0], vecs[2]).toFixed(3)}`);
})().catch((err) => {
  console.error("[x]", err.message);
  process.exit(1);
});
