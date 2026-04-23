import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { settingsApi } from "../../api/client";

// Must match the keys the backend whitelist uses.
const PROVIDERS = [
  { id: "openai", name: "OpenAI", modelHint: "e.g. gpt-4o-mini" },
  { id: "gemini", name: "Google Gemini", modelHint: "e.g. gemini-2.5-flash-lite" },
];

export default function LLMPreference() {
  // Server's view of the current config — provider + per-provider {apiKey, model, apiKeySet}.
  // Keys come back masked ("AIza...xyz") so we never hold real secrets in React state.
  const [config, setConfig] = useState(null);

  // Currently selected tab in the form.
  const [provider, setProvider] = useState("openai");
  // Form inputs — apiKey is left blank so user only types when they want to replace it.
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  // Load on mount.
  useEffect(() => {
    (async () => {
      try {
        const data = await settingsApi.getLLM();
        setConfig(data);
        setProvider(data.provider ?? "openai");
        setModel(data[data.provider ?? "openai"]?.model ?? "");
      } catch (err) {
        setStatus({ type: "error", msg: `could not load settings: ${err.message}` });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // When user flips the provider dropdown, sync the visible fields to that provider's saved values.
  const onProviderChange = (next) => {
    setProvider(next);
    setApiKey("");
    setModel(config?.[next]?.model ?? "");
    setStatus(null);
  };

  const onTest = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const r = await settingsApi.testLLM({ provider, apiKey, model });
      if (r.ok) {
        setStatus({
          type: "success",
          msg: `Connected (${r.latencyMs}ms). Reply: "${r.reply?.slice(0, 80)}"`,
        });
      } else {
        setStatus({ type: "error", msg: r.error ?? "test failed" });
      }
    } catch (err) {
      setStatus({ type: "error", msg: err.message });
    } finally {
      setTesting(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await settingsApi.saveLLM({ provider, apiKey, model });
      const fresh = await settingsApi.getLLM();
      setConfig(fresh);
      setApiKey(""); // clear so next change is explicit
      setStatus({ type: "success", msg: "saved" });
    } catch (err) {
      setStatus({ type: "error", msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-200">
        loading...
      </div>
    );
  }

  const savedKeyHint = config?.[provider]?.apiKeySet
    ? `Saved: ${config[provider].apiKey} (leave blank to keep)`
    : "Not configured yet — paste your API key";

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <header className="border-b border-slate-700 px-6 py-4 flex items-center gap-4">
        <Link to="/" className="text-slate-400 hover:text-white">
          ← Back to chat
        </Link>
        <h1 className="text-xl font-semibold">LLM Preference</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div>
          <label className="block text-sm mb-2 text-slate-400">Provider</label>
          <select
            value={provider}
            onChange={(e) => onProviderChange(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-2 text-slate-400">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={savedKeyHint}
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm mb-2 text-slate-400">Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={PROVIDERS.find((p) => p.id === provider)?.modelHint}
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 font-mono text-sm"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onTest}
            disabled={testing || saving}
            className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
          >
            {testing ? "Testing..." : "Test connection"}
          </button>
          <button
            onClick={onSave}
            disabled={testing || saving}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-medium"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>

        {status && (
          <div
            className={`mt-2 px-4 py-3 rounded text-sm ${
              status.type === "success"
                ? "bg-emerald-900/40 border border-emerald-700 text-emerald-200"
                : "bg-red-900/40 border border-red-700 text-red-200"
            }`}
          >
            {status.msg}
          </div>
        )}

        <p className="text-xs text-slate-500 pt-6">
          Changes apply to the very next chat message — no restart needed. API
          keys are encrypted at rest.
        </p>
      </main>
    </div>
  );
}
