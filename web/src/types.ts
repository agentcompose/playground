// Mirror of the engine's EngineEvent union (the wire contract the SSE stream emits).
// Kept as a local, hand-checked copy so the web app has no build dep on the engine.
export type Part =
  | { kind: "text"; text: string }
  | { kind: "file"; mediaType: string; name?: string; uri?: string; bytes?: string }
  | { kind: "json"; json: unknown; mediaType?: string };

export interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface Artifact {
  id: string;
  parts: Part[];
  name?: string;
  createdAt?: string;
}

export type Pending = { kind: "approval"; stepId: string; proposed?: unknown };

export type EngineEvent =
  | { type: "run-started"; runId: string }
  | { type: "plan"; steps: { id: string; agent: string }[] }
  | { type: "step-started"; stepId: string; agent: string }
  | { type: "progress"; stepId: string; percent?: number; message?: string }
  | { type: "message"; stepId: string; delta: Part }
  | { type: "artifact"; stepId: string; artifact: Artifact }
  | { type: "step-completed"; stepId: string; parts: Part[] }
  | { type: "step-failed"; stepId: string; error: RpcError }
  | { type: "suspended"; reason: Pending }
  | { type: "canceled" }
  | { type: "result"; parts: Part[] }
  | { type: "error"; error: RpcError };

export type StepState = "pending" | "running" | "done" | "failed";

export interface StepView {
  id: string;
  agent: string;
  state: StepState;
  progress?: string;
  messages: string;
  output?: string;
  error?: string;
}

export type RunStatus =
  | "idle"
  | "running"
  | "awaiting-approval"
  | "completed"
  | "failed"
  | "canceled";

export function partsToText(parts: Part[]): string {
  return parts
    .map((p) => (p.kind === "text" ? p.text : p.kind === "json" ? JSON.stringify(p.json, null, 2) : `[${p.kind}]`))
    .join("\n");
}
