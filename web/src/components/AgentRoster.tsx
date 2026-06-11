import type { AgentInfo } from "../api.ts";

// The agent registry the master (engine) can delegate to — read-only context that makes
// the planner's choices legible. Engine-mode only: in single-agent mode there is no
// registry, and the Composer's dropdown is the selector.
export function AgentRoster({ agents, search }: { agents: AgentInfo[]; search?: string }) {
  if (agents.length === 0) return null;
  return (
    <section className="card">
      <h2 className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs uppercase tracking-wide text-dim">
        Registry · {agents.length} agents
        <span className="ml-auto normal-case text-[11px]">the master delegates to these</span>
      </h2>
      <div className="grid grid-cols-1 gap-2.5 p-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => (
          <div key={a.name} className="rounded-lg border border-line bg-panel2 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] text-white">{a.name}</span>
              {a.name === "research" && (
                <span className="rounded-full border border-line px-1.5 py-px text-[10px] text-dim">
                  search: {search ?? "fixture"}
                </span>
              )}
            </div>
            {a.description && <p className="mt-1 text-xs leading-snug text-dim">{a.description}</p>}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {a.capabilities.map((c) => (
                <span key={c} className="rounded-full bg-accent/10 px-2 py-px text-[10px] text-accent">
                  {c}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
