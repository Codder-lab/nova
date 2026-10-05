import { z } from "zod";
import { RiskLevel } from "@nova/shared";
import { AgentTool } from "../../tools/base/agent-tool.interface";
import {
  BaseConnector,
  ConnectionTestResult,
} from "../base/connector.interface";

export class DiscordConnector implements BaseConnector {
  public readonly id = "discord";
  public readonly name = "Discord";
  public readonly description =
    "Send messages, embeds, and status alerts to Discord channels using Webhooks.";
  public readonly category = "communication" as const;
  public readonly icon = "Radio";
  public readonly authType = "webhook" as const;
  public readonly capabilities = ["Send Messages", "Rich Embed Alerts"];
  public readonly documentationUrl =
    "https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks";

  public readonly credentialFields = [
    {
      key: "webhookUrl",
      label: "Discord Webhook URL",
      placeholder: "https://discord.com/api/webhooks/...",
      type: "url" as const,
      required: true,
      description: "Channel Webhook URL from Discord channel settings -> Integrations.",
    },
  ];

  public async testConnection(
    credentials: Record<string, string>
  ): Promise<ConnectionTestResult> {
    const webhookUrl = credentials.webhookUrl?.trim();
    if (!webhookUrl) {
      return { success: false, message: "Discord Webhook URL is required" };
    }

    try {
      const response = await fetch(webhookUrl);
      if (!response.ok) {
        return {
          success: false,
          message: `Discord Webhook check failed (HTTP ${response.status})`,
        };
      }

      const data = (await response.json()) as any;
      return {
        success: true,
        message: `Connected successfully to Discord webhook: "${data.name || "Nova Webhook"}" in channel ID ${data.channel_id}`,
        details: { name: data.name, channelId: data.channel_id, guildId: data.guild_id },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to test Discord webhook: ${err.message || String(err)}`,
      };
    }
  }

  public createTools(credentials: Record<string, string>): AgentTool[] {
    const webhookUrl = credentials.webhookUrl?.trim() || "";

    // 1. Send Discord Message
    const sendMessageTool: AgentTool = {
      name: "discord_send_message",
      description: "Send a message or notification to the configured Discord channel.",
      riskLevel: "LOW",
      inputSchema: z.object({
        content: z.string().min(1).describe("The text message to send to Discord"),
        username: z
          .string()
          .optional()
          .default("Nova Assistant")
          .describe("Override the bot display name"),
      }),
      execute: async ({ content, username }) => {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, username }),
        });
        if (!res.ok) {
          throw new Error(`Discord Webhook error (${res.status}): ${await res.text()}`);
        }
        return {
          success: true,
          message: "Message dispatched to Discord successfully.",
        };
      },
    };

    // 2. Send Discord Embed Alert
    const sendEmbedTool: AgentTool = {
      name: "discord_send_embed",
      description: "Post a structured rich embed alert to Discord (e.g. for completed tasks or reports).",
      riskLevel: "LOW",
      inputSchema: z.object({
        title: z.string().min(1).describe("Embed title"),
        description: z.string().min(1).describe("Embed body text or markdown"),
        color: z
          .number()
          .optional()
          .default(3447003) // Blue
          .describe("Embed color code integer (e.g. 3447003 for blue, 15158332 for red)"),
      }),
      execute: async ({ title, description, color }) => {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "Nova Assistant",
            embeds: [
              {
                title,
                description,
                color,
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        });
        if (!res.ok) {
          throw new Error(`Discord Webhook error (${res.status}): ${await res.text()}`);
        }
        return {
          success: true,
          message: "Discord embed posted successfully.",
        };
      },
    };

    return [sendMessageTool, sendEmbedTool];
  }
}
