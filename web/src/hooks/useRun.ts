import { useCallback, useRef, useState } from "react";
import { sendControl, startRun } from "../api.ts";
import {
  type EngineEvent,
  type RunStatus,
  type StepState,
  type StepView,
  partsToText,
} from "../types.ts";

interface RunState {
  status: RunStatus;
  steps: StepView[];
  result?: string;
  error?: string;
  pending?: { stepId: string; agent: string };
  log: EngineEvent[];
  run: (goal: string, govern: boolean) => Promise<void>;
  approve: (ok: boolean) => Promise<void>;
  reset: () => void;
}

export function useRun(): RunState {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [steps, setSteps] = useState<StepView[]>([]);
  const [result, setResult] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<{ stepId: string; agent: string }>();
  const [log, setLog] = useState<EngineEvent[]>([]);

  const runIdRef = useRef<string>("");
  const esRef = useRef<EventSource | null>(null);
  const stepsRef = useRef<Map<string, StepView>>(new Map());

  const flush = useCallback(() => setSteps([...stepsRef.current.values()]), []);

  const upsert = useCallback(
    (id: string, patch: Partial<StepView> & { agent?: string }) => {
      const cur =
        stepsRef.current.get(id) ?? ({ id, agent: patch.agent ?? "?", state: "pending", messages: "" } as StepView);
      stepsRef.current.set(id, { ...cur, ...patch });
      flush();
    },
    [flush],
  );

  const closeStream = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

  const onEvent = useCallback(
    (ev: EngineEvent) => {
      setLog((l) => [...l, ev]);
      switch (ev.type) {
        case "plan":
          ev.steps.forEach((s) => upsert(s.id, { agent: s.agent, state: "pending" as StepState }));
          break;
        case "step-started":
          upsert(ev.stepId, { agent: ev.agent, state: "running" });
          break;
        case "progress":
          upsert(ev.stepId, {
            state: "running",
            progress: `${ev.percent != null ? ev.percent + "% " : ""}${ev.message ?? ""}`.trim(),
          });
          break;
        case "message": {
          const cur = stepsRef.current.get(ev.stepId);
          const add = ev.delta.kind === "text" ? ev.delta.text : "";
          upsert(ev.stepId, { messages: (cur?.messages ?? "") + add });
          break;
        }
        case "step-completed":
          upsert(ev.stepId, { state: "done", output: partsToText(ev.parts) });
          break;
        case "step-retry":
          upsert(ev.stepId, {
            state: "running",
            progress: `retry ${ev.attempt}/${ev.maxAttempts} in ${ev.delayMs}ms — ${ev.error.message}`,
          });
          break;
        case "step-fallback":
          upsert(ev.stepId, { agent: ev.to, state: "running", progress: `fallback: ${ev.from} → ${ev.to}` });
          break;
        case "step-failed":
          upsert(ev.stepId, { state: "failed", error: ev.error.message });
          break;
        case "suspended": {
          const stepId = ev.reason.stepId;
          setPending({ stepId, agent: stepsRef.current.get(stepId)?.agent ?? "?" });
          setStatus("awaiting-approval");
          break;
        }
        case "result":
          setResult(partsToText(ev.parts));
          setStatus("completed");
          closeStream();
          break;
        case "error":
          setError(ev.error.message);
          setStatus("failed");
          closeStream();
          break;
        case "canceled":
          setStatus("canceled");
          closeStream();
          break;
      }
    },
    [upsert, closeStream],
  );

  const openStream = useCallback(
    (runId: string) => {
      const es = new EventSource(`/events/${runId}`);
      esRef.current = es;
      es.onmessage = (m) => onEvent(JSON.parse(m.data) as EngineEvent);
      es.addEventListener("done", () => closeStream());
    },
    [onEvent, closeStream],
  );

  const reset = useCallback(() => {
    closeStream();
    stepsRef.current = new Map();
    setSteps([]);
    setResult(undefined);
    setError(undefined);
    setPending(undefined);
    setLog([]);
    setStatus("idle");
  }, [closeStream]);

  const run = useCallback(
    async (goal: string, govern: boolean) => {
      reset();
      setStatus("running");
      const runId = await startRun(goal, govern);
      runIdRef.current = runId;
      openStream(runId);
    },
    [reset, openStream],
  );

  const approve = useCallback(
    async (ok: boolean) => {
      if (!pending) return;
      setStatus("running");
      const { stepId } = pending;
      setPending(undefined);
      await sendControl(runIdRef.current, stepId, ok);
    },
    [pending],
  );

  return { status, steps, result, error, pending, log, run, approve, reset };
}
