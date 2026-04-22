// ============================================================================
//  AnythingLLM Rebuild — Server entrypoint
// ============================================================================
//  Starts the Express HTTP server on the configured port.
//  For now: two simple health-check routes. Auth, chat, RAG come in Phase 1+.
// ============================================================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const logger = require("./utils/logger");

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

// -------- Middleware --------
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// -------- Routes (Phase 0) --------
app.get("/api/ping", (req, res) => {
  res.json({ online: true });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "anything-llm-server",
    version: "0.1.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// -------- 404 fallback --------
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

// -------- Start --------
app.listen(PORT, () => {
  logger.info(`✓ server listening on http://localhost:${PORT}`);
});
