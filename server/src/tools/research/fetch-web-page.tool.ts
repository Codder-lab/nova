import { z } from "zod";
import * as cheerio from "cheerio";
import { AgentTool, ToolContext } from "../base/agent-tool.interface";

export const fetchWebPageTool: AgentTool = {
  name: "fetch_web_page",
  description:
    "Fetches the text content of a web page URL and extracts readable, clean markdown-like text.",
  riskLevel: "READ",
  inputSchema: z.object({
    url: z
      .string()
      .url()
      .describe(
        "The URL of the webpage to fetch (must start with http:// or https://)",
      ),
    maxLength: z
      .number()
      .min(500)
      .max(20000)
      .optional()
      .default(4000)
      .describe("Maximum characters of content to return (default 4000)"),
  }),
  async execute(input, _context: ToolContext) {
    const { url, maxLength = 4000 } = input;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return {
          success: false,
          url,
          status: response.status,
          error: `HTTP request failed with status ${response.status} (${response.statusText})`,
        };
      }

      const contentType = response.headers.get("content-type") || "";
      if (
        !contentType.includes("text/") &&
        !contentType.includes("application/json") &&
        !contentType.includes("application/xhtml+xml")
      ) {
        return {
          success: false,
          url,
          error: `Unsupported content type "${contentType}". Only HTML, plain text, and JSON pages can be fetched.`,
        };
      }

      const rawContent = await response.text();

      // If plain text or JSON, return directly truncated
      if (
        contentType.includes("text/plain") ||
        contentType.includes("application/json")
      ) {
        const text = rawContent.slice(0, maxLength);
        return {
          success: true,
          url,
          title: url,
          content:
            text.length < rawContent.length
              ? `${text}\n\n[... Truncated ${rawContent.length - maxLength} characters ...]`
              : text,
        };
      }

      // Parse HTML with cheerio
      const $ = cheerio.load(rawContent);

      // Strip non-content elements
      $(
        'script, style, noscript, svg, iframe, nav, footer, header, form, aside, [role="navigation"], [role="banner"]',
      ).remove();

      const title =
        $("title").text().trim() || $("h1").first().text().trim() || url;
      const metaDescription = $('meta[name="description"]')
        .attr("content")
        ?.trim();

      // Extract main text or body
      const mainContainer = $(
        "article, main, #content, .content, body",
      ).first();
      let extractedText = "";

      if (mainContainer.length > 0) {
        // Collect text by paragraph and heading blocks
        const blocks: string[] = [];
        mainContainer
          .find("h1, h2, h3, h4, h5, h6, p, li, pre, blockquote")
          .each((_i, el) => {
            const tag = (
              "tagName" in el ? (el as any).tagName : (el as any).name || ""
            ).toLowerCase();
            const text = $(el).text().replace(/\s+/g, " ").trim();
            if (!text) return;

            if (tag.startsWith("h")) {
              const level = parseInt(tag[1], 10) || 2;
              blocks.push(`\n${"#".repeat(level)} ${text}`);
            } else if (tag === "li") {
              blocks.push(`• ${text}`);
            } else if (tag === "pre") {
              blocks.push(`\`\`\`\n${text}\n\`\`\``);
            } else {
              blocks.push(text);
            }
          });

        extractedText = blocks.join("\n\n");
      }

      if (!extractedText) {
        extractedText = $("body").text().replace(/\s+/g, " ").trim();
      }

      let content = extractedText;
      if (metaDescription) {
        content = `Summary: ${metaDescription}\n\n${content}`;
      }

      const isTruncated = content.length > maxLength;
      const truncated = isTruncated
        ? `${content.slice(0, maxLength)}\n\n[... Truncated ${content.length - maxLength} remaining characters ...]`
        : content;

      return {
        success: true,
        url,
        title,
        status: response.status,
        content: truncated,
      };
    } catch (err: any) {
      return {
        success: false,
        url,
        error: `Failed to fetch webpage: ${err.message}`,
      };
    }
  },
};
