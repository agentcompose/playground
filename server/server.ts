// AgentCompose Playground — a zero-dependency web harness for driving the engine
// with a REAL model and REAL agents. The seed of product layer ④ and the long-life
// testing surface: type goals, watch the engine plan → delegate → stream, approve/deny
// governed steps (HITL), and resume.
//
// Run:  OPENAI_API_KEY=sk-... npm start   then open http://localhost:5173
// Env:  OPENAI_API_KEY (required) · OPENAI_BASE_URL (default api.openai.com/v1)
//       OPENAI_MODEL (default gpt-4o-mini) · PORT (default 5173)
import http from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { inProcess } from "@agentcompose/sdk";
import type { AgentClient, AgentConfig, TaskEvent } from "@agentcompose/sdk";
import {
  Engine,
  AgentRegistry,
  dynamicPlanner,
  approveWhen,
  InMemoryCheckpointStore,
} from "@agentcompose/engine";
import { openAICompatibleDecider } from "@agentcompose/engine/adapters/openai";
import type { EngineEvent } from "@agentcompose/engine";

import { buildCatalog } from "./catalog.ts";

const PORT = Number(process.env.PORT ?? 5173);
const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("✗ OPENAI_API_KEY is not set. Export it and restart:\n  OPENAI_API_KEY=sk-... npm start");
  process.exit(1);
}

// ── Catalog → clients ─────────────────────────────────────────────────────────
// One declarative catalog (server/catalog.ts) is the single source of truth for which
// agents exist. Both the engine (master) registries and single-agent test mode are
// derived from it, so adding an agent is a one-line change in the catalog.
const tavilyKey = process.env.TAVILY_API_KEY;
const catalog = buildCatalog({ baseUrl, model, tavilyKey });
// One in-process client per agent, shared by the engine registries.
const clients = new Map<string, AgentClient>(catalog.map((e) => [e.name, inProcess(e.def)]));
function agentDef(name: string) {
  return catalog.find((e) => e.name === name)?.def;
}

// ── Engine wiring ───────────────────────────────────────────────────────────
// One decider (the brain); a shared checkpoint store so the governed engine can resume
// a suspended run. Engines differ only by governor (HITL) and research's `clarify`.
//
// `research` is a dedicated, independently-published worker (@agentcompose/research-agent)
// — a leaf the master delegates to. It uses Tavily when TAVILY_API_KEY is set, otherwise
// an offline fixture, so it runs keyless.
const registryEntries = Object.fromEntries(catalog.map((e) => [e.name, clients.get(e.name)!]));
const plainRegistry = new AgentRegistry(registryEntries);
// `clarify` makes the research worker escalate one scoping question via the spec's
// input-required state — the tangible *worker-escalation* HITL demo (distinct from the
// governor-approval gate). Only research is overlaid; the rest reuse their clients.
const clarifyRegistry = new AgentRegistry({
  ...registryEntries,
  research: { client: clients.get("research")!, config: { clarify: true } },
});
const decider = openAICompatibleDecider({ baseUrl, apiKey, model });
// The planner only *enumerates* agents (same roster in both registries), so one planner
// serves all engines; execution uses the engine's own registry (plain or clarify).
const planner = dynamicPlanner({ decider, registry: plainRegistry, maxRounds: 8 });
const checkpoints = new InMemoryCheckpointStore();

// Engines are a 2×2 of (govern coding) × (clarify research), memoized and sharing one
// checkpoint store so any can resume/route-input into a suspended run.
const engineCache = new Map<string, Engine>();
function engineFor(govern: boolean, clarify: boolean): Engine {
  const key = `${govern}:${clarify}`;
  let e = engineCache.get(key);
  if (!e) {
    e = new Engine({
      registry: clarify ? clarifyRegistry : plainRegistry,
      planner,
      checkpoints,
      ...(govern ? { governor: approveWhen((s) => s.agent === "coding") } : {}),
    });
    engineCache.set(key, e);
  }
  return e;
}

// ── Agent roster (drives the UI's read-only registry + the single-agent dropdown) ───
async function roster(): Promise<
  {
    name: string;
    id: string;
    title: string;
    description?: string;
    capabilities: string[];
    configSchema?: Record<string, unknown>;
  }[]
> {
  return Promise.all(
    plainRegistry.names().map(async (name) => {
      const d = await plainRegistry.describe(name);
      return {
        name,
        id: d.id,
        title: d.name,
        description: d.description,
        capabilities: (d.capabilities ?? []).map((c) => c.id),
        configSchema: d.configSchema,
      };
    }),
  );
}

// ── Per-run SSE plumbing ─────────────────────────────────────────────────────
type Mode = "engine" | "agent";
interface PendingRun {
  mode: Mode;
  goal: string;
  // engine mode
  govern: boolean;
  clarify: boolean;
  // agent mode
  agent?: string;
  config?: AgentConfig;
}
const pending = new Map<string, PendingRun>();
const conns = new Map<string, http.ServerResponse>();
// Live single-agent runs, so /input can route a human answer back to the worker.
const agentRuns = new Map<string, { client: AgentClient; taskId: string }>();
// One AbortController per run so /cancel can abort in-flight engine work (and model calls).
const aborts = new Map<string, AbortController>();

