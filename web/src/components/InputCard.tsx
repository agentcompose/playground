import { useState } from "react";

export function InputCard({
  stepId,
  agent,
  prompt,
  onAnswer,
}: {
  stepId: string;
  agent: string;
  prompt: string;
  onAnswer: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const submit = () => {
    if (text.trim()) onAnswer(text.trim());
  };
  return (
    <div className="rounded-xl border border-accent/70 bg-[#0f1830] p-3.5">
      <div className="mb-1.5 text-sm font-semibold text-accent">
        <span className="font-mono">{agent}</span> <span className="text-dim">({stepId})</span> needs input
      </div>
      <p className="mb-2.5 whitespace-pre-wrap text-sm text-white/90">{prompt}</p>
      <p className="mb-2.5 text-xs text-dim">
        A delegated agent escalated a required decision to the engine, which suspended the run durably and bubbled it up
        to you (its controller). Your answer is routed back down to the worker.
      </p>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        placeholder="Your answer…  (⌘/Ctrl + Enter)"
        className="mb-2.5 min-h-[60px] w-full resize-y rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <button
        onClick={submit}
        disabled={!text.trim()}
        className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-[#0b1020] transition enabled:hover:brightness-110 disabled:opacity-40"
      >
        Send ▶
      </button>
    </div>
  );
}
