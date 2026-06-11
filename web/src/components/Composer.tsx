import { useState } from "react";
import type { AgentInfo, Mode, RunRequest } from "../api.ts";
import { ConfigForm } from "./ConfigForm.tsx";

interface Sample {
  label: string;
  goal: string;
  /** Agent-mode only: config knobs this preset also applies (merged into the form). */
  config?: Record<string, unknown>;
  /** Optional tooltip explaining what the preset does / sets. */
  note?: string;
}

const SAMPLES: Sample[] = [
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
  {
    label: "🧭 Idea → feasibility → prototype",
    goal: "Research a few promising niches for a small productivity app, evaluate the top candidates for solo-developer feasibility, then build a minimal prototype of the most feasible one. Confirm the pick with me before building.",
  },
];

// Per-agent sample goals for single-agent mode. Written to actually exercise each
// worker's behavior — fetch pulls real content, writer shows tone/format control,
// research shows multi-angle cited synthesis — so one run is a fair demonstration.
const AGENT_SAMPLES: Record<string, Sample[]> = {
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
  // Analysis is a GENERAL evaluator: it scores supplied options against weighted criteria
  // and recommends one. "Competitive" and "feasibility" are presets, not separate agents;
  // tiers below run preset → custom-weighted → evidence-in (the "decide" node pattern).
  analysis: [
    {
      label: "Feasibility of 3 ideas",
      goal: "Evaluate the feasibility of building each of these as a solo developer in one month, then recommend which to start with.",
      config: {
        preset: "feasibility",
        options: [
          "A minimalist habit tracker app",
          "A real-time multiplayer game with custom netcode",
          "A markdown note-taking PWA",
        ],
      },
      note: "Trivial · feasibility preset, 3 fixed options (inverted effort/cost/risk).",
    },
    {
      label: "Competitive positioning",
      goal: "Assess the market opportunity for entering the personal note-taking space, score the main approaches, and recommend a positioning.",
      config: {
        preset: "competitive",
        options: ["Local-first markdown editor", "AI-native notes with auto-linking", "Privacy-focused encrypted notes"],
      },
      note: "Medium · competitive preset (market gap, differentiation, demand, moat…).",
    },
    {
      label: "Datastore (custom weights)",
      goal: "Pick a primary datastore for a write-heavy, multi-tenant SaaS backend and justify the choice.",
      config: {
        preset: "custom",
        scale: 10,
        criteria: [
          { name: "write throughput", weight: 3 },
          { name: "operational complexity", weight: 2, invert: true },
          { name: "cost", weight: 2, invert: true },
          { name: "ecosystem maturity", weight: 1 },
        ],
        options: ["PostgreSQL", "MongoDB", "CockroachDB", "DynamoDB"],
      },
      note: "Higher · custom weighted criteria, with inverted cost/complexity.",
    },
    {
      label: "Decide from evidence",
      goal:
        "Given the notes below, rank these CI providers for a small open-source TypeScript library and recommend one.\n\nEvidence:\n- GitHub Actions: free for public repos, huge marketplace, native to GitHub, YAML config, occasional queue delays.\n- CircleCI: fast with good caching, limited free tier, a separate account to manage.\n- GitLab CI: powerful and flexible, best when already on GitLab, heavier setup for a GitHub-hosted repo.",
      config: {
        preset: "custom",
        criteria: [
          { name: "cost", weight: 2, invert: true },
          { name: "setup effort", weight: 2, invert: true },
          { name: "speed", weight: 2 },
          { name: "github integration", weight: 2 },
        ],
        options: ["GitHub Actions", "CircleCI", "GitLab CI"],
      },
      note: "Evidence-in · ranks from supplied notes — the 'decide' node downstream of research.",
    },
  ],
};

