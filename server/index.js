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
const { Workspace } = require("./models/workspace");
const { setupEndpoints } = require("./endpoints/setup");
const { authEndpoints } = require("./endpoints/auth");
const { chatEndpoints } = require("./endpoints/chat");
const { systemSettingsEndpoints } = require("./endpoints/systemSettings");
const { documentEndpoints } = require("./endpoints/document");
const { adminEndpoints } = require("./endpoints/admin");
const { threadEndpoints } = require("./endpoints/thread");

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

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

setupEndpoints(app);
authEndpoints(app);
chatEndpoints(app);
systemSettingsEndpoints(app);
documentEndpoints(app);
adminEndpoints(app);
threadEndpoints(app);

app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

app.listen(PORT, async () => {
  try {
    await Workspace.ensureDefault();
    logger.info("✓ default workspace ready");
  } catch (err) {
    logger.error(`failed to seed default workspace: ${err.message}`);
  }
  logger.info(`✓ server listening on http://localhost:${PORT}`);
});
