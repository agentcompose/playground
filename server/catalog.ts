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
import { fetchAgent, makeWriter } from "./agents.ts";
import { makeResearchAgent, tavily } from "@agentcompose/research-agent";

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
    { name: "fetch", def: fetchAgent },
    { name: "writer", def: makeWriter({ baseUrl, model }) },
    {
      name: "research",
      def: makeResearchAgent({
        defaults: { baseUrl, model, angles: 3, maxSourcesPerAngle: 4, maxIterationsPerAngle: 1 },
        ...(tavilyKey ? { search: tavily({ apiKey: tavilyKey }) } : {}),
      }),
    },
    // To add the coding worker: `npm i @agentcompose/coding-agent`, then append:
    //   { name: "coding", def: makeCodingAgent({ defaults: { baseUrl, model } }) },
  ];
}
