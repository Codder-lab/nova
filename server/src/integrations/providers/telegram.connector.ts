import { z } from "zod";
import { RiskLevel } from "@nova/shared";
import { AgentTool } from "../../tools/base/agent-tool.interface";
import {
  BaseConnector,
  ConnectionTestResult,
} from "../base/connector.interface";

export class TelegramConnector implements BaseConnector {
  public readonly id = "telegram";
  public readonly name = "Telegram";
  public readonly description =
    "Send messages, notifications, alerts, and photos to Telegram chats or channels.";
  public readonly category = "communication" as const;
  public readonly icon = "Send";
  public readonly authType = "api_key" as const;
  public readonly capabilities = [
    "Send Messages",
    "Send Photos",
    "Channel Broadcasts",
    "Markdown Formatting",
  ];
  public readonly documentationUrl = "https://core.telegram.org/bots/api";

  public readonly credentialFields = [
    {
      key: "botToken",
      label: "Telegram Bot Token",
      placeholder: "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ...",
      type: "password" as const,
      required: true,
      description: "Bot token obtained from @BotFather on Telegram.",
    },
    {
      key: "defaultChatId",
      label: "Default Chat / Channel ID",
      placeholder: "@channel_name or -1001234567890",
      type: "text" as const,
      required: false,
      description:
        "Default chat, group, or channel ID where messages should be delivered if not specified.",
    },
  ];

  public async testConnection(
    credentials: Record<string, string>
  ): Promise<ConnectionTestResult> {
    const token = credentials.botToken?.trim();
    if (!token) {
      return { success: false, message: "Telegram Bot Token is required." };
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = (await response.json()) as any;

      if (!data.ok) {
        return {
          success: false,
          message: `Telegram auth failed: ${data.description || "Invalid Bot Token"}`,
        };
      }

      return {
        success: true,
        message: `Connected successfully as @${data.result.username} (${data.result.first_name})`,
        details: {
          botId: data.result.id,
          username: data.result.username,
          firstName: data.result.first_name,
          canJoinGroups: data.result.can_join_groups,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to test Telegram bot: ${err.message || String(err)}`,
      };
    }
  }

  public createTools(credentials: Record<string, string>): AgentTool[] {
    const token = credentials.botToken?.trim() || "";
    const defaultChatId = credentials.defaultChatId?.trim() || "";

    // 1. Send Message Tool
    const sendMessageTool: AgentTool = {
      name: "telegram_send_message",
      description:
        "Send a message or notification to a Telegram chat, group, or channel.",
      riskLevel: "LOW",
      inputSchema: z.object({
        text: z.string().min(1).describe("The text message to send. Supports Markdown formatting."),
        chatId: z
          .string()
          .optional()
          .describe(
            "Telegram chat ID or @channelusername. Defaults to the configured default chat ID."
          ),
        parseMode: z
          .enum(["MarkdownV2", "HTML", "Markdown"])
          .optional()
          .default("Markdown")
          .describe("Formatting mode for text: 'Markdown', 'MarkdownV2', or 'HTML'."),
      }),
      execute: async ({ text, chatId, parseMode }) => {
        const targetChatId = chatId?.trim() || defaultChatId;
        if (!targetChatId) {
          throw new Error(
            "Target chatId must be provided or configured as defaultChatId in the Telegram integration."
          );
        }

        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: targetChatId,
            text,
            parse_mode: parseMode,
          }),
        });

        const data = (await res.json()) as any;
        if (!data.ok) {
          throw new Error(`Telegram API Error (${res.status}): ${data.description}`);
        }

        return {
          success: true,
          message: `Message sent to Telegram chat ${targetChatId} (message ID: ${data.result.message_id}).`,
          messageId: data.result.message_id,
        };
      },
    };

    // 2. Send Photo Tool
    const sendPhotoTool: AgentTool = {
      name: "telegram_send_photo",
      description:
        "Send a photo URL with an optional caption to a Telegram chat, group, or channel.",
      riskLevel: "LOW",
      inputSchema: z.object({
        photoUrl: z.string().url().describe("Public URL of the photo image to send."),
        caption: z.string().optional().describe("Optional caption for the photo."),
        chatId: z
          .string()
          .optional()
          .describe(
            "Telegram chat ID or @channelusername. Defaults to the configured default chat ID."
          ),
      }),
      execute: async ({ photoUrl, caption, chatId }) => {
        const targetChatId = chatId?.trim() || defaultChatId;
        if (!targetChatId) {
          throw new Error(
            "Target chatId must be provided or configured as defaultChatId in the Telegram integration."
          );
        }

        const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: targetChatId,
            photo: photoUrl,
            caption,
          }),
        });

        const data = (await res.json()) as any;
        if (!data.ok) {
          throw new Error(`Telegram API Error (${res.status}): ${data.description}`);
        }

        return {
          success: true,
          message: `Photo sent to Telegram chat ${targetChatId} (message ID: ${data.result.message_id}).`,
          messageId: data.result.message_id,
        };
      },
    };

    return [sendMessageTool, sendPhotoTool];
  }
}
