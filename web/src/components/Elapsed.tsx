import { useEffect, useState } from "react";

function fmt(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

// Live run timer: ticks while running, freezes at the final duration once ended.
export function Elapsed({ startedAt, endedAt }: { startedAt?: number; endedAt?: number }) {
  const [now, setNow] = useState(() => Date.now());
  const running = startedAt != null && endedAt == null;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running]);

  if (startedAt == null) return null;
  const ms = (endedAt ?? now) - startedAt;
  return <span className="font-mono text-xs text-dim">{fmt(ms)}</span>;
}
