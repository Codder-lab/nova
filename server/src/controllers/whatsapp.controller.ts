import { Request, Response } from "express";
import { z } from "zod";
import { whatsappService } from "../services/whatsapp.service";
import { logger } from "../utils/logger";

const sendSchema = z.object({
  to: z.string().min(1, "Recipient is required"),
  message: z.string().min(1, "Message content is required"),
});

const mediaSchema = z.object({
  to: z.string().min(1, "Recipient is required"),
  mediaUrl: z.string().url("Valid media URL is required"),
  caption: z.string().optional(),
  mediaType: z.enum(["image", "document"]).default("image"),
});

const settingsSchema = z.object({
  autoReplyEnabled: z.boolean(),
});

function getUserId(req: Request): string {
  return (
    req.user?.userId ||
    (req.headers["x-user-id"] as string) ||
    (req.query.userId as string) ||
    "cli-user"
  );
}

export async function getWhatsAppStatus(req: Request, res: Response): Promise<void> {
  try {
    const status = whatsappService.getStatus();
    if (status.isConnected) {
      const userId = getUserId(req);
      whatsappService.syncToIntegrationModel(userId).catch(() => {});
    }
    res.json({ success: true, ...status });
  } catch (err: any) {
    logger.error({ err }, "Failed getting WhatsApp status");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function connectWhatsApp(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const status = await whatsappService.connect(userId);
    res.json({ success: true, ...status });
  } catch (err: any) {
    logger.error({ err }, "Failed initiating WhatsApp connection");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function disconnectWhatsApp(_req: Request, res: Response): Promise<void> {
  try {
    await whatsappService.disconnect();
    res.json({ success: true, message: "WhatsApp disconnected" });
  } catch (err: any) {
    logger.error({ err }, "Failed disconnecting WhatsApp");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function logoutWhatsApp(_req: Request, res: Response): Promise<void> {
  try {
    await whatsappService.logout();
    res.json({ success: true, message: "WhatsApp logged out and session cleared" });
  } catch (err: any) {
    logger.error({ err }, "Failed logging out WhatsApp");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function sendWhatsAppMessage(req: Request, res: Response): Promise<void> {
  const parseResult = sendSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: "Validation failed",
      details: parseResult.error.format(),
    });
    return;
  }

  try {
    const result = await whatsappService.sendMessage(
      parseResult.data.to,
      parseResult.data.message
    );
    res.json(result);
  } catch (err: any) {
    logger.error({ err }, "Failed sending WhatsApp message");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function sendWhatsAppMedia(req: Request, res: Response): Promise<void> {
  const parseResult = mediaSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: "Validation failed",
      details: parseResult.error.format(),
    });
    return;
  }

  try {
    const result = await whatsappService.sendMedia(
      parseResult.data.to,
      parseResult.data.mediaUrl,
      parseResult.data.caption,
      parseResult.data.mediaType
    );
    res.json(result);
  } catch (err: any) {
    logger.error({ err }, "Failed sending WhatsApp media");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateWhatsAppSettings(req: Request, res: Response): Promise<void> {
  const parseResult = settingsSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: "Validation failed",
      details: parseResult.error.format(),
    });
    return;
  }

  try {
    whatsappService.setAutoReply(parseResult.data.autoReplyEnabled);
    res.json({
      success: true,
      autoReplyEnabled: parseResult.data.autoReplyEnabled,
    });
  } catch (err: any) {
    logger.error({ err }, "Failed updating WhatsApp settings");
    res.status(500).json({ success: false, error: err.message });
  }
}