// Coding samples depend on the server's cwd (for the read-codebase presets), so they
// are built per-render. Tiers run trivial → multi-file → TDD → read-only codebase review.
function codingSamples(cwd?: string): Sample[] {
  const readOnly = cwd
    ? { workspace: cwd, tools: ["read", "grep", "find", "ls"], maxTurns: 40 }
    : { tools: ["read", "grep", "find", "ls"], maxTurns: 40 };
  return [
    {
      label: "Haiku file",
      goal: "Create hello.txt containing an original three-line haiku about composable software agents, then show me the file you created.",
      note: "Trivial · one file, disposable temp workspace.",
    },
    {
      label: "FizzBuzz + run",
      goal: "Write fizzbuzz.js that prints FizzBuzz for 1–30, add a one-line comment explaining the modulo trick, run it with node, and show me the output.",
      note: "Simple · write + execute, disposable temp workspace.",
    },
    {
      label: "Mini CLI (multi-file)",
      goal:
        "Create a tiny zero-dependency Node project: package.json (type module, a \"start\" script) and cli.js that parses a --name flag and prints 'Hello, <name>!' (default 'world'). Then run `node cli.js --name AgentCompose` and show the output.",
      note: "Medium · multiple files + run, disposable temp workspace.",
    },
    {
      label: "TDD: slugify",
      goal:
        "Write slugify.js exporting slugify(str) (lowercase, spaces→dashes, strip non-alphanumerics, collapse repeated dashes) and slugify.test.js using Node's built-in node:test + node:assert. Run `node --test` and iterate until every test passes. Show the final code and the passing test output.",
      config: { maxTurns: 40 },
      note: "Higher · test-driven loop (iterates to green), disposable temp workspace.",
    },
    {
      label: "📖 Read this codebase",
      goal:
        "Read the source in this workspace and produce an architecture overview for a new contributor: the entry point(s), the main modules and what each is responsible for, and how a single request/run flows through the system end to end. Do not modify anything.",
      config: readOnly,
      note: cwd
        ? `Read-only · sets workspace=${cwd} and read-only tools (no edits).`
        : "Read-only · set 'workspace' to a repo path below; uses read-only tools.",
    },
    {
      label: "📖 Find & propose a fix",
      goal:
        "Explore this codebase and identify one concrete, high-value improvement (a latent bug, a missing guard/edge case, or a clarity win). Propose the exact change as a unified diff and explain why it matters. Do NOT apply it — just show the proposed patch.",
      config: readOnly,
      note: cwd
        ? `Read-only · reads workspace=${cwd}, proposes a diff without applying.`
        : "Read-only · set 'workspace' to a repo path below; proposes a diff.",
    },
  ];
}

export function Composer({
  mode,
  busy,
  agents,
  selectedAgent,
  onSelectAgent,
  config,
  onConfigChange,
  onRun,
  cwd,
}: {
  mode: Mode;
  busy: boolean;
  agents: AgentInfo[];
  selectedAgent?: string;
  onSelectAgent: (name: string) => void;
  config: Record<string, unknown>;
  onConfigChange: (next: Record<string, unknown>) => void;
  onRun: (req: RunRequest) => void;
  cwd?: string;
}) {
  const [goal, setGoal] = useState("");
  const [govern, setGovern] = useState(true);
  const [clarify, setClarify] = useState(false);
  const [configOpen, setConfigOpen] = useState(true);

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

  const samples = mode === "engine" ? SAMPLES : agentSamplesFor(selectedAgent, cwd);

  // Clicking a sample fills the goal and, in agent mode, applies any config the preset
  // carries (e.g. read-codebase sets workspace + read-only tools) on top of current config.
  const applySample = (s: Sample) => {
    setGoal(s.goal);
    if (mode === "agent" && s.config) onConfigChange({ ...config, ...s.config });
  };

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
          className="field min-h-19 flex-1 resize-y px-4 py-3"
        />
        <div className="flex w-40 flex-col gap-2">
          <button disabled={!canRun} onClick={submit} className="btn btn-primary py-2.5">
            Run <span aria-hidden>▶</span>
          </button>
          {mode === "engine" && (
            <>
              <label
                title="Engine policy (not the model): suspend before any step that calls the fetch agent and ask you to approve or deny. This is the governor / HITL gate."
                className="flex cursor-pointer items-center gap-2 px-1 text-[13px] text-dim select-none"
              >
                <input type="checkbox" checked={govern} onChange={(e) => setGovern(e.target.checked)} />
                Govern fetch
              </label>
              <label
                title="Agent behavior: tell the research worker to ask you one scoping question before it starts (via the input-required state). The agent decides to escalate; you answer."
                className="flex cursor-pointer items-center gap-2 px-1 text-[13px] text-dim select-none"
              >
                <input type="checkbox" checked={clarify} onChange={(e) => setClarify(e.target.checked)} />
                Clarify research
              </label>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {samples.map((s) => (
          <button key={s.label} onClick={() => applySample(s)} title={s.note} className="chip">
            {s.label}
          </button>
        ))}
      </div>

      {mode === "agent" && agent && (
        <div className="card p-3.5">
          <button
            onClick={() => setConfigOpen((o) => !o)}
            className="flex w-full items-baseline gap-2 text-left"
          >
            <span aria-hidden className="text-dim">{configOpen ? "▾" : "▸"}</span>
            <span className="text-xs uppercase tracking-wide text-dim">Configuration</span>
            <span className="text-[11px] text-dim">
              the agent's declared knobs — including any human-in-the-loop ones (e.g.{" "}
              <span className="font-mono">clarify</span>)
            </span>
          </button>
          {configOpen && (
            <div className="mt-3">
              <ConfigForm schema={agent.configSchema} value={config} onChange={onConfigChange} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function agentSamplesFor(name?: string, cwd?: string): Sample[] {
  if (name === "coding") return codingSamples(cwd);
  return (name && AGENT_SAMPLES[name]) || [];
}
