import { LLMProvider } from "./provider";
import { OllamaProvider } from "./ollama.provider";
import { OpenAIProvider } from "./openai.provider";
import { AnthropicProvider } from "./anthropic.provider";
import { GeminiProvider } from "./gemini.provider";
import { GroqProvider } from "./groq.provider";
import { DEFAULT_MODEL_CATALOG } from "./catalog";
import { ModelConfigModel } from "../models/model-config.model";
import { env } from "../config/env";
import mongoose from "mongoose";

export * from "./provider";
export * from "./ollama.provider";
export * from "./openai.provider";
export * from "./anthropic.provider";
export * from "./gemini.provider";
export * from "./groq.provider";
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
    case "openai":
      return new OpenAIProvider({
        apiKey: apiKey || process.env.OPENAI_API_KEY,
        baseUrl:
          baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
        model: modelName || "gpt-4o-mini",
      });

    case "anthropic":
      return new AnthropicProvider({
        apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
        baseUrl: baseUrl || "https://api.anthropic.com",
        model: modelName || "claude-3-5-sonnet-20241022",
      });

    case "gemini":
      return new GeminiProvider({
        apiKey: apiKey || process.env.GEMINI_API_KEY,
        model: modelName || "gemini-1.5-flash",
      });

    case "groq":
      return new GroqProvider({
        apiKey: apiKey || process.env.GROQ_API_KEY,
        baseUrl: baseUrl || "https://api.groq.com/openai/v1",
        model: modelName || "llama-3.3-70b-versatile",
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
    if (provider === "openai") {
      apiKey = userConfig.apiKeys?.openai;
      baseUrl = userConfig.customBaseUrls?.openai;
    } else if (provider === "anthropic") {
      apiKey = userConfig.apiKeys?.anthropic;
    } else if (provider === "gemini") {
      apiKey = userConfig.apiKeys?.gemini;
    } else if (provider === "groq") {
      apiKey = userConfig.apiKeys?.groq;
      baseUrl = userConfig.customBaseUrls?.groq;
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
