import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";

// ─── small reusable badge ────────────────────────────────────────────────────
function Badge({ label, color }) {
  const colours = {
    green: "bg-emerald-900 text-emerald-300",
    red: "bg-red-900 text-red-300",
    sky: "bg-sky-900 text-sky-300",
    slate: "bg-slate-700 text-slate-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colours[color]}`}>
      {label}
    </span>
  );
}

// ─── Users section ───────────────────────────────────────────────────────────
function UsersSection({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const { users } = await adminApi.listUsers();
      setUsers(users);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const act = async (fn) => {
    setBusy(true);
    setError("");
    try { await fn(); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Users</h2>
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-slate-400 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Username</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {users.map((u) => {
              const isMe = u.id === currentUser?.id;
              return (
                <tr key={u.id} className="hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-mono">
                    {u.username}
                    {isMe && <span className="ml-2 text-slate-500 text-xs">(you)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={u.role} color={u.role === "admin" ? "sky" : "slate"} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      label={u.suspended ? "suspended" : "active"}
                      color={u.suspended ? "red" : "green"}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      {/* Suspend / unsuspend */}
                      {!isMe && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            act(() =>
                              u.suspended
                                ? adminApi.unsuspendUser(u.id)
                                : adminApi.suspendUser(u.id)
                            )
                          }
                          className="px-2 py-1 rounded text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
                        >
                          {u.suspended ? "Unsuspend" : "Suspend"}
                        </button>
                      )}

                      {/* Change role */}
                      {!isMe && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            act(() =>
                              adminApi.changeRole(
                                u.id,
                                u.role === "admin" ? "default" : "admin"
                              )
                            )
                          }
                          className="px-2 py-1 rounded text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
                        >
                          Make {u.role === "admin" ? "default" : "admin"}
                        </button>
                      )}

                      {/* Delete */}
                      {!isMe && (
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
                            act(() => adminApi.deleteUser(u.id));
                          }}
                          className="px-2 py-1 rounded text-xs bg-red-900/60 hover:bg-red-800 text-red-300 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Invites section ─────────────────────────────────────────────────────────
function InvitesSection() {
  const [invites, setInvites] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(null); // invite id that was just copied

  const load = async () => {
    try {
      const { invites } = await adminApi.listInvites();
      setInvites(invites);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      await adminApi.createInvite();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    setBusy(true);
    setError("");
    try {
      await adminApi.deleteInvite(id);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = (invite) => {
    const url = `${window.location.origin}/register?token=${invite.token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(invite.id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Invite links</h2>
        <button
          disabled={busy}
          onClick={generate}
          className="px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-sm disabled:opacity-50"
        >
          + Generate invite
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {invites.length === 0 ? (
        <p className="text-slate-500 text-sm">No invites yet. Generate one to share.</p>
      ) : (
        <div className="space-y-2">
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg bg-slate-800 border border-slate-700"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Badge
                  label={inv.used ? "used" : "open"}
                  color={inv.used ? "slate" : "green"}
                />
                <span className="font-mono text-xs text-slate-400 truncate">
                  {inv.token}
                </span>
                {inv.claimedBy && (
                  <span className="text-xs text-slate-500">
                    → claimed by <strong>{inv.claimedBy.username}</strong>
                  </span>
                )}
              </div>

              <div className="flex gap-2 shrink-0">
                {!inv.used && (
                  <button
                    onClick={() => copyLink(inv)}
                    className="px-2 py-1 rounded text-xs bg-slate-700 hover:bg-slate-600"
                  >
                    {copied === inv.id ? "Copied!" : "Copy link"}
                  </button>
                )}
                <button
                  disabled={busy}
                  onClick={() => remove(inv.id)}
                  className="px-2 py-1 rounded text-xs bg-red-900/60 hover:bg-red-800 text-red-300 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function UserManagement() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/workspace/default" className="text-slate-400 hover:text-white">
            ← Back to workspace
          </Link>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link
            to="/settings/llm"
            className="text-slate-400 hover:text-white"
          >
            LLM Settings
          </Link>
          <span className="text-sky-400 font-medium">User Management</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-12">
        <h1 className="text-2xl font-bold">User Management</h1>
        <UsersSection currentUser={user} />
        <InvitesSection />
      </main>
    </div>
  );
}
