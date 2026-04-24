import { useEffect, useRef, useState } from "react";
import { chatApi, threadApi, agentApi } from "../../../api/client";
import ChatHistory from "./ChatHistory";
import PromptInput from "./PromptInput";
import AgentThinking from "./AgentThinking";

// Holds the mutable state of one conversation (workspace or thread).
// Props:
//   slug         : workspace slug
//   activeThread : { slug, name } | null  (null = workspace default context)
export default function ChatContainer({ slug, activeThread }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingPrompt, setPendingPrompt] = useState(null);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState("");
  const [agentMode, setAgentMode] = useState(false);
  // agentSteps: live tool-call / tool-result events during an agent run.
  const [agentSteps, setAgentSteps] = useState([]);
  const [agentThinking, setAgentThinking] = useState(false);
  const activeStream = useRef(null);
  // Ref to accumulate agent response text — avoids stale closure in event handler.
  const agentResponseRef = useRef("");

  // Reload history whenever the active thread changes.
  useEffect(() => {
    let cancelled = false;

    activeStream.current?.abort();
    activeStream.current = null;
    agentResponseRef.current = "";
    setPendingPrompt(null);
    setStreamingText("");
    setError("");
    setAgentSteps([]);
    setAgentThinking(false);
    setLoading(true);
    setRows([]);

    (async () => {
      try {
        let chats;
        if (activeThread) {
          const res = await threadApi.getHistory(slug, activeThread.slug);
          chats = res.chats;
        } else {
          const res = await chatApi.getHistory(slug);
          chats = res.chats;
        }
        if (!cancelled) setRows(chats);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [slug, activeThread?.slug ?? null]);

  // Regular (non-agent) streaming chat.
  const handleRegularSend = (message) => {
    setPendingPrompt(message);
    setStreamingText("");
    setError("");

    const stream = chatApi.stream(
      slug,
      message,
      (evt) => {
        if (evt.type === "chunk") {
          setStreamingText((prev) => prev + evt.text);
        } else if (evt.type === "done") {
          setRows((prev) => [
            ...prev,
            { id: evt.id, prompt: message, response: evt.response, createdAt: evt.createdAt, sources: evt.sources ?? [] },
          ]);
          setPendingPrompt(null);
          setStreamingText("");
          activeStream.current = null;
        } else if (evt.type === "error") {
          setError(evt.error);
          setPendingPrompt(null);
          setStreamingText("");
          activeStream.current = null;
        }
      },
      { threadSlug: activeThread?.slug ?? undefined }
    );
    activeStream.current = stream;
  };

  // Agent streaming chat — tool calls loop then final answer.
  const handleAgentSend = (message) => {
    agentResponseRef.current = "";
    setPendingPrompt(message);
    setStreamingText("");
    setError("");
    setAgentSteps([]);
    setAgentThinking(true);

    const stream = agentApi.stream(
      slug,
      message,
      (evt) => {
        if (evt.type === "tool_call" || evt.type === "tool_result") {
          setAgentSteps((prev) => [...prev, evt]);
        } else if (evt.type === "chunk") {
          setAgentThinking(false);
          // Accumulate into ref so the saved handler always reads fresh text.
          agentResponseRef.current += evt.text;
          setStreamingText((prev) => prev + evt.text);
        } else if (evt.type === "done") {
          setAgentThinking(false);
        } else if (evt.type === "saved") {
          // Use ref value — NOT streamingText (stale closure).
          setRows((prev) => [
            ...prev,
            { id: evt.id, prompt: message, response: agentResponseRef.current, createdAt: evt.createdAt, sources: [] },
          ]);
          setPendingPrompt(null);
          setStreamingText("");
          agentResponseRef.current = "";
          activeStream.current = null;
        } else if (evt.type === "error") {
          setError(evt.error);
          setPendingPrompt(null);
          setStreamingText("");
          setAgentThinking(false);
          agentResponseRef.current = "";
          activeStream.current = null;
        }
      },
      { threadSlug: activeThread?.slug ?? undefined }
    );
    activeStream.current = stream;
  };

  const handleSend = (message) => {
    if (agentMode) {
      handleAgentSend(message);
    } else {
      handleRegularSend(message);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        Loading chat...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Agent mode toggle bar */}
      <div className="flex items-center gap-3 px-6 py-2 border-b border-slate-800 shrink-0">
        <button
          onClick={() => setAgentMode((v) => !v)}
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition ${
            agentMode
              ? "bg-violet-700 text-white"
              : "bg-slate-800 text-slate-400 hover:bg-slate-700"
          }`}
        >
          <span>⚡</span>
          <span>{agentMode ? "Agent mode ON" : "Agent mode"}</span>
        </button>
        {agentMode && (
          <span className="text-xs text-slate-500">
            Tools: 🌐 web search · 📄 document search
          </span>
        )}
      </div>

      <ChatHistory
        rows={rows}
        pendingPrompt={pendingPrompt}
        streamingText={streamingText}
      />

      {/* Agent thinking steps — shown while an agent run is in progress */}
      {pendingPrompt && agentMode && (
        <AgentThinking steps={agentSteps} thinking={agentThinking} />
      )}

      {error && (
        <div className="px-6 py-2 text-sm text-rose-400 border-t border-rose-900/40 bg-rose-900/10">
          {error}
        </div>
      )}
      <PromptInput onSend={handleSend} disabled={!!pendingPrompt} />
    </div>
  );
}
