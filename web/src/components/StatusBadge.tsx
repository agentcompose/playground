import { type RunStatus } from "../types.ts";

const MAP: Record<RunStatus, { label: string; cls: string; dot: string }> = {
  idle: { label: "idle", cls: "text-dim border-line", dot: "bg-dim" },
  running: { label: "running", cls: "text-accent border-accent/40", dot: "bg-accent" },
  "awaiting-approval": { label: "awaiting approval", cls: "text-warn border-warn/40", dot: "bg-warn" },
  "awaiting-input": { label: "awaiting input", cls: "text-accent border-accent/40", dot: "bg-accent" },
  completed: { label: "completed", cls: "text-ok border-ok/40", dot: "bg-ok" },
  failed: { label: "failed", cls: "text-err border-err/40", dot: "bg-err" },
  canceled: { label: "canceled", cls: "text-dim border-line", dot: "bg-dim" },
};

export function StatusBadge({ status }: { status: RunStatus }) {
  const m = MAP[status];
  const live = status === "running" || status === "awaiting-approval" || status === "awaiting-input";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border bg-panel2/50 px-2.5 py-1 font-mono text-[11px] ${m.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot} ${live ? "animate-pulse" : ""}`} />
      {m.label}
    </span>
  );
}
