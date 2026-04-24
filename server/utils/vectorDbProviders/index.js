const { LanceDb } = require("./lance");

// Factory — returns the configured vector DB instance.
// Phase 4 supports only LanceDB. Phase 5 adds Chroma as a second option
// behind the same interface, switchable from the admin settings UI.
//
// Priority: DB setting > env > "lancedb"
// (env/DB switching wired in Phase 5 — for now always returns LanceDb)
const getVectorDb = () => {
  const name = (process.env.VECTOR_DB ?? "lancedb").toLowerCase();
  switch (name) {
    case "lancedb":
      return new LanceDb();
    default:
      throw new Error(`Unsupported VECTOR_DB: ${name}`);
  }
};

module.exports = { getVectorDb };