function sse(runId: string, ev: unknown): void {
  conns.get(runId)?.write(`data: ${JSON.stringify(ev)}\n\n`);
}
function end(runId: string): void {
  const res = conns.get(runId);
  if (res) {
    res.write(`event: done\ndata: {}\n\n`);
    res.end();
  }
  conns.delete(runId);
  pending.delete(runId);
  aborts.delete(runId);
}

/** Drain an engine event stream into the run's SSE connection. On `suspended` we
 *  keep the connection open and wait for a /control call; terminal events close it. */
async function drive(runId: string, gen: AsyncGenerator<EngineEvent>): Promise<void> {
  try {
    for await (const ev of gen) {
      sse(runId, ev);
      if (ev.type === "result" || ev.type === "error" || ev.type === "canceled") return end(runId);
      if (ev.type === "suspended") return; // wait for approve/deny via /control
    }
    end(runId);
  } catch (err) {
    sse(runId, { type: "error", error: { code: -32603, message: (err as Error)?.message ?? String(err) } });
    end(runId);
  }
}

/** Single-agent mode: drive ONE agent directly through the uniform AgentClient surface
 *  (configure → submit → events), bypassing the engine/planner. The agent's TaskEvents are
 *  normalized into the SAME EngineEvent shape the UI already renders — the whole run is a
 *  single synthetic step named after the agent. Because the contract is uniform, a master
 *  published via asAgent() could be driven here too. */
async function driveAgent(runId: string, agent: string, goal: string, config: AgentConfig): Promise<void> {
  const def = agentDef(agent);
  if (!def) {
    sse(runId, { type: "error", error: { code: -32602, message: `Unknown agent: ${agent}` } });
    return end(runId);
  }
  const client = inProcess(def); // fresh client so per-run config can't race a shared one
  const step = agent;
  try {
    const effective = await client.configure(config ?? {});
    const task = await client.submit([{ kind: "text", text: goal }]);
    agentRuns.set(runId, { client, taskId: task.id });
    sse(runId, { type: "run-started", runId });
    // Surface the agent's *normalized* config (defaults applied, values coerced) — this is
    // configure()'s return, which proves the contract's config validation to the UI.
    sse(runId, { type: "config-resolved", config: effective });
    sse(runId, { type: "plan", steps: [{ id: step, agent }] });
    sse(runId, { type: "step-started", stepId: step, agent });
    for await (const ev of client.events(task.id)) {
      for (const out of normalizeAgentEvent(step, agent, ev)) sse(runId, out);
      if (ev.type === "result" || ev.type === "error") break;
      if (ev.type === "status" && ev.state === "canceled") break;
    }
    end(runId);
  } catch (err) {
    sse(runId, { type: "error", error: { code: -32603, message: (err as Error)?.message ?? String(err) } });
    end(runId);
  } finally {
    agentRuns.delete(runId);
    void client.close().catch(() => {});
  }
}

/** Map one SDK TaskEvent onto the engine's EngineEvent vocabulary (synthetic single step). */
function normalizeAgentEvent(step: string, agent: string, ev: TaskEvent): EngineEvent[] {
  switch (ev.type) {
    case "progress":
      return [{ type: "progress", stepId: step, percent: ev.percent, message: ev.message }];
    case "message":
      return [{ type: "message", stepId: step, delta: ev.delta }];
    case "artifact":
      return [{ type: "artifact", stepId: step, artifact: ev.artifact }];
    case "span-start":
      // Pass spans straight through onto the run stream. In single-agent mode the agent's
      // own root span already roots the trace, so no synthetic step span is imposed.
      return [{ type: "span-start", span: ev.span }];
    case "span-end":
      return [
        {
          type: "span-end",
          traceId: ev.traceId,
          spanId: ev.spanId,
          endTime: ev.endTime,
          status: ev.status,
          ...(ev.attributes ? { attributes: ev.attributes } : {}),
          ...(ev.events ? { events: ev.events } : {}),
          ...(ev.error ? { error: ev.error } : {}),
        },
      ];
    case "status":
      // input-required → suspend for an answer; canceled → terminal canceled event.
      if (ev.state === "input-required")
        return [
          {
            type: "suspended",
            reason: { kind: "input", address: { stepId: step, askIndex: 0 }, prompt: ev.prompt },
          },
        ];
      if (ev.state === "canceled") return [{ type: "canceled" }];
      return [];
    case "result":
      return [
        { type: "step-completed", stepId: step, parts: ev.result.parts },
        { type: "result", parts: ev.result.parts },
      ];
    case "error":
      return [
        { type: "step-failed", stepId: step, error: ev.error },
        { type: "error", error: ev.error },
      ];
    default:
      return [];
  }
}

// ── HTTP ─────────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "web", "dist");
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

