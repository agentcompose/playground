import { useEffect, useState, type ReactNode } from "react";
import type { JsonSchema, JsonSchemaProp } from "../api.ts";

// Renders an agent's configuration surface straight from its declared JSON Schema
// (descriptor.configSchema). This is what turns "a dropdown of names" into "test and
// CONFIGURE any agent" — and it's the spec's "configurable component" claim made
// tangible. Primitive knobs (string/number/boolean/enum) render as native inputs;
// string[] arrays render as an editable list; objects and object[] (e.g. weighted
// `criteria`, the BYO-model `provider`) render as a validated JSON editor. Every field
// reflects the LIVE value (not just the schema default) and flows up via onChange,
// then ships verbatim to the worker through AgentClient.configure().
const PRIMITIVE = new Set(["string", "number", "integer", "boolean"]);

function typeOf(p: JsonSchemaProp): string {
  return Array.isArray(p.type) ? (p.type.find((t) => t !== "null") ?? "string") : (p.type ?? "string");
}
function itemTypeOf(p: JsonSchemaProp): string | undefined {
  const it = p.items?.type;
  return Array.isArray(it) ? it.find((t) => t !== "null") : it;
}

/** Seed a config object from a schema's declared defaults (primitives only). */
export function defaultsFromSchema(schema?: JsonSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(schema?.properties ?? {})) {
    if (prop.default !== undefined && PRIMITIVE.has(typeOf(prop))) out[key] = prop.default;
  }
  return out;
}

/** Editable list of strings (e.g. `options`, `includeDomains`). One item per line. */
function ListField({ label, value, onChange }: { label: ReactNode; value: unknown; onChange: (v: string[] | undefined) => void }) {
  const initial = Array.isArray(value) ? (value as unknown[]).map(String).join("\n") : "";
  const [text, setText] = useState(initial);
  useEffect(() => { setText(Array.isArray(value) ? (value as unknown[]).map(String).join("\n") : ""); }, [JSON.stringify(value)]);
  return (
    <label className="flex flex-col gap-1 sm:col-span-2">
      {label}
      <textarea
        className="field font-mono text-[11px]"
        rows={Math.min(6, Math.max(2, text.split("\n").length))}
        placeholder="one value per line"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const arr = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
          onChange(arr.length ? arr : undefined);
        }}
      />
    </label>
  );
}

/** Editable, validated JSON for objects / object arrays (e.g. `criteria`, `provider`). */
function JsonField({ label, value, fallback, onChange }: { label: ReactNode; value: unknown; fallback?: unknown; onChange: (v: unknown) => void }) {
  const show = value !== undefined ? value : fallback;
  const [text, setText] = useState(show === undefined ? "" : JSON.stringify(show, null, 2));
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const v = value !== undefined ? value : fallback;
    setText(v === undefined ? "" : JSON.stringify(v, null, 2));
    setErr(null);
  }, [JSON.stringify(value)]);
  return (
    <label className="flex flex-col gap-1 sm:col-span-2">
      {label}
      <textarea
        className="field font-mono text-[11px]"
        rows={Math.min(12, Math.max(3, text.split("\n").length))}
        value={text}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          const raw = e.target.value.trim();
          if (raw === "") { setErr(null); onChange(undefined); return; }
          try { onChange(JSON.parse(raw)); setErr(null); } catch { setErr("invalid JSON — not applied"); }
        }}
      />
      {err && <span className="text-[10px] text-err">{err}</span>}
    </label>
  );
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

        if (t === "array" && itemTypeOf(prop) === "string") {
          return <ListField key={key} label={label} value={value[key] ?? prop.default} onChange={(v) => set(key, v)} />;
        }
        if (!PRIMITIVE.has(t)) {
          return <JsonField key={key} label={label} value={value[key]} fallback={prop.default} onChange={(v) => set(key, v)} />;
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
                className="select"
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
              className="field"
            />
          </label>
        );
      })}
    </div>
  );
}
