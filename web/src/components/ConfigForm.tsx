import type { JsonSchema, JsonSchemaProp } from "../api.ts";

// Renders an agent's configuration surface straight from its declared JSON Schema
// (descriptor.configSchema). This is what turns "a dropdown of names" into "test and
// CONFIGURE any agent" — and it's the spec's "configurable component" claim made
// tangible. Only flat primitive knobs (string/number/boolean/enum) are rendered as
// inputs; complex defaults (e.g. the BYO-model `provider` object) are shown read-only
// so they're visible without being foot-guns. Values flow up via onChange and are sent
// verbatim to the worker through AgentClient.configure().
const PRIMITIVE = new Set(["string", "number", "integer", "boolean"]);

function typeOf(p: JsonSchemaProp): string {
  return Array.isArray(p.type) ? (p.type.find((t) => t !== "null") ?? "string") : (p.type ?? "string");
}

/** Seed a config object from a schema's declared defaults (primitives only). */
export function defaultsFromSchema(schema?: JsonSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(schema?.properties ?? {})) {
    if (prop.default !== undefined && PRIMITIVE.has(typeOf(prop))) out[key] = prop.default;
  }
  return out;
}

export function ConfigForm({
  schema,
  value,
  onChange,
}: {
  schema?: JsonSchema;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const props = Object.entries(schema?.properties ?? {});
  if (props.length === 0)
    return <p className="px-1 text-xs text-dim">This agent declares no configuration.</p>;

  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {props.map(([key, prop]) => {
        const t = typeOf(prop);
        const label = (
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-[12px] text-white">{key}</span>
            {prop.description && <span className="truncate text-[10px] text-dim" title={prop.description}>{prop.description}</span>}
          </span>
        );

        if (!PRIMITIVE.has(t)) {
          return (
            <label key={key} className="flex flex-col gap-1 sm:col-span-2">
              {label}
              <code className="overflow-x-auto rounded-lg border border-line bg-panel2 px-2.5 py-1.5 text-[11px] text-dim">
                {JSON.stringify(prop.default ?? `(${t})`)}
              </code>
            </label>
          );
        }

        if (t === "boolean") {
          return (
            <label key={key} className="flex cursor-pointer items-center gap-2 py-1 text-[13px] text-dim select-none">
              <input
                type="checkbox"
                checked={Boolean(value[key] ?? prop.default ?? false)}
                onChange={(e) => set(key, e.target.checked)}
              />
              {label}
            </label>
          );
        }

        if (Array.isArray(prop.enum)) {
          return (
            <label key={key} className="flex flex-col gap-1">
              {label}
              <select
                value={String(value[key] ?? prop.default ?? "")}
                onChange={(e) => set(key, e.target.value)}
                className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-sm outline-none focus:border-accent"
              >
                {prop.enum.map((o) => (
                  <option key={String(o)} value={String(o)}>{String(o)}</option>
                ))}
              </select>
            </label>
          );
        }

        const isNum = t === "number" || t === "integer";
        return (
          <label key={key} className="flex flex-col gap-1">
            {label}
            <input
              type={isNum ? "number" : "text"}
              value={String(value[key] ?? prop.default ?? "")}
              min={prop.minimum}
              max={prop.maximum}
              onChange={(e) => set(key, isNum ? (e.target.value === "" ? undefined : Number(e.target.value)) : e.target.value)}
              className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            />
          </label>
        );
      })}
    </div>
  );
}
