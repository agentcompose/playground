import { useState } from "react";

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
  {
    label: "🔬 Research: consensus & latency",
    goal: "Research how consensus algorithms trade off latency, throughput, and availability. Cite your sources.",
  },
];

export function Composer({
  busy,
  onRun,
}: {
  busy: boolean;
  onRun: (goal: string, govern: boolean) => void;
}) {
  const [goal, setGoal] = useState("");
  const [govern, setGovern] = useState(true);

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !busy && goal.trim()) onRun(goal.trim(), govern);
          }}
          placeholder="Give the engine a goal…  (⌘/Ctrl + Enter to run)"
          className="flex-1 min-h-[76px] resize-y rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
        />
        <div className="flex w-40 flex-col gap-2">
          <button
            disabled={busy || !goal.trim()}
            onClick={() => onRun(goal.trim(), govern)}
            className="rounded-xl bg-accent px-4 py-2.5 font-semibold text-[#0b1020] transition enabled:hover:brightness-110 disabled:opacity-40"
          >
            Run ▶
          </button>
          <label className="flex cursor-pointer items-center gap-2 px-1 text-[13px] text-dim select-none">
            <input type="checkbox" checked={govern} onChange={(e) => setGovern(e.target.checked)} />
            Govern fetch (HITL)
          </label>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {SAMPLES.map((s) => (
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
