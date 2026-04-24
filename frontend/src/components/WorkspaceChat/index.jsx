import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import ChatContainer from "./ChatContainer";
import DocumentPanel from "./DocumentPanel";

// Shell that wraps a single workspace: top header + chat area + document side panel.
export default function WorkspaceChat({ slug }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showDocs, setShowDocs] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">AnythingLLM Rebuild</span>
          <span className="text-slate-500">/</span>
          <span className="text-sky-400 font-medium">{slug}</span>
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
            <Link
              to="/settings/llm"
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 transition"
              title="LLM settings"
            >
              ⚙ Settings
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 transition"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main area: chat on left, document panel slides in on right */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <ChatContainer slug={slug} />
        </div>
        {showDocs && (
          <DocumentPanel slug={slug} onClose={() => setShowDocs(false)} />
        )}
      </div>
    </div>
  );
}
