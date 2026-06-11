import type { AgentInfo } from "../api.ts";

// The agent registry. In engine mode it's read-only context — the workers the master
// can delegate to. In single-agent mode the cards become selectable: click one to pick
// the worker to drive directly. Same roster, two purposes — the point being a master and
// a worker are the same kind of thing.
export function AgentRoster({
  agents,
  search,
  selectable = false,
  selected,
  onSelect,
}: {
  agents: AgentInfo[];
  search?: string;
  selectable?: boolean;
  selected?: string;
  onSelect?: (name: string) => void;
}) {
  if (agents.length === 0) return null;
  return (
    <section className="rounded-xl border border-line bg-panel/40">
      <h2 className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs uppercase tracking-wide text-dim">
        Registry · {agents.length} agents
        <span className="ml-auto normal-case text-[11px]">
          {selectable ? "click to test an agent directly" : "the master delegates to these"}
        </span>
      </h2>
      <div className="grid grid-cols-1 gap-2.5 p-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => {
          const active = selectable && a.name === selected;
          return (
            <button
              key={a.name}
              type="button"
              disabled={!selectable}
              onClick={() => onSelect?.(a.name)}
              className={
                "rounded-lg border bg-panel2 px-3 py-2.5 text-left transition " +
                (selectable ? "cursor-pointer hover:border-accent/60 " : "cursor-default ") +
                (active ? "border-accent ring-1 ring-accent/40" : "border-line")
              }
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[13px] text-white">{a.name}</span>
                {a.name === "research" && (
                  <span className="rounded-full border border-line px-1.5 py-px text-[10px] text-dim">
                    search: {search ?? "fixture"}
                  </span>
                )}
                {active && <span className="ml-auto text-[10px] text-accent">selected</span>}
              </div>
              {a.description && <p className="mt-1 text-xs leading-snug text-dim">{a.description}</p>}
              <div className="mt-1.5 flex flex-wrap gap-1">
                {a.capabilities.map((c) => (
                  <span key={c} className="rounded-full bg-accent/10 px-2 py-px text-[10px] text-accent">
                    {c}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
