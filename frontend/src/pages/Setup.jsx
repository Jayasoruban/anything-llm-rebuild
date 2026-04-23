import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Setup() {
  const { createFirstUser } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await createFirstUser(username.trim(), password);
      navigate("/workspace/default", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-slate-800 rounded-xl p-8 shadow-lg"
      >
        <h1 className="text-2xl font-semibold mb-1">Create admin account</h1>
        <p className="text-sm text-slate-400 mb-6">
          First-time setup — this user will be the admin.
        </p>

        <label className="block text-sm mb-1">Username</label>
        <input
          type="text"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          className="w-full mb-4 px-3 py-2 rounded bg-slate-900 border border-slate-700 focus:border-sky-500 outline-none"
        />

        <label className="block text-sm mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full mb-4 px-3 py-2 rounded bg-slate-900 border border-slate-700 focus:border-sky-500 outline-none"
        />

        {error && (
          <p className="text-sm text-rose-400 mb-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2 rounded bg-sky-500 hover:bg-sky-400 disabled:opacity-50 font-medium transition"
        >
          {busy ? "Creating..." : "Create account"}
        </button>
      </form>
    </div>
  );
}
