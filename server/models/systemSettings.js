const { prisma } = require("./prisma");
const { encrypt, decrypt } = require("../utils/crypto");

const SETUP_COMPLETE_KEY = "has_setup_completed";

const SystemSettings = {
  // Raw string get/set — use for non-secret values (provider name, model name).
  get: async (label) => {
    const row = await prisma.systemSettings.findUnique({ where: { label } });
    return row?.value ?? null;
  },

  set: async (label, value) => {
    return prisma.systemSettings.upsert({
      where: { label },
      update: { value },
      create: { label, value },
    });
  },

  // Encrypted variants — use for secrets (API keys).
  // getSecret returns the plaintext, or null if the row doesn't exist.
  getSecret: async (label) => {
    const row = await prisma.systemSettings.findUnique({ where: { label } });
    if (!row?.value) return null;
    return decrypt(row.value);
  },

  setSecret: async (label, plaintext) => {
    const ciphertext = encrypt(plaintext);
    return SystemSettings.set(label, ciphertext);
  },

  // Batch helper: returns { label: value } for every label passed in.
  // Missing rows come back as null so callers can still destructure safely.
  getMany: async (labels) => {
    const rows = await prisma.systemSettings.findMany({
      where: { label: { in: labels } },
    });
    const out = {};
    for (const l of labels) out[l] = null;
    for (const r of rows) out[r.label] = r.value;
    return out;
  },

  isSetupComplete: async () => {
    return (await SystemSettings.get(SETUP_COMPLETE_KEY)) === "true";
  },

  markSetupComplete: async () => {
    return SystemSettings.set(SETUP_COMPLETE_KEY, "true");
  },
};

// Canonical setting labels — every key used elsewhere lives here to prevent typos.
const SETTINGS = {
  SETUP_COMPLETE: SETUP_COMPLETE_KEY,
  LLM_PROVIDER: "llm_provider",
  OPENAI_API_KEY: "llm_openai_api_key",
  OPENAI_MODEL: "llm_openai_model",
  GEMINI_API_KEY: "llm_gemini_api_key",
  GEMINI_MODEL: "llm_gemini_model",
  EMBEDDING_PROVIDER: "embedding_provider",
  EMBEDDING_MODEL: "embedding_model",
};

module.exports = { SystemSettings, SETUP_COMPLETE_KEY, SETTINGS };
