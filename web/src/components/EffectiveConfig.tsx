import { useState } from "react";

// Shows the agent's *normalized* config — configure()'s return — next to what was
// submitted, so applied defaults and coercions are visible. This is the contract's
// config-validation surface made observable.
export function EffectiveConfig({
  submitted,
  resolved,
}: {
  submitted: Record<string, unknown>;
  resolved: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  const keys = Object.keys(resolved);
  const changed = keys.filter((k) => JSON.stringify(resolved[k]) !== JSON.stringify(submitted[k]));

  return (
    <div className="rounded-md border border-line bg-bg/60">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left">
        <span aria-hidden className="text-dim">{open ? "▾" : "▸"}</span>
        <span className="text-[11px] text-accent">⚙ effective config</span>
        {changed.length > 0 && (
          <span className="text-[10px] text-dim">{changed.length} default(s)/coercion(s) applied</span>
        )}
      </button>
      {open && (
        <div className="border-t border-line p-2 font-mono text-[11.5px]">
          {keys.map((k) => {
            const isChanged = changed.includes(k);
            return (
              <div key={k} className="flex gap-2 px-1 py-0.5">
                <span className={isChanged ? "text-[#e0b341]" : "text-dim"}>{isChanged ? "●" : "·"}</span>
                <span className="w-32 shrink-0 text-[#9aa4b8]">{k}</span>
                <span className="truncate text-[#cbd2e0]">{JSON.stringify(resolved[k])}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
