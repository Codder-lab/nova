/**
 * Sanitizes markdown and formatted LLM assistant responses into natural,
 * clean text suitable for Text-to-Speech (TTS) engines without reading
 * code syntax, markdown asterisks, or raw URLs.
 */
export function sanitizeForSpeech(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  let sanitized = text;

  // 1. Remove fenced code blocks (multiline)
  sanitized = sanitized.replace(/```[a-zA-Z0-9_-]*\n[\s\S]*?```/g, "Code block omitted.");
  sanitized = sanitized.replace(/```[\s\S]*?```/g, "Code block omitted.");

  // 2. Remove inline code backticks while preserving content
  sanitized = sanitized.replace(/`([^`]+)`/g, "$1");

  // 3. Remove markdown image tags completely
  sanitized = sanitized.replace(/!\[([^\]]*)\]\([^)]+\)/g, "");

  // 4. Convert markdown links [Label](URL) -> Label
  sanitized = sanitized.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // 5. Replace raw URLs (http:// or https://) with "the link"
  sanitized = sanitized.replace(/https?:\/\/[^\s)]+/g, "the link");

  // 6. Strip bullet lists and numbered lists before italic regex
  sanitized = sanitized.replace(/^\s*[-*+]\s+/gm, "");
  sanitized = sanitized.replace(/^\s*\d+\.\s+/gm, "");

  // 7. Strip blockquotes (> Quote -> Quote)
  sanitized = sanitized.replace(/^\s*>\s+/gm, "");

  // 8. Strip markdown headings (# Title -> Title)
  sanitized = sanitized.replace(/^#{1,6}\s+/gm, "");

  // 9. Strip bold, italics, and strikethrough without multiline cross-matching
  sanitized = sanitized.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  sanitized = sanitized.replace(/__([^_\n]+)__/g, "$1");
  sanitized = sanitized.replace(/\*([^*\n]+)\*/g, "$1");
  sanitized = sanitized.replace(/_([^_\n]+)_/g, "$1");
  sanitized = sanitized.replace(/~~([^~\n]+)~~/g, "$1");

  // 10. Strip horizontal rules (---, ***, ___)
  sanitized = sanitized.replace(/^[-*_]{3,}\s*$/gm, "");

  // 11. Remove any lone leftover markdown formatting markers
  sanitized = sanitized.replace(/[*_~#]/g, "");

  // 12. Remove HTML tags if present (e.g. <br/>, <div>)
  sanitized = sanitized.replace(/<[^>]+>/g, " ");

  // 13. Normalize multiple newlines and spaces
  sanitized = sanitized.replace(/\r\n/g, "\n");
  sanitized = sanitized.replace(/\n{2,}/g, ". ");
  sanitized = sanitized.replace(/\n/g, " ");
  sanitized = sanitized.replace(/\s{2,}/g, " ");

  // 14. Clean repeated periods or punctuation
  sanitized = sanitized.replace(/\.\s*\./g, ".");

  return sanitized.trim();
}
