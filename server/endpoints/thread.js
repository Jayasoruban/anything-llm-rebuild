const { Router } = require("express");
const { Thread } = require("../models/thread");
const { Workspace } = require("../models/workspace");
const { WorkspaceChats } = require("../models/workspaceChats");
const { validatedRequest } = require("../utils/auth");
const logger = require("../utils/logger");

const threadEndpoints = (app) => {
  const router = Router({ mergeParams: true });
  router.use(validatedRequest);

  // GET /api/workspace/:slug/threads — list threads for the current user
  router.get("/", async (req, res) => {
    try {
      const workspace = await Workspace.findBySlug(req.params.slug);
      if (!workspace) return res.status(404).json({ error: "workspace not found" });

      const threads = await Thread.listForUser(workspace.id, req.user.id);
      res.json({ threads });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/workspace/:slug/threads — create a new thread
  // Body: { name? }
  router.post("/", async (req, res) => {
    try {
      const workspace = await Workspace.findBySlug(req.params.slug);
      if (!workspace) return res.status(404).json({ error: "workspace not found" });

      const name = req.body?.name?.trim() || "New Thread";
      const thread = await Thread.create({
        workspaceId: workspace.id,
        userId: req.user.id,
        name,
      });
      logger.info(`[thread] created "${thread.name}" (${thread.slug})`);
      res.status(201).json({ thread });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/workspace/:slug/threads/:threadSlug — rename a thread
  // Body: { name }
  router.patch("/:threadSlug", async (req, res) => {
    try {
      const thread = await Thread.findBySlug(req.params.threadSlug);
      if (!thread) return res.status(404).json({ error: "thread not found" });

      // Only the owner (or admin) can rename.
      if (thread.userId !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "not your thread" });
      }

      const name = req.body?.name?.trim();
      if (!name) return res.status(400).json({ error: "name required" });

      const updated = await Thread.rename(thread.slug, name);
      res.json({ thread: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/workspace/:slug/threads/:threadSlug — delete thread + its chats
  router.delete("/:threadSlug", async (req, res) => {
    try {
      const thread = await Thread.findBySlug(req.params.threadSlug);
      if (!thread) return res.status(404).json({ error: "thread not found" });

      if (thread.userId !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "not your thread" });
      }

      await Thread.deleteBySlug(thread.slug);
      logger.info(`[thread] deleted "${thread.name}" (${thread.slug})`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/workspace/:slug/threads/:threadSlug/chats — history for one thread
  router.get("/:threadSlug/chats", async (req, res) => {
    try {
      const thread = await Thread.findBySlug(req.params.threadSlug);
      if (!thread) return res.status(404).json({ error: "thread not found" });

      const chats = await WorkspaceChats.getHistory(thread.workspaceId, {
        threadId: thread.id,
      });
      res.json({ chats });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/workspace/:slug/threads/:threadSlug/chats — clear a thread's history
  router.delete("/:threadSlug/chats", async (req, res) => {
    try {
      const thread = await Thread.findBySlug(req.params.threadSlug);
      if (!thread) return res.status(404).json({ error: "thread not found" });

      await WorkspaceChats.deleteAllForWorkspace(thread.workspaceId, {
        threadId: thread.id,
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.use("/api/workspace/:slug/threads", router);
};

module.exports = { threadEndpoints };
