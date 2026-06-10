// Real worker agents for the playground — thin adapters over real tools, the way
// the AgentCompose vision prescribes (wrap an existing thing at the right altitude,
// don't build a toy from raw primitives):
//
//   fetch  — wraps a real HTTP GET (pulls a URL's readable text)
//   writer — wraps your LLM via the spec's provider injection (BYO-model)
//
// These exist so the playground orchestrates *real work*, not canned strings — the
// only honest way to judge whether the engine is valuable.
import { defineAgent, AgentError, ErrorCodes, JsonRpcCodes } from "@agentcompose/sdk";
import type { AgentDefinition, Part } from "@agentcompose/sdk";

/** Provider shape after the SDK resolves the apiKey SecretRef from the environment. */
export interface Provider {
  baseUrl: string;
  model: string;
  apiKey: string;
}

/** Flatten parts to a single text blob (the input an agent receives). */
export function toText(parts: Part[]): string {
  return parts
    .map((p) => (p.kind === "text" ? p.text : p.kind === "json" ? JSON.stringify(p.json) : ""))
    .join("\n")
    .trim();
}

/** Minimal OpenAI-compatible chat call. Zero deps, raw fetch — same altitude as the
 *  engine's reference decider adapter. */
export async function chat(
  provider: Provider,
  messages: { role: string; content: string }[],
  opts: { signal?: AbortSignal; temperature?: number } = {},
): Promise<string> {
  const res = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({ model: provider.model, messages, temperature: opts.temperature ?? 0.3 }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AgentError(JsonRpcCodes.InternalError, `Model HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  // Some gateways stream by default (text/event-stream) even without stream:true.
  const contentType = res.headers.get("content-type") ?? "";
  const raw = await res.text();
  if (contentType.includes("text/event-stream") || /^\s*data:/.test(raw)) {
    let out = "";
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload) as { choices?: { delta?: { content?: string }; message?: { content?: string } }[] };
        out += j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? "";
      } catch {
        // ignore keep-alive lines
      }
    }
    return out;
  }
  const data = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

const URL_RE = /https?:\/\/[^\s)>"']+/i;

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/** fetch — pull the first URL found in the input and return its readable text. */
export const fetchAgent: AgentDefinition = defineAgent({
  descriptor: {
    id: "ac.fetch",
    name: "Fetch",
    version: "0.1.0",
    capabilities: [{ id: "fetch", description: "Fetch a URL and return its readable text content" }],
    configSchema: {
      type: "object",
      additionalProperties: false,
      properties: { maxChars: { type: "number", default: 6000 } },
    },
  },
  async handle(goal, ctx) {
    const text = toText(goal);
    const match = text.match(URL_RE);
    if (!match) throw new AgentError(ErrorCodes.InvalidGoal, "No URL found in the input to fetch.");
    const url = match[0];
    ctx.progress(10, `Fetching ${url}`);
    const res = await fetch(url, {
      signal: ctx.signal,
      headers: { "user-agent": "AgentCompose-Playground/0.1 (+https://github.com/agentcompose)" },
    });
    if (!res.ok) throw new AgentError(JsonRpcCodes.InternalError, `Fetch HTTP ${res.status} for ${url}`);
    const max = Number(ctx.config.maxChars ?? 6000);
    const clean = htmlToText(await res.text()).slice(0, max);
    ctx.progress(100, `Fetched ${clean.length} chars from ${url}`);
    return [{ kind: "text", text: clean }];
  },
});

/** writer — summarize/compose with the injected model. The provider (baseUrl/model/
 *  apiKey-SecretRef) is declared as a config default, so the SDK resolves the secret
 *  and hands the handler a ready-to-use Provider: this is BYO-model injection in action. */
export function makeWriter(defaults: { baseUrl: string; model: string }): AgentDefinition {
  return defineAgent({
    descriptor: {
      id: "ac.writer",
      name: "Writer",
      version: "0.1.0",
      capabilities: [{ id: "write", description: "Summarize or compose text with an LLM" }],
      configSchema: {
        type: "object",
        additionalProperties: true,
        properties: {
          style: { type: "string", default: "concise, neutral, executive tone" },
          provider: {
            type: "object",
            description: "BYO-model: kind/baseUrl/model and an apiKey SecretRef resolved from env.",
            default: {
              kind: "openai",
              baseUrl: defaults.baseUrl,
              model: defaults.model,
              apiKey: { secretRef: "OPENAI_API_KEY" },
            },
          },
        },
      },
    },
    async handle(goal, ctx) {
      const provider = ctx.config.provider as unknown as Provider;
      const style = String(ctx.config.style ?? "concise");
      ctx.progress(10, "Composing with model…");
      const out = await chat(
        provider,
        [
          {
            role: "system",
            content: `You are a writing assistant. Style: ${style}. Follow the user's instruction precisely; output only the requested content.`,
          },
          { role: "user", content: toText(goal) },
        ],
        { signal: ctx.signal },
      );
      ctx.progress(100, "Done");
      return [{ kind: "text", text: out }];
    },
  });
}
