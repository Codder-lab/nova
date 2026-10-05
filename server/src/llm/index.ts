import { LLMProvider } from "./provider";
import { OllamaProvider } from "./ollama.provider";
import { OpenRouterProvider } from "./openrouter.provider";
import { DEFAULT_MODEL_CATALOG } from "./catalog";
import { ModelConfigModel } from "../models/model-config.model";
import { env } from "../config/env";
import mongoose from "mongoose";

export * from "./provider";
export * from "./ollama.provider";
export * from "./openrouter.provider";
export * from "./openrouter.service";
export * from "./catalog";

export interface ProviderFactoryOptions {
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export function getLLMProvider(
  options?: string | ProviderFactoryOptions,
): LLMProvider {
  let providerName = env.LLM_PROVIDER as string;
  let modelName: string | undefined;
  let apiKey: string | undefined;
  let baseUrl: string | undefined;

  if (typeof options === "string") {
    providerName = options;
  } else if (options && typeof options === "object") {
    if (options.provider) providerName = options.provider;
    if (options.model) modelName = options.model;
    if (options.apiKey) apiKey = options.apiKey;
    if (options.baseUrl) baseUrl = options.baseUrl;
  }

  switch (providerName.toLowerCase()) {
    case "openrouter":
      return new OpenRouterProvider({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY,
        baseUrl: baseUrl || process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
        model: modelName || "meta-llama/llama-3.3-70b-instruct:free",
      });

    case "ollama":
    default:
      return new OllamaProvider(
        baseUrl || env.OLLAMA_BASE_URL,
        modelName || env.OLLAMA_MODEL,
      );
  }
}

/**
 * Resolves the LLMProvider for a given user by combining stored DB configuration
 * with any per-request overrides.
 */
export async function getLLMProviderForUser(
  userId: string,
  override?: { provider?: string; model?: string },
): Promise<LLMProvider> {
  let userConfig: any = null;

  if (mongoose.connection.readyState === 1 && userId) {
    try {
      userConfig = await ModelConfigModel.findOne({ userId }).lean();
    } catch {
      // Fallback to env
    }
  }

  const provider =
    override?.provider ||
    userConfig?.activeProvider ||
    env.LLM_PROVIDER ||
    "ollama";

  const model =
    override?.model ||
    userConfig?.activeModel ||
    (provider === "ollama" ? env.OLLAMA_MODEL : undefined);

  let apiKey: string | undefined;
  let baseUrl: string | undefined;

  if (userConfig) {
    if (provider === "openrouter") {
      apiKey = userConfig.apiKeys?.openrouter || process.env.OPENROUTER_API_KEY;
      baseUrl = userConfig.customBaseUrls?.openrouter;
    } else if (provider === "ollama") {
      baseUrl = userConfig.customBaseUrls?.ollama;
    }
  }

  return getLLMProvider({
    provider,
    model,
    apiKey,
    baseUrl,
  });
}
