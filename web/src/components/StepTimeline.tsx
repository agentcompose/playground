import { useState } from "react";
import { type StepView } from "../types.ts";

const BADGE: Record<StepView["state"], string> = {
  pending: "bg-panel2 text-dim",
  running: "bg-[#21314f] text-accent",
  done: "bg-[#14361f] text-ok",
  failed: "bg-[#3a1717] text-err",
};
const BORDER: Record<StepView["state"], string> = {
  pending: "border-line",
  running: "border-accent/60",
  done: "border-ok/40",
  failed: "border-err/50",
};

function StepCard({ step }: { step: StepView }) {
  const [open, setOpen] = useState(false);
  const body = step.output ?? step.messages;
  return (
    <div className={`rounded-lg border ${BORDER[step.state]} bg-panel p-3`}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-accent">{step.id}</span>
        <span className="text-xs text-dim">→ {step.agent}</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${BADGE[step.state]}`}>{step.state}</span>
      </div>
      {step.progress && <div className="mt-1.5 text-xs text-dim">{step.progress}</div>}
      {step.error && <div className="mt-1.5 text-xs text-err">{step.error}</div>}
      {body && (
        <div className="mt-2">
          <button onClick={() => setOpen((o) => !o)} className="text-[11px] text-dim hover:text-white">
            {open ? "▾ hide output" : "▸ show output"} ({body.length} chars)
          </button>
          {open && (
            <pre className="mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-bg p-2 font-mono text-[11.5px] text-[#cbd2e0]">
              {body}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function StepTimeline({ steps }: { steps: StepView[] }) {
  if (!steps.length) return <div className="text-sm italic text-dim">No steps yet — run a goal.</div>;
  return (
    <div className="space-y-2">
      {steps.map((s) => (
        <StepCard key={s.id} step={s} />
      ))}
    </div>
  );
}
