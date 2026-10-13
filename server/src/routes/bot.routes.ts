import { Router } from "express";
import {
  listBots,
  getBot,
  updateBotPreferences,
  resetBotPreferences,
} from "../controllers/bot.controller";
import { optionalAuthMiddleware } from "../middleware/auth.middleware";

export const botRouter = Router();

botRouter.get("/", optionalAuthMiddleware, listBots);
botRouter.get("/:botSlug", optionalAuthMiddleware, getBot);
botRouter.patch("/:botSlug/preferences", optionalAuthMiddleware, updateBotPreferences);
botRouter.post(
  "/:botSlug/preferences/reset",
  optionalAuthMiddleware,
  resetBotPreferences,
);
