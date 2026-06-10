export function ResultPanel({ result, error }: { result?: string; error?: string }) {
  if (error) return <pre className="whitespace-pre-wrap text-sm text-err">✗ {error}</pre>;
  if (!result) return <div className="text-sm italic text-dim">The final result appears here.</div>;
  return <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[#e6e9ef]">{result}</pre>;
}
