const { Router } = require("express");
const logger = require("../utils/logger");
const { validatedRequest, requireAdmin } = require("../utils/auth");
const { SystemSettings, SETTINGS } = require("../models/systemSettings");
const { mask } = require("../utils/crypto");
const { OpenAiProvider } = require("../utils/AiProviders/openAi");
const { GeminiProvider } = require("../utils/AiProviders/gemini");

// Whitelist of LLM providers the UI is allowed to pick from.
// Each entry describes how to read/write/construct that provider's config.
const PROVIDERS = {
  openai: {
    apiKeyLabel: SETTINGS.OPENAI_API_KEY,
    modelLabel: SETTINGS.OPENAI_MODEL,
    envApiKey: "OPENAI_API_KEY",
    envModel: "OPENAI_MODEL",
    defaultModel: "gpt-4o-mini",
    Provider: OpenAiProvider,
  },
  gemini: {
    apiKeyLabel: SETTINGS.GEMINI_API_KEY,
    modelLabel: SETTINGS.GEMINI_MODEL,
    envApiKey: "GEMINI_API_KEY",
    envModel: "GEMINI_MODEL",
    defaultModel: "gemini-2.5-flash-lite",
    Provider: GeminiProvider,
  },
};

// Resolve one provider's effective config: { apiKey, model, apiKeySet }
// Follows the usual DB > env > null priority.
// apiKey is returned MASKED for the UI — we never leak raw keys over the wire.
async function readProvider(name) {
  const spec = PROVIDERS[name];
  if (!spec) return null;

  const [dbKey, dbModel] = await Promise.all([
    SystemSettings.getSecret(spec.apiKeyLabel),
    SystemSettings.get(spec.modelLabel),
  ]);

  const effectiveKey = dbKey ?? process.env[spec.envApiKey] ?? null;
  const effectiveModel =
    dbModel ?? process.env[spec.envModel] ?? spec.defaultModel;

  return {
    apiKey: effectiveKey ? mask(effectiveKey) : "",
    apiKeySet: Boolean(effectiveKey),
    model: effectiveModel,
  };
}

const systemSettingsEndpoints = (app) => {
  const router = Router();

  // All endpoints below are admin-only.
  router.use(validatedRequest, requireAdmin);

  // GET current LLM config (keys are masked).
  router.get("/llm-provider", async (_req, res) => {
    try {
      const [currentProvider, openai, gemini] = await Promise.all([
        SystemSettings.get(SETTINGS.LLM_PROVIDER),
        readProvider("openai"),
        readProvider("gemini"),
      ]);
      res.json({
        provider: currentProvider ?? process.env.LLM_PROVIDER ?? "openai",
        openai,
        gemini,
      });
    } catch (err) {
      logger.error(`GET /llm-provider failed: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // POST save LLM config.
  // Body: { provider, apiKey?, model? }
  // - apiKey omitted or empty string => keep existing (lets admin edit model alone)
  // - apiKey provided => encrypt and overwrite
  router.post("/llm-provider", async (req, res) => {
    try {
      const { provider, apiKey, model } = req.body ?? {};
      const spec = PROVIDERS[provider];
      if (!spec) {
        return res
          .status(400)
          .json({ error: `unsupported provider: ${provider}` });
      }

      await SystemSettings.set(SETTINGS.LLM_PROVIDER, provider);

      if (typeof apiKey === "string" && apiKey.trim().length > 0) {
        await SystemSettings.setSecret(spec.apiKeyLabel, apiKey.trim());
      }
      if (typeof model === "string" && model.trim().length > 0) {
        await SystemSettings.set(spec.modelLabel, model.trim());
      }

      logger.info(`llm-provider updated -> ${provider}`);
      // Read-back gives the UI a freshly-masked snapshot to re-render from.
      const updated = await readProvider(provider);
      res.json({ provider, ...updated });
    } catch (err) {
      logger.error(`POST /llm-provider failed: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // POST test config by actually pinging the LLM.
  // Body may supply creds inline (for a pre-save "Test" click) OR omit them
  // to test whatever is currently saved in the DB.
  router.post("/llm-provider/test", async (req, res) => {
    const { provider, apiKey, model } = req.body ?? {};
    const spec = PROVIDERS[provider];
    if (!spec) {
      return res
        .status(400)
        .json({ error: `unsupported provider: ${provider}` });
    }

    const started = Date.now();
    try {
      // Resolve creds for this test run: inline > DB > env.
      const dbKey = await SystemSettings.getSecret(spec.apiKeyLabel);
      const dbModel = await SystemSettings.get(spec.modelLabel);
      const effectiveKey =
        (typeof apiKey === "string" && apiKey.trim().length > 0
          ? apiKey.trim()
          : null) ??
        dbKey ??
        process.env[spec.envApiKey] ??
        null;
      const effectiveModel =
        (typeof model === "string" && model.trim().length > 0
          ? model.trim()
          : null) ??
        dbModel ??
        process.env[spec.envModel] ??
        spec.defaultModel;

      if (!effectiveKey) {
        return res
          .status(400)
          .json({ ok: false, error: "no API key available to test" });
      }

      const instance = new spec.Provider({
        apiKey: effectiveKey,
        model: effectiveModel,
      });
      const reply = await instance.sendChat([
        { role: "system", content: "You are a connectivity test." },
        { role: "user", content: "Reply with the single word OK." },
      ]);

      res.json({
        ok: true,
        provider,
        model: effectiveModel,
        reply: (reply ?? "").slice(0, 200),
        latencyMs: Date.now() - started,
      });
    } catch (err) {
      // Sanitize — never echo user-provided keys back in error messages.
      res.status(400).json({
        ok: false,
        provider,
        error: err.message,
        latencyMs: Date.now() - started,
      });
    }
  });

  app.use("/api/system-settings", router);
};

module.exports = { systemSettingsEndpoints };
