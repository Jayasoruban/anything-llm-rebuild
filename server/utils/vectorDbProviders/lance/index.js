const lancedb = require("@lancedb/lancedb");
const path = require("path");

// Where the LanceDB database folder lives on disk.
// One sub-folder per LanceDB table, all inside server/storage/lancedb/.
const DB_PATH = path.join(__dirname, "../../../storage/lancedb");

// One LanceDB table per workspace, named "workspace_<slug>".
// Each row = one document chunk:
//   chunkId  : uuid string — unique ID for this chunk
//   docId    : uuid string — links back to WorkspaceDocument SQL row
//   text     : raw chunk text (returned to LLM as context)
//   vector   : float32 array — the embedding (3072 dims for gemini-embedding-001)

class LanceDb {
  constructor() {
    this._db = null;
  }

  // Lazy-open the DB connection (LanceDB is just a local folder).
  async _connect() {
    if (!this._db) {
      this._db = await lancedb.connect(DB_PATH);
    }
    return this._db;
  }

  // Table name for a workspace — kept consistent everywhere.
  _tableName(workspaceSlug) {
    return `workspace_${workspaceSlug.replace(/[^a-z0-9_]/gi, "_")}`;
  }

  // Store chunks + their vectors.
  // chunks:  [{ chunkId, text, docId }]
  // vectors: number[][]   one vector per chunk, same order
  async addChunks(workspaceSlug, chunks, vectors) {
    if (!chunks.length) return;

    const db = await this._connect();
    const tableName = this._tableName(workspaceSlug);

    // Build rows in the shape LanceDB expects.
    const rows = chunks.map((c, i) => ({
      chunkId: c.chunkId,
      docId: c.docId,
      text: c.text,
      vector: vectors[i],
    }));

    const existingTables = await db.tableNames();

    if (existingTables.includes(tableName)) {
      // Table already exists — append new rows.
      const table = await db.openTable(tableName);
      await table.add(rows);
    } else {
      // First upload to this workspace — create the table.
      await db.createTable(tableName, rows);
    }
  }

  // Find the topK most similar chunks to a query vector.
  // Returns: [{ chunkId, docId, text, score }] sorted best → worst.
  async similaritySearch(workspaceSlug, queryVector, topK = 5) {
    const db = await this._connect();
    const tableName = this._tableName(workspaceSlug);

    const existingTables = await db.tableNames();
    if (!existingTables.includes(tableName)) return [];

    const table = await db.openTable(tableName);
    const results = await table
      .vectorSearch(queryVector)
      .limit(topK)
      .toArray();

    // LanceDB appends a "_distance" field (L2 by default).
    // Convert to a cosine-style "score" where higher = more relevant.
    return results.map((r) => ({
      chunkId: r.chunkId,
      docId: r.docId,
      text: r.text,
      score: 1 / (1 + (r._distance ?? 0)), // monotonic transform: lower distance → higher score
    }));
  }

  // Delete all chunks belonging to a specific document.
  // Called when a document is deleted from a workspace.
  async deleteDocument(workspaceSlug, docId) {
    const db = await this._connect();
    const tableName = this._tableName(workspaceSlug);
    const existingTables = await db.tableNames();
    if (!existingTables.includes(tableName)) return;
    const table = await db.openTable(tableName);
    await table.delete(`docId = '${docId}'`);
  }

  // Drop the entire table for a workspace (used when workspace is deleted).
  async deleteWorkspace(workspaceSlug) {
    const db = await this._connect();
    const tableName = this._tableName(workspaceSlug);
    const existingTables = await db.tableNames();
    if (!existingTables.includes(tableName)) return;
    await db.dropTable(tableName);
  }
}

module.exports = { LanceDb };
