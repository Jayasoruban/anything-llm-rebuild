const { Router } = require("express");
const { Workspace } = require("../models/workspace");
const { WorkspaceChats } = require("../models/workspaceChats");
const { getProvider } = require("../utils/AiProviders");
const { validatedRequest } = require("../utils/auth");
const logger = require("../utils/logger");

const SYSTEM_PROMPT =
  "You are a helpful assistant. Answer concisely unless asked for detail.";
const HISTORY_LIMIT = 20;

// Convert stored Q&A rows into the OpenAI "messages" format.
const historyToMessages = (history) =>
  history.flatMap((row) => [
    { role: "user", content: row.prompt },
    { role: "assistant", content: row.response },
  ]);

const chatEndpoints = (app) => {
  const router = Router();
  router.use(validatedRequest);

  // POST /api/workspace/:slug/chat — send a message, get a reply, persist both.
  router.post("/:slug/chat", async (req, res) => {
    try {
      const { slug } = req.params;
      const { message } = req.body ?? {};
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "message (string) required" });
      }

      const workspace = await Workspace.findBySlug(slug);
      if (!workspace) return res.status(404).json({ error: "workspace not found" });

      const history = await WorkspaceChats.getHistory(workspace.id, { limit: HISTORY_LIMIT });
      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...historyToMessages(history),
        { role: "user", content: message },
      ];

      const provider = getProvider();
      const response = await provider.sendChat(messages);

      const saved = await WorkspaceChats.addChat({
        workspaceId: workspace.id,
        userId: req.user.id,
        prompt: message,
        response,
      });

      res.json({
        id: saved.id,
        prompt: saved.prompt,
        response: saved.response,
        createdAt: saved.createdAt,
      });
    } catch (err) {
      logger.error(`chat failed: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/workspace/:slug/chats — full history.
  router.get("/:slug/chats", async (req, res) => {
    try {
      const workspace = await Workspace.findBySlug(req.params.slug);
      if (!workspace) return res.status(404).json({ error: "workspace not found" });
      const history = await WorkspaceChats.getHistory(workspace.id, { limit: 1000 });
      res.json({ chats: history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/workspace/:slug/stream-chat — SSE stream of tokens.
  // Frames emitted:
  //   data: {"type":"chunk","text":"hel"}
  //   data: {"type":"chunk","text":"lo"}
  //   data: {"type":"done","id":42,"response":"hello","createdAt":"..."}
  //   data: {"type":"error","error":"..."}
  router.post("/:slug/stream-chat", async (req, res) => {
    const { slug } = req.params;
    const { message } = req.body ?? {};

    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      if (!message || typeof message !== "string") {
        send({ type: "error", error: "message (string) required" });
        return res.end();
      }
      const workspace = await Workspace.findBySlug(slug);
      if (!workspace) {
        send({ type: "error", error: "workspace not found" });
        return res.end();
      }

      const history = await WorkspaceChats.getHistory(workspace.id, { limit: HISTORY_LIMIT });
      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...historyToMessages(history),
        { role: "user", content: message },
      ];

      const provider = getProvider();
      let full = "";
      let aborted = false;

      req.on("close", () => { aborted = true; });

      for await (const chunk of provider.streamChat(messages)) {
        if (aborted) return;
        full += chunk;
        send({ type: "chunk", text: chunk });
      }

      if (aborted) return;

      const saved = await WorkspaceChats.addChat({
        workspaceId: workspace.id,
        userId: req.user.id,
        prompt: message,
        response: full,
      });

      send({
        type: "done",
        id: saved.id,
        response: saved.response,
        createdAt: saved.createdAt,
      });
      res.end();
    } catch (err) {
      logger.error(`stream-chat failed: ${err.message}`);
      send({ type: "error", error: err.message });
      res.end();
    }
  });

  // DELETE /api/workspace/:slug/chats — clear history.
  router.delete("/:slug/chats", async (req, res) => {
    try {
      const workspace = await Workspace.findBySlug(req.params.slug);
      if (!workspace) return res.status(404).json({ error: "workspace not found" });
      const result = await WorkspaceChats.deleteAllForWorkspace(workspace.id);
      res.json({ deleted: result.count });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.use("/api/workspace", router);
};

module.exports = { chatEndpoints };
