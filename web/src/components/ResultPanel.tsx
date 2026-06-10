import { useState } from "react";
import type { Part } from "../types.ts";
import { Markdown } from "./Markdown.tsx";

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="rounded-md border border-line bg-panel2 px-2 py-1 text-[11px] text-dim transition hover:text-white"
    >
      {done ? "✓ copied" : "copy"}
    </button>
  );
}

function DownloadButton({ text }: { text: string }) {
  return (
    <button
      onClick={() => {
        const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = "report.md";
        a.click();
        URL.revokeObjectURL(url);
      }}
      className="rounded-md border border-line bg-panel2 px-2 py-1 text-[11px] text-dim transition hover:text-white"
    >
      ↓ .md
    </button>
  );
}

function JsonDisclosure({ json }: { json: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-line pt-2">
      <button onClick={() => setOpen((o) => !o)} className="text-[11px] text-dim hover:text-white">
        {open ? "▾ hide" : "▸ show"} structured data (JSON)
      </button>
      {open && (
        <pre className="mt-1.5 max-h-72 overflow-auto rounded-md bg-bg p-2.5 font-mono text-[11.5px] text-[#cbd2e0]">
          {JSON.stringify(json, null, 2)}
        </pre>
      )}
    </div>
  );
}

// The final result. Text parts render as markdown (the report); any structured (JSON)
// part — e.g. machine-readable citations — is tucked into a disclosure so it doesn't
// clutter the readable report. Copy / download act on the markdown.
export function ResultPanel({ parts, error }: { parts?: Part[]; error?: string }) {
  if (error) return <pre className="whitespace-pre-wrap text-sm text-err">✗ {error}</pre>;
  if (!parts || parts.length === 0) return <div className="text-sm italic text-dim">The final result appears here.</div>;

  const text = parts
    .filter((p): p is Extract<Part, { kind: "text" }> => p.kind === "text")
    .map((p) => p.text)
    .join("\n\n")
    .trim();
  const json = parts.find((p) => p.kind === "json") as Extract<Part, { kind: "json" }> | undefined;

  return (
    <div className="space-y-3">
      {text && (
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-dim">report</span>
          <div className="ml-auto flex gap-1.5">
            <CopyButton text={text} />
            <DownloadButton text={text} />
          </div>
        </div>
      )}
      {text ? <Markdown text={text} /> : <div className="text-sm italic text-dim">(no text in result)</div>}
      {json && <JsonDisclosure json={json.json} />}
    </div>
  );
}
