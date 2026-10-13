import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import http from "http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../app";
import { encryptionService } from "../services/encryption.service";
import { connectorRegistry } from "../integrations/connector.registry";
import { CustomRestConnector } from "../integrations/providers/custom-rest.connector";
import { integrationService } from "../services/integration.service";
import { IntegrationModel } from "../models/integration.model";
import { AgentEngine } from "../agents/agent.engine";
import { LLMRequest, LLMResponse, LLMChunk } from "@nova/shared";
import { LLMProvider } from "../llm/provider";

class MockTestLLM implements LLMProvider {
  public name = "mock";
  public model = "mock-model";

  supportsToolCalling(): boolean {
    return true;
  }

  async *stream(_input: LLMRequest): AsyncIterable<LLMChunk> {
    yield { contentChunk: "Mock stream", isDone: true };
  }

  async generate(options: LLMRequest): Promise<LLMResponse> {
    const lastMsg = options.messages[options.messages.length - 1];
    if (lastMsg && lastMsg.role === "tool") {
      return {
        content: "The action was completed successfully.",
      };
    }

    const hasGitHubTool = options.tools?.some(
      (t) => (t.name || (t as any).function?.name) === "github_create_issue"
    );
    const hasCustomTool = options.tools?.some(
      (t) => (t.name || (t as any).function?.name) === "crm_create_lead"
    );

    if (hasCustomTool) {
      return {
        content: "Calling custom CRM tool",
        toolCalls: [
          {
            id: "call-1",
            name: "crm_create_lead",
            arguments: { name: "Alice", email: "alice@example.com" },
          },
        ],
      };
    }

    if (hasGitHubTool) {
      return {
        content: "Creating issue on GitHub",
        toolCalls: [
          {
            id: "call-2",
            name: "github_create_issue",
            arguments: {
              owner: "octocat",
              repo: "Hello-World",
              title: "Bug in app",
            },
          },
        ],
      };
    }

    return {
      content: "Hello! No integration tool was requested.",
    };
  }
}

