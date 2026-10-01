import React from "react";
import { ExternalLink, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  showReferences?: boolean;
}

export interface ExtractedReference {
  title: string;
  url: string;
  domain: string;
}

/**
 * Extract all markdown and raw links from content
 */
export function extractReferences(markdownText: string): ExtractedReference[] {
  const refs: ExtractedReference[] = [];
  const seenUrls = new Set<string>();

  // Match [title](url)
  const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
  let match;
  while ((match = mdLinkRegex.exec(markdownText)) !== null) {
    const title = match[1].trim();
    const url = match[2].trim();
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      try {
        const domain = new URL(url).hostname.replace(/^www\./, "");
        refs.push({ title, url, domain });
      } catch {
        refs.push({ title, url, domain: url });
      }
    }
  }

  // Match raw https://... links that aren't already captured
  const rawUrlRegex = /(?<!\()https?:\/\/[^\s\)\],]+/g;
  while ((match = rawUrlRegex.exec(markdownText)) !== null) {
    const url = match[0].trim();
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      try {
        const domain = new URL(url).hostname.replace(/^www\./, "");
        refs.push({ title: domain, url, domain });
      } catch {
        refs.push({ title: url, url, domain: url });
      }
    }
  }

  return refs;
}

/**
 * Helper to parse inline markdown elements (bold, italic, code, links)
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  // Tokenize bold, italic, code, and links
  const tokenRegex =
    /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s\)]+\)|https?:\/\/[^\s\)\],]+)/g;

  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(text)) !== null) {
    // Add preceding plain text
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `token-${match.index}`;

    if (token.startsWith("**") && token.endsWith("**")) {
      elements.push(
        <strong key={key} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("__") && token.endsWith("__")) {
      elements.push(
        <strong key={key} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      elements.push(
        <em key={key} className="italic text-foreground">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith("_") && token.endsWith("_")) {
      elements.push(
        <em key={key} className="italic text-foreground">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      elements.push(
        <code
          key={key}
          className="px-1.5 py-0.5 rounded bg-secondary text-foreground font-mono text-[11px] border border-border"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("[") && token.includes("](")) {
      const linkMatch = token.match(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/);
      if (linkMatch) {
        const linkTitle = linkMatch[1];
        const linkUrl = linkMatch[2];
        elements.push(
          <a
            key={key}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-primary underline underline-offset-4 hover:opacity-80 font-medium break-all"
          >
            <span>{linkTitle}</span>
            <ExternalLink className="w-3 h-3 shrink-0 inline-block ml-0.5 opacity-70" />
          </a>,
        );
      } else {
        elements.push(token);
      }
    } else if (token.startsWith("http://") || token.startsWith("https://")) {
      elements.push(
        <a
          key={key}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-primary underline underline-offset-4 hover:opacity-80 font-medium break-all text-xs"
        >
          <span>{token}</span>
          <ExternalLink className="w-3 h-3 shrink-0 inline-block ml-0.5 opacity-70" />
        </a>,
      );
    } else {
      elements.push(token);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
  showReferences = true,
}) => {
  if (!content) return null;

  const references = extractReferences(content);

  // Clean lines and blocks
  const lines = content.split("\n");
  const renderedBlocks: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code block start/end
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        // Close code block
        renderedBlocks.push(
          <div
            key={`codeblock-${i}`}
            className="my-2.5 rounded-md border border-border bg-secondary/80 overflow-hidden"
          >
            {codeBlockLang && (
              <div className="px-3 py-1 bg-muted/60 text-[10px] font-mono text-muted-foreground border-b border-border">
                {codeBlockLang}
              </div>
            )}
            <pre className="p-3 font-mono text-[11px] overflow-x-auto text-foreground whitespace-pre">
              {codeBlockContent.join("\n")}
            </pre>
          </div>,
        );
        inCodeBlock = false;
        codeBlockContent = [];
        codeBlockLang = "";
      } else {
        inCodeBlock = true;
        codeBlockLang = line.trim().replace(/^```/, "");
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Empty lines
    if (!line.trim()) {
      renderedBlocks.push(<div key={`empty-${i}`} className="h-2" />);
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      renderedBlocks.push(
        <h4
          key={`h3-${i}`}
          className="font-semibold text-xs sm:text-sm text-foreground mt-3 mb-1 tracking-tight"
        >
          {parseInlineMarkdown(line.replace(/^###\s+/, ""))}
        </h4>,
      );
      continue;
    }
    if (line.startsWith("## ")) {
      renderedBlocks.push(
        <h3
          key={`h2-${i}`}
          className="font-semibold text-sm sm:text-base text-foreground mt-3.5 mb-1.5 tracking-tight"
        >
          {parseInlineMarkdown(line.replace(/^##\s+/, ""))}
        </h3>,
      );
      continue;
    }
    if (line.startsWith("# ")) {
      renderedBlocks.push(
        <h2
          key={`h1-${i}`}
          className="font-bold text-base sm:text-lg text-foreground mt-4 mb-2 tracking-tight"
        >
          {parseInlineMarkdown(line.replace(/^#\s+/, ""))}
        </h2>,
      );
      continue;
    }

    // Numbered list (e.g. "1. **Title**: ...")
    const numListMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numListMatch) {
      const num = numListMatch[1];
      const itemText = numListMatch[2];
      renderedBlocks.push(
        <div key={`num-${i}`} className="flex items-start gap-2 my-1 pl-1">
          <span className="font-mono text-xs text-muted-foreground select-none shrink-0 w-4 text-right">
            {num}.
          </span>
          <div className="flex-1 min-w-0 leading-relaxed text-xs sm:text-sm text-foreground">
            {parseInlineMarkdown(itemText)}
          </div>
        </div>,
      );
      continue;
    }

    // Unordered list item (- or *)
    const bulletMatch = line.match(/^(\s*)[-*•]\s+(.*)$/);
    if (bulletMatch) {
      const indent = bulletMatch[1].length > 0;
      const itemText = bulletMatch[2];
      renderedBlocks.push(
        <div
          key={`bullet-${i}`}
          className={cn(
            "flex items-start gap-2 my-0.5",
            indent ? "pl-5" : "pl-2",
          )}
        >
          <span className="text-muted-foreground select-none shrink-0 text-xs mt-1">
            •
          </span>
          <div className="flex-1 min-w-0 leading-relaxed text-xs sm:text-sm text-foreground">
            {parseInlineMarkdown(itemText)}
          </div>
        </div>,
      );
      continue;
    }

    // Standard paragraph
    renderedBlocks.push(
      <p
        key={`p-${i}`}
        className="leading-relaxed text-xs sm:text-sm text-foreground my-1"
      >
        {parseInlineMarkdown(line)}
      </p>,
    );
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockContent.length > 0) {
    renderedBlocks.push(
      <pre
        key="codeblock-end"
        className="p-3 my-2 font-mono text-[11px] overflow-x-auto text-foreground bg-secondary/80 rounded border border-border"
      >
        {codeBlockContent.join("\n")}
      </pre>,
    );
  }

  return (
    <div className={cn("space-y-0.5", className)}>
      {renderedBlocks}

      {/* Sources & References Section at the bottom */}
      {showReferences && references.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <Globe className="w-3.5 h-3.5" />
            <span>References & Sources ({references.length})</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {references.map((ref, idx) => (
              <a
                key={idx}
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-secondary/70 hover:bg-secondary text-foreground text-xs transition-colors group cursor-pointer max-w-full truncate shadow-2xs"
                title={ref.url}
              >
                <span className="font-mono text-[10px] text-muted-foreground">
                  [{idx + 1}]
                </span>
                <span className="font-medium truncate max-w-[200px]">
                  {ref.title || ref.domain}
                </span>
                <span className="text-[10px] text-muted-foreground opacity-70 truncate">
                  ({ref.domain})
                </span>
                <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-foreground shrink-0 ml-0.5" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
