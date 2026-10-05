import { z } from "zod";
import { RiskLevel } from "@nova/shared";
import { AgentTool } from "../../tools/base/agent-tool.interface";
import {
  BaseConnector,
  ConnectionTestResult,
} from "../base/connector.interface";

export class SlackConnector implements BaseConnector {
  public readonly id = "slack";
  public readonly name = "Slack";
  public readonly description =
    "Send messages, notifications, and query channels in your Slack workspace.";
  public readonly category = "communication" as const;
  public readonly icon = "MessageSquare";
  public readonly authType = "bearer_token" as const;
  public readonly capabilities = ["List Channels", "Send Messages", "Thread Replies"];
  public readonly documentationUrl =
    "https://api.slack.com/authentication/token-types#bot";

  public readonly credentialFields = [
    {
      key: "botToken",
      label: "Bot User OAuth Token",
      placeholder: "xoxb-...",
      type: "password" as const,
      required: true,
      description: "Slack Bot Token starting with 'xoxb-' with chat:write & channels:read scopes.",
    },
  ];

  public async testConnection(
    credentials: Record<string, string>
  ): Promise<ConnectionTestResult> {
    const token = credentials.botToken?.trim();
    if (!token) {
      return { success: false, message: "Slack Bot Token is required" };
    }

    try {
      const response = await fetch("https://slack.com/api/auth.test", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = (await response.json()) as any;
      if (!data.ok) {
        return {
          success: false,
          message: `Slack auth failed: ${data.error || "Unknown error"}`,
        };
      }

      return {
        success: true,
        message: `Connected successfully to workspace "${data.team}" as bot @${data.user}`,
        details: { team: data.team, user: data.user, teamId: data.team_id },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to connect to Slack: ${err.message || String(err)}`,
      };
    }
  }

  public createTools(credentials: Record<string, string>): AgentTool[] {
    const token = credentials.botToken?.trim() || "";
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // 1. List Channels Tool
    const listChannelsTool: AgentTool = {
      name: "slack_list_channels",
      description: "List public channels in the connected Slack workspace.",
      riskLevel: "LOW",
      inputSchema: z.object({
        limit: z.number().min(1).max(100).default(20).describe("Max channels to list"),
      }),
      execute: async ({ limit }) => {
        const res = await fetch(
          `https://slack.com/api/conversations.list?types=public_channel&limit=${limit}`,
          { headers }
        );
        const data = (await res.json()) as any;
        if (!data.ok) {
          throw new Error(`Slack API error: ${data.error}`);
        }
        return (data.channels || []).map((c: any) => ({
          id: c.id,
          name: `#${c.name}`,
          topic: c.topic?.value,
          numMembers: c.num_members,
        }));
      },
    };

    // 2. Send Message Tool
    const sendMessageTool: AgentTool = {
      name: "slack_send_message",
      description: "Post a message to a Slack channel or thread.",
      riskLevel: "MEDIUM",
      inputSchema: z.object({
        channel: z
          .string()
          .min(1)
          .describe("Channel ID (e.g. C123456) or channel name"),
        text: z.string().min(1).describe("The message text to send"),
        threadTs: z
          .string()
          .optional()
          .describe("Optional timestamp of a parent message to reply in thread"),
      }),
      execute: async ({ channel, text, threadTs }) => {
        const cleanChannel = channel.startsWith("#") ? channel.substring(1) : channel;
        const res = await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers,
          body: JSON.stringify({
            channel: cleanChannel,
            text,
            thread_ts: threadTs,
          }),
        });
        const data = (await res.json()) as any;
        if (!data.ok) {
          throw new Error(`Slack API error: ${data.error}`);
        }
        return {
          success: true,
          channel: data.channel,
          ts: data.ts,
          message: `Message sent to Slack channel ${channel} successfully.`,
        };
      },
    };

    return [listChannelsTool, sendMessageTool];
  }
}
