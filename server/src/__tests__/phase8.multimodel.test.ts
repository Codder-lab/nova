import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  getLLMProvider,
  getLLMProviderForUser,
  OllamaProvider,
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
  GroqProvider,
  DEFAULT_MODEL_CATALOG,
} from "../llm";
import { ModelConfigModel } from "../models/model-config.model";
import { AgentRunModel } from "../models/agent-run.model";
import { createApp } from "../app";
import { AgentEngine } from "../agents/agent.engine";
import { LLMProvider } from "../llm/provider";
import { LLMRequest, LLMResponse } from "@nova/shared";

describe("Phase 8: Multi-Model Support & Provider Switching", () => {
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

    it("instantiates OpenAIProvider with custom model and apiKey", () => {
      const provider = new OpenAIProvider({
        apiKey: "sk-test-openai-key-12345",
        model: "gpt-4o",
      });
      expect(provider.name).toBe("openai");
      expect(provider.model).toBe("gpt-4o");
      expect(provider.supportsToolCalling()).toBe(true);
    });

    it("instantiates AnthropicProvider with custom model", () => {
      const provider = new AnthropicProvider({
        apiKey: "sk-ant-test-key",
        model: "claude-3-5-sonnet-20241022",
      });
      expect(provider.name).toBe("anthropic");
      expect(provider.model).toBe("claude-3-5-sonnet-20241022");
      expect(provider.supportsToolCalling()).toBe(true);
    });

    it("instantiates GeminiProvider with custom model", () => {
      const provider = new GeminiProvider({
        apiKey: "gemini-test-key",
        model: "gemini-1.5-pro",
      });
      expect(provider.name).toBe("gemini");
      expect(provider.model).toBe("gemini-1.5-pro");
      expect(provider.supportsToolCalling()).toBe(true);
    });

    it("GeminiProvider formats tool declarations with uppercase types and items for arrays", () => {
      const provider = new GeminiProvider({ apiKey: "test" });
      const tools = [
        {
          name: "create_task",
          description: "create task",
          parameters: {
            type: "object" as const,
            properties: {
              tags: {
                type: "array",
              },
            },
          },
        },
      ];

      const formatted = (provider as any).formatTools(tools);
      const decl = formatted[0].functionDeclarations[0];
      expect(decl.parameters.type).toBe("OBJECT");
      expect(decl.parameters.properties.tags.type).toBe("ARRAY");
      expect(decl.parameters.properties.tags.items).toBeDefined();
      expect(decl.parameters.properties.tags.items.type).toBe("STRING");
    });

    it("instantiates GroqProvider with custom model", () => {
      const provider = new GroqProvider({
        apiKey: "gsk-test-groq-key",
        model: "llama-3.3-70b-versatile",
      });
      expect(provider.name).toBe("groq");
      expect(provider.model).toBe("llama-3.3-70b-versatile");
      expect(provider.baseUrl).toBe("https://api.groq.com/openai/v1");
      expect(provider.supportsToolCalling()).toBe(true);
    });

    it("factory getLLMProvider returns appropriate provider instance", () => {
      const ollama = getLLMProvider({ provider: "ollama", model: "mistral:7b" });
      expect(ollama instanceof OllamaProvider).toBe(true);
      expect(ollama.model).toBe("mistral:7b");

      const openai = getLLMProvider({ provider: "openai", model: "gpt-4o-mini", apiKey: "sk-test" });
      expect(openai instanceof OpenAIProvider).toBe(true);
      expect(openai.model).toBe("gpt-4o-mini");

      const anthropic = getLLMProvider({ provider: "anthropic", apiKey: "sk-ant" });
      expect(anthropic instanceof AnthropicProvider).toBe(true);

      const gemini = getLLMProvider({ provider: "gemini", apiKey: "gemini-key" });
      expect(gemini instanceof GeminiProvider).toBe(true);

      const groq = getLLMProvider({ provider: "groq", apiKey: "gsk-key" });
      expect(groq instanceof GroqProvider).toBe(true);
    });

    it("getLLMProviderForUser resolves user DB preferences and overrides", async () => {
      const userId = "test-user-model-1";
      await ModelConfigModel.create({
        userId,
        activeProvider: "openai",
        activeModel: "gpt-4o",
        apiKeys: { openai: "sk-persisted-user-key" },
      });

      // Default from DB
      const resolvedFromDb = await getLLMProviderForUser(userId);
      expect(resolvedFromDb.name).toBe("openai");
      expect(resolvedFromDb.model).toBe("gpt-4o");

      // Per-request override takes precedence
      const resolvedWithOverride = await getLLMProviderForUser(userId, {
        provider: "anthropic",
        model: "claude-3-5-haiku-20241022",
      });
      expect(resolvedWithOverride.name).toBe("anthropic");
      expect(resolvedWithOverride.model).toBe("claude-3-5-haiku-20241022");
    });
  });

  describe("Model Catalog & Metadata", () => {
    it("catalog contains all 5 supported providers with specifications", () => {
      const providers = new Set(DEFAULT_MODEL_CATALOG.map((m) => m.provider));
      expect(providers.has("ollama")).toBe(true);
      expect(providers.has("openai")).toBe(true);
      expect(providers.has("anthropic")).toBe(true);
      expect(providers.has("gemini")).toBe(true);
      expect(providers.has("groq")).toBe(true);

      // Verify each model has valid properties
      for (const model of DEFAULT_MODEL_CATALOG) {
        expect(model.id).toBeDefined();
        expect(model.name).toBeDefined();
        expect(model.contextWindow).toBeGreaterThan(0);
        expect(typeof model.isLocal).toBe("boolean");
      }
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
        activeProvider: "groq",
        activeModel: "llama-3.3-70b-versatile",
        apiKeys: { groq: "gsk-12345678abcdef" },
      });

      const response = await fetch(`${baseUrl}/api/models`, {
        headers: { "x-user-id": "api-test-user" },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body.catalog)).toBe(true);
      expect(body.active.provider).toBe("groq");
      expect(body.active.model).toBe("llama-3.3-70b-versatile");
      expect(body.settings.maskedKeys.groq).toContain("••••");
      expect(body.settings.configuredProviders.groq).toBe(true);
    });

    it("POST /api/models/active updates active provider and model", async () => {
      const response = await fetch(`${baseUrl}/api/models/active`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "api-test-user-2",
        },
        body: JSON.stringify({
          provider: "openai",
          model: "gpt-4o",
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.activeProvider).toBe("openai");
      expect(body.activeModel).toBe("gpt-4o");

      const saved = await ModelConfigModel.findOne({ userId: "api-test-user-2" });
      expect(saved?.activeProvider).toBe("openai");
      expect(saved?.activeModel).toBe("gpt-4o");
    });

    it("POST /api/models/config updates API keys and parameters", async () => {
      const response = await fetch(`${baseUrl}/api/models/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "api-test-user-3",
        },
        body: JSON.stringify({
          apiKeys: {
            openai: "sk-test-live-key",
            gemini: "gemini-api-key-test",
          },
          temperature: 0.3,
          maxTokens: 2048,
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);

      const saved = await ModelConfigModel.findOne({ userId: "api-test-user-3" });
      expect(saved?.apiKeys?.openai).toBe("sk-test-live-key");
      expect(saved?.apiKeys?.gemini).toBe("gemini-api-key-test");
      expect(saved?.temperature).toBe(0.3);
      expect(saved?.maxTokens).toBe(2048);
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
        provider: "openai",
        model: "gpt-4o-mini",
        promptTokens: 500,
        completionTokens: 200,
        totalTokens: 700,
        durationMs: 1200,
        steps: [],
      });
      await AgentRunModel.create({
        runId: "run-metrics-2",
        userId,
        goal: "Test prompt 2",
        status: "completed",
        provider: "openai",
        model: "gpt-4o-mini",
        promptTokens: 1000,
        completionTokens: 300,
        totalTokens: 1300,
        durationMs: 1800,
        steps: [],
      });

      const response = await fetch(`${baseUrl}/api/models/metrics`, {
        headers: { "x-user-id": userId },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body.metrics)).toBe(true);
      const gpt4oMiniMetric = body.metrics.find(
        (m: any) => m.provider === "openai" && m.model === "gpt-4o-mini",
      );
      expect(gpt4oMiniMetric).toBeDefined();
      expect(gpt4oMiniMetric.totalRuns).toBe(2);
      expect(gpt4oMiniMetric.totalPromptTokens).toBe(1500);
      expect(gpt4oMiniMetric.totalCompletionTokens).toBe(500);
      expect(gpt4oMiniMetric.totalTokens).toBe(2000);
      expect(gpt4oMiniMetric.avgLatencyMs).toBe(1500);
      expect(gpt4oMiniMetric.estimatedCostUsd).toBeGreaterThan(0);
    });
  });

  describe("Agent Execution with Model & Token Tracking", () => {
    it("AgentEngine saves model, provider and token counts to AgentRunModel", async () => {
      const mockLLM: LLMProvider = {
        name: "groq",
        model: "llama-3.3-70b-versatile",
        supportsToolCalling: () => true,
        generate: async () => ({
          content: "Hello from Groq LPU!",
          usage: {
            promptTokens: 42,
            completionTokens: 18,
            totalTokens: 60,
          },
        }),
        stream: async function* () {
          yield { contentChunk: "Hello from Groq LPU!", isDone: true };
        },
      };

      const engine = new AgentEngine({ llm: mockLLM });
      const result = await engine.run({
        userId: "agent-model-user",
        goal: "Say hello",
      });

      expect(result.status).toBe("completed");
      expect(result.provider).toBe("groq");
      expect(result.model).toBe("llama-3.3-70b-versatile");
      expect(result.promptTokens).toBe(42);
      expect(result.completionTokens).toBe(18);
      expect(result.totalTokens).toBe(60);

      // Verify MongoDB persistence
      const savedRun = await AgentRunModel.findOne({ runId: result.runId });
      expect(savedRun).toBeDefined();
      expect(savedRun?.provider).toBe("groq");
      expect(savedRun?.model).toBe("llama-3.3-70b-versatile");
      expect(savedRun?.promptTokens).toBe(42);
      expect(savedRun?.completionTokens).toBe(18);
    });
  });
});
