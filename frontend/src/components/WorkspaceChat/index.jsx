import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import ChatContainer from "./ChatContainer";

// Shell that wraps a single workspace: top header + chat area.
export default function WorkspaceChat({ slug }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
            onClick={handleLogout}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 transition"
          >
            Log out
          </button>
        </div>
      </header>
      <ChatContainer slug={slug} />
    </div>
  );
}
