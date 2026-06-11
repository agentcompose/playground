import { useState } from "react";
import type { SpanView } from "../types.ts";

const KIND_ICON: Record<string, string> = {
  run: "▶",
  agent: "🤖",
  step: "→",
  plan: "🗂",
  llm: "✦",
  tool: "🔧",
  retrieval: "🔎",
  internal: "·",
};
const kindIcon = (kind?: string) => (kind && KIND_ICON[kind]) || "•";

function fmtDur(span: SpanView): string {
  if (span.endTime == null) return "…";
  const ms = span.endTime - span.startTime;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

const STATUS_DOT: Record<SpanView["status"], string> = {
  ok: "bg-ok",
  error: "bg-err",
  unset: "bg-dim/50",
};

// One span row + its subtree. Indentation encodes depth; a thin rail makes nesting legible.
function SpanRow({ span, depth }: { span: SpanView; depth: number }) {
  const [open, setOpen] = useState(true);
  const attrs = Object.entries(span.attributes ?? {}).filter(([k]) => k !== "agent.id");
  const hasDetail = attrs.length > 0 || (span.events?.length ?? 0) > 0 || !!span.error;
  const hasChildren = span.children.length > 0;
  const expandable = hasChildren || hasDetail;

  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded px-1.5 py-1 hover:bg-panel2/60"
        style={{ paddingLeft: depth * 14 + 6 }}
      >
        <button
          onClick={() => setOpen((o) => !o)}
          className={`w-3 shrink-0 text-[10px] text-dim ${expandable ? "" : "invisible"}`}
        >
          {open ? "▾" : "▸"}
        </button>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[span.status]}`} />
        <span className="shrink-0 text-xs">{kindIcon(span.kind)}</span>
        <span className="truncate text-[14px] text-[#dde3ee]" title={span.name}>
          {span.name}
        </span>
        {span.kind && <span className="shrink-0 text-[11.5px] text-dim">{span.kind}</span>}
        <span className="ml-auto shrink-0 font-mono text-[12px] text-dim">{fmtDur(span)}</span>
      </div>

      {open && hasDetail && (
        <div className="space-y-0.5 py-0.5" style={{ paddingLeft: depth * 14 + 30 }}>
          {attrs.map(([k, v]) => (
            <div key={k} className="flex gap-2 font-mono text-[12.5px]">
              <span className="text-[#7d869b]">{k}</span>
              <span className="truncate text-[#aab3c5]">{JSON.stringify(v)}</span>
            </div>
          ))}
          {span.events?.map((e, i) => (
            <div key={i} className="font-mono text-[12.5px] text-[#c08cf0]">⚑ {e.name}</div>
          ))}
          {span.error && <div className="font-mono text-[12.5px] text-err">✗ {span.error.message}</div>}
        </div>
      )}

      {open && hasChildren && span.children.map((c) => <SpanRow key={c.spanId} span={c} depth={depth + 1} />)}
    </div>
  );
}

// The nested trace: what each agent actually did, as a tree of timed spans. This is the
// observability plane — it renders whatever spans were emitted, of any agent shape,
// without assuming a workflow (an un-instrumented agent simply shows one root span).
export function TraceTree({ spans }: { spans: SpanView[] }) {
  if (!spans.length) {
    return <div className="text-sm italic text-dim">No spans yet — the trace appears here as the run works.</div>;
  }
  return (
    <div className="rounded-lg border border-line bg-bg/40 p-1">
      {spans.map((s) => (
        <SpanRow key={s.spanId} span={s} depth={0} />
      ))}
    </div>
  );
}
