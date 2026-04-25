// ============================================================================
//  MCP Servers — admin settings page
//
//  What this page shows:
//  - Each MCP server configured in server/.env (MCP_SERVERS)
//  - Whether it connected successfully on startup
//  - What tools it exposed (name + description)
//
//  This page is READ-ONLY — you configure servers in .env, not from the UI.
//  (Adding runtime config is a future enhancement.)
// ============================================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";

// Status badge — green dot for connected, red for failed.
function StatusBadge({ connected }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
        connected
          ? "bg-emerald-900/60 text-emerald-300"
          : "bg-red-900/60 text-red-300"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          connected ? "bg-emerald-400" : "bg-red-400"
        }`}
      />
      {connected ? "Connected" : "Failed"}
    </span>
  );
}

// Card for one MCP server — shows its name, command, status, and tool list.
function ServerCard({ server }) {
  const [showTools, setShowTools] = useState(false);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-lg">🔌</span>
            <span className="font-semibold text-slate-100">{server.name}</span>
            <StatusBadge connected={server.connected} />
          </div>
          <p className="mt-1 text-xs text-slate-500 font-mono">{server.command}</p>
        </div>

        {/* Tool count + expand toggle */}
        {server.connected && (
          <button
            onClick={() => setShowTools((v) => !v)}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
          >
            <span>{server.toolCount} tool{server.toolCount !== 1 ? "s" : ""}</span>
            <span>{showTools ? "▾" : "▸"}</span>
          </button>
        )}
      </div>

      {/* Tool list (expandable) */}
      {showTools && server.tools.length > 0 && (
        <div className="border-t border-slate-700 divide-y divide-slate-700/50">
          {server.tools.map((tool) => (
            <div key={tool.name} className="px-5 py-3">
              <p className="text-sm font-mono text-sky-400">{tool.name}</p>
              {tool.description && (
                <p className="text-xs text-slate-500 mt-0.5">{tool.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Not connected — show hint */}
      {!server.connected && (
        <div className="border-t border-slate-700 px-5 py-3 text-xs text-slate-500">
          Connection failed on startup. Check that the command is correct and any required
          tokens are set in <code className="text-slate-400">server/.env</code>.
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MCPServers() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/admin/mcp/servers")
      .then(({ servers }) => setServers(servers))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800">
        <Link to="/workspace/default" className="text-sm text-slate-400 hover:text-white">
          ← Back to workspace
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/settings/llm" className="text-slate-400 hover:text-white">LLM</Link>
          <Link to="/settings/users" className="text-slate-400 hover:text-white">Users</Link>
          <span className="text-sky-400 font-medium">MCP Servers</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">MCP Servers</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            MCP (Model Context Protocol) servers give the agent extra tools — like searching
            GitHub, reading databases, or calling any external API.
            Configure servers in <code className="text-slate-300">server/.env</code> using the{" "}
            <code className="text-slate-300">MCP_SERVERS</code> key. They connect automatically
            when the server starts.
          </p>
        </div>

        {/* Setup instructions card */}
        <div className="mb-8 rounded-lg border border-slate-700 bg-slate-800/50 px-5 py-4 text-sm space-y-2">
          <p className="font-medium text-slate-300">Adding the GitHub MCP server:</p>
          <ol className="list-decimal list-inside text-slate-400 space-y-1">
            <li>Go to github.com → Settings → Developer settings → Personal access tokens</li>
            <li>Create a token with <code className="text-slate-300">repo</code> scope</li>
            <li>Add to <code className="text-slate-300">server/.env</code>:</li>
          </ol>
          <pre className="mt-2 p-3 rounded bg-slate-900 text-xs text-slate-300 overflow-x-auto">
{`GITHUB_TOKEN=ghp_your_token_here
MCP_SERVERS={"github":{"command":"npx","args":["-y","@modelcontextprotocol/server-github"],"env":{"GITHUB_TOKEN":"ghp_your_token_here"}}}`}
          </pre>
          <p className="text-slate-500 text-xs">Restart the server after changing .env</p>
        </div>

        {/* Server list */}
        {loading && (
          <p className="text-slate-500">Loading MCP server status…</p>
        )}
        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}
        {!loading && servers.length === 0 && (
          <div className="rounded-lg border border-slate-700 border-dashed px-6 py-10 text-center">
            <p className="text-slate-500">No MCP servers configured yet.</p>
            <p className="text-slate-600 text-sm mt-1">
              Add <code className="text-slate-500">MCP_SERVERS</code> to server/.env to get started.
            </p>
          </div>
        )}
        <div className="space-y-4">
          {servers.map((s) => (
            <ServerCard key={s.name} server={s} />
          ))}
        </div>
      </main>
    </div>
  );
}
