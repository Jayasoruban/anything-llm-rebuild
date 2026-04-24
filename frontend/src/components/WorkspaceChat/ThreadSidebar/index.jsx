import { useEffect, useState } from "react";
import { threadApi } from "../../../api/client";

// Thread sidebar — shown on the left of the workspace.
// Props:
//   slug           : workspace slug
//   activeThread   : { slug, name } | null (null = "default" / no thread)
//   onSelect(t)    : called when user clicks a thread (t = thread object or null)
//   onClose()      : called when user hides the sidebar
export default function ThreadSidebar({ slug, activeThread, onSelect, onClose }) {
  const [threads, setThreads] = useState([]);
  const [editingId, setEditingId] = useState(null); // thread id being renamed
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { threads } = await threadApi.list(slug);
      setThreads(threads);
    } catch {
      // silently ignore — sidebar shouldn't crash the app
    }
  };

  useEffect(() => { load(); }, [slug]);

  const createThread = async () => {
    setBusy(true);
    try {
      const { thread } = await threadApi.create(slug, "New Thread");
      await load();
      onSelect(thread); // auto-switch to the new thread
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  const deleteThread = async (t) => {
    if (!confirm(`Delete thread "${t.name}"? All its chats will be lost.`)) return;
    setBusy(true);
    try {
      await threadApi.delete(slug, t.slug);
      // If we deleted the active thread, fall back to default (null).
      if (activeThread?.slug === t.slug) onSelect(null);
      await load();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  const startRename = (t) => {
    setEditingId(t.id);
    setEditName(t.name);
  };

  const commitRename = async (t) => {
    if (!editName.trim() || editName.trim() === t.name) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    try {
      await threadApi.rename(slug, t.slug, editName.trim());
      await load();
    } catch {
      // ignore
    } finally {
      setBusy(false);
      setEditingId(null);
    }
  };

  return (
    <aside className="w-56 flex flex-col border-r border-slate-800 bg-slate-950 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-800">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Threads
        </span>
        <button
          onClick={onClose}
          className="text-slate-600 hover:text-slate-300 text-lg leading-none"
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {/* "Default" entry — no thread, uses workspace-level history */}
        <button
          onClick={() => onSelect(null)}
          className={`w-full text-left px-3 py-2 rounded text-sm truncate transition ${
            activeThread === null
              ? "bg-sky-800 text-white"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          💬 Default
        </button>

        {threads.map((t) => (
          <div
            key={t.id}
            className={`group flex items-center gap-1 px-2 py-1.5 rounded transition ${
              activeThread?.slug === t.slug
                ? "bg-sky-800"
                : "hover:bg-slate-800"
            }`}
          >
            {editingId === t.id ? (
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => commitRename(t)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(t);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="flex-1 bg-slate-700 text-slate-100 text-sm px-1 py-0.5 rounded outline-none min-w-0"
              />
            ) : (
              <button
                onClick={() => onSelect(t)}
                className="flex-1 text-left text-sm truncate text-slate-300"
              >
                {t.name}
              </button>
            )}

            {/* Rename + delete — visible on hover */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
              <button
                onClick={() => startRename(t)}
                title="Rename"
                className="text-slate-500 hover:text-slate-200 text-xs"
              >
                ✏
              </button>
              <button
                onClick={() => deleteThread(t)}
                disabled={busy}
                title="Delete"
                className="text-slate-500 hover:text-red-400 text-xs disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* New thread button */}
      <div className="px-3 py-3 border-t border-slate-800">
        <button
          onClick={createThread}
          disabled={busy}
          className="w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 disabled:opacity-50 transition"
        >
          + New thread
        </button>
      </div>
    </aside>
  );
}
