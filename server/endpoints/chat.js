const { Router } = require("express");
const { Workspace } = require("../models/workspace");
const { WorkspaceChats } = require("../models/workspaceChats");
const { WorkspaceDocument } = require("../models/workspaceDocument");
const { getProvider } = require("../utils/AiProviders");
const { getEmbedder } = require("../utils/EmbeddingEngines");
const { getVectorDb } = require("../utils/vectorDbProviders");
const { validatedRequest } = require("../utils/auth");
const logger = require("../utils/logger");

const BASE_SYSTEM_PROMPT =
  "You are a helpful assistant. Answer concisely unless asked for detail.";
const HISTORY_LIMIT = 20;
const RAG_TOP_K = 4;         // how many chunks to inject per message
const RAG_MIN_SCORE = 0.35;  // ignore chunks below this relevance threshold

// Convert stored Q&A rows into the OpenAI "messages" format.
const historyToMessages = (history) =>
  history.flatMap((row) => [
    { role: "user", content: row.prompt },
    { role: "assistant", content: row.response },
  ]);

// Build the system prompt.
// If the workspace has documents and relevant chunks were found, inject them.
// If no documents or no relevant chunks, returns the base prompt unchanged.
function buildSystemPrompt(sources) {
  if (!sources || sources.length === 0) return BASE_SYSTEM_PROMPT;

  const context = sources
    .map((s, i) => `--- Source ${i + 1} ---\n${s.text}`)
    .join("\n\n");

  return (
    BASE_SYSTEM_PROMPT +
    "\n\nUse the following document context to answer the user's question. " +
    "If the answer is not in the context, answer from your general knowledge but say so.\n\n" +
    "[CONTEXT]\n" + context + "\n[/CONTEXT]"
  );
}

// Retrieve relevant chunks for a given workspace + user question.
// Returns [] if the workspace has no documents or nothing scores high enough.
async function retrieveSources(workspaceSlug, workspaceId, question) {
  try {
    const docCount = await WorkspaceDocument.countForWorkspace(workspaceId);
    if (docCount === 0) return []; // skip embedding + DB lookup entirely

    const embedder = await getEmbedder();
    const queryVector = await embedder.embedSingle(question);
    const vectorDb = getVectorDb();
    const results = await vectorDb.similaritySearch(workspaceSlug, queryVector, RAG_TOP_K);

    return results.filter((r) => r.score >= RAG_MIN_SCORE);
  } catch (err) {
    // Retrieval failure must never break chat — graceful degrade to no-RAG.
    logger.warn(`RAG retrieval failed (continuing without context): ${err.message}`);
    return [];
  }
}

const chatEndpoints = (app) => {
  const router = Router();
  router.use(validatedRequest);

  // POST /api/workspace/:slug/chat — non-streaming chat with RAG.
  router.post("/:slug/chat", async (req, res) => {
    try {
      const { slug } = req.params;
      const { message } = req.body ?? {};
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "message (string) required" });
      }

      const workspace = await Workspace.findBySlug(slug);
      if (!workspace) return res.status(404).json({ error: "workspace not found" });

      const [history, sources] = await Promise.all([
        WorkspaceChats.getHistory(workspace.id, { limit: HISTORY_LIMIT }),
        retrieveSources(slug, workspace.id, message),
      ]);

      const messages = [
        { role: "system", content: buildSystemPrompt(sources) },
        ...historyToMessages(history),
        { role: "user", content: message },
      ];

      const provider = await getProvider();
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
        sources: sources.map((s) => ({ text: s.text, score: s.score, docId: s.docId })),
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

  // POST /api/workspace/:slug/stream-chat — SSE streaming chat with RAG.
  // Frames emitted:
  //   data: {"type":"chunk","text":"hel"}
  //   data: {"type":"done","id":42,"response":"hello","sources":[...],"createdAt":"..."}
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

      // Retrieve RAG context + chat history in parallel.
      const [history, sources] = await Promise.all([
        WorkspaceChats.getHistory(workspace.id, { limit: HISTORY_LIMIT }),
        retrieveSources(slug, workspace.id, message),
      ]);

      const messages = [
        { role: "system", content: buildSystemPrompt(sources) },
        ...historyToMessages(history),
        { role: "user", content: message },
      ];

      const provider = await getProvider();
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
        // Send sources so the frontend can render citations.
        sources: sources.map((s) => ({ text: s.text, score: s.score, docId: s.docId })),
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
