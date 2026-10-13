export type BotTone = "concise" | "friendly" | "formal" | "analytical" | "default";

export interface BotRoutine {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon?: string;
  suggestedCron?: string;
}

/** Definition of a curated platform bot (read-only for clients) */
export interface PlatformBot {
  id: string;
  slug: string;
  name: string;
  avatar: string;
  badgeColor: string;
  tagline: string;
  description: string;
  baseSystemPrompt: string;
  defaultModel: string;
  defaultProvider: "ollama" | "openrouter";
  availableTools: string[]; // Whitelist of tools this bot is permitted to use
  defaultTone: BotTone;
  routines: BotRoutine[];
  isDefault?: boolean;
}

/** User-specific preference overrides for a given bot */
export interface UserBotPreference {
  userId: string;
  botSlug: string;
  tone: BotTone;
  customInstructions: string;
  enabledTools: string[]; // Subset of PlatformBot.availableTools
  temperature: number;
  routineSchedules: Record<string, { enabled: boolean; cron: string }>;
  updatedAt?: string;
}

/** Merged representation returned to the UI */
export interface HydratedBot extends PlatformBot {
  userPreference: {
    tone: BotTone;
    customInstructions: string;
    enabledTools: string[];
    temperature: number;
    routineSchedules: Record<string, { enabled: boolean; cron: string }>;
  };
}

export interface UpdateBotPreferenceInput {
  tone?: BotTone;
  customInstructions?: string;
  enabledTools?: string[];
  temperature?: number;
  routineSchedules?: Record<string, { enabled: boolean; cron: string }>;
}
