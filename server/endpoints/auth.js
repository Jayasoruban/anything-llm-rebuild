const { Router } = require("express");
const { User } = require("../models/user");
const {
  verifyPassword,
  signToken,
  validatedRequest,
  publicUser,
} = require("../utils/auth");

const authEndpoints = (app) => {
  const router = Router();

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

      const token = signToken(user);
      res.json({ user: publicUser(user), token });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Returns the currently-logged-in user. Requires a valid JWT.
  router.get("/me", validatedRequest, async (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  app.use("/api/auth", router);
};

module.exports = { authEndpoints };
