export interface ServerConfig {
  model: string;
  baseUrl: string;
}

export async function getConfig(): Promise<ServerConfig> {
  return (await fetch("/config")).json();
}

export async function startRun(goal: string, govern: boolean): Promise<string> {
  const r = await fetch("/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ goal, govern }),
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
