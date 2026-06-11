import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Rendered markdown with GFM (tables, strikethrough, autolinks). Styling lives in the
// `.md` block in index.css. Links open in a new tab.
export function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
