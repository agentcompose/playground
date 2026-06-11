import type { Mode } from "../api.ts";

// Switch between the two altitudes the playground exercises:
//   engine — the master agent: a goal is planned and delegated across the registry
//   agent  — a single worker, selected and driven directly through the SDK contract
// Both share the same event stream and result UI; only the composer differs.
export function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const opts: { id: Mode; label: string; hint: string }[] = [
    { id: "engine", label: "Engine", hint: "master · plan + delegate" },
    { id: "agent", label: "Single agent", hint: "test one worker directly" },
  ];
  return (
    <div className="inline-flex rounded-xl border border-line bg-panel p-1">
      {opts.map((o) => {
        const active = o.id === mode;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            title={o.hint}
            className={
              "rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition " +
              (active ? "bg-accent text-[#0b1020]" : "text-dim hover:text-white")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
