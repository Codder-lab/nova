import { z } from "zod";
import { AgentTool } from "../../tools/base/agent-tool.interface";
import {
  BaseConnector,
  ConnectionTestResult,
} from "../base/connector.interface";
import { whatsappService } from "../../services/whatsapp.service";

export class WhatsAppConnector implements BaseConnector {
  public readonly id = "whatsapp";
  public readonly name = "WhatsApp";
  public readonly description =
    "Send messages, notifications, and chat with Nova directly from WhatsApp using QR Code Multi-Device pairing.";
  public readonly category = "communication" as const;
  public readonly icon = "Phone";
  public readonly authType = "qr_code" as const;
  public readonly capabilities = [
    "Scan QR Code (No API Key Required)",
    "Two-Way Agent Conversation",
    "Send WhatsApp Messages",
    "Send Photos & Media",
    "Direct & Group Messages",
  ];
  public readonly documentationUrl =
    "https://faq.whatsapp.com/1317564962489013/?helpref=uf_share";

  public readonly credentialFields = [
    {
      key: "defaultRecipient",
      label: "Default Recipient Phone Number",
      placeholder: "+1234567890",
      type: "text" as const,
      required: false,
      description:
        "Optional default phone number with country code where notifications should be sent if not specified.",
    },
  ];

  public async testConnection(
    _credentials: Record<string, string>
  ): Promise<ConnectionTestResult> {
    const status = whatsappService.getStatus();

    if (status.isConnected) {
      const userIdentifier =
        status.user?.phone || status.user?.name || status.user?.id || "Linked Account";
      return {
        success: true,
        message: `WhatsApp is connected as ${userIdentifier}`,
        details: {
          user: status.user,
          status: status.status,
          lastActive: status.lastActive,
          autoReplyEnabled: status.autoReplyEnabled,
        },
      };
    }

    if (status.status === "qr_ready") {
      return {
        success: false,
        message: "QR Code is ready. Please scan it with WhatsApp on your phone to finish connecting.",
      };
    }

    return {
      success: false,
      message: "WhatsApp is not connected. Click 'Scan QR Code' to link your WhatsApp account.",
    };
  }

  public createTools(credentials: Record<string, string>): AgentTool[] {
    const defaultRecipient = credentials.defaultRecipient?.trim() || "";

    // 1. Send WhatsApp Message Tool
    const sendMessageTool: AgentTool = {
      name: "whatsapp_send_message",
      description:
        "Send a WhatsApp text message or notification to a phone number or group chat.",
      riskLevel: "LOW",
      inputSchema: z.object({
        to: z
          .string()
          .optional()
          .describe(
            "Recipient phone number with country code (e.g. +1234567890 or 919876543210) or group JID. Defaults to the configured default recipient."
          ),
        message: z
          .string()
          .min(1)
          .describe("The text message content to send via WhatsApp."),
      }),
      execute: async ({ to, message }) => {
        const targetRecipient = to?.trim() || defaultRecipient;
        if (!targetRecipient) {
          throw new Error(
            "Recipient phone number must be provided or configured as defaultRecipient in WhatsApp integration."
          );
        }

        const result = await whatsappService.sendMessage(targetRecipient, message);
        return {
          success: true,
          message: `WhatsApp message sent to ${result.to}.`,
          messageId: result.messageId,
          recipient: result.to,
        };
      },
    };

    // 2. Send WhatsApp Media Tool
    const sendMediaTool: AgentTool = {
      name: "whatsapp_send_media",
      description:
        "Send a photo or document URL with an optional caption to a WhatsApp recipient or group.",
      riskLevel: "LOW",
      inputSchema: z.object({
        to: z
          .string()
          .optional()
          .describe("Recipient phone number with country code or group JID."),
        mediaUrl: z.string().url().describe("Public URL of the image or document to send."),
        caption: z.string().optional().describe("Optional caption text for the media."),
        mediaType: z
          .enum(["image", "document"])
          .default("image")
          .describe("Type of media: 'image' or 'document'."),
      }),
      execute: async ({ to, mediaUrl, caption, mediaType }) => {
        const targetRecipient = to?.trim() || defaultRecipient;
        if (!targetRecipient) {
          throw new Error(
            "Recipient phone number must be provided or configured as defaultRecipient in WhatsApp integration."
          );
        }

        const result = await whatsappService.sendMedia(
          targetRecipient,
          mediaUrl,
          caption,
          mediaType
        );

        return {
          success: true,
          message: `WhatsApp ${mediaType} sent to ${result.to}.`,
          messageId: result.messageId,
          recipient: result.to,
        };
      },
    };

    // 3. WhatsApp Status Tool
    const getStatusTool: AgentTool = {
      name: "whatsapp_get_status",
      description:
        "Check the current connection status of the WhatsApp client, linked phone number, and auto-reply state.",
      riskLevel: "LOW",
      inputSchema: z.object({}),
      execute: async () => {
        const status = whatsappService.getStatus();
        return {
          status: status.status,
          isConnected: status.isConnected,
          user: status.user,
          autoReplyEnabled: status.autoReplyEnabled,
          lastActive: status.lastActive,
        };
      },
    };

    return [sendMessageTool, sendMediaTool, getStatusTool];
  }
}
