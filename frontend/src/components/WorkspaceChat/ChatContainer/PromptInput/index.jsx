import { useRef, useState } from "react";

// The text box + send button at the bottom.
// Enter = send, Shift+Enter = newline, matching ChatGPT / AnythingLLM.
export default function PromptInput({ onSend, disabled }) {
  const [text, setText] = useState("");
  const ref = useRef(null);

  const submit = (e) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-slate-800 bg-slate-900 px-6 py-4">
      <form
        onSubmit={submit}
        className="max-w-3xl mx-auto flex gap-3 items-end"
      >
        <textarea
          ref={ref}
          rows={1}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Type a message..."
          className="flex-1 resize-none px-4 py-3 rounded-xl bg-slate-800 border border-slate-700
                     focus:border-sky-500 outline-none text-slate-100 placeholder-slate-500
                     disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40
                     disabled:cursor-not-allowed font-medium text-white transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}
