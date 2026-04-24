import { useState } from "react";

// Icons for each tool name.
const TOOL_ICONS = {
  web_search: "🌐",
  search_documents: "📄",
};

// Renders the agent's thinking steps: tool calls + results.
// steps = [{ type: "tool_call"|"tool_result", tool, args?, result? }]
export default function AgentThinking({ steps = [], thinking = false }) {
  const [expanded, setExpanded] = useState(false);

  if (!thinking && steps.length === 0) return null;

  // Group steps into pairs: [tool_call, tool_result].
  const pairs = [];
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].type === "tool_call") {
      pairs.push({ call: steps[i], result: steps[i + 1]?.type === "tool_result" ? steps[i + 1] : null });
      i++;
    }
  }

  return (
    <div className="mx-6 mb-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition"
      >
        <span className={thinking ? "animate-spin" : ""}>{thinking ? "⚙" : "✓"}</span>
        <span>
          {thinking
            ? "Agent is thinking…"
            : `Agent used ${pairs.length} tool${pairs.length !== 1 ? "s" : ""}`}
        </span>
        <span>{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 pl-4 border-l-2 border-slate-800">
          {pairs.map((pair, i) => (
            <div key={i} className="text-xs space-y-1">
              {/* Tool call */}
              <div className="flex items-start gap-2 text-slate-400">
                <span>{TOOL_ICONS[pair.call.tool] ?? "🔧"}</span>
                <div>
                  <span className="font-mono text-slate-300">{pair.call.tool}</span>
                  {pair.call.args && (
                    <span className="text-slate-600 ml-1">
                      ({Object.values(pair.call.args).join(", ")})
                    </span>
                  )}
                </div>
              </div>

              {/* Tool result — collapsible */}
              {pair.result && (
                <details className="ml-6">
                  <summary className="cursor-pointer text-slate-600 hover:text-slate-400">
                    View result
                  </summary>
                  <pre className="mt-1 p-2 rounded bg-slate-900 text-slate-400 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                    {pair.result.result}
                  </pre>
                </details>
              )}

              {/* Still waiting for result */}
              {!pair.result && thinking && (
                <p className="ml-6 text-slate-600 animate-pulse">Running…</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
