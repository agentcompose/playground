export type Mode = "engine" | "agent";

export interface AgentInfo {
  name: string;
  id?: string;
  title: string;
  description?: string;
  capabilities: string[];
  configSchema?: JsonSchema;
}

// Minimal JSON-Schema shape the config form understands (flat, primitive properties).
export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchemaProp>;
  [key: string]: unknown;
}
export interface JsonSchemaProp {
  type?: string | string[];
  default?: unknown;
  description?: string;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  [key: string]: unknown;
}

export interface ServerConfig {
  model: string;
  baseUrl: string;
  search?: string;
  modes?: Mode[];
  agents?: AgentInfo[];
}

export async function getConfig(): Promise<ServerConfig> {
  return (await fetch("/config")).json();
}

export interface RunRequest {
  mode: Mode;
  goal: string;
  // engine mode
  govern?: boolean;
  clarify?: boolean;
  // agent mode
  agent?: string;
  config?: Record<string, unknown>;
}

export async function startRun(req: RunRequest): Promise<string> {
  const r = await fetch("/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  const { runId } = await r.json();
  return runId as string;
}

export async function sendControl(runId: string, stepId: string, approve: boolean): Promise<void> {
  await fetch("/control", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ runId, stepId, approve }),
  });
}

export async function sendInput(
  runId: string,
  stepId: string,
  askIndex: number,
  text: string,
): Promise<void> {
  await fetch("/input", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ runId, stepId, askIndex, text }),
  });
}
