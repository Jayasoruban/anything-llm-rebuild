#!/usr/bin/env node
// Smoke test for the LanceDB vector store.
// Inserts 3 chunks with real Gemini embeddings then searches.
// Expected: chunk[0] and chunk[1] rank above chunk[2] for the query.
//
// Usage: node scripts/test-lancedb.js

require("dotenv").config();
const { getEmbedder } = require("../utils/EmbeddingEngines");
const { getVectorDb } = require("../utils/vectorDbProviders");
const { v4: uuid } = require("uuid");

const TEST_SLUG = "test_lancedb_smoke";

const CHUNKS = [
  { text: "How to cancel your subscription and stop future billing charges." },
  { text: "Steps to unsubscribe from a paid service and get a refund." },
  { text: "The weather forecast for Paris tomorrow is sunny with light clouds." },
];

(async () => {
  const embedder = await getEmbedder();
  const db = getVectorDb();

  console.log(`[>] embedding ${CHUNKS.length} chunks via ${embedder.model}...`);
  const vectors = await embedder.embedMany(CHUNKS.map((c) => c.text));
  console.log(`[✓] got ${vectors.length} vectors, each ${vectors[0].length} dims`);

  const docId = uuid();
  const chunks = CHUNKS.map((c) => ({ chunkId: uuid(), docId, text: c.text }));

  console.log(`[>] inserting into workspace_${TEST_SLUG}...`);
  await db.addChunks(TEST_SLUG, chunks, vectors);
  console.log(`[✓] inserted`);

  const query = "How do I unsubscribe and cancel my plan?";
  console.log(`[>] searching: "${query}"`);
  const queryVec = await embedder.embedSingle(query);
  const results = await db.similaritySearch(TEST_SLUG, queryVec, 3);

  results.forEach((r, i) => {
    console.log(`[<] #${i + 1} score=${r.score.toFixed(4)} | "${r.text.slice(0, 70)}"`);
  });

  const topText = results[0]?.text ?? "";
  const passed =
    topText.toLowerCase().includes("cancel") ||
    topText.toLowerCase().includes("subscri");

  console.log(`\n[${passed ? "✓ PASS" : "✗ FAIL"}] top result is semantically correct`);

  // Clean up test table so re-runs stay idempotent.
  await db.deleteWorkspace(TEST_SLUG);
  console.log(`[✓] test table cleaned up`);

  process.exit(passed ? 0 : 1);
})().catch((err) => {
  console.error("[x]", err.message);
  process.exit(1);
});
