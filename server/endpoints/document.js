const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");
const { readFile } = fs;
const { v4: uuid } = require("uuid");
const logger = require("../utils/logger");
const { validatedRequest } = require("../utils/auth");
const { Workspace } = require("../models/workspace");
const { WorkspaceDocument } = require("../models/workspaceDocument");
const { getEmbedder } = require("../utils/EmbeddingEngines");
const { getVectorDb } = require("../utils/vectorDbProviders");

const UPLOAD_DIR = path.join(__dirname, "../storage/uploads");
const COLLECTOR_URL = process.env.COLLECTOR_URL ?? "http://localhost:8888";

// multer saves the file temporarily on the server before we forward it.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${uuid()}__${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".txt", ".md"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error(`unsupported file type: ${ext}. Allowed: ${allowed.join(", ")}`));
  },
});

// Forward the uploaded file to the collector and get back chunks.
// Uses Node 20's native FormData + Blob — avoids stream truncation issues
// that happen when piping a ReadStream through the form-data package.
async function callCollector(tmpPath, originalname) {
  const buf = await readFile(tmpPath);
  const blob = new Blob([buf]);

  // Native FormData (global in Node 20, no import needed)
  const form = new FormData();
  form.append("file", blob, originalname);

  let res;
  try {
    res = await fetch(`${COLLECTOR_URL}/process`, {
      method: "POST",
      body: form,
      // Do NOT set Content-Type manually — fetch sets it with the correct boundary.
    });
  } catch (err) {
    throw new Error(
      `Collector service is not running at ${COLLECTOR_URL}. Start it with: node collector/index.js`
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Collector returned non-JSON response (status ${res.status}). Check collector logs.`);
  }

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? `collector responded ${res.status}`);
  }
  return data;
}

const documentEndpoints = (app) => {
  const router = Router({ mergeParams: true });

  // All routes require auth.
  router.use(validatedRequest);

  // POST /api/workspace/:slug/upload
  // Accepts a single file, runs the full pipeline, returns saved document.
  router.post(
    "/upload",
    upload.single("file"),
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: "no file uploaded" });
      }

      const { slug } = req.params;
      const { path: tmpPath, originalname } = req.file;

      try {
        const workspace = await Workspace.findBySlug(slug);
        if (!workspace) {
          return res.status(404).json({ error: "workspace not found" });
        }

        // Step 1 — collector: file → chunks
        logger.info(`[doc] forwarding ${originalname} to collector`);
        const collected = await callCollector(tmpPath, originalname);
        const { chunks, wordCount, chunkCount, mimeType } = collected;

        // Step 2 — embed all chunk texts
        logger.info(`[doc] embedding ${chunkCount} chunks`);
        const embedder = await getEmbedder();
        const vectors = await embedder.embedMany(chunks.map((c) => c.text));

        // Step 3 — store in LanceDB
        const docId = uuid();
        const vectorDb = getVectorDb();
        const lanceChunks = chunks.map((c) => ({
          chunkId: uuid(),
          docId,
          text: c.text,
        }));
        await vectorDb.addChunks(slug, lanceChunks, vectors);
        logger.info(`[doc] stored ${chunkCount} vectors in LanceDB`);

        // Step 4 — save metadata to SQL
        const doc = await WorkspaceDocument.create({
          workspaceId: workspace.id,
          docId,
          title: originalname,
          mimeType: mimeType ?? "application/octet-stream",
          wordCount: wordCount ?? 0,
          chunkCount: chunkCount ?? 0,
        });

        logger.info(`[doc] document saved: ${originalname} (${chunkCount} chunks)`);
        res.json({ success: true, document: doc });
      } catch (err) {
        logger.error(`[doc] upload failed: ${err.message}`);
        res.status(500).json({ error: err.message });
      } finally {
        // Always delete the temp file regardless of success or failure.
        fs.unlink(tmpPath).catch(() => {});
      }
    }
  );

  // GET /api/workspace/:slug/documents
  router.get("/documents", async (req, res) => {
    try {
      const workspace = await Workspace.findBySlug(req.params.slug);
      if (!workspace) return res.status(404).json({ error: "workspace not found" });
      const documents = await WorkspaceDocument.listForWorkspace(workspace.id);
      res.json({ documents });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/workspace/:slug/document/:docId
  // Removes from both LanceDB (vectors) and SQL (metadata).
  router.delete("/document/:docId", async (req, res) => {
    try {
      const { slug, docId } = req.params;
      const workspace = await Workspace.findBySlug(slug);
      if (!workspace) return res.status(404).json({ error: "workspace not found" });

      const doc = await WorkspaceDocument.findByDocId(docId);
      if (!doc) return res.status(404).json({ error: "document not found" });

      // Delete vectors first, then SQL row.
      const vectorDb = getVectorDb();
      await vectorDb.deleteDocument(slug, docId);
      await WorkspaceDocument.deleteByDocId(docId);

      logger.info(`[doc] deleted: ${doc.title}`);
      res.json({ success: true });
    } catch (err) {
      logger.error(`[doc] delete failed: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.use("/api/workspace/:slug", router);
};

module.exports = { documentEndpoints };
