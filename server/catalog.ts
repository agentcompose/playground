// The agent catalog — the playground's single, declarative source of truth for
// "which agents exist." Both the *engine* (master) registry and the *single-agent*
// test mode are built from this one list, so adding an agent is a one-line change
// here (no edits to server.ts, no UI changes — the dropdown and roster are derived).
//
// This is the playground's small "DI container": each entry pairs a stable registry
// `name` with an `AgentDefinition` (the SDK component, already constructed with its
// base defaults). Per-run configuration is layered on top at call time via the
// uniform `AgentClient.configure()`, exactly as the spec prescribes. To plug in a new
// worker (e.g. @agentcompose/coding-agent), add it as a dependency and append one entry.
import type { AgentDefinition } from "@agentcompose/sdk";
import { makeResearchAgent, tavily } from "@agentcompose/research-agent";
import { makeCodingAgent } from "@agentcompose/coding-agent";
import { makeAnalysisAgent } from "@agentcompose/analysis-agent";

export interface CatalogEntry {
  /** Registry key + dropdown id (stable, lowercase). */
  name: string;
  /** The SDK component, constructed with its base defaults. */
  def: AgentDefinition;
}

export interface CatalogEnv {
  baseUrl: string;
  model: string;
  tavilyKey?: string;
}

/** Build the catalog from environment. One place to register every agent. */
export function buildCatalog(env: CatalogEnv): CatalogEntry[] {
  const { baseUrl, model, tavilyKey } = env;
  return [
    {
      name: "research",
      def: makeResearchAgent({
        defaults: { baseUrl, model, angles: 3, maxSourcesPerAngle: 4, maxIterationsPerAngle: 1 },
        ...(tavilyKey ? { search: tavily({ apiKey: tavilyKey }) } : {}),
      }),
    },
    // Coding worker (@agentcompose/coding-agent): wraps pi, runs in a disposable temp
    // workspace per run, returns a summary + diffs. Drives the same OpenAI gateway.
    { name: "coding", def: makeCodingAgent({ defaults: { baseUrl, model } }) },
    // Analysis worker (@agentcompose/analysis-agent): scores options against weighted
    // criteria over supplied evidence and returns a ranked verdict + recommendation.
    // The natural "decide" node between research (gather) and coding (build).
    { name: "analysis", def: makeAnalysisAgent({ defaults: { baseUrl, model } }) },
  ];
}
