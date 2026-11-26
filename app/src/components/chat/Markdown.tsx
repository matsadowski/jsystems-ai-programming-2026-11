// Safe Markdown for model output: no raw HTML, limited elements, links as plain text (ADR 003 §3.2).
import ReactMarkdown from "react-markdown";

const ALLOWED = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "strong", "em", "ul", "ol", "li", "code"];

export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 text-base [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_h4]:font-bold [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_code]:rounded-xs [&_code]:bg-bg-light [&_code]:px-1">
      <ReactMarkdown allowedElements={ALLOWED} unwrapDisallowed>
        {children}
      </ReactMarkdown>
    </div>
  );
}
