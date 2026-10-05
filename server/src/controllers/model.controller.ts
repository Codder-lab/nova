import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import {
  DEFAULT_MODEL_CATALOG,
  getLLMProvider,
  OllamaProvider,
  getOpenRouterCatalog,
  refreshOpenRouterCatalog,
} from "../llm";
import { ModelConfigModel } from "../models/model-config.model";
import { AgentRunModel } from "../models/agent-run.model";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { ModelInfo } from "@nova/shared";

function getUserId(req: Request): string {
  return (
    req.user?.userId ||
    (req.headers["x-user-id"] as string) ||
    (req.query.userId as string) ||
    "cli-user"
  );
}

function maskApiKey(key?: string): string {
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

export async function listModels(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  const isDbConnected = mongoose.connection.readyState === 1;

  let userConfig: any = null;
  if (isDbConnected) {
    try {
      userConfig = await ModelConfigModel.findOne({ userId }).lean();
    } catch (err: any) {
      logger.warn({ error: err.message }, "Failed loading user model config");
    }
  }

  // Active settings fallback
  const activeProvider =
    userConfig?.activeProvider || env.LLM_PROVIDER || "ollama";
  const activeModel =
    userConfig?.activeModel ||
    (activeProvider === "ollama"
      ? env.OLLAMA_MODEL
      : "meta-llama/llama-3.3-70b-instruct:free");

  const ollamaBaseUrl =
    userConfig?.customBaseUrls?.ollama ||
    env.OLLAMA_BASE_URL ||
    "http://localhost:11434";

  const openRouterKey =
    userConfig?.apiKeys?.openrouter || process.env.OPENROUTER_API_KEY || "";

  // 1. Local Ollama models
  const localCatalog: ModelInfo[] = [...DEFAULT_MODEL_CATALOG];
  try {
    const installedOllamaModels =
      await OllamaProvider.listInstalledModels(ollamaBaseUrl);
    for (const installedName of installedOllamaModels) {
      const alreadyInCatalog = localCatalog.some(
        (m) =>
          m.provider === "ollama" &&
          (m.id === installedName || installedName.startsWith(`${m.id}:`)),
      );
      if (!alreadyInCatalog) {
        localCatalog.unshift({
          id: installedName,
          name: `${installedName} (Local)`,
          provider: "ollama",
          providerName: "Ollama (Local)",
          contextWindow: 32768,
          supportsTools: true,
          supportsStreaming: true,
          isLocal: true,
          isFree: true,
          description:
            "Locally installed model detected from your Ollama daemon.",
          costPer1kInput: 0,
          costPer1kOutput: 0,
          recommendedFor: "Local offline inference",
        });
      }
    }
  } catch {
    // Ignore if ollama daemon is offline
  }

  // 2. OpenRouter dynamic models
  let cloudModels: ModelInfo[] = [];
  try {
    cloudModels = await getOpenRouterCatalog(false, openRouterKey);
  } catch (err: any) {
    logger.warn({ error: err.message }, "Failed loading OpenRouter models");
  }

  const catalog: ModelInfo[] = [...localCatalog, ...cloudModels];

  const isOpenRouterConfigured = Boolean(
    openRouterKey && openRouterKey.trim().length > 0,
  );

  const configuredProviders = {
    ollama: true,
    openrouter: isOpenRouterConfigured,
  };

  const maskedKeys = {
    openrouter: maskApiKey(openRouterKey),
  };

  res.status(200).json({
    catalog,
    active: {
      provider: activeProvider,
      model: activeModel,
    },
    isOpenRouterConfigured,
    settings: {
      temperature: userConfig?.temperature ?? 0.1,
      maxTokens: userConfig?.maxTokens ?? 4096,
      customBaseUrls: userConfig?.customBaseUrls || {
        ollama: ollamaBaseUrl,
        openrouter: "",
      },
      configuredProviders,
      maskedKeys,
    },
  });
}

export async function refreshModels(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  let openRouterKey = process.env.OPENROUTER_API_KEY || "";

  if (mongoose.connection.readyState === 1) {
    try {
      const userConfig = await ModelConfigModel.findOne({ userId }).lean();
      if (userConfig?.apiKeys?.openrouter) {
        openRouterKey = userConfig.apiKeys.openrouter;
      }
    } catch {
      // ignore
    }
  }

  try {
    const refreshed = await refreshOpenRouterCatalog(openRouterKey);
    res.status(200).json({
      success: true,
      message: "OpenRouter catalog refreshed successfully",
      count: refreshed.length,
    });
  } catch (err: any) {
    res.status(500).json({
      error: "Failed refreshing OpenRouter catalog",
      details: err.message,
    });
  }
}

const setActiveModelSchema = z.object({
  provider: z.enum(["ollama", "openrouter"]),
  model: z.string().min(1, "Model is required"),
});

export async function setActiveModel(
  req: Request,
  res: Response,
): Promise<void> {
  const parseResult = setActiveModelSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "Validation failed",
      details: parseResult.error.format(),
    });
    return;
  }

  const userId = getUserId(req);
  const { provider, model } = parseResult.data;
  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected) {
    try {
      await ModelConfigModel.findOneAndUpdate(
        { userId },
        {
          $set: {
            activeProvider: provider,
            activeModel: model,
          },
        },
        { upsert: true, new: true },
      );
    } catch (err: any) {
      logger.error(
        { error: err.message },
        "Failed persisting active model selection",
      );
    }
  }

  res.status(200).json({
    success: true,
    activeProvider: provider,
    activeModel: model,
  });
}

