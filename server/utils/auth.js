const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("../models/user");

const SALT_ROUNDS = 10;
const TOKEN_TTL = "7d";

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "JWT_SECRET is missing or too short (needs 16+ chars). Set it in server/.env"
    );
  }
  return s;
};

const hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);
const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

const signToken = (user) =>
  jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    secret(),
    { expiresIn: TOKEN_TTL }
  );

// Express middleware — rejects the request unless a valid JWT is attached.
const validatedRequest = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "missing bearer token" });
    }
    const payload = jwt.verify(token, secret());
    const user = await User.findById(payload.userId);
    if (!user) return res.status(401).json({ error: "user not found" });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "invalid or expired token" });
  }
};

// Return a safe user object (never leak the password hash).
const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  role: user.role,
  createdAt: user.createdAt,
});

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  validatedRequest,
  publicUser,
};
