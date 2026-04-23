import { useEffect, useRef } from "react";
import HistoricalMessage from "./HistoricalMessage";

// Flattens stored Q&A rows into a flat list of user/assistant bubbles.
// Each chat row { prompt, response } → 2 messages on screen.
const rowsToMessages = (rows) =>
  rows.flatMap((row) => [
    { id: `u-${row.id}`, role: "user", content: row.prompt },
    { id: `a-${row.id}`, role: "assistant", content: row.response },
  ]);

export default function ChatHistory({ rows, pendingPrompt, streamingText }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rows, pendingPrompt, streamingText]);

  const messages = rowsToMessages(rows);
  const isStreaming = !!pendingPrompt;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-3xl mx-auto">
        {messages.length === 0 && !isStreaming && (
          <div className="text-center text-slate-500 mt-20">
            Start the conversation — type a message below.
          </div>
        )}
        {messages.map((m) => (
          <HistoricalMessage key={m.id} role={m.role} content={m.content} />
        ))}
        {isStreaming && (
          <>
            <HistoricalMessage role="user" content={pendingPrompt} />
            <HistoricalMessage
              role="assistant"
              content={streamingText}
              pending={!streamingText}
              streaming={!!streamingText}
            />
          </>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
