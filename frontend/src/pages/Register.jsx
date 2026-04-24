import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, Token } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

// Public registration page — only reachable via an invite link.
// URL format: /register?token=<uuid>
export default function Register() {
  const [params] = useSearchParams();
  const inviteToken = params.get("token") ?? "";

  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!inviteToken) {
      return setError("No invite token found in URL. Ask your admin for a valid link.");
    }
    setLoading(true);
    try {
      const data = await api.post("/auth/register", {
        username: form.username.trim().toLowerCase(),
        password: form.password,
        token: inviteToken,
      });
      Token.set(data.token);
      login(data.user, data.token);
      navigate("/workspace/default", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1">Create your account</h1>
        <p className="text-slate-400 text-sm mb-8">
          You were invited to join AnythingLLM Rebuild.
        </p>

        {!inviteToken && (
          <div className="mb-6 px-4 py-3 rounded bg-red-900/50 border border-red-700 text-red-300 text-sm">
            Invalid or missing invite token. Please use the link your admin sent you.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              disabled={!inviteToken}
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-500 disabled:opacity-50"
              placeholder="choose a username"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              disabled={!inviteToken}
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-500 disabled:opacity-50"
              placeholder="choose a password"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !inviteToken}
            className="w-full py-2 rounded bg-sky-600 hover:bg-sky-500 font-medium transition disabled:opacity-50"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
