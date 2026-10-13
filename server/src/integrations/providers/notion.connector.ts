import { z } from "zod";
import { RiskLevel } from "@nova/shared";
import { AgentTool } from "../../tools/base/agent-tool.interface";
import {
  BaseConnector,
  ConnectionTestResult,
} from "../base/connector.interface";

export class NotionConnector implements BaseConnector {
  public readonly id = "notion";
  public readonly name = "Notion";
  public readonly description =
    "Search your Notion workspace, query databases, and create or append notes and documentation.";
  public readonly category = "productivity" as const;
  public readonly icon = "BookOpen";
  public readonly authType = "bearer_token" as const;
  public readonly capabilities = ["Search Workspace", "Create Pages", "Database Query"];
  public readonly documentationUrl =
    "https://developers.notion.com/docs/create-a-notion-integration";

  public readonly credentialFields = [
    {
      key: "apiKey",
      label: "Internal Integration Secret",
      placeholder: "ntn_... or secret_...",
      type: "password" as const,
      required: true,
      description: "Notion internal integration secret token.",
    },
  ];

  public async testConnection(
    credentials: Record<string, string>
  ): Promise<ConnectionTestResult> {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey) {
      return { success: false, message: "Notion Integration Secret is required" };
    }

    try {
      const response = await fetch("https://api.notion.com/v1/users/me", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Notion-Version": "2022-06-28",
        },
      });

      if (!response.ok) {
        return {
          success: false,
          message: `Notion authentication failed (HTTP ${response.status})`,
        };
      }

      const data = (await response.json()) as any;
      return {
        success: true,
        message: `Connected successfully to Notion as bot "${data.name || "Nova Integration"}"`,
        details: { botId: data.id, name: data.name },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to connect to Notion: ${err.message || String(err)}`,
      };
    }
  }

  public createTools(credentials: Record<string, string>): AgentTool[] {
    const apiKey = credentials.apiKey?.trim() || "";
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    };

    // 1. Notion Search Tool
    const searchTool: AgentTool = {
      name: "notion_search",
      description: "Search pages and databases across your Notion workspace.",
      riskLevel: "LOW",
      inputSchema: z.object({
        query: z.string().describe("Search query keywords"),
        filterType: z
          .enum(["page", "database"])
          .optional()
          .describe("Filter by object type"),
      }),
      execute: async ({ query, filterType }) => {
        const body: any = { query };
        if (filterType) {
          body.filter = { value: filterType, property: "object" };
        }
        const res = await fetch("https://api.notion.com/v1/search", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          throw new Error(`Notion API error (${res.status}): ${await res.text()}`);
        }
        const data = (await res.json()) as any;
        return (data.results || []).slice(0, 10).map((r: any) => {
          let title = "Untitled";
          if (r.properties?.title?.title?.[0]?.plain_text) {
            title = r.properties.title.title[0].plain_text;
          } else if (r.title?.[0]?.plain_text) {
            title = r.title[0].plain_text;
          }
          return {
            id: r.id,
            type: r.object,
            title,
            url: r.url,
            lastEditedTime: r.last_edited_time,
          };
        });
      },
    };

    // 2. Notion Create Page Tool
    const createPageTool: AgentTool = {
      name: "notion_create_page",
      description:
        "Create a new page in Notion under a parent page. Automatically parses headers, checklists, and bullet points.",
      riskLevel: "MEDIUM",
      inputSchema: z.object({
        parentPageId: z
          .string()
          .min(1)
          .describe(
            "The 32-character ID or URL of the parent Notion page (e.g. 354ee125-9771-0042-0e0a-dccb1497f850)",
          ),
        title: z.string().min(1).describe("The title of the new page"),
        content: z.string().describe("Markdown or text content for the page body"),
      }),
      execute: async ({ parentPageId, title, content }) => {
        // Extract 32-hex ID even if a full Notion URL is passed
        let cleanParentId = parentPageId.trim();
        const urlMatch = cleanParentId.match(
          /([a-fA-F0-9]{32}|[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})/,
        );
        if (urlMatch) {
          cleanParentId = urlMatch[1].replace(/-/g, "");
        } else {
          cleanParentId = cleanParentId.replace(/-/g, "");
        }

        // Helper to chunk text so each text.content is safely below Notion's 2000 character hard limit
        const chunkText = (str: string, maxLen = 1900): string[] => {
          if (!str) return [];
          const chunks: string[] = [];
          for (let i = 0; i < str.length; i += maxLen) {
            chunks.push(str.slice(i, i + maxLen));
          }
          return chunks;
        };

        // Convert markdown lines into native Notion blocks
        const blocks: any[] = [];
        const lines = content.split("\n");

        for (const rawLine of lines) {
          const line = rawLine.trimEnd();
          if (!line.trim()) continue;

          // Heading 1
          if (line.startsWith("# ")) {
            for (const chunk of chunkText(line.slice(2).trim())) {
              blocks.push({
                object: "block",
                type: "heading_1",
                heading_1: {
                  rich_text: [{ type: "text", text: { content: chunk } }],
                },
              });
            }
            continue;
          }

          // Heading 2
          if (line.startsWith("## ")) {
            for (const chunk of chunkText(line.slice(3).trim())) {
              blocks.push({
                object: "block",
                type: "heading_2",
                heading_2: {
                  rich_text: [{ type: "text", text: { content: chunk } }],
                },
              });
            }
            continue;
          }

          // Heading 3
          if (line.startsWith("### ")) {
            for (const chunk of chunkText(line.slice(4).trim())) {
              blocks.push({
                object: "block",
                type: "heading_3",
                heading_3: {
                  rich_text: [{ type: "text", text: { content: chunk } }],
                },
              });
            }
            continue;
          }

          // Checklist / To-Do item: - [ ] or - [x]
          const todoMatch = line.match(/^[-*]\s*\[([ xX])\]\s*(.*)$/);
          if (todoMatch) {
            const checked = todoMatch[1].toLowerCase() === "x";
            for (const chunk of chunkText(todoMatch[2].trim())) {
              blocks.push({
                object: "block",
                type: "to_do",
                to_do: {
                  checked,
                  rich_text: [{ type: "text", text: { content: chunk } }],
                },
              });
            }
            continue;
          }

          // Bulleted list item
          if (line.startsWith("- ") || line.startsWith("* ")) {
            for (const chunk of chunkText(line.slice(2).trim())) {
              blocks.push({
                object: "block",
                type: "bulleted_list_item",
                bulleted_list_item: {
                  rich_text: [{ type: "text", text: { content: chunk } }],
                },
              });
            }
            continue;
          }

          // Numbered list item: 1. Item
          const numMatch = line.match(/^\d+\.\s*(.*)$/);
          if (numMatch) {
            for (const chunk of chunkText(numMatch[1].trim())) {
              blocks.push({
                object: "block",
                type: "numbered_list_item",
                numbered_list_item: {
                  rich_text: [{ type: "text", text: { content: chunk } }],
                },
              });
            }
            continue;
          }

          // Standard paragraph
          for (const chunk of chunkText(line)) {
            blocks.push({
              object: "block",
              type: "paragraph",
              paragraph: {
                rich_text: [{ type: "text", text: { content: chunk } }],
              },
            });
          }
        }

        if (blocks.length === 0) {
          blocks.push({
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [
                {
                  type: "text",
                  text: { content: content.slice(0, 1900) || "Empty note" },
                },
              ],
            },
          });
        }

        // Notion page creation allows max 100 blocks in children
        const initialBlocks = blocks.slice(0, 100);
        const remainingBlocks = blocks.slice(100);

        const res = await fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers,
          body: JSON.stringify({
            parent: { page_id: cleanParentId },
            properties: {
              title: {
                title: [{ text: { content: title.slice(0, 1900) } }],
              },
            },
            children: initialBlocks,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          let errDetail = errText;
          try {
            const parsed = JSON.parse(errText);
            errDetail = parsed.message || errText;
          } catch {}
          throw new Error(`Notion API error (${res.status}): ${errDetail}`);
        }

        const data = (await res.json()) as any;
        const pageId = data.id;

        // If content had more than 100 blocks, append remaining in batches of 100
        if (remainingBlocks.length > 0 && pageId) {
          for (let i = 0; i < remainingBlocks.length; i += 100) {
            const batch = remainingBlocks.slice(i, i + 100);
            const patchRes = await fetch(
              `https://api.notion.com/v1/blocks/${pageId.replace(/-/g, "")}/children`,
              {
                method: "PATCH",
                headers,
                body: JSON.stringify({ children: batch }),
              },
            );
            if (!patchRes.ok) {
              // Non-fatal if page was created, but log warning
              console.warn(
                `Failed appending block batch to Notion page ${pageId}: ${await patchRes.text()}`,
              );
            }
          }
        }

        return {
          id: data.id,
          url: data.url,
          totalBlocks: blocks.length,
          message: `Created Notion page "${title}" successfully with ${blocks.length} formatted blocks.`,
        };
      },
    };

    return [searchTool, createPageTool];
  }
}
