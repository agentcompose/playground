export interface AgentInfo {
  name: string;
  title: string;
  description?: string;
  capabilities: string[];
}

export interface ServerConfig {
  model: string;
  baseUrl: string;
  search?: string;
  agents?: AgentInfo[];
}

export async function getConfig(): Promise<ServerConfig> {
  return (await fetch("/config")).json();
}

export async function startRun(goal: string, govern: boolean, clarify: boolean): Promise<string> {
  const r = await fetch("/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ goal, govern, clarify }),
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
