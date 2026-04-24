import { useEffect, useRef, useState } from "react";
import { chatApi, threadApi } from "../../../api/client";
import ChatHistory from "./ChatHistory";
import PromptInput from "./PromptInput";

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
  const activeStream = useRef(null);

  // Reload history whenever the active thread changes.
  useEffect(() => {
    let cancelled = false;

    // Abort any in-flight stream from the previous thread.
    activeStream.current?.abort();
    activeStream.current = null;
    setPendingPrompt(null);
    setStreamingText("");
    setError("");
    setLoading(true);
    setRows([]);

    (async () => {
      try {
        let chats;
        if (activeThread) {
          // Load thread-specific history.
          const res = await threadApi.getHistory(slug, activeThread.slug);
          chats = res.chats;
        } else {
          // Load workspace-level (no thread) history.
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

  const handleSend = (message) => {
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
            {
              id: evt.id,
              prompt: message,
              response: evt.response,
              createdAt: evt.createdAt,
              sources: evt.sources ?? [],
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
      },
      // Pass the active thread slug so the server scopes history correctly.
      { threadSlug: activeThread?.slug ?? undefined }
    );
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
    <div className="flex-1 flex flex-col overflow-hidden h-full">
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
