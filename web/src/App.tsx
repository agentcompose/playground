import { useEffect, useState } from "react";
import { getConfig, type ServerConfig } from "./api.ts";
import { useRun } from "./hooks/useRun.ts";
import { Composer } from "./components/Composer.tsx";
import { StepTimeline } from "./components/StepTimeline.tsx";
import { ApprovalCard } from "./components/ApprovalCard.tsx";
import { ResultPanel } from "./components/ResultPanel.tsx";
import { AgentRoster } from "./components/AgentRoster.tsx";
import { EventLog } from "./components/EventLog.tsx";
import { StatusBadge } from "./components/StatusBadge.tsx";

export function App() {
  const run = useRun();
  const [cfg, setCfg] = useState<ServerConfig | null>(null);

  useEffect(() => {
    getConfig().then(setCfg).catch(() => setCfg(null));
  }, []);

  const busy = run.status === "running" || run.status === "awaiting-approval";

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-5 px-5 py-6">
      <header className="flex items-baseline gap-3 border-b border-line pb-4">
        <h1 className="text-base font-semibold">
          <span className="mr-1.5">🧩</span>AgentCompose <span className="text-dim">Playground</span>
        </h1>
        <span className="font-mono text-xs text-dim">{cfg ? `${cfg.model} · ${cfg.baseUrl}` : "…"}</span>
        <div className="ml-auto">
          <StatusBadge status={run.status} />
        </div>
      </header>

      <Composer busy={busy} onRun={run.run} />

      {cfg?.agents && <AgentRoster agents={cfg.agents} search={cfg.search} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-panel/40">
          <h2 className="border-b border-line px-4 py-2.5 text-xs uppercase tracking-wide text-dim">Plan &amp; steps</h2>
          <div className="max-h-[58vh] space-y-3 overflow-auto p-3.5">
            {run.pending && (
              <ApprovalCard stepId={run.pending.stepId} agent={run.pending.agent} onDecide={run.approve} />
            )}
            <StepTimeline steps={run.steps} />
          </div>
        </section>

        <section className="rounded-xl border border-line bg-panel/40">
          <h2 className="border-b border-line px-4 py-2.5 text-xs uppercase tracking-wide text-dim">Result</h2>
          <div className="max-h-[58vh] overflow-auto p-4">
            <ResultPanel result={run.result} error={run.error} />
          </div>
        </section>
      </div>

      <EventLog log={run.log} />

      <footer className="mt-auto pt-4 text-xs text-dim">
        Real planner (your model) orchestrating real <span className="font-mono">fetch</span>,{" "}
        <span className="font-mono">writer</span>, and <span className="font-mono">research</span> agents — the
        last is the standalone <span className="font-mono">@agentcompose/research-agent</span> worker. Durability is
        in-memory — resume works within this process.
      </footer>
    </div>
  );
}
