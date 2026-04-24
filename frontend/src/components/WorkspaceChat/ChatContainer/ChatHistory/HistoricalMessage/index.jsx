import { useState } from "react";

// Renders a single chat "bubble" — one per user OR assistant turn.
// Supports three states:
//   - normal (content)
//   - pending (no content yet — shows "Thinking...")
//   - streaming (content present + blinking cursor)
// For assistant messages, also renders a collapsible Sources section
// when sources (RAG context chunks) are attached to the message.
export default function HistoricalMessage({
  role,
  content,
  pending = false,
  streaming = false,
  sources = [],
}) {
  const isUser = role === "user";
  const [showSources, setShowSources] = useState(false);
  const hasSources = !isUser && sources.length > 0;

  return (
    <div className={`w-full flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`max-w-[80%] flex flex-col gap-2`}>
        {/* Main bubble */}
        <div
          className={`px-4 py-3 rounded-2xl whitespace-pre-wrap
            ${isUser
              ? "bg-sky-600 text-white rounded-br-md"
              : "bg-slate-800 text-slate-100 rounded-bl-md"}`}
        >
          {pending ? (
            <span className="inline-flex gap-1 items-center text-slate-400">
              <span className="animate-pulse">Thinking</span>
              <span className="animate-bounce">.</span>
              <span className="animate-bounce [animation-delay:.15s]">.</span>
              <span className="animate-bounce [animation-delay:.3s]">.</span>
            </span>
          ) : (
            <>
              {content}
              {streaming && (
                <span className="ml-0.5 inline-block w-2 h-4 bg-sky-300 align-middle animate-pulse" />
              )}
            </>
          )}
        </div>

        {/* Sources toggle — only for assistant messages with RAG results */}
        {hasSources && (
          <div className="ml-1">
            <button
              onClick={() => setShowSources((v) => !v)}
              className="text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1"
            >
              <span>{showSources ? "▾" : "▸"}</span>
              <span>Sources ({sources.length})</span>
            </button>

            {showSources && (
              <div className="mt-1 space-y-2">
                {sources.map((s, i) => (
                  <div
                    key={i}
                    className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-slate-400"
                  >
                    <p className="text-slate-500 mb-1 font-mono">
                      source {i + 1} · relevance {(s.score * 100).toFixed(0)}%
                    </p>
                    <p className="line-clamp-4 whitespace-pre-wrap">{s.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
