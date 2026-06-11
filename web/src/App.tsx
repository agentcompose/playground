import { useEffect, useMemo, useState } from "react";
import { getConfig, type Mode, type ServerConfig } from "./api.ts";
import { useRun } from "./hooks/useRun.ts";
import { Composer } from "./components/Composer.tsx";
import { ModeToggle } from "./components/ModeToggle.tsx";
import { defaultsFromSchema } from "./components/ConfigForm.tsx";
import { StepTimeline } from "./components/StepTimeline.tsx";
import { ApprovalCard } from "./components/ApprovalCard.tsx";
import { InputCard } from "./components/InputCard.tsx";
import { ResultPanel } from "./components/ResultPanel.tsx";
import { AgentRoster } from "./components/AgentRoster.tsx";
import { EventLog } from "./components/EventLog.tsx";
import { StatusBadge } from "./components/StatusBadge.tsx";
import { Elapsed } from "./components/Elapsed.tsx";

export function App() {
  const run = useRun();
  const [cfg, setCfg] = useState<ServerConfig | null>(null);
  const [mode, setMode] = useState<Mode>("engine");
  const [selectedAgent, setSelectedAgent] = useState<string>();
  const [config, setConfig] = useState<Record<string, unknown>>({});

  useEffect(() => {
    getConfig().then(setCfg).catch(() => setCfg(null));
  }, []);

  const agents = useMemo(() => cfg?.agents ?? [], [cfg]);

  // Selecting an agent seeds the config form from its declared schema defaults.
  const selectAgent = (name: string) => {
    setSelectedAgent(name);
    const schema = agents.find((a) => a.name === name)?.configSchema;
    setConfig(defaultsFromSchema(schema));
    run.reset();
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    run.reset();
  };

  const busy = run.status === "running" || run.status === "awaiting-approval" || run.status === "awaiting-input";

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-wrap items-baseline gap-3 border-b border-line pb-4">
        <h1 className="text-base font-semibold">
          <span className="mr-1.5">🧩</span>AgentCompose <span className="text-dim">Playground</span>
        </h1>
        <span className="font-mono text-xs text-dim">{cfg ? `${cfg.model} · ${cfg.baseUrl}` : "…"}</span>
        <div className="ml-auto flex items-center gap-3">
          <ModeToggle mode={mode} onChange={switchMode} />
          <Elapsed startedAt={run.startedAt} endedAt={run.endedAt} />
          {busy && (
            <button onClick={run.cancel} className="btn btn-danger btn-sm">
              Stop <span aria-hidden>■</span>
            </button>
          )}
          <StatusBadge status={run.status} />
        </div>
      </header>

      <p className="text-xs text-dim">
        {mode === "engine" ? (
          <>
            <span className="font-medium text-white">Engine mode</span> — give the{" "}
            <span className="font-mono">master</span> a goal; it plans and delegates across the registry below.
          </>
        ) : (
          <>
            <span className="font-medium text-white">Single-agent mode</span> — select one worker, set its config, and
            drive it directly through the AgentCompose contract (no planner). Same contract a master would use.
          </>
        )}
      </p>

      <Composer
        mode={mode}
        busy={busy}
        agents={agents}
        selectedAgent={selectedAgent}
        onSelectAgent={selectAgent}
        config={config}
        onConfigChange={setConfig}
        onRun={run.run}
      />

      {mode === "engine" && <AgentRoster agents={agents} search={cfg?.search} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="border-b border-line px-4 py-2.5 text-xs uppercase tracking-wide text-dim">
            {mode === "engine" ? "Plan & steps" : "Run"}
          </h2>
          <div className="max-h-[58vh] space-y-3 overflow-auto p-3.5">
            {run.pending && (
              <ApprovalCard stepId={run.pending.stepId} agent={run.pending.agent} onDecide={run.approve} />
            )}
            {run.inputAsk && (
              <InputCard
                stepId={run.inputAsk.stepId}
                agent={run.inputAsk.agent}
                prompt={run.inputAsk.prompt}
                onAnswer={run.answer}
              />
            )}
            <StepTimeline steps={run.steps} />
          </div>
        </section>

        <section className="card">
          <h2 className="border-b border-line px-4 py-2.5 text-xs uppercase tracking-wide text-dim">Result</h2>
          <div className="max-h-[58vh] overflow-auto p-4">
            <ResultPanel parts={run.resultParts} error={run.error} />
          </div>
        </section>
      </div>

      <EventLog log={run.log} />

      <footer className="mt-auto pt-4 text-xs text-dim">
        Two altitudes over one contract: <span className="font-mono">Engine</span> (a master plans and delegates) and{" "}
        <span className="font-mono">Single agent</span> (drive one worker directly). The registry is built from a single
        declarative catalog, so adding an agent is one line. Durability is in-memory — resume works within this process.
        HITL appears in both: governor approval (engine) and a worker escalating an <span className="font-mono">input-required</span>{" "}
        question (engine via the master, or directly in single-agent mode when <span className="font-mono">clarify</span> is set).
      </footer>
    </div>
  );
}
