import { useState } from "react";
import { type EngineEvent } from "../types.ts";

export function EventLog({ log }: { log: EngineEvent[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs uppercase tracking-wide text-dim hover:text-white"
      >
        {open ? "▾" : "▸"} Raw event log ({log.length})
      </button>
      {open && (
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-bg p-3 font-mono text-[11px] text-dim">
          {log.map((e, i) => `${i.toString().padStart(2, "0")}  ${JSON.stringify(e)}`).join("\n")}
        </pre>
      )}
    </div>
  );
}