describe("Phase 11: External Integrations & Connectors Hub", () => {
  let mongoServer: MongoMemoryServer;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    const app = createApp();
    server = app.listen(0);
    const address = server.address() as any;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await mongoose.disconnect();
    await mongoServer.stop();
    vi.restoreAllMocks();
  });

  describe("1. AES-256-GCM Encryption Service", () => {
    it("should encrypt and decrypt a plaintext string correctly", () => {
      const secret = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
      const encrypted = encryptionService.encrypt(secret);

      expect(encrypted.cipherText).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      expect(encrypted.cipherText).not.toBe(secret);

      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(secret);
    });

    it("should encrypt and decrypt a credentials object", () => {
      const creds = {
        apiKey: "ntn_secret_token_123",
        botToken: "xoxb-9876543210-abcdef",
      };

      const encrypted = encryptionService.encryptObject(creds);
      const decrypted = encryptionService.decryptObject<typeof creds>(encrypted);

      expect(decrypted).toEqual(creds);
    });

    it("should fail decryption if tag or ciphertext is tampered", () => {
      const encrypted = encryptionService.encrypt("my-secret");
      const tampered = {
        ...encrypted,
        cipherText: encrypted.cipherText.slice(0, -2) + "00",
      };

      expect(() => encryptionService.decrypt(tampered)).toThrow();
    });

    it("should accurately mask sensitive tokens for UI display", () => {
      expect(encryptionService.mask("ghp_secretTokenABC1234")).toBe(
        "ghp_••••••••1234"
      );
      expect(encryptionService.mask("xoxb-9876543210-9876")).toBe(
        "xoxb-••••••••9876"
      );
      expect(encryptionService.mask("short")).toBe("••••••••");
    });
  });

  describe("2. Connector Registry & Metadata", () => {
    it("should register built-in connectors", () => {
      const connectors = connectorRegistry.getAll();
      const ids = connectors.map((c) => c.id);

      expect(ids).toContain("github");
      expect(ids).toContain("gmail");
      expect(ids).toContain("google_calendar");
      expect(ids).toContain("slack");
      expect(ids).toContain("discord");
      expect(ids).toContain("notion");
      expect(ids).toContain("telegram");
      expect(ids).toContain("custom_rest");
    });

    it("should generate valid metadata list", () => {
      const metaList = connectorRegistry.getMetadataList();
      const githubMeta = metaList.find((m) => m.id === "github");
      const telegramMeta = metaList.find((m) => m.id === "telegram");

      expect(githubMeta).toBeDefined();
      expect(githubMeta?.name).toBe("GitHub");
      expect(githubMeta?.category).toBe("developer");
      expect(githubMeta?.credentialFields.length).toBeGreaterThan(0);
      expect(githubMeta?.capabilities).toContain("Create Issues");

      expect(telegramMeta).toBeDefined();
      expect(telegramMeta?.name).toBe("Telegram");
      expect(telegramMeta?.category).toBe("communication");
      expect(telegramMeta?.credentialFields.some((f) => f.key === "botToken")).toBe(true);
      expect(telegramMeta?.capabilities).toContain("Send Messages");
    });
  });

  describe("3. Universal Custom REST Connector (Extensibility Engine)", () => {
    it("should dynamically synthesize AgentTool instances with valid Zod schemas from user config", () => {
      const customConnector = new CustomRestConnector();
      const tools = customConnector.createTools(
        { apiKey: "test-crm-token" },
        {
          baseUrl: "https://api.crm.example.com",
          authHeaderKey: "Authorization",
          authPrefix: "Bearer ",
          actions: [
            {
              name: "crm_create_lead",
              description: "Create a new lead",
              method: "POST",
              path: "/leads",
              riskLevel: "medium",
              parameters: [
                {
                  name: "name",
                  type: "string",
                  required: true,
                  description: "Full name",
                },
                {
                  name: "email",
                  type: "string",
                  required: true,
                  description: "Email address",
                },
              ],
            },
          ],
        }
      );

      expect(tools.length).toBe(1);
      const tool = tools[0];
      expect(tool.name).toBe("crm_create_lead");
      expect(tool.riskLevel).toBe("MEDIUM");

      // Validate schema parsing
      const valid = tool.inputSchema.safeParse({
        name: "John Doe",
        email: "john@example.com",
      });
      expect(valid.success).toBe(true);

      const invalid = tool.inputSchema.safeParse({ name: "John Doe" });
      expect(invalid.success).toBe(false);
    });
  });

  describe("4. Integration REST API Endpoints", () => {
    it("GET /api/integrations/connectors should return available connectors", async () => {
      const res = await fetch(`${baseUrl}/api/integrations/connectors`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.connectors.length).toBeGreaterThanOrEqual(5);
    });

    it("POST /api/integrations should save and encrypt credentials without leaking plaintext", async () => {
      // Mock fetch for GitHub API while letting local Express requests through
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation((url: any, init?: any) => {
        const urlStr = typeof url === "string" ? url : url?.url || url?.href || String(url);
        if (urlStr.includes("api.github.com")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ login: "testuser" }),
            text: async () => "ok",
          } as any);
        }
        return originalFetch(url, init);
      });

      const res = await fetch(`${baseUrl}/api/integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorId: "github",
          credentials: { token: "ghp_mockSecretTokenForTesting1234" },
          enabled: true,
        }),
      });

      const body = await res.json();
      global.fetch = originalFetch;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.integration).toBeDefined();
      expect(body.integration.status).toBe("connected");
      // Raw token must never be returned
      expect(body.integration.maskedCredentials.token).toContain("ghp_••••••••");
      expect(body.integration.maskedCredentials.token).not.toBe(
        "ghp_mockSecretTokenForTesting1234"
      );

      // Verify DB record is encrypted
      const doc = await IntegrationModel.findOne({ connectorId: "github" });
      expect(doc).toBeDefined();
      expect(doc?.encryptedCredentials.cipherText).toBeDefined();
      expect(doc?.encryptedCredentials.cipherText).not.toContain(
        "ghp_mockSecretTokenForTesting1234"
      );
    });

    it("PATCH /api/integrations/:connectorId/toggle should enable or disable integration", async () => {
      await IntegrationModel.create({
        userId: "anonymous",
        connectorId: "slack",
        name: "Slack",
        category: "communication",
        enabled: true,
        status: "connected",
        encryptedCredentials: encryptionService.encryptObject({ botToken: "xoxb-123" }),
      });

      const res = await fetch(`${baseUrl}/api/integrations/slack/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });

      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.integration.enabled).toBe(false);

      const updated = await IntegrationModel.findOne({ connectorId: "slack" });
      expect(updated?.enabled).toBe(false);
    });

    it("DELETE /api/integrations/:connectorId should remove the integration", async () => {
      await IntegrationModel.create({
        userId: "anonymous",
        connectorId: "discord",
        name: "Discord",
        category: "communication",
        enabled: true,
        status: "connected",
        encryptedCredentials: encryptionService.encryptObject({
          webhookUrl: "https://discord.com/api/webhooks/123",
        }),
      });

      const res = await fetch(`${baseUrl}/api/integrations/discord`, {
        method: "DELETE",
      });

      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.deleted).toBe(true);

      const found = await IntegrationModel.findOne({ connectorId: "discord" });
      expect(found).toBeNull();
    });
  });

  describe("5. Dynamic Agent Tool Injection during Agent Run", () => {
    it("should inject user's active integration tools into the per-run ToolRegistry", async () => {
      // Mock fetch for both connection test and tool execution
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation((url: any, init?: any) => {
        const urlStr = typeof url === "string" ? url : url?.url || url?.href || String(url);
        if (urlStr.includes("api.acme.com")) {
          return Promise.resolve({
            ok: true,
            status: 201,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => ({ id: "lead_99", name: "Alice" }),
            text: async () => "ok",
          } as any);
        }
        return originalFetch(url, init);
      });

      // 1. Configure a custom integration in DB for this user
      await integrationService.saveUserIntegration("user-integration-test", {
        connectorId: "custom_rest",
        name: "Acme CRM",
        credentials: { apiKey: "secret-key" },
        enabled: true,
        customConfig: {
          baseUrl: "https://api.acme.com",
          actions: [
            {
              name: "crm_create_lead",
              description: "Create lead in Acme CRM",
              method: "POST",
              path: "/leads",
              riskLevel: "low",
              parameters: [
                {
                  name: "name",
                  type: "string",
                  required: true,
                  description: "Full name",
                },
                {
                  name: "email",
                  type: "string",
                  required: true,
                  description: "Email address",
                },
              ],
            },
          ],
        },
      });

      // 2. Run AgentEngine with our MockTestLLM
      const mockLLM = new MockTestLLM();
      const engine = new AgentEngine({ llm: mockLLM });

      const result = await engine.run({
        userId: "user-integration-test",
        goal: "Create a new lead for Alice with email alice@example.com in CRM",
      });

      global.fetch = originalFetch;

      expect(result.status).toBe("completed");
      expect(result.toolCallsCount).toBe(1);
      const toolStep = result.steps.find((s) => s.type === "tool");
      expect(toolStep).toBeDefined();
      expect(toolStep?.toolCall?.name).toBe("crm_create_lead");
      expect(toolStep?.status).toBe("completed");
    });
  });
});
