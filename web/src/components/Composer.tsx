import { useState } from "react";
import type { AgentInfo, Mode, RunRequest } from "../api.ts";
import { ConfigForm } from "./ConfigForm.tsx";

const SAMPLES: { label: string; goal: string }[] = [
  {
    label: "Summarize the spec README",
    goal: "Fetch https://raw.githubusercontent.com/agentcompose/spec/main/README.md, then write a crisp executive summary: a one-sentence thesis, exactly 5 bullets covering the contract's two surfaces and how composition works, and a closing line on who should care and why.",
  },
  {
    label: "Describe example.com",
    goal: "Fetch https://example.com and explain, in two sentences, what this page is and why it exists — written for a non-technical reader.",
  },
  {
    label: "Engine concepts → brief",
    goal: "Fetch https://raw.githubusercontent.com/agentcompose/engine/main/README.md and produce a short technical brief: the 3 most important concepts (one tight paragraph each) and a final 'when would I reach for this?' note.",
  },
  {
    label: "🔬 Research: Raft vs Paxos",
    goal: "Research the practical trade-offs between Raft and Paxos for a write-heavy, leader-based service. Compare leader election, throughput under contention, and operational complexity, then give a clear recommendation with caveats. Cite your sources.",
  },
];

// Per-agent sample goals for single-agent mode. Written to actually exercise each
// worker's behavior — fetch pulls real content, writer shows tone/format control,
// research shows multi-angle cited synthesis — so one run is a fair demonstration.
const AGENT_SAMPLES: Record<string, { label: string; goal: string }[]> = {
  fetch: [
    { label: "spec README", goal: "https://raw.githubusercontent.com/agentcompose/spec/main/README.md" },
    { label: "engine README", goal: "https://raw.githubusercontent.com/agentcompose/engine/main/README.md" },
    { label: "example.com", goal: "https://example.com" },
  ],
  writer: [
    {
      label: "Exec summary",
      goal: "Write a 5-bullet executive summary of this idea, then a one-line takeaway: AgentCompose runs autonomous agents as reusable, configurable components — ship sensible defaults, expose typed knobs (model, prompt, tools, limits), and compose them into pipelines.",
    },
    {
      label: "Tweet thread",
      goal: "Turn this into a punchy, numbered 3-tweet thread for developers (≤280 chars each, no hashtags): orchestrating AI agents is hard because every agent ships its own interface; a shared contract makes them swappable, configurable, and composable.",
    },
    {
      label: "Tone rewrite",
      goal: "Rewrite the following as two labeled versions — (1) formal release-notes tone, (2) casual changelog tone: 'we added a thing that lets agents talk to each other and get configured without forking the code.'",
    },
  ],
  research: [
    {
      label: "Raft vs Paxos",
      goal: "Investigate the practical trade-offs between Raft and Paxos for a write-heavy, leader-based service — leader election, throughput under contention, and operational complexity — then close with a clear recommendation and its caveats. Cite sources.",
    },
    {
      label: "Consensus trade-offs",
      goal: "Research how consensus algorithms trade off latency, throughput, and availability across deployment topologies (single-region vs geo-distributed), and summarize when each profile is the right choice. Cite sources.",
    },
    {
      label: "Agent interop",
      goal: "Survey the current landscape of AI agent interoperability standards (e.g. MCP, A2A, and peers): what problem each solves, where they overlap, and where the gaps remain. Cite sources.",
    },
  ],
  coding: [
    {
      label: "Haiku file",
      goal: "Create hello.txt containing an original three-line haiku about composable software agents, then show me the file you created.",
    },
    {
      label: "FizzBuzz",
      goal: "Write fizzbuzz.js that prints FizzBuzz for 1–30, add a one-line comment explaining the modulo trick, run it, and show me the output.",
    },
  ],
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
            className="select"
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
          className="field min-h-[76px] flex-1 resize-y px-4 py-3"
        />
        <div className="flex w-40 flex-col gap-2">
          <button disabled={!canRun} onClick={submit} className="btn btn-primary py-2.5">
            Run <span aria-hidden>▶</span>
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

      <div className="flex flex-wrap gap-2">
        {samples.map((s) => (
          <button key={s.label} onClick={() => setGoal(s.goal)} className="chip">
            {s.label}
          </button>
        ))}
      </div>

      {mode === "agent" && agent && (
        <div className="card p-3.5">
          <div className="mb-2.5 text-xs uppercase tracking-wide text-dim">Configuration</div>
          <ConfigForm schema={agent.configSchema} value={config} onChange={onConfigChange} />
        </div>
      )}
    </div>
  );
}

function agentSamplesFor(name?: string): { label: string; goal: string }[] {
  return (name && AGENT_SAMPLES[name]) || [];
}
