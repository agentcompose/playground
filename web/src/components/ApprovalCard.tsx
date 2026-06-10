export function ApprovalCard({
  stepId,
  agent,
  onDecide,
}: {
  stepId: string;
  agent: string;
  onDecide: (ok: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-warn/70 bg-[#2a2410] p-3.5">
      <div className="mb-2.5 text-sm font-semibold text-warn">
        Approve step <span className="font-mono">{stepId}</span> <span className="text-dim">({agent})</span>?
      </div>
      <p className="mb-3 text-xs text-dim">
        The governor paused this run before a governed step. This is the engine's durable HITL gate — approve to
        continue, deny to fail the run.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onDecide(true)}
          className="rounded-lg bg-ok px-3.5 py-1.5 text-sm font-semibold text-[#06210f] hover:brightness-110"
        >
          Approve ✓
        </button>
        <button
          onClick={() => onDecide(false)}
          className="rounded-lg border border-err px-3.5 py-1.5 text-sm font-semibold text-err hover:bg-err/10"
        >
          Deny ✕
        </button>
      </div>
    </div>
  );
}
