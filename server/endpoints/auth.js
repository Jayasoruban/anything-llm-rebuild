const { Router } = require("express");
const { User } = require("../models/user");
const { Invite } = require("../models/invite");
const {
  hashPassword,
  verifyPassword,
  signToken,
  validatedRequest,
  publicUser,
} = require("../utils/auth");

const authEndpoints = (app) => {
  const router = Router();

  // POST /api/auth/login
  router.post("/login", async (req, res) => {
    try {
      const { username, password } = req.body ?? {};
      if (!username || !password) {
        return res.status(400).json({ error: "username and password required" });
      }
      const user = await User.findByUsername(username.toLowerCase().trim());
      if (!user) return res.status(401).json({ error: "invalid credentials" });

      const ok = await verifyPassword(password, user.password);
      if (!ok) return res.status(401).json({ error: "invalid credentials" });

      // Suspended users cannot log in.
      if (user.suspended) {
        return res.status(403).json({ error: "account suspended — contact your admin" });
      }

      const token = signToken(user);
      res.json({ user: publicUser(user), token });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/auth/register
  // Public route — but requires a valid, unused invite token.
  // Flow: admin creates invite → shares URL with token → user opens URL → POSTs here.
  router.post("/register", async (req, res) => {
    try {
      const { username, password, token } = req.body ?? {};
      if (!username || !password || !token) {
        return res.status(400).json({ error: "username, password, and token required" });
      }

      // Validate the invite token.
      const invite = await Invite.findByToken(token);
      if (!invite) return res.status(400).json({ error: "invalid invite token" });
      if (invite.used) return res.status(400).json({ error: "invite already used" });

      // Check username is not taken.
      const existing = await User.findByUsername(username.toLowerCase().trim());
      if (existing) return res.status(409).json({ error: "username already taken" });

      // Create the user and mark invite used in parallel-safe order.
      const passwordHash = await hashPassword(password);
      const user = await User.create({
        username: username.toLowerCase().trim(),
        passwordHash,
        role: "default",
      });

      await Invite.markUsed(invite.id, user.id);

      const jwtToken = signToken(user);
      res.status(201).json({ user: publicUser(user), token: jwtToken });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/auth/me — returns the currently logged-in user.
  router.get("/me", validatedRequest, async (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  app.use("/api/auth", router);
};

module.exports = { authEndpoints };
