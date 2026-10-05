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
      description: "Create a new page in Notion under a parent page.",
      riskLevel: "MEDIUM",
      inputSchema: z.object({
        parentPageId: z
          .string()
          .min(1)
          .describe("The 32-character ID of the parent Notion page"),
        title: z.string().min(1).describe("The title of the new page"),
        content: z.string().describe("Text content for the page body"),
      }),
      execute: async ({ parentPageId, title, content }) => {
        const res = await fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers,
          body: JSON.stringify({
            parent: { page_id: parentPageId.replace(/-/g, "") },
            properties: {
              title: {
                title: [{ text: { content: title } }],
              },
            },
            children: [
              {
                object: "block",
                type: "paragraph",
                paragraph: {
                  rich_text: [{ type: "text", text: { content } }],
                },
              },
            ],
          }),
        });
        if (!res.ok) {
          throw new Error(`Notion API error (${res.status}): ${await res.text()}`);
        }
        const data = (await res.json()) as any;
        return {
          id: data.id,
          url: data.url,
          message: `Created Notion page "${title}" successfully.`,
        };
      },
    };

    return [searchTool, createPageTool];
  }
}
