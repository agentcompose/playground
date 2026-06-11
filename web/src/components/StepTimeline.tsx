import { useState } from "react";
import { type Artifact, type StepView, partsToText } from "../types.ts";
import { PartView } from "./PartView.tsx";

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

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const [open, setOpen] = useState(true);
  const chars = partsToText(artifact.parts).length;
  return (
    <div className="rounded-md border border-line bg-bg/60">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left">
        <span aria-hidden className="text-dim">{open ? "▾" : "▸"}</span>
        <span className="text-[12.5px] text-accent">📎 {artifact.name ?? artifact.id}</span>
        <span className="ml-auto text-[10px] text-dim">{chars} chars</span>
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-line p-2">
          {artifact.parts.map((p, i) => (
            <PartView key={i} part={p} name={artifact.name} />
          ))}
        </div>
      )}
    </div>
  );
}

function StepCard({ step }: { step: StepView }) {
  const [open, setOpen] = useState(false);
  const body = step.output ?? step.messages;
  const artifacts = step.artifacts ?? [];
  return (
    <div className={`rounded-lg border ${BORDER[step.state]} bg-panel p-3`}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-accent">{step.id}</span>
        <span className="text-xs text-dim">→ {step.agent}</span>
        {step.durationMs != null && (
          <span className="font-mono text-[10px] text-dim">{fmtDuration(step.durationMs)}</span>
        )}
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${BADGE[step.state]}`}>{step.state}</span>
      </div>
      {step.progress && <div className="mt-1.5 text-xs text-dim">{step.progress}</div>}
      {step.error && <div className="mt-1.5 text-xs text-err">{step.error}</div>}
      {artifacts.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {artifacts.map((a) => (
            <ArtifactCard key={a.id} artifact={a} />
          ))}
        </div>
      )}
      {body && (
        <div className="mt-2">
          <button onClick={() => setOpen((o) => !o)} className="text-xs text-dim hover:text-white">
            {open ? "▾ hide output" : "▸ show output"} ({body.length} chars)
          </button>
          {open && (
            <pre className="mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-bg p-2 font-mono text-[12.5px] text-[#cbd2e0]">
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
