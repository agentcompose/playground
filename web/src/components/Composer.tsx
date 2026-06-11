import { useState } from "react";
import type { AgentInfo, Mode, RunRequest } from "../api.ts";
import { ConfigForm } from "./ConfigForm.tsx";

const SAMPLES: { label: string; goal: string }[] = [
  {
    label: "Summarize the spec README",
    goal: "Fetch https://raw.githubusercontent.com/agentcompose/spec/main/README.md and write a 5-bullet executive summary.",
  },
  {
    label: "Describe example.com",
    goal: "Fetch https://example.com and describe what the page is in two sentences.",
  },
  {
    label: "Key engine concepts",
    goal: "Fetch https://raw.githubusercontent.com/agentcompose/engine/main/README.md and list the 3 most important concepts with one line each.",
  },
  {
    label: "🔬 Research: Raft vs Paxos",
    goal: "Research the trade-offs between Raft and Paxos for consensus in a write-heavy service, and produce a cited report.",
  },
];

// Per-agent sample goals for single-agent mode (so the goal matches the worker's job).
const AGENT_SAMPLES: Record<string, string> = {
  fetch: "https://raw.githubusercontent.com/agentcompose/spec/main/README.md",
  writer: "Summarize in 3 bullets: AgentCompose composes agents as reusable, configurable components.",
  research: "The trade-offs between Raft and Paxos for consensus in a write-heavy service.",
  coding: "Create hello.txt containing a haiku about composable agents.",
};

export function Composer({
  mode,
  busy,
  agents,
  selectedAgent,
  onSelectAgent,
  config,
  onConfigChange,
  onRun,
}: {
  mode: Mode;
  busy: boolean;
  agents: AgentInfo[];
  selectedAgent?: string;
  onSelectAgent: (name: string) => void;
  config: Record<string, unknown>;
  onConfigChange: (next: Record<string, unknown>) => void;
  onRun: (req: RunRequest) => void;
}) {
  const [goal, setGoal] = useState("");
  const [govern, setGovern] = useState(true);
  const [clarify, setClarify] = useState(false);

  const agent = agents.find((a) => a.name === selectedAgent);
  const canRun = !busy && goal.trim() !== "" && (mode === "engine" || !!selectedAgent);

  const submit = () => {
    if (!canRun) return;
    if (mode === "engine") onRun({ mode: "engine", goal: goal.trim(), govern, clarify });
    else onRun({ mode: "agent", goal: goal.trim(), agent: selectedAgent, config });
  };

  const placeholder =
    mode === "engine"
      ? "Give the engine a goal…  (⌘/Ctrl + Enter to run)"
      : agent
        ? `Give ${agent.title} a goal…  (⌘/Ctrl + Enter to run)`
        : "Pick an agent first…";

  const samples = mode === "engine" ? SAMPLES : agentSamplesFor(selectedAgent);

  return (
    <div className="space-y-3">
      {mode === "agent" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-dim">Agent</span>
          <select
            value={selectedAgent ?? ""}
            onChange={(e) => onSelectAgent(e.target.value)}
            className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm outline-none focus:border-accent"
          >
            <option value="" disabled>
              Select an agent…
            </option>
            {agents.map((a) => (
              <option key={a.name} value={a.name}>
                {a.title} — {a.name}
              </option>
            ))}
          </select>
          {agent?.description && <span className="text-xs text-dim">{agent.description}</span>}
        </div>
      )}

      <div className="flex gap-3">
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder={placeholder}
          className="flex-1 min-h-[76px] resize-y rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
        />
        <div className="flex w-40 flex-col gap-2">
          <button
            disabled={!canRun}
            onClick={submit}
            className="rounded-xl bg-accent px-4 py-2.5 font-semibold text-[#0b1020] transition enabled:hover:brightness-110 disabled:opacity-40"
          >
            Run ▶
          </button>
          {mode === "engine" && (
            <>
              <label className="flex cursor-pointer items-center gap-2 px-1 text-[13px] text-dim select-none">
                <input type="checkbox" checked={govern} onChange={(e) => setGovern(e.target.checked)} />
                Govern fetch (HITL)
              </label>
              <label className="flex cursor-pointer items-center gap-2 px-1 text-[13px] text-dim select-none">
                <input type="checkbox" checked={clarify} onChange={(e) => setClarify(e.target.checked)} />
                Clarify research (HITL)
              </label>
            </>
          )}
        </div>
      </div>

      {mode === "agent" && agent && (
        <div className="rounded-xl border border-line bg-panel/40 p-3.5">
          <div className="mb-2.5 text-xs uppercase tracking-wide text-dim">Configuration</div>
          <ConfigForm schema={agent.configSchema} value={config} onChange={onConfigChange} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {samples.map((s) => (
          <button
            key={s.label}
            onClick={() => setGoal(s.goal)}
            className="rounded-full border border-line bg-panel2 px-3 py-1 text-xs text-dim transition hover:text-white"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function agentSamplesFor(name?: string): { label: string; goal: string }[] {
  if (!name || !AGENT_SAMPLES[name]) return [];
  return [{ label: `Sample for ${name}`, goal: AGENT_SAMPLES[name] }];
}
