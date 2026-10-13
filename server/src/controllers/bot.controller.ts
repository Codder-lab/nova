import { Request, Response } from "express";
import { z } from "zod";
import { botService } from "../services/bot.service";
import { logger } from "../utils/logger";

function getUserId(req: Request): string {
  return (
    req.user?.userId ||
    (req.headers["x-user-id"] as string) ||
    (req.query.userId as string) ||
    "cli-user"
  );
}

const updatePreferencesSchema = z.object({
  tone: z
    .enum(["concise", "friendly", "formal", "analytical", "default"])
    .optional(),
  customInstructions: z.string().max(1000).optional(),
  enabledTools: z.array(z.string()).optional(),
  temperature: z.number().min(0).max(1).optional(),
  routineSchedules: z
    .record(
      z.object({
        enabled: z.boolean(),
        cron: z.string(),
      }),
    )
    .optional(),
});

export async function listBots(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  try {
    const bots = await botService.getHydratedBots(userId);
    res.json({ bots });
  } catch (err: any) {
    logger.error({ userId, error: err.message }, "Failed to list bots");
    res.status(500).json({ error: "Failed to list bots" });
  }
}

export async function getBot(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const { botSlug } = req.params;
  try {
    const bot = await botService.getHydratedBot(userId, botSlug);
    res.json({ bot });
  } catch (err: any) {
    logger.error({ userId, botSlug, error: err.message }, "Failed to get bot");
    res.status(500).json({ error: "Failed to get bot" });
  }
}

export async function updateBotPreferences(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = getUserId(req);
  const { botSlug } = req.params;

  const parsed = updatePreferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      details: parsed.error.format(),
    });
    return;
  }

  try {
    const updated = await botService.updateUserPreference(
      userId,
      botSlug,
      parsed.data,
    );
    res.json({ bot: updated });
  } catch (err: any) {
    logger.error(
      { userId, botSlug, error: err.message },
      "Failed to update bot preferences",
    );
    res.status(500).json({ error: "Failed to update bot preferences" });
  }
}

export async function resetBotPreferences(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = getUserId(req);
  const { botSlug } = req.params;

  try {
    const reset = await botService.resetUserPreference(userId, botSlug);
    res.json({ bot: reset });
  } catch (err: any) {
    logger.error(
      { userId, botSlug, error: err.message },
      "Failed to reset bot preferences",
    );
    res.status(500).json({ error: "Failed to reset bot preferences" });
  }
}