const updateConfigSchema = z.object({
  apiKeys: z
    .object({
      openrouter: z.string().optional(),
    })
    .optional(),
  customBaseUrls: z
    .object({
      ollama: z.string().optional(),
      openrouter: z.string().optional(),
    })
    .optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
});

export async function updateModelConfig(
  req: Request,
  res: Response,
): Promise<void> {
  const parseResult = updateConfigSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "Validation failed",
      details: parseResult.error.format(),
    });
    return;
  }

  const userId = getUserId(req);
  const data = parseResult.data;
  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected) {
    try {
      const updateDoc: any = {};
      if (data.temperature !== undefined)
        updateDoc.temperature = data.temperature;
      if (data.maxTokens !== undefined) updateDoc.maxTokens = data.maxTokens;

      if (data.apiKeys) {
        for (const [key, val] of Object.entries(data.apiKeys)) {
          if (val !== undefined && !val.includes("••••")) {
            updateDoc[`apiKeys.${key}`] = val.trim();
          }
        }
      }

      if (data.customBaseUrls) {
        for (const [key, val] of Object.entries(data.customBaseUrls)) {
          if (val !== undefined) {
            updateDoc[`customBaseUrls.${key}`] = val.trim();
          }
        }
      }

      await ModelConfigModel.findOneAndUpdate(
        { userId },
        { $set: updateDoc },
        { upsert: true, new: true },
      );
    } catch (err: any) {
      res.status(500).json({
        error: "Failed saving model configuration",
        details: err.message,
      });
      return;
    }
  }

  res.status(200).json({
    success: true,
    message: "Model configuration updated successfully",
  });
}

const testConnectionSchema = z.object({
  provider: z.enum(["ollama", "openrouter"]),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
});

export async function testModelConnection(
  req: Request,
  res: Response,
): Promise<void> {
  const parseResult = testConnectionSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "Validation failed",
      details: parseResult.error.format(),
    });
    return;
  }

  const userId = getUserId(req);
  const { provider, model, apiKey, baseUrl } = parseResult.data;

  // Retrieve user settings if apiKey or baseUrl not provided
  let effectiveApiKey = apiKey;
  let effectiveBaseUrl = baseUrl;

  if (
    mongoose.connection.readyState === 1 &&
    (!effectiveApiKey || !effectiveBaseUrl)
  ) {
    try {
      const userConfig = await ModelConfigModel.findOne({ userId }).lean();
      if (userConfig) {
        if (!effectiveApiKey) {
          effectiveApiKey = (userConfig.apiKeys as any)?.[provider];
        }
        if (!effectiveBaseUrl) {
          effectiveBaseUrl = (userConfig.customBaseUrls as any)?.[provider];
        }
      }
    } catch {
      // Ignore
    }
  }

  const llm = getLLMProvider({
    provider,
    model,
    apiKey: effectiveApiKey,
    baseUrl: effectiveBaseUrl,
  });

  if (typeof llm.testConnection === "function") {
    const result = await llm.testConnection();
    res.status(200).json(result);
  } else {
    res.status(200).json({
      success: true,
      latencyMs: 1,
      model: llm.model,
    });
  }
}

export async function getModelMetrics(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = getUserId(req);
  const isDbConnected = mongoose.connection.readyState === 1;

  if (!isDbConnected) {
    res.status(200).json({ metrics: [] });
    return;
  }

  try {
    const rawMetrics = await AgentRunModel.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: {
            provider: { $ifNull: ["$provider", "ollama"] },
            model: { $ifNull: ["$model", "qwen2.5:7b"] },
          },
          totalRuns: { $sum: 1 },
          totalPromptTokens: { $sum: { $ifNull: ["$promptTokens", 0] } },
          totalCompletionTokens: {
            $sum: { $ifNull: ["$completionTokens", 0] },
          },
          totalTokens: { $sum: { $ifNull: ["$totalTokens", 0] } },
          avgLatencyMs: { $avg: "$durationMs" },
        },
      },
    ]);

    const cachedCloud = await getOpenRouterCatalog(false);
    const fullCatalog = [...DEFAULT_MODEL_CATALOG, ...cachedCloud];

    const metrics = rawMetrics.map((row) => {
      const provider = row._id.provider;
      const model = row._id.model;
      const promptTokens = row.totalPromptTokens || 0;
      const completionTokens = row.totalCompletionTokens || 0;

      const catalogEntry = fullCatalog.find(
        (m) => m.provider === provider && m.id === model,
      );

      const inputRate = catalogEntry?.costPer1kInput || 0;
      const outputRate = catalogEntry?.costPer1kOutput || 0;
      const estimatedCostUsd =
        (promptTokens / 1000) * inputRate +
        (completionTokens / 1000) * outputRate;

      return {
        provider,
        model,
        totalRuns: row.totalRuns,
        totalPromptTokens: promptTokens,
        totalCompletionTokens: completionTokens,
        totalTokens: row.totalTokens || promptTokens + completionTokens,
        avgLatencyMs: Math.round(row.avgLatencyMs || 0),
        estimatedCostUsd: Number(estimatedCostUsd.toFixed(5)),
      };
    });

    res.status(200).json({ metrics });
  } catch (err: any) {
    logger.error({ error: err.message }, "Failed calculating model metrics");
    res
      .status(500)
      .json({ error: "Failed calculating metrics", details: err.message });
  }
}