async function serveStatic(res: http.ServerResponse, pathname: string): Promise<void> {
  const rel = pathname === "/" ? "/index.html" : pathname;
  const file = path.join(DIST, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
  try {
    const buf = await readFile(file);
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
    res.end(buf);
  } catch {
    // SPA fallback to index.html; if the app isn't built yet, a helpful hint.
    try {
      const buf = await readFile(path.join(DIST, "index.html"));
      res.writeHead(200, { "content-type": MIME[".html"] });
      res.end(buf);
    } catch {
      res.writeHead(200, { "content-type": MIME[".html"] });
      res.end(
        `<h1>AgentCompose Playground</h1><p>The web app isn't built yet.</p>` +
          `<pre>cd web &amp;&amp; npm install &amp;&amp; npm run build</pre>` +
          `<p>or for development run <code>npm run dev</code> in <code>web/</code> (it proxies the API here).</p>`,
      );
    }
  }
}

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || "{}");
  } catch {
    return {};
  }
}
function json(res: http.ServerResponse, obj: unknown, code = 200): void {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/config") {
    return json(res, {
      model,
      baseUrl,
      search: tavilyKey ? "tavily" : "fixture",
      modes: ["engine", "agent"],
      cwd: process.cwd(),
      agents: await roster(),
    });
  }

  if (req.method === "POST" && url.pathname === "/run") {
    const body = await readJson(req);
    const runId = "run_" + randomUUID().slice(0, 12);
    const mode: Mode = body.mode === "agent" ? "agent" : "engine";
    pending.set(runId, {
      mode,
      goal: String(body.goal ?? ""),
      govern: !!body.govern,
      clarify: !!body.clarify,
      agent: body.agent ? String(body.agent) : undefined,
      config: (body.config as AgentConfig) ?? {},
    });
    return json(res, { runId });
  }

  if (req.method === "GET" && url.pathname.startsWith("/events/")) {
    const runId = url.pathname.slice("/events/".length);
    const p = pending.get(runId);
    if (!p) return void res.writeHead(404).end();
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    conns.set(runId, res);
    req.on("close", () => conns.delete(runId));
    const ac = new AbortController();
    aborts.set(runId, ac);
    if (p.mode === "agent") {
      void driveAgent(runId, p.agent ?? "", p.goal, p.config ?? {});
    } else {
      void drive(runId, engineFor(p.govern, p.clarify).run([{ kind: "text", text: p.goal }], { runId, signal: ac.signal }));
    }
    return;
  }

  // Cancel a run mid-flight, from any state (running or suspended). Aborts in-flight
  // engine/model work, cancels the worker task in agent mode, and resolves the UI to
  // 'canceled' immediately.
  if (req.method === "POST" && url.pathname === "/cancel") {
    const body = await readJson(req);
    const runId = String(body.runId ?? "");
    if (!conns.has(runId)) return json(res, { error: "no open run" }, 409);
    json(res, { ok: true });
    const live = agentRuns.get(runId);
    if (live) void live.client.cancel(live.taskId).catch(() => {});
    aborts.get(runId)?.abort();
    sse(runId, { type: "canceled" });
    end(runId);
    return;
  }

  if (req.method === "POST" && url.pathname === "/control") {
    const body = await readJson(req);
    const runId = String(body.runId ?? "");
    const stepId = String(body.stepId ?? "");
    const p = pending.get(runId);
    if (!p || !conns.has(runId)) return json(res, { error: "no open run" }, 409);
    json(res, { ok: true });
    const signal = aborts.get(runId)?.signal;
    void drive(runId, engineFor(p.govern, p.clarify).resume(runId, { approvals: { [stepId]: !!body.approve }, signal }));
    return;
  }

  // Route a human answer down to a worker that escalated (input-required). Tier-1 HITL.
  // Works in both modes: engine mode re-drives via the engine; agent mode forwards the
  // answer straight to the worker through the same task it suspended on.
  if (req.method === "POST" && url.pathname === "/input") {
    const body = await readJson(req);
    const runId = String(body.runId ?? "");
    const stepId = String(body.stepId ?? "");
    const askIndex = Number(body.askIndex ?? 0) || 0;
    const p = pending.get(runId);
    if (!p || !conns.has(runId)) return json(res, { error: "no open run" }, 409);
    json(res, { ok: true });
    const parts = [{ kind: "text" as const, text: String(body.text ?? "") }];
    const live = agentRuns.get(runId);
    if (p.mode === "agent" && live) {
      // The agent's events() loop in driveAgent is still subscribed and will pick up the
      // resumed events; we just feed the answer in.
      void live.client.provideInput(live.taskId, parts).catch((err) => {
        sse(runId, { type: "error", error: { code: -32603, message: (err as Error)?.message ?? String(err) } });
        end(runId);
      });
    } else {
      const signal = aborts.get(runId)?.signal;
      void drive(runId, engineFor(p.govern, p.clarify).provideInput(runId, parts, { stepId, askIndex }, { signal }));
    }
    return;
  }

  if (req.method === "GET") return void serveStatic(res, url.pathname);
  res.writeHead(404).end();
});

server.listen(PORT, () => {
  console.log(`▶ AgentCompose Playground on http://localhost:${PORT}`);
  console.log(`  model: ${model}  ·  base: ${baseUrl}`);
  console.log(`  search: ${tavilyKey ? "tavily (live web)" : "fixture (offline — set TAVILY_API_KEY for live web)"}`);
});
