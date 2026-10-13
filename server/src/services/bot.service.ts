import mongoose from "mongoose";
import {
  PlatformBot,
  HydratedBot,
  UpdateBotPreferenceInput,
  BotTone,
} from "@nova/shared";
import { PLATFORM_BOTS, getPlatformBotBySlug } from "../config/platform-bots";
import {
  UserBotPreferenceModel,
  UserBotPreferenceData,
} from "../models/bot-preference.model";
import { logger } from "../utils/logger";

export interface BotRuntimeConfig {
  bot: PlatformBot;
  tone: BotTone;
  customInstructions: string;
  scopedToolNames: string[];
  temperature: number;
}

export class BotService {
  /**
   * Retrieves all platform bots hydrated with the user's specific customizations.
   */
  public async getHydratedBots(userId: string): Promise<HydratedBot[]> {
    const isDbConnected = mongoose.connection.readyState === 1;
    let userPreferences: UserBotPreferenceData[] = [];

    if (isDbConnected && userId) {
      try {
        userPreferences = (await UserBotPreferenceModel.find({ userId }).lean()) as any;
      } catch (err: any) {
        logger.warn(
          { userId, error: err.message },
          "Failed loading user bot preferences, falling back to defaults",
        );
      }
    }

    const prefMap = new Map<string, UserBotPreferenceData>();
    for (const pref of userPreferences) {
      prefMap.set(pref.botSlug.toLowerCase(), pref);
    }

    return PLATFORM_BOTS.map((bot) => this.hydrateBot(bot, prefMap.get(bot.slug.toLowerCase())));
  }

  /**
   * Retrieves a single platform bot hydrated with the user's customizations.
   */
  public async getHydratedBot(
    userId: string,
    botSlug: string,
  ): Promise<HydratedBot> {
    const bot = getPlatformBotBySlug(botSlug);
    const isDbConnected = mongoose.connection.readyState === 1;
    let pref: UserBotPreferenceData | null = null;

    if (isDbConnected && userId) {
      try {
        pref = (await UserBotPreferenceModel.findOne({
          userId,
          botSlug: bot.slug,
        }).lean()) as any;
      } catch (err: any) {
        logger.warn(
          { userId, botSlug, error: err.message },
          "Failed loading single user bot preference",
        );
      }
    }

    return this.hydrateBot(bot, pref);
  }

  /**
   * Updates a user's customization preferences for a specific platform bot.
   */
  public async updateUserPreference(
    userId: string,
    botSlug: string,
    patch: UpdateBotPreferenceInput,
  ): Promise<HydratedBot> {
    const bot = getPlatformBotBySlug(botSlug);
    const isDbConnected = mongoose.connection.readyState === 1;

    // Sanitize enabled tools to only allow tools on the bot's whitelist
    let sanitizedTools: string[] | undefined;
    if (patch.enabledTools) {
      const allowedSet = new Set(bot.availableTools);
      sanitizedTools = patch.enabledTools.filter((t) => allowedSet.has(t));
    }

    const updateDoc: any = {};
    if (patch.tone !== undefined) updateDoc.tone = patch.tone;
    if (patch.customInstructions !== undefined) {
      updateDoc.customInstructions = patch.customInstructions.slice(0, 1000);
    }
    if (sanitizedTools !== undefined) updateDoc.enabledTools = sanitizedTools;
    if (patch.temperature !== undefined) {
      updateDoc.temperature = Math.max(0, Math.min(1, patch.temperature));
    }
    if (patch.routineSchedules !== undefined) {
      updateDoc.routineSchedules = patch.routineSchedules;
    }

    let savedPref: UserBotPreferenceData | null = null;
    if (isDbConnected && userId) {
      savedPref = (await UserBotPreferenceModel.findOneAndUpdate(
        { userId, botSlug: bot.slug },
        { $set: updateDoc },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      ).lean()) as any;
    }

    return this.hydrateBot(bot, savedPref);
  }

  /**
   * Resets a user's customizations for a bot back to platform defaults.
   */
  public async resetUserPreference(
    userId: string,
    botSlug: string,
  ): Promise<HydratedBot> {
    const bot = getPlatformBotBySlug(botSlug);
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected && userId) {
      await UserBotPreferenceModel.deleteOne({ userId, botSlug: bot.slug });
    }

    return this.hydrateBot(bot, null);
  }

  /**
   * Resolves the runtime configuration (merged prompt directives + scoped tools)
   * used directly by the AgentEngine execution loop.
   */
  public async resolveBotRuntimeConfig(
    userId: string,
    botSlug?: string,
  ): Promise<BotRuntimeConfig> {
    const hydrated = await this.getHydratedBot(userId, botSlug || "nova-core");
    const { bot, userPreference } = {
      bot: hydrated,
      userPreference: hydrated.userPreference,
    };

    const effectiveTone = userPreference.tone || bot.defaultTone || "default";
    const effectiveTools =
      userPreference.enabledTools && userPreference.enabledTools.length > 0
        ? userPreference.enabledTools
        : bot.availableTools;

    return {
      bot,
      tone: effectiveTone,
      customInstructions: userPreference.customInstructions || "",
      scopedToolNames: effectiveTools,
      temperature: userPreference.temperature ?? 0.2,
    };
  }

  private hydrateBot(
    bot: PlatformBot,
    pref?: UserBotPreferenceData | null,
  ): HydratedBot {
    return {
      ...bot,
      userPreference: {
        tone: pref?.tone || bot.defaultTone || "default",
        customInstructions: pref?.customInstructions || "",
        enabledTools:
          pref?.enabledTools && pref.enabledTools.length > 0
            ? pref.enabledTools
            : [...bot.availableTools],
        temperature: pref?.temperature ?? 0.2,
        routineSchedules: pref?.routineSchedules || {},
      },
    };
  }
}

export const botService = new BotService();
