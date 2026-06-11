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
import {
  Engine,
  AgentRegistry,
  dynamicPlanner,
  approveWhen,
  InMemoryCheckpointStore,
} from "@agentcompose/engine";
import { openAICompatibleDecider } from "@agentcompose/engine/adapters/openai";
import type { EngineEvent } from "@agentcompose/engine";

import { fetchAgent, makeWriter } from "./agents.ts";
import { makeResearchAgent, tavily } from "@agentcompose/research-agent";

const PORT = Number(process.env.PORT ?? 5173);
const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("✗ OPENAI_API_KEY is not set. Export it and restart:\n  OPENAI_API_KEY=sk-... npm start");
  process.exit(1);
}

// ── Engine wiring ───────────────────────────────────────────────────────────
// One registry of real agents; one decider (the brain); a shared checkpoint store
// so the governed engine can resume a suspended run. Two engines differ only by
// governor so the UI can toggle HITL on/off.
//
// `research` is a dedicated, independently-published worker (@agentcompose/research-agent)
// — a leaf the master delegates to. It uses Tavily when TAVILY_API_KEY is set, otherwise
// an offline fixture, so it runs keyless. Modest defaults keep the demo snappy.
const tavilyKey = process.env.TAVILY_API_KEY;
const researchClient = inProcess(
  makeResearchAgent({
    defaults: { baseUrl, model, angles: 3, maxSourcesPerAngle: 4, maxIterationsPerAngle: 1 },
    ...(tavilyKey ? { search: tavily({ apiKey: tavilyKey }) } : {}),
  }),
);
// Two registries differ only in research's base config: `clarify` makes the research
// worker escalate one scoping question via the spec's input-required state — the
// tangible *worker-escalation* HITL demo (distinct from the governor-approval gate).
const plainRegistry = new AgentRegistry({
  fetch: inProcess(fetchAgent),
  writer: inProcess(makeWriter({ baseUrl, model })),
  research: researchClient,
});
const clarifyRegistry = new AgentRegistry({
  fetch: inProcess(fetchAgent),
  writer: inProcess(makeWriter({ baseUrl, model })),
  research: { client: researchClient, config: { clarify: true } },
});
const decider = openAICompatibleDecider({ baseUrl, apiKey, model });
// The planner only *enumerates* agents (same roster in both registries), so one planner
// serves all engines; execution uses the engine's own registry (plain or clarify).
const planner = dynamicPlanner({ decider, registry: plainRegistry, maxRounds: 8 });
const checkpoints = new InMemoryCheckpointStore();

// Engines are a 2×2 of (govern fetch) × (clarify research), memoized and sharing one
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
      ...(govern ? { governor: approveWhen((s) => s.agent === "fetch") } : {}),
    });
    engineCache.set(key, e);
  }
  return e;
}

// ── Agent roster (for the UI to show what the master can delegate to) ─────────
async function roster(): Promise<
  { name: string; title: string; description?: string; capabilities: string[] }[]
> {
  return Promise.all(
    plainRegistry.names().map(async (name) => {
      const d = await plainRegistry.describe(name);
      return {
        name,
        title: d.name,
        description: d.description,
        capabilities: (d.capabilities ?? []).map((c) => c.id),
      };
    }),
  );
}

// ── Per-run SSE plumbing ─────────────────────────────────────────────────────
const pending = new Map<string, { goal: string; govern: boolean; clarify: boolean }>();
const conns = new Map<string, http.ServerResponse>();

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
    return json(res, { model, baseUrl, search: tavilyKey ? "tavily" : "fixture", agents: await roster() });
  }

  if (req.method === "POST" && url.pathname === "/run") {
    const body = await readJson(req);
    const runId = "run_" + randomUUID().slice(0, 12);
    pending.set(runId, { goal: String(body.goal ?? ""), govern: !!body.govern, clarify: !!body.clarify });
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
    void drive(runId, engineFor(p.govern, p.clarify).run([{ kind: "text", text: p.goal }], { runId }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/control") {
    const body = await readJson(req);
    const runId = String(body.runId ?? "");
    const stepId = String(body.stepId ?? "");
    const p = pending.get(runId);
    if (!p || !conns.has(runId)) return json(res, { error: "no open run" }, 409);
    json(res, { ok: true });
    void drive(runId, engineFor(p.govern, p.clarify).resume(runId, { approvals: { [stepId]: !!body.approve } }));
    return;
  }

  // Route a human answer down to a worker that escalated (input-required). Tier-1 HITL.
  if (req.method === "POST" && url.pathname === "/input") {
    const body = await readJson(req);
    const runId = String(body.runId ?? "");
    const stepId = String(body.stepId ?? "");
    const askIndex = Number(body.askIndex ?? 0) || 0;
    const p = pending.get(runId);
    if (!p || !conns.has(runId)) return json(res, { error: "no open run" }, 409);
    json(res, { ok: true });
    const parts = [{ kind: "text" as const, text: String(body.text ?? "") }];
    void drive(runId, engineFor(p.govern, p.clarify).provideInput(runId, parts, { stepId, askIndex }));
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
