import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { botService } from "../services/bot.service";
import { PLATFORM_BOTS, getPlatformBotBySlug } from "../config/platform-bots";
import { UserBotPreferenceModel } from "../models/bot-preference.model";
import { connectDB, disconnectDB } from "../db/connection";

describe("Curated Platform Bots & Preferences", () => {
  const testUserId = "test-user-bot-42";

  beforeAll(async () => {
    await connectDB();
  }, 35000);

  afterAll(async () => {
    await UserBotPreferenceModel.deleteMany({ userId: testUserId });
    await disconnectDB();
  });

  beforeEach(async () => {
    await UserBotPreferenceModel.deleteMany({ userId: testUserId });
  });

  it("should provide exactly 4 curated platform bots", () => {
    expect(PLATFORM_BOTS).toHaveLength(4);
    const slugs = PLATFORM_BOTS.map((b) => b.slug);
    expect(slugs).toContain("nova-core");
    expect(slugs).toContain("nova-taskmaster");
    expect(slugs).toContain("nova-scout");
    expect(slugs).toContain("nova-scribe");
  });

  it("should hydrate bots with defaults when no user preference exists", async () => {
    const bots = await botService.getHydratedBots(testUserId);
    expect(bots).toHaveLength(4);

    const taskmaster = bots.find((b) => b.slug === "nova-taskmaster");
    expect(taskmaster).toBeDefined();
    expect(taskmaster?.userPreference.tone).toBe("concise");
    expect(taskmaster?.userPreference.customInstructions).toBe("");
    expect(taskmaster?.userPreference.enabledTools).toEqual(
      taskmaster?.availableTools,
    );
  });

  it("should update and persist user preferences for a bot", async () => {
    const updated = await botService.updateUserPreference(
      testUserId,
      "nova-scout",
      {
        tone: "friendly",
        customInstructions: "Prioritize articles from official engineering blogs.",
        temperature: 0.5,
        enabledTools: ["web_search", "fetch_web_page"],
      },
    );

    expect(updated.userPreference.tone).toBe("friendly");
    expect(updated.userPreference.customInstructions).toBe(
      "Prioritize articles from official engineering blogs.",
    );
    expect(updated.userPreference.temperature).toBe(0.5);
    expect(updated.userPreference.enabledTools).toEqual([
      "web_search",
      "fetch_web_page",
    ]);

    // Verify retrieval persists
    const fetched = await botService.getHydratedBot(testUserId, "nova-scout");
    expect(fetched.userPreference.tone).toBe("friendly");
    expect(fetched.userPreference.enabledTools).toEqual([
      "web_search",
      "fetch_web_page",
    ]);
  });

  it("should reject tools outside the bot whitelist", async () => {
    // nova-scout does not have 'create_task' or 'calculate' in whitelist
    const updated = await botService.updateUserPreference(
      testUserId,
      "nova-scout",
      {
        enabledTools: ["web_search", "create_task", "disallowed_tool"],
      },
    );

    // Only web_search should be accepted
    expect(updated.userPreference.enabledTools).toEqual(["web_search"]);
  });

  it("should reset user preferences back to platform defaults", async () => {
    await botService.updateUserPreference(testUserId, "nova-scribe", {
      tone: "concise",
      customInstructions: "Make it brief.",
    });

    const reset = await botService.resetUserPreference(testUserId, "nova-scribe");
    expect(reset.userPreference.tone).toBe("formal"); // Platform default for nova-scribe
    expect(reset.userPreference.customInstructions).toBe("");
  });

  it("should correctly resolve runtime configuration for AgentEngine", async () => {
    await botService.updateUserPreference(testUserId, "nova-taskmaster", {
      tone: "formal",
      customInstructions: "Mention EST deadlines.",
      temperature: 0.3,
      enabledTools: ["create_task", "list_tasks"],
    });

    const config = await botService.resolveBotRuntimeConfig(
      testUserId,
      "nova-taskmaster",
    );

    expect(config.bot.slug).toBe("nova-taskmaster");
    expect(config.tone).toBe("formal");
    expect(config.customInstructions).toBe("Mention EST deadlines.");
    expect(config.temperature).toBe(0.3);
    expect(config.scopedToolNames).toEqual(["create_task", "list_tasks"]);
  });
});
