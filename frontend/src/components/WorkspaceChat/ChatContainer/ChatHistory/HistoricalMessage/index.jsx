// Renders a single chat "bubble" — one per user OR assistant turn.
// Supports three states:
//   - normal (content)
//   - pending (no content yet — shows "Thinking...")
//   - streaming (content present + blinking cursor)
export default function HistoricalMessage({ role, content, pending = false, streaming = false }) {
  const isUser = role === "user";

  return (
    <div className={`w-full flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl whitespace-pre-wrap
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
            {streaming && <span className="ml-0.5 inline-block w-2 h-4 bg-sky-300 align-middle animate-pulse" />}
          </>
        )}
      </div>
    </div>
  );
}
