import { type RunStatus } from "../types.ts";

const MAP: Record<RunStatus, { label: string; cls: string }> = {
  idle: { label: "idle", cls: "text-dim" },
  running: { label: "running", cls: "text-accent" },
  "awaiting-approval": { label: "awaiting approval", cls: "text-warn" },
  completed: { label: "completed", cls: "text-ok" },
  failed: { label: "failed", cls: "text-err" },
  canceled: { label: "canceled", cls: "text-dim" },
};

export function StatusBadge({ status }: { status: RunStatus }) {
  const m = MAP[status];
  return (
    <span className={`font-mono text-xs ${m.cls}`}>
      {status === "running" && <span className="inline-block animate-pulse">● </span>}
      {m.label}
    </span>
  );
}
