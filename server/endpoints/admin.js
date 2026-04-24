const { Router } = require("express");
const { User } = require("../models/user");
const { Invite } = require("../models/invite");
const { WorkspaceUser } = require("../models/workspaceUser");
const { Workspace } = require("../models/workspace");
const { validatedRequest, requireAdmin, publicUser } = require("../utils/auth");
const logger = require("../utils/logger");

const adminEndpoints = (app) => {
  const router = Router();

  // Every route in this file requires a valid JWT + admin role.
  router.use(validatedRequest, requireAdmin);

  // ── User management ──────────────────────────────────────────────────────────

  // GET /api/admin/users — list all users (no passwords)
  router.get("/users", async (_req, res) => {
    try {
      const users = await User.list();
      res.json({ users });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/users/:id/suspend — lock user out
  router.post("/users/:id/suspend", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (id === req.user.id) {
        return res.status(400).json({ error: "cannot suspend yourself" });
      }
      const user = await User.suspend(id);
      logger.info(`[admin] suspended user ${user.username}`);
      res.json({ success: true, user: publicUser(user) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/users/:id/unsuspend — re-enable user
  router.post("/users/:id/unsuspend", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await User.unsuspend(id);
      logger.info(`[admin] unsuspended user ${user.username}`);
      res.json({ success: true, user: publicUser(user) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/users/:id/role — change role to "admin" or "default"
  router.post("/users/:id/role", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { role } = req.body ?? {};
      if (!["admin", "default"].includes(role)) {
        return res.status(400).json({ error: 'role must be "admin" or "default"' });
      }
      if (id === req.user.id && role !== "admin") {
        return res.status(400).json({ error: "cannot demote yourself" });
      }
      const user = await User.updateRole(id, role);
      logger.info(`[admin] set user ${user.username} role → ${role}`);
      res.json({ success: true, user: publicUser(user) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/admin/users/:id — remove a user entirely
  router.delete("/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (id === req.user.id) {
        return res.status(400).json({ error: "cannot delete yourself" });
      }
      await User.deleteById(id);
      logger.info(`[admin] deleted user id ${id}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Invite management ────────────────────────────────────────────────────────

  // POST /api/admin/invites — generate a new invite token
  router.post("/invites", async (req, res) => {
    try {
      const invite = await Invite.create(req.user.id);
      logger.info(`[admin] created invite ${invite.token}`);
      res.json({ success: true, invite });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/admin/invites — list all invites with creator/claimer usernames
  router.get("/invites", async (_req, res) => {
    try {
      const invites = await Invite.list();
      res.json({ invites });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/admin/invites/:id — revoke an invite before it is used
  router.delete("/invites/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await Invite.deleteById(id);
      logger.info(`[admin] deleted invite id ${id}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Workspace access control ─────────────────────────────────────────────────

  // POST /api/admin/workspaces/:slug/users — grant a user access to a workspace
  // Body: { userId }
  router.post("/workspaces/:slug/users", async (req, res) => {
    try {
      const { slug } = req.params;
      const { userId } = req.body ?? {};
      if (!userId) return res.status(400).json({ error: "userId required" });

      const workspace = await Workspace.findBySlug(slug);
      if (!workspace) return res.status(404).json({ error: "workspace not found" });

      await WorkspaceUser.add(parseInt(userId), workspace.id);
      logger.info(`[admin] added user ${userId} to workspace ${slug}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/admin/workspaces/:slug/users/:userId — revoke workspace access
  router.delete("/workspaces/:slug/users/:userId", async (req, res) => {
    try {
      const { slug, userId } = req.params;
      const workspace = await Workspace.findBySlug(slug);
      if (!workspace) return res.status(404).json({ error: "workspace not found" });

      await WorkspaceUser.remove(parseInt(userId), workspace.id);
      logger.info(`[admin] removed user ${userId} from workspace ${slug}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.use("/api/admin", router);
};

module.exports = { adminEndpoints };
