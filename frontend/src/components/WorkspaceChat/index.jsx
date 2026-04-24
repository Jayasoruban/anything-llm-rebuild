import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import ChatContainer from "./ChatContainer";
import DocumentPanel from "./DocumentPanel";
import ThreadSidebar from "./ThreadSidebar";

// Shell: header + optional thread sidebar (left) + chat + optional doc panel (right).
export default function WorkspaceChat({ slug }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showDocs, setShowDocs] = useState(false);
  const [showThreads, setShowThreads] = useState(false);
  const [activeThread, setActiveThread] = useState(null); // null = default context

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleSelectThread = (thread) => {
    // Reset chat when switching threads so stale history doesn't flash.
    setActiveThread(thread);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowThreads((v) => !v)}
            className={`px-3 py-1.5 rounded text-sm transition ${
              showThreads
                ? "bg-sky-700 text-white"
                : "bg-slate-800 hover:bg-slate-700"
            }`}
            title="Threads"
          >
            🗂 Threads
          </button>
          <span className="text-lg font-semibold">AnythingLLM Rebuild</span>
          <span className="text-slate-500">/</span>
          <span className="text-sky-400 font-medium">{slug}</span>
          {activeThread && (
            <>
              <span className="text-slate-500">/</span>
              <span className="text-emerald-400 text-sm">{activeThread.name}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-400">
            {user?.username}{" "}
            <span className="text-slate-600">({user?.role})</span>
          </span>
          <button
            onClick={() => setShowDocs((v) => !v)}
            className={`px-3 py-1.5 rounded transition ${
              showDocs
                ? "bg-sky-700 text-white"
                : "bg-slate-800 hover:bg-slate-700"
            }`}
          >
            📄 Documents
          </button>
          {user?.role === "admin" && (
            <>
              <Link
                to="/settings/users"
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 transition"
                title="User management"
              >
                👥 Users
              </Link>
              <Link
                to="/settings/llm"
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 transition"
                title="LLM settings"
              >
                ⚙ Settings
              </Link>
            </>
          )}
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 transition"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Body: thread sidebar | chat | doc panel */}
      <div className="flex flex-1 overflow-hidden">
        {showThreads && (
          <ThreadSidebar
            slug={slug}
            activeThread={activeThread}
            onSelect={handleSelectThread}
            onClose={() => setShowThreads(false)}
          />
        )}

        <div className="flex-1 overflow-hidden">
          <ChatContainer slug={slug} activeThread={activeThread} />
        </div>

        {showDocs && (
          <DocumentPanel slug={slug} onClose={() => setShowDocs(false)} />
        )}
      </div>
    </div>
  );
}
