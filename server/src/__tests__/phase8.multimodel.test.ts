import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  getLLMProvider,
  getLLMProviderForUser,
  OllamaProvider,
  OpenRouterProvider,
  DEFAULT_MODEL_CATALOG,
  getOpenRouterCatalog,
} from "../llm";
import { ModelConfigModel } from "../models/model-config.model";
import { AgentRunModel } from "../models/agent-run.model";
import { createApp } from "../app";
import { AgentEngine } from "../agents/agent.engine";
import { LLMProvider } from "../llm/provider";

describe("Phase 8: Multi-Model Support & OpenRouter Integration", () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await ModelConfigModel.deleteMany({});
    await AgentRunModel.deleteMany({});
  });

  describe("Provider Implementations & Factory", () => {
    it("instantiates OllamaProvider with custom model and baseUrl", () => {
      const provider = new OllamaProvider("http://localhost:11434", "llama3.2:3b");
      expect(provider.name).toBe("ollama");
      expect(provider.model).toBe("llama3.2:3b");
      expect(provider.baseUrl).toBe("http://localhost:11434");
      expect(provider.supportsToolCalling()).toBe(true);
    });

    it("instantiates OpenRouterProvider with custom model and apiKey", () => {
      const provider = new OpenRouterProvider({
        apiKey: "sk-or-test-openrouter-key",
        model: "meta-llama/llama-3.3-70b-instruct:free",
      });
      expect(provider.name).toBe("openrouter");
      expect(provider.model).toBe("meta-llama/llama-3.3-70b-instruct:free");
      expect(provider.baseUrl).toBe("https://openrouter.ai/api/v1");
      expect(provider.supportsToolCalling()).toBe(true);
    });

    it("factory getLLMProvider returns appropriate provider instance", () => {
      const ollama = getLLMProvider({ provider: "ollama", model: "mistral:7b" });
      expect(ollama instanceof OllamaProvider).toBe(true);
      expect(ollama.model).toBe("mistral:7b");

      const openrouter = getLLMProvider({
        provider: "openrouter",
        model: "anthropic/claude-3.5-sonnet",
        apiKey: "sk-or-test",
      });
      expect(openrouter instanceof OpenRouterProvider).toBe(true);
      expect(openrouter.model).toBe("anthropic/claude-3.5-sonnet");
    });

    it("getLLMProviderForUser resolves user DB preferences and overrides", async () => {
      const userId = "test-user-model-1";
      await ModelConfigModel.create({
        userId,
        activeProvider: "openrouter",
        activeModel: "anthropic/claude-3.5-sonnet",
        apiKeys: { openrouter: "sk-or-persisted-user-key" },
      });

      // Default from DB
      const resolvedFromDb = await getLLMProviderForUser(userId);
      expect(resolvedFromDb.name).toBe("openrouter");
      expect(resolvedFromDb.model).toBe("anthropic/claude-3.5-sonnet");

      // Per-request override takes precedence
      const resolvedWithOverride = await getLLMProviderForUser(userId, {
        provider: "ollama",
        model: "qwen2.5:7b",
      });
      expect(resolvedWithOverride.name).toBe("ollama");
      expect(resolvedWithOverride.model).toBe("qwen2.5:7b");
    });
  });

  describe("Model Catalog & Metadata", () => {
    it("local catalog contains Ollama models with valid properties", () => {
      expect(DEFAULT_MODEL_CATALOG.length).toBeGreaterThan(0);

      for (const model of DEFAULT_MODEL_CATALOG) {
        expect(model.id).toBeDefined();
        expect(model.name).toBeDefined();
        expect(model.provider).toBe("ollama");
        expect(model.contextWindow).toBeGreaterThan(0);
        expect(model.isLocal).toBe(true);
        expect(model.isFree).toBe(true);
      }
    });

    it("openrouter service returns models with free and pricing flags", async () => {
      const catalog = await getOpenRouterCatalog(false);
      expect(catalog.length).toBeGreaterThan(0);

      const freeModel = catalog.find((m) => m.isFree);
      expect(freeModel).toBeDefined();
      expect(freeModel?.provider).toBe("openrouter");
      expect(freeModel?.isLocal).toBe(false);
    });
  });

  describe("Model REST API Endpoints", () => {
    let server: any;
    let baseUrl: string;

    beforeAll(async () => {
      const app = createApp();
      server = app.listen(0);
      const address = server.address() as any;
      baseUrl = `http://localhost:${address.port}`;
    });

    afterAll(async () => {
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it("GET /api/models returns catalog, active selection, and settings", async () => {
      // Create user config
      await ModelConfigModel.create({
        userId: "api-test-user",
        activeProvider: "openrouter",
        activeModel: "meta-llama/llama-3.3-70b-instruct:free",
        apiKeys: { openrouter: "sk-or-v1-abcdef123456" },
      });

      const response = await fetch(`${baseUrl}/api/models`, {
        headers: { "x-user-id": "api-test-user" },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body.catalog)).toBe(true);
      expect(body.active.provider).toBe("openrouter");
      expect(body.active.model).toBe("meta-llama/llama-3.3-70b-instruct:free");
      expect(body.isOpenRouterConfigured).toBe(true);
      expect(body.settings.maskedKeys.openrouter).toContain("••••");
      expect(body.settings.configuredProviders.openrouter).toBe(true);
    });

    it("POST /api/models/active updates active provider and model", async () => {
      const response = await fetch(`${baseUrl}/api/models/active`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "api-test-user-2",
        },
        body: JSON.stringify({
          provider: "openrouter",
          model: "deepseek/deepseek-r1:free",
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.activeProvider).toBe("openrouter");
      expect(body.activeModel).toBe("deepseek/deepseek-r1:free");

      const saved = await ModelConfigModel.findOne({ userId: "api-test-user-2" });
      expect(saved?.activeProvider).toBe("openrouter");
      expect(saved?.activeModel).toBe("deepseek/deepseek-r1:free");
    });

    it("POST /api/models/config updates OpenRouter key and parameters", async () => {
      const response = await fetch(`${baseUrl}/api/models/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "api-test-user-3",
        },
        body: JSON.stringify({
          apiKeys: {
            openrouter: "sk-or-v1-test-live-key",
          },
          temperature: 0.3,
          maxTokens: 2048,
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);

      const saved = await ModelConfigModel.findOne({ userId: "api-test-user-3" });
      expect(saved?.apiKeys?.openrouter).toBe("sk-or-v1-test-live-key");
      expect(saved?.temperature).toBe(0.3);
      expect(saved?.maxTokens).toBe(2048);
    });

    it("POST /api/models/refresh triggers refresh of openrouter catalog", async () => {
      const response = await fetch(`${baseUrl}/api/models/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "api-test-user-refresh",
        },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.count).toBeGreaterThan(0);
    });

    it("POST /api/models/test tests connectivity and returns latency", async () => {
      const response = await fetch(`${baseUrl}/api/models/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "api-test-user-4",
        },
        body: JSON.stringify({
          provider: "ollama",
          model: "qwen2.5:7b",
          baseUrl: "http://127.0.0.1:9999", // Intentional offline port to test error handling
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(typeof body.success).toBe("boolean");
      expect(typeof body.latencyMs).toBe("number");
      expect(body.model).toBe("qwen2.5:7b");
    });

    it("GET /api/models/metrics computes token usage and estimated cost", async () => {
      const userId = "metrics-test-user";
      // Seed runs with tokens
      await AgentRunModel.create({
        runId: "run-metrics-1",
        userId,
        goal: "Test prompt 1",
        status: "completed",
        provider: "ollama",
        model: "qwen2.5:7b",
        promptTokens: 500,
        completionTokens: 200,
        totalTokens: 700,
        durationMs: 1200,
        steps: [],
      });

      const response = await fetch(`${baseUrl}/api/models/metrics`, {
        headers: { "x-user-id": userId },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body.metrics)).toBe(true);
      const qwenMetric = body.metrics.find(
        (m: any) => m.provider === "ollama" && m.model === "qwen2.5:7b",
      );
      expect(qwenMetric).toBeDefined();
      expect(qwenMetric.totalRuns).toBe(1);
      expect(qwenMetric.totalPromptTokens).toBe(500);
      expect(qwenMetric.totalCompletionTokens).toBe(200);
      expect(qwenMetric.totalTokens).toBe(700);
      expect(qwenMetric.avgLatencyMs).toBe(1200);
      expect(qwenMetric.estimatedCostUsd).toBe(0);
    });
  });

  describe("Agent Execution with Model & Token Tracking", () => {
    it("AgentEngine saves model, provider and token counts to AgentRunModel", async () => {
      const mockLLM: LLMProvider = {
        name: "openrouter",
        model: "meta-llama/llama-3.3-70b-instruct:free",
        supportsToolCalling: () => true,
        generate: async () => ({
          content: "Hello from OpenRouter!",
          usage: {
            promptTokens: 42,
            completionTokens: 18,
            totalTokens: 60,
          },
        }),
        stream: async function* () {
          yield { contentChunk: "Hello from OpenRouter!", isDone: true };
        },
      };

      const engine = new AgentEngine({ llm: mockLLM });
      const result = await engine.run({
        userId: "agent-model-user",
        goal: "Say hello",
      });

      expect(result.status).toBe("completed");
      expect(result.provider).toBe("openrouter");
      expect(result.model).toBe("meta-llama/llama-3.3-70b-instruct:free");
      expect(result.promptTokens).toBe(42);
      expect(result.completionTokens).toBe(18);
      expect(result.totalTokens).toBe(60);

      // Verify MongoDB persistence
      const savedRun = await AgentRunModel.findOne({ runId: result.runId });
      expect(savedRun).toBeDefined();
      expect(savedRun?.provider).toBe("openrouter");
      expect(savedRun?.model).toBe("meta-llama/llama-3.3-70b-instruct:free");
      expect(savedRun?.promptTokens).toBe(42);
      expect(savedRun?.completionTokens).toBe(18);
    });
  });
});
