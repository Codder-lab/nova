import { ModelInfo } from "@nova/shared";
import { logger } from "../utils/logger";
import { FALLBACK_OPENROUTER_SNAPSHOT } from "./catalog.snapshot";

export interface OpenRouterRawModel {
  id: string;
  name: string;
  created?: number;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
    request?: string;
    image?: string;
  };
  supported_parameters?: string[];
}

let cachedCatalog: ModelInfo[] | null = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function formatVendorName(rawId: string): string {
  const prefix = rawId.split("/")[0] || "ai";
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

export function mapOpenRouterModelToInfo(raw: OpenRouterRawModel): ModelInfo {
  const promptRate = parseFloat(raw.pricing?.prompt || "0");
  const completionRate = parseFloat(raw.pricing?.completion || "0");
  const costPer1kInput = Math.round(promptRate * 1000 * 100000) / 100000;
  const costPer1kOutput = Math.round(completionRate * 1000 * 100000) / 100000;

  const isFree =
    raw.id.endsWith(":free") ||
    (costPer1kInput === 0 && costPer1kOutput === 0);

  const supportsTools =
    Array.isArray(raw.supported_parameters) &&
    raw.supported_parameters.includes("tools");

  const vendor = formatVendorName(raw.id);

  return {
    id: raw.id,
    name: raw.name || raw.id,
    provider: "openrouter",
    providerName: `OpenRouter (${vendor})`,
    contextWindow: raw.context_length || 4096,
    supportsTools,
    supportsStreaming: true,
    isLocal: false,
    isFree,
    description: raw.description || `OpenRouter model hosted by ${vendor}.`,
    costPer1kInput,
    costPer1kOutput,
    recommendedFor: isFree
      ? "Free cloud inference (no credits consumed)"
      : `${vendor} cloud model on OpenRouter`,
  };
}

export async function fetchOpenRouterCatalog(
  apiKey?: string,
): Promise<ModelInfo[]> {
  const siteUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const headers: Record<string, string> = {
      "HTTP-Referer": siteUrl,
      "X-Title": "Nova AI Assistant",
    };

    const effectiveKey = apiKey || process.env.OPENROUTER_API_KEY;
    if (effectiveKey) {
      headers["Authorization"] = `Bearer ${effectiveKey}`;
    }

    const res = await fetch("https://openrouter.ai/api/v1/models", {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`OpenRouter returned HTTP ${res.status}: ${res.statusText}`);
    }

    const body: any = await res.json();
    const data: OpenRouterRawModel[] = Array.isArray(body?.data) ? body.data : [];

    const mapped = data.map(mapOpenRouterModelToInfo);

    // Sort: free models first, then models with tool calling, then alphabetical
    mapped.sort((a, b) => {
      if (a.isFree && !b.isFree) return -1;
      if (!a.isFree && b.isFree) return 1;
      if (a.supportsTools && !b.supportsTools) return -1;
      if (!a.supportsTools && b.supportsTools) return 1;
      return a.name.localeCompare(b.name);
    });

    cachedCatalog = mapped;
    lastFetchedAt = Date.now();
    logger.info({ count: mapped.length }, "Successfully refreshed OpenRouter model catalog");
    return mapped;
  } catch (err: any) {
    clearTimeout(timeoutId);
    logger.warn({ error: err.message }, "Failed fetching models from OpenRouter, checking cache or snapshot");

    if (cachedCatalog && cachedCatalog.length > 0) {
      return cachedCatalog;
    }

    // Fallback to bundled snapshot
    const snapshot = FALLBACK_OPENROUTER_SNAPSHOT.map((m) => ({
      ...m,
      provider: "openrouter" as const,
    }));
    cachedCatalog = snapshot;
    return snapshot;
  }
}

export async function getOpenRouterCatalog(
  forceRefresh = false,
  apiKey?: string,
): Promise<ModelInfo[]> {
  const isExpired = Date.now() - lastFetchedAt > CACHE_TTL_MS;
  if (!forceRefresh && cachedCatalog && !isExpired) {
    return cachedCatalog;
  }
  return fetchOpenRouterCatalog(apiKey);
}

export async function refreshOpenRouterCatalog(apiKey?: string): Promise<ModelInfo[]> {
  return fetchOpenRouterCatalog(apiKey);
}
