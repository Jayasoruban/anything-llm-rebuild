// ============================================================================
//  AnythingLLM Rebuild — Collector microservice entrypoint
// ============================================================================
//  Stateless document parsing service. The main server forwards uploads here.
//  Phase 0: placeholder routes. Phase 4 adds PDF / DOCX / TXT processing.
// ============================================================================

require("dotenv").config();
const express = require("express");

const app = express();
const PORT = process.env.COLLECTOR_PORT || 8888;

app.use(express.json({ limit: "25mb" }));

// -------- Routes (Phase 0) --------
app.get("/", (req, res) => {
  res.json({
    online: true,
    service: "anything-llm-collector",
    message: "Document collector is running.",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "anything-llm-collector",
    version: "0.1.0",
    uptime: process.uptime(),
  });
});

// -------- 404 fallback --------
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

// -------- Start --------
app.listen(PORT, () => {
  console.log(`✓ collector listening on http://localhost:${PORT}`);
});
