import { describe, it, expect, vi, beforeEach } from "vitest";
import { takeScreenshotTool } from "../tools/browser/browser.tools";
import { browserManager } from "../tools/browser/browser.manager";
import { OllamaProvider } from "../llm/ollama.provider";
import { OpenRouterProvider } from "../llm/openrouter.provider";
import { AgentEngine } from "../agents/agent.engine";
import { socketService } from "../services/socket.service";
import { ToolRegistry } from "../tools/base/tool-registry";
import { LLMProvider } from "../llm/provider";
import { AgentSocketEvents, ChatMessage } from "@nova/shared";
import { z } from "zod";

describe("Sprint 1: Screenshot Tool & Visual Browser Loop", () => {
  describe("1. takeScreenshotTool", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("should capture a viewport screenshot and return base64 data and metadata", async () => {
      const dummyBuffer = Buffer.from("fake-png-screenshot-bytes");
      const mockPage = {
        screenshot: vi.fn().mockResolvedValue(dummyBuffer),
        url: vi.fn().mockReturnValue("https://example.com/dashboard"),
        title: vi.fn().mockResolvedValue("Example Dashboard"),
      };

      vi.spyOn(browserManager, "getOrCreateSession").mockResolvedValue({
        browser: {} as any,
        context: {} as any,
        page: mockPage as any,
        lastActive: new Date(),
      });

      const result = await takeScreenshotTool.execute(
        { fullPage: false },
        { userId: "user-123", runId: "run-456" },
      );

      expect(mockPage.screenshot).toHaveBeenCalledWith({ fullPage: false });
      expect(result.success).toBe(true);
      expect(result.imageBase64).toBe(dummyBuffer.toString("base64"));
      expect(result.mimeType).toBe("image/png");
      expect(result.url).toBe("https://example.com/dashboard");
      expect(result.title).toBe("Example Dashboard");
    });

    it("should respect fullPage flag when set to true", async () => {
      const dummyBuffer = Buffer.from("full-page-png");
      const mockPage = {
        screenshot: vi.fn().mockResolvedValue(dummyBuffer),
        url: vi.fn().mockReturnValue("https://example.com/long-page"),
        title: vi.fn().mockResolvedValue("Long Page"),
      };

      vi.spyOn(browserManager, "getOrCreateSession").mockResolvedValue({
        browser: {} as any,
        context: {} as any,
        page: mockPage as any,
        lastActive: new Date(),
      });

      const result = await takeScreenshotTool.execute(
        { fullPage: true },
        { userId: "user-123", runId: "run-789" },
      );

      expect(mockPage.screenshot).toHaveBeenCalledWith({ fullPage: true });
      expect(result.imageBase64).toBe(dummyBuffer.toString("base64"));
    });
  });

  describe("2. Multi-Modal Vision Message Formatting", () => {
    it("OllamaProvider formats images into payload messages", () => {
      const provider = new OllamaProvider("http://localhost:11434", "llava");
      const formatMessages = (provider as any).formatMessages.bind(provider);

      const messages: ChatMessage[] = [
        {
          role: "user",
          content: "What is on this screen?",
          images: [
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          ],
        },
      ];

      const formatted = formatMessages(messages);
      expect(formatted).toHaveLength(1);
      expect(formatted[0].role).toBe("user");
      expect(formatted[0].images).toEqual([
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      ]);
    });

    it("OpenRouterProvider formats images into multi-part content", () => {
      const provider = new OpenRouterProvider({
        apiKey: "test-key",
        model: "openai/gpt-4o",
      });
      const formatMessages = (provider as any).formatMessages.bind(provider);

      const messages: ChatMessage[] = [
        {
          role: "user",
          content: "Look at this screenshot",
          images: ["abc123rawbase64"],
        },
      ];

      const formatted = formatMessages(messages);
      expect(formatted).toHaveLength(1);
      expect(formatted[0].role).toBe("user");
      expect(Array.isArray(formatted[0].content)).toBe(true);
      expect(formatted[0].content[0]).toEqual({
        type: "text",
        text: "Look at this screenshot",
      });
      expect(formatted[0].content[1]).toEqual({
        type: "image_url",
        image_url: {
          url: "data:image/png;base64,abc123rawbase64",
        },
      });
    });
  });

  describe("3. Agent Engine Visual Integration & Socket Streaming", () => {
    it("AgentEngine emits browser:screenshot event and injects images into tool messages", async () => {
      const emitScreenshotSpy = vi.spyOn(socketService, "emitBrowserScreenshot");

      // Custom tool returning an imageBase64 screenshot result
      const mockScreenshotTool = {
        name: "take_screenshot",
        description: "Takes screenshot",
        riskLevel: "READ" as const,
        inputSchema: z.object({}),
        execute: vi.fn().mockResolvedValue({
          success: true,
          imageBase64: "base64imagepayload123",
          mimeType: "image/png",
          url: "https://news.ycombinator.com",
          title: "Hacker News",
        }),
      };

      const testRegistry = new ToolRegistry();
      testRegistry.register(mockScreenshotTool);

      let step = 0;
      const mockLLM: LLMProvider = {
        name: "mock-vision-llm",
        model: "gpt-4o",
        supportsToolCalling: () => true,
        stream: vi.fn(),
        generate: vi.fn().mockImplementation(async ({ messages }) => {
          step++;
          if (step === 1) {
            return {
              content: "I will take a screenshot first.",
              toolCalls: [
                {
                  id: "call_screenshot_1",
                  name: "take_screenshot",
                  arguments: {},
                },
              ],
            };
          }
          // Verify that tool message in messages has images attached!
          const toolMsg = messages.find((m: ChatMessage) => m.role === "tool");
          expect(toolMsg).toBeDefined();
          expect(toolMsg?.images).toEqual(["base64imagepayload123"]);

          return {
            content: "I see Hacker News homepage with top stories.",
          };
        }),
      };

      const engine = new AgentEngine({ llm: mockLLM, tools: testRegistry });

      const result = await engine.run({
        userId: "user-test",
        goal: "Check news homepage",
        botSlug: "nova-core",
      });

      expect(result.status).toBe("completed");
      expect(emitScreenshotSpy).toHaveBeenCalledWith(
        "user-test",
        expect.any(String),
        expect.objectContaining({
          imageBase64: "base64imagepayload123",
          mimeType: "image/png",
          url: "https://news.ycombinator.com",
          title: "Hacker News",
        }),
      );
    });
  });
});
