import { useMemo, useState } from "react";
import { type EngineEvent, type LogEntry } from "../types.ts";

// Per-event-type presentation: an icon, a color, and whether it's "noisy" (the
// high-frequency progress/message stream you usually want to filter out to see the
// lifecycle skeleton).
const META: Record<string, { icon: string; cls: string; noisy?: boolean }> = {
  "run-started": { icon: "▶", cls: "text-accent" },
  plan: { icon: "🗂", cls: "text-accent" },
  "step-started": { icon: "→", cls: "text-[#8ab4ff]" },
  progress: { icon: "·", cls: "text-dim", noisy: true },
  message: { icon: "…", cls: "text-dim", noisy: true },
  artifact: { icon: "📎", cls: "text-[#c08cf0]" },
  "step-completed": { icon: "✓", cls: "text-ok" },
  "step-retry": { icon: "↻", cls: "text-[#e0b341]" },
  "step-fallback": { icon: "⇄", cls: "text-[#e0b341]" },
  "step-failed": { icon: "✗", cls: "text-err" },
  suspended: { icon: "⏸", cls: "text-[#c08cf0]" },
  canceled: { icon: "■", cls: "text-dim" },
  result: { icon: "★", cls: "text-ok" },
  error: { icon: "✗", cls: "text-err" },
};
const meta = (t: string) => META[t] ?? { icon: "•", cls: "text-dim" };

// A compact one-line summary of an event's payload (so you don't have to expand JSON).
function summarize(ev: EngineEvent): string {
  switch (ev.type) {
    case "plan":
      return ev.steps.map((s) => `${s.id}→${s.agent}`).join(", ");
    case "step-started":
      return `${ev.stepId} (${ev.agent})`;
    case "progress":
      return `${ev.stepId} ${ev.percent != null ? ev.percent + "% " : ""}${ev.message ?? ""}`.trim();
    case "message":
      return ev.delta.kind === "text" ? ev.delta.text.slice(0, 80) : `[${ev.delta.kind}]`;
    case "artifact":
      return ev.artifact.name ?? ev.artifact.id;
    case "step-completed":
      return ev.stepId;
    case "step-retry":
      return `${ev.stepId} attempt ${ev.attempt}/${ev.maxAttempts}: ${ev.error.message}`;
    case "step-fallback":
      return `${ev.from} → ${ev.to}`;
    case "step-failed":
      return `${ev.stepId}: ${ev.error.message}`;
    case "suspended":
      return ev.reason.kind;
    case "error":
      return ev.error.message;
    default:
      return "";
  }
}

function dt(t: number, t0: number): string {
  const ms = t - t0;
  if (ms < 1000) return `+${ms}ms`;
  return `+${(ms / 1000).toFixed(1)}s`;
}

export function EventLog({ log }: { log: LogEntry[] }) {
  const [open, setOpen] = useState(false);
  const [hideNoise, setHideNoise] = useState(true);
  const [raw, setRaw] = useState(false);

  const t0 = log[0]?.t ?? 0;
  const shown = useMemo(
    () => (hideNoise ? log.filter((e) => !meta(e.ev.type).noisy) : log),
    [log, hideNoise],
  );
  const noiseCount = log.length - log.filter((e) => !meta(e.ev.type).noisy).length;

  const rawText = useMemo(
    () => shown.map((e, i) => `${i.toString().padStart(2, "0")}  ${JSON.stringify(e.ev)}`).join("\n"),
    [shown],
  );
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable (e.g. non-secure context) */
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs uppercase tracking-wide text-dim hover:text-white"
        >
          {open ? "▾" : "▸"} Event log ({log.length})
        </button>
        {open && (
          <div className="flex items-center gap-3 text-xs text-dim">
            <label className="flex cursor-pointer items-center gap-1.5 select-none">
              <input type="checkbox" checked={hideNoise} onChange={(e) => setHideNoise(e.target.checked)} />
              hide progress/message{noiseCount > 0 && ` (${noiseCount})`}
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 select-none">
              <input type="checkbox" checked={raw} onChange={(e) => setRaw(e.target.checked)} />
              raw JSON
            </label>
            <button
              onClick={copy}
              title="Copy the shown events as JSON lines"
              className="rounded border border-line px-1.5 py-0.5 text-[11px] hover:text-white"
            >
              {copied ? "✓ copied" : "⧉ copy"}
            </button>
          </div>
        )}
      </div>

      {open &&
        (raw ? (
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-bg p-3 font-mono text-xs text-dim">
            {rawText}
          </pre>
        ) : (
          <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-line bg-bg p-2 font-mono text-[12.5px]">
            {shown.length === 0 ? (
              <div className="px-1 py-0.5 text-dim italic">No events yet.</div>
            ) : (
              shown.map((e, i) => {
                const m = meta(e.ev.type);
                return (
                  <div key={i} className="flex items-baseline gap-2 px-1 py-0.5">
                    <span className="w-12 shrink-0 text-right text-[11.5px] text-[#5b6477]">{dt(e.t, t0)}</span>
                    <span className={`w-4 shrink-0 text-center ${m.cls}`}>{m.icon}</span>
                    <span className={`w-28 shrink-0 ${m.cls}`}>{e.ev.type}</span>
                    <span className="truncate text-[#9aa4b8]">{summarize(e.ev)}</span>
                  </div>
                );
              })
            )}
          </div>
        ))}
    </div>
  );
}
