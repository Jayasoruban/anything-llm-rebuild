// ============================================================================
//  AnythingLLM Rebuild — Collector microservice
// ============================================================================
//  Stateless document parsing service. The main server forwards uploads here.
//  Phase 4: extract text from PDF/TXT/MD → split into overlapping chunks.
// ============================================================================

require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs/promises");
const path = require("path");
const { v4: uuid } = require("uuid");
const { extractText } = require("./utils/extract");
const { splitText } = require("./utils/chunk");

const app = express();
const PORT = process.env.COLLECTOR_PORT || 8888;

// --- Where uploaded files are temporarily written before parsing ---
// We delete each file after we're done extracting text from it. Nothing
// here belongs in git (see .gitignore).
const HOTDIR = path.join(__dirname, "hotdir");
fs.mkdir(HOTDIR, { recursive: true });

// multer puts the uploaded file on disk for us. We give it a uuid filename
// so two simultaneous uploads with the same name don't collide.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, HOTDIR),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${uuid()}__${safeName}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

app.use(express.json({ limit: "5mb" }));

app.get("/", (_req, res) => {
  res.json({
    online: true,
    service: "anything-llm-collector",
    message: "Document collector is running.",
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "anything-llm-collector",
    version: "0.2.0",
    uptime: process.uptime(),
  });
});

// POST /process
// multipart/form-data with field name "file"
//   → extracts text → splits into chunks → returns JSON
//   → deletes the temp file regardless of success/failure
app.post("/process", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "no file uploaded" });
  }

  const { path: tmpPath, originalname, mimetype, size } = req.file;
  try {
    const { text, mimeType } = await extractText(tmpPath);
    const cleaned = text.replace(/\u0000/g, "").trim();

    if (cleaned.length === 0) {
      return res
        .status(422)
        .json({ success: false, error: "no readable text found in file" });
    }

    const chunks = await splitText(cleaned);
    const wordCount = cleaned.split(/\s+/).filter(Boolean).length;

    res.json({
      success: true,
      documentId: uuid(),
      title: originalname,
      mimeType: mimeType ?? mimetype,
      sizeBytes: size,
      wordCount,
      chunkCount: chunks.length,
      chunks,
    });
  } catch (err) {
    console.error(`[collector] process failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    fs.unlink(tmpPath).catch(() => {});
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

app.listen(PORT, () => {
  console.log(`✓ collector listening on http://localhost:${PORT}`);
});
