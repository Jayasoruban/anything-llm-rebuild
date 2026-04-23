import { useEffect, useRef, useState } from "react";
import { chatApi } from "../../../api/client";
import ChatHistory from "./ChatHistory";
import PromptInput from "./PromptInput";

// Holds the mutable state of one workspace's conversation:
//   - completed rows (loaded from DB)
//   - the live-streaming message being typed right now (if any)
export default function ChatContainer({ slug }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingPrompt, setPendingPrompt] = useState(null);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState("");
  const activeStream = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { chats } = await chatApi.getHistory(slug);
        if (!cancelled) setRows(chats);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      activeStream.current?.abort();
    };
  }, [slug]);

  const handleSend = (message) => {
    setPendingPrompt(message);
    setStreamingText("");
    setError("");

    const stream = chatApi.stream(slug, message, (evt) => {
      if (evt.type === "chunk") {
        setStreamingText((prev) => prev + evt.text);
      } else if (evt.type === "done") {
        setRows((prev) => [
          ...prev,
          {
            id: evt.id,
            prompt: message,
            response: evt.response,
            createdAt: evt.createdAt,
          },
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
    });
    activeStream.current = stream;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        Loading chat...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ChatHistory
        rows={rows}
        pendingPrompt={pendingPrompt}
        streamingText={streamingText}
      />
      {error && (
        <div className="px-6 py-2 text-sm text-rose-400 border-t border-rose-900/40 bg-rose-900/10">
          {error}
        </div>
      )}
      <PromptInput onSend={handleSend} disabled={!!pendingPrompt} />
    </div>
  );
}
