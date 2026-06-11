import { useCallback, useRef, useState } from "react";
import { sendCancel, sendControl, sendInput, startRun, type RunRequest } from "../api.ts";
import {
  type EngineEvent,
  type Part,
  type RunStatus,
  type StepState,
  type StepView,
  partsToText,
} from "../types.ts";

interface InputAsk {
  stepId: string;
  askIndex: number;
  agent: string;
  prompt: string;
}

interface RunState {
  status: RunStatus;
  steps: StepView[];
  resultParts?: Part[];
  error?: string;
  pending?: { stepId: string; agent: string };
  inputAsk?: InputAsk;
  log: EngineEvent[];
  startedAt?: number;
  endedAt?: number;
  run: (req: RunRequest) => Promise<void>;
  approve: (ok: boolean) => Promise<void>;
  answer: (text: string) => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => void;
}

export function useRun(): RunState {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [steps, setSteps] = useState<StepView[]>([]);
  const [resultParts, setResultParts] = useState<Part[]>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<{ stepId: string; agent: string }>();
  const [inputAsk, setInputAsk] = useState<InputAsk>();
  const [log, setLog] = useState<EngineEvent[]>([]);
  const [startedAt, setStartedAt] = useState<number>();
  const [endedAt, setEndedAt] = useState<number>();

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
          upsert(ev.stepId, { agent: ev.agent, state: "running", startedAt: Date.now() });
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
        case "step-completed": {
          const cur = stepsRef.current.get(ev.stepId);
          upsert(ev.stepId, {
            state: "done",
            output: partsToText(ev.parts),
            durationMs: cur?.startedAt ? Date.now() - cur.startedAt : undefined,
          });
          break;
        }
        case "artifact": {
          const cur = stepsRef.current.get(ev.stepId);
          upsert(ev.stepId, { artifacts: [...(cur?.artifacts ?? []), ev.artifact] });
          break;
        }
        case "step-retry":
          upsert(ev.stepId, {
            state: "running",
            progress: `retry ${ev.attempt}/${ev.maxAttempts} in ${ev.delayMs}ms — ${ev.error.message}`,
          });
          break;
        case "step-fallback":
          upsert(ev.stepId, { agent: ev.to, state: "running", progress: `fallback: ${ev.from} → ${ev.to}` });
          break;
        case "step-failed": {
          const cur = stepsRef.current.get(ev.stepId);
          upsert(ev.stepId, {
            state: "failed",
            error: ev.error.message,
            durationMs: cur?.startedAt ? Date.now() - cur.startedAt : undefined,
          });
          break;
        }
        case "suspended": {
          if (ev.reason.kind === "input") {
            const { stepId, askIndex } = ev.reason.address;
            const prompt = ev.reason.prompt ? partsToText(ev.reason.prompt) : "The agent needs input to continue.";
            setInputAsk({ stepId, askIndex, agent: stepsRef.current.get(stepId)?.agent ?? "?", prompt });
            setStatus("awaiting-input");
          } else {
            setPending({ stepId: ev.reason.stepId, agent: stepsRef.current.get(ev.reason.stepId)?.agent ?? "?" });
            setStatus("awaiting-approval");
          }
          break;
        }
        case "result":
          setResultParts(ev.parts);
          setStatus("completed");
          setEndedAt(Date.now());
          closeStream();
          break;
        case "error":
          setError(ev.error.message);
          setStatus("failed");
          setEndedAt(Date.now());
          closeStream();
          break;
        case "canceled":
          setStatus("canceled");
          setEndedAt(Date.now());
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
    setResultParts(undefined);
    setError(undefined);
    setPending(undefined);
    setInputAsk(undefined);
    setLog([]);
    setStartedAt(undefined);
    setEndedAt(undefined);
    setStatus("idle");
  }, [closeStream]);

  const run = useCallback(
    async (req: RunRequest) => {
      reset();
      setStatus("running");
      setStartedAt(Date.now());
      const runId = await startRun(req);
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

  const answer = useCallback(
    async (text: string) => {
      if (!inputAsk) return;
      setStatus("running");
      const { stepId, askIndex } = inputAsk;
      setInputAsk(undefined);
      await sendInput(runIdRef.current, stepId, askIndex, text);
    },
    [inputAsk],
  );

  const cancel = useCallback(async () => {
    if (!runIdRef.current) return;
    setPending(undefined);
    setInputAsk(undefined);
    await sendCancel(runIdRef.current);
  }, []);

  return { status, steps, resultParts, error, pending, inputAsk, log, startedAt, endedAt, run, approve, answer, cancel, reset };
}
