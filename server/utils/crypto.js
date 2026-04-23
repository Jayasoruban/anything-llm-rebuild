const crypto = require("crypto");

// Symmetric encryption for secrets stored in the database (API keys, etc.).
// Algorithm: AES-256-GCM
//   - 256-bit key derived from ENCRYPTION_KEY (hex-decoded or sha256'd)
//   - Random 12-byte IV per message (GCM standard)
//   - Authentication tag (16 bytes) proves the ciphertext wasn't tampered with
//
// On-disk format (stored as a single string):
//   v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
//
// The "v1:" prefix lets us rotate algorithms later without breaking old rows.

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const VERSION = "v1";

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is missing. Generate one with: openssl rand -hex 32"
    );
  }
  // Accept a 64-char hex string (preferred) OR any string (hashed to 32 bytes).
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  return crypto.createHash("sha256").update(raw).digest();
}

function encrypt(plaintext) {
  if (plaintext == null || plaintext === "") return null;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

function decrypt(payload) {
  if (!payload) return null;
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("encrypted payload format is not v1");
  }
  const [, ivHex, tagHex, ctHex] = parts;
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(ctHex, "hex")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

// Mask a secret for log/UI display: "sk-abcd...wxyz"
function mask(s, { keep = 4 } = {}) {
  if (!s) return "";
  if (s.length <= keep * 2) return "*".repeat(s.length);
  return `${s.slice(0, keep)}...${s.slice(-keep)}`;
}

module.exports = { encrypt, decrypt, mask };
