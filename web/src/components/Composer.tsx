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
  // Engine-mode goals. Two flavors, kept in balance (see README → "Adding an agent"):
  //   • Coordinated (🔗/📱) — fan out across the roster and chain specialists.
  //   • Selection (🎯) — prove the planner routes to ONE specialist and doesn't over-decompose.
  // When a new agent joins the catalog, revisit these: add a goal that uses it, drop/update stale ones.
  {
    label: "📱 App idea → rank → MVP",
    goal:
      "I want to build and publish a small app to the app stores and earn revenue from it. " +
      "First research a few promising niches and the existing competition (demand, weaknesses, monetization, discoverability). " +
      "Then rank the candidate ideas on market demand, monetization potential, and solo-developer build effort, and confirm the winner with me before building. " +
      "Finally, build a minimal runnable prototype of the core feature of the idea I pick, with a quick test proving it works.",
    note: "Coordinated · research → analysis → [your pick] → coding — the full app-making loop.",
  },
  {
    label: "🔗 Survey → rank a choice",
    goal:
      "Research the leading options for a primary datastore for a write-heavy, multi-tenant SaaS backend, then score them against write throughput, operational complexity, cost, and ecosystem maturity and recommend one with its trade-offs.",
    note: "Coordinated · research → analysis (gather, then decide).",
  },
  // Single-agent — kept deliberately: proof the planner ROUTES to the right specialist
  // and does not over-decompose. Each routes to a different worker as a single step.
  {
    label: "🎯 Research only",
    goal:
      "Research the practical trade-offs between Raft and Paxos for a write-heavy, leader-based service — leader election, throughput under contention, operational complexity — and give a recommendation with caveats. Cite sources.",
    note: "Selection · should route to one specialist (research) — a single step.",
  },
  {
    label: "🎯 Decide among options",
    goal:
      "I'm choosing a CI provider for a small, GitHub-hosted TypeScript library among GitHub Actions, CircleCI, and GitLab CI. Weigh cost, setup effort, speed, and GitHub integration, and recommend one.",
    note: "Selection · should route to one specialist (analysis) — a single step.",
  },
];

// Per-agent sample goals for single-agent mode. CONVENTION (see README → "Adding an
// agent"): every catalog agent ships a few *powerful* samples here — not toys. Write
// them to actually exercise the worker's behavior, tiered from a quick proof to a
// substantial run, with at least one tied to the app-making use case (the 📱 samples):
// research shows multi-angle cited synthesis, analysis shows weighted scoring, coding
// writes & runs real code — so one click is a fair demonstration.
const AGENT_SAMPLES: Record<string, Sample[]> = {
  research: [
    {
      label: "Agent interop",
      goal: "Survey the current landscape of AI agent interoperability standards (e.g. MCP, A2A, and peers): what problem each solves, where they overlap, and where the gaps remain. Cite sources.",
    },
    {
      label: "Raft vs Paxos",
      goal: "Investigate the practical trade-offs between Raft and Paxos for a write-heavy, leader-based service — leader election, throughput under contention, and operational complexity — then close with a clear recommendation and its caveats. Cite sources.",
    },
    {
      label: "📱 App opportunity scan",
      goal:
        "Investigate the market opportunity for a focus/Pomodoro productivity app aimed at remote knowledge workers, intended for the App Store and Google Play. Cover, as distinct angles: (1) the target users and their top unmet needs; (2) the leading existing apps with their pricing, ratings, and most-complained-about weaknesses; (3) viable monetization models — subscription vs one-time vs freemium — with rough market benchmarks; (4) the categories and keywords that drive discoverability (ASO); and (5) the main risks (platform policies, competitive saturation, retention). Close with a clear go/no-go recommendation and the single sharpest feature wedge to differentiate. Cite your sources.",
      note: "Big · the 'discover & validate' step of the app-making loop — multi-angle market/competitor/monetization/ASO scan → go/no-go.",
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
      label: "📱 Rank app ideas to build",
      goal:
        "Rank these candidate app ideas for a solo developer aiming to publish to the app stores and earn revenue within six months, then recommend which to build first and justify it against the criteria.\n\n" +
        "Evidence:\n" +
        "- Focus/Pomodoro timer: large but crowded market; top apps charge $3–5/mo; reviews complain of bloat and intrusive ads; ASO highly competitive; moderate build effort; retention is habitual but churny.\n" +
        "- Plant-care reminder: mid-size, passionate niche; few polished apps; photo plant-ID is a strong differentiator but adds real effort; monetization via one-time purchase + IAP; lower competition; seasonal usage.\n" +
        "- Receipt/expense scanner for freelancers: high willingness to pay ($8–12/mo); strong incumbents; needs reliable OCR (high effort, accuracy risk); excellent retention via recurring monthly need.\n" +
        "- Daily-gratitude journal: very low build effort; saturated category; weak monetization; high churn after the first week.",
      config: {
        preset: "custom",
        scale: 10,
        criteria: [
          { name: "market demand", weight: 3 },
          { name: "monetization potential", weight: 3 },
          { name: "competition gap", weight: 2 },
          { name: "build effort", weight: 2, invert: true },
          { name: "retention potential", weight: 2 },
          { name: "ASO discoverability", weight: 1 },
        ],
        options: [
          "Focus/Pomodoro timer",
          "Plant-care reminder",
          "Receipt/expense scanner for freelancers",
          "Daily-gratitude journal",
        ],
      },
      note: "Big · evidence-in ranking against weighted app-business criteria — the 'validate & pick' gate after research.",
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
      label: "📱 Build the MVP slice",
      goal:
        "Build a small but real, runnable slice of a habit-tracker app as a zero-dependency TypeScript Node project. " +
        "Create a HabitStore module that can add a habit, mark a habit done for today, and compute both the current streak and the longest streak, persisting state to a local JSON file. " +
        "Add a CLI so `node habit.js add \"Read 20 min\"`, `node habit.js done <id>`, and `node habit.js list` work (list shows each habit with its current streak). " +
        "Write node:test unit tests for the streak logic — including a case where a missed day breaks the streak — and run `node --test` until everything passes. " +
        "Then demonstrate the CLI end to end (add two habits, complete one, list them) and show the real output.",
      config: { maxTurns: 60 },
      note: "Big · a real runnable app slice (domain + persistence + CLI + tests), disposable temp workspace — the 'build' node.",
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
                title="Engine policy (not the model): suspend before any step that calls the coding agent and ask you to approve or deny before code is written/run. This is the governor / HITL gate."
                className="flex cursor-pointer items-center gap-2 px-1 text-[13px] text-dim select-none"
              >
                <input type="checkbox" checked={govern} onChange={(e) => setGovern(e.target.checked)} />
                Govern coding
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
