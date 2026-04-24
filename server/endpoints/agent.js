const { Router } = require("express");
const { Workspace } = require("../models/workspace");
const { WorkspaceChats } = require("../models/workspaceChats");
const { Thread } = require("../models/thread");
const { AgentEngine } = require("../utils/AgentEngine");
const { validatedRequest } = require("../utils/auth");
const logger = require("../utils/logger");

const AGENT_SYSTEM_PROMPT =
  "You are a helpful AI agent with access to tools. " +
  "Think step by step. Use tools when you need external information. " +
  "After gathering enough information, give a clear and concise final answer.";

// Resolve optional threadSlug → threadId (null if not provided).
async function resolveThread(threadSlug) {
  if (!threadSlug) return { threadId: null };
  const thread = await Thread.findBySlug(threadSlug);
  return { threadId: thread?.id ?? null };
}

const agentEndpoints = (app) => {
  const router = Router();
  router.use(validatedRequest);

  // POST /api/workspace/:slug/agent-chat
  // Body: { message, threadSlug? }
  //
  // SSE frames:
  //   { type: "agent_start" }
  //   { type: "tool_call",   tool: "web_search",      args: { query: "..." } }
  //   { type: "tool_result", tool: "web_search",      result: "..." }
  //   { type: "chunk",       text: "final answer..." }
  //   { type: "done",        id, response, createdAt }
  //   { type: "error",       error: "..." }
  router.post("/:slug/agent-chat", async (req, res) => {
    const { slug } = req.params;
    const { message, threadSlug } = req.body ?? {};

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

      const { threadId } = await resolveThread(threadSlug);

      // Load recent history to give the agent conversation context.
      const history = await WorkspaceChats.getHistory(workspace.id, {
        limit: 10,
        threadId,
      });

      const messages = [
        { role: "system", content: AGENT_SYSTEM_PROMPT },
        ...history.flatMap((row) => [
          { role: "user", content: row.prompt },
          { role: "assistant", content: row.response },
        ]),
        { role: "user", content: message },
      ];

      const engine = new AgentEngine({
        workspaceSlug: slug,
        workspaceId: workspace.id,
      });

      let fullResponse = "";
      let aborted = false;
      req.on("close", () => { aborted = true; });

      for await (const event of engine.run(messages)) {
        if (aborted) return;

        send(event);

        if (event.type === "chunk") {
          fullResponse += event.text;
        }

        if (event.type === "done" || event.type === "error") {
          break;
        }
      }

      if (aborted) return;

      // Save the final answer to chat history (same table as regular chat).
      if (fullResponse) {
        const saved = await WorkspaceChats.addChat({
          workspaceId: workspace.id,
          userId: req.user.id,
          threadId,
          prompt: message,
          response: fullResponse,
        });

        // Re-emit done with DB id so frontend can reference it.
        send({
          type: "saved",
          id: saved.id,
          createdAt: saved.createdAt,
        });
      }

      res.end();
    } catch (err) {
      logger.error(`[agent] endpoint failed: ${err.message}`);
      send({ type: "error", error: err.message });
      res.end();
    }
  });

  app.use("/api/workspace", router);
};

module.exports = { agentEndpoints };
