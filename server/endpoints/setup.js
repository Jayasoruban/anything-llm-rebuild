const { Router } = require("express");
const { User } = require("../models/user");
const { SystemSettings } = require("../models/systemSettings");
const { hashPassword, signToken, publicUser } = require("../utils/auth");

const setupEndpoints = (app) => {
  const router = Router();

  // Has an admin user been created yet? Frontend calls this on every boot.
  router.get("/needs-setup", async (_req, res) => {
    try {
      const completed = await SystemSettings.isSetupComplete();
      const userCount = await User.count();
      res.json({ needsSetup: !completed || userCount === 0 });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create the very first user (admin). Refuses if setup is already complete.
  router.post("/create-first-user", async (req, res) => {
    try {
      const { username, password } = req.body ?? {};
      if (!username || !password) {
        return res.status(400).json({ error: "username and password required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "password must be 8+ chars" });
      }

      const completed = await SystemSettings.isSetupComplete();
      if (completed || (await User.count()) > 0) {
        return res.status(403).json({ error: "setup already completed" });
      }

      const passwordHash = await hashPassword(password);
      const user = await User.create({
        username: username.toLowerCase().trim(),
        passwordHash,
        role: "admin",
      });
      await SystemSettings.markSetupComplete();

      const token = signToken(user);
      res.json({ user: publicUser(user), token });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.use("/api/setup", router);
};

module.exports = { setupEndpoints };
