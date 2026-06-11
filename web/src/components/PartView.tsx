import { useState } from "react";
import type { Part } from "../types.ts";
import { Markdown } from "./Markdown.tsx";

// Colorize a unified diff / patch. Best-effort line classification — no parsing, just
// the leading character, which is enough for git-style patches the coding agent emits.
export function Diff({ text }: { text: string }) {
  const lines = text.replace(/\n$/, "").split("\n");
  return (
    <pre className="max-h-96 overflow-auto rounded-md bg-bg p-2.5 font-mono text-[11.5px] leading-[1.45]">
      {lines.map((line, i) => {
        let cls = "text-[#9aa4b8]";
        if (/^\+\+\+|^---|^diff |^index /.test(line)) cls = "text-accent";
        else if (/^@@/.test(line)) cls = "text-[#c08cf0]";
        else if (line.startsWith("+")) cls = "text-ok bg-[#0f2a18]";
        else if (line.startsWith("-")) cls = "text-err bg-[#2a1414]";
        return (
          <div key={i} className={`whitespace-pre-wrap ${cls}`}>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}

function looksLikeDiff(name: string | undefined, text: string): boolean {
  if (name && /\.(patch|diff)$/i.test(name)) return true;
  return /^(diff --git |--- |\+\+\+ |@@ )/m.test(text.slice(0, 200));
}

function bytesToDataUrl(mediaType: string, bytes: string): string {
  return `data:${mediaType};base64,${bytes}`;
}

/** A text body with a raw ⇄ rendered (markdown) toggle, defaulting to rendered. Diffs /
 *  patches are detected and shown colorized (never markdown). Shared by step output and
 *  artifact text so reports read as formatted markdown while staying inspectable as raw. */
export function TextBody({ text, name }: { text: string; name?: string }) {
  const [raw, setRaw] = useState(false);
  if (looksLikeDiff(name, text)) return <Diff text={text} />;
  return (
    <div>
      <button
        onClick={() => setRaw((r) => !r)}
        className="mb-1 font-mono text-[10.5px] text-dim hover:text-white"
        title={raw ? "Show rendered markdown" : "Show raw text"}
      >
        {raw ? "rendered" : "raw"}
      </button>
      {raw ? (
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-bg p-2.5 font-mono text-[11.5px] text-[#cbd2e0]">
          {text}
        </pre>
      ) : (
        <div className="max-h-96 overflow-auto rounded-md bg-bg p-2.5">
          <Markdown text={text} />
        </div>
      )}
    </div>
  );
}

/** Render a single Part richly: diffs colorized, images inline, files as links/downloads,
 *  JSON pretty-printed, text as markdown (with a raw toggle). */
export function PartView({ part, name }: { part: Part; name?: string }) {
  const [showJson, setShowJson] = useState(false);

  if (part.kind === "text") return <TextBody text={part.text} name={name} />;

  if (part.kind === "json") {
    return (
      <div>
        <button onClick={() => setShowJson((o) => !o)} className="text-[11px] text-dim hover:text-white">
          {showJson ? "▾ hide" : "▸ show"} JSON
        </button>
        {showJson && (
          <pre className="mt-1.5 max-h-96 overflow-auto rounded-md bg-bg p-2.5 font-mono text-[11.5px] text-[#cbd2e0]">
            {JSON.stringify(part.json, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  // file part
  const isImage = part.mediaType.startsWith("image/");
  const href = part.uri ?? (part.bytes ? bytesToDataUrl(part.mediaType, part.bytes) : undefined);
  const label = part.name ?? name ?? part.mediaType;
  if (isImage && href) {
    return <img src={href} alt={label} className="max-h-72 rounded-md border border-line" />;
  }
  return (
    <div className="flex items-center gap-2 rounded-md border border-line bg-bg px-2.5 py-2 text-xs">
      <span aria-hidden>📄</span>
      <span className="font-mono text-[#cbd2e0]">{label}</span>
      <span className="text-dim">{part.mediaType}</span>
      {href && (
        <a href={href} download={part.name ?? "file"} className="btn btn-ghost btn-sm ml-auto">
          ↓ download
        </a>
      )}
    </div>
  );
}
