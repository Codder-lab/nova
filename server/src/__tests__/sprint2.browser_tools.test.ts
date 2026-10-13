import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  scrollPageTool,
  hoverElementTool,
  waitForSelectorTool,
  getPageElementsTool,
} from "../tools/browser/browser.tools";
import { browserManager } from "../tools/browser/browser.manager";
import { globalToolRegistry } from "../tools/base/tool-registry";
import { initializeDefaultTools } from "../tools";

describe("Sprint 2: Extended Browser Automation Tools", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. scrollPageTool", () => {
    it("should execute scroll evaluation and return offset metrics", async () => {
      const mockPage = {
        evaluate: vi.fn().mockResolvedValue({
          scrollY: 650,
          scrollHeight: 3200,
          innerHeight: 900,
        }),
      };

      vi.spyOn(browserManager, "getOrCreateSession").mockResolvedValue({
        browser: {} as any,
        context: {} as any,
        page: mockPage as any,
        lastActive: new Date(),
      });

      const result = await scrollPageTool.execute(
        { direction: "down", amount: 650 },
        { userId: "u1", runId: "r1" },
      );

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.direction).toBe("down");
      expect(result.amount).toBe(650);
      expect(result.currentScrollY).toBe(650);
      expect(result.maxScrollY).toBe(3200);
    });

    it("should default to direction down and 500px when parameters are omitted", async () => {
      const mockPage = {
        evaluate: vi.fn().mockResolvedValue({
          scrollY: 500,
          scrollHeight: 2000,
          innerHeight: 800,
        }),
      };

      vi.spyOn(browserManager, "getOrCreateSession").mockResolvedValue({
        browser: {} as any,
        context: {} as any,
        page: mockPage as any,
        lastActive: new Date(),
      });

      const result = await scrollPageTool.execute(
        {},
        { userId: "u1", runId: "r1" },
      );

      expect(result.success).toBe(true);
      expect(result.direction).toBe("down");
      expect(result.amount).toBe(500);
    });
  });

  describe("2. hoverElementTool", () => {
    it("should hover over specified selector with 10s timeout", async () => {
      const mockPage = {
        hover: vi.fn().mockResolvedValue(undefined),
      };

      vi.spyOn(browserManager, "getOrCreateSession").mockResolvedValue({
        browser: {} as any,
        context: {} as any,
        page: mockPage as any,
        lastActive: new Date(),
      });

      const result = await hoverElementTool.execute(
        { selector: "button.nav-dropdown" },
        { userId: "u1", runId: "r1" },
      );

      expect(mockPage.hover).toHaveBeenCalledWith("button.nav-dropdown", {
        timeout: 10000,
      });
      expect(result.success).toBe(true);
      expect(result.selector).toBe("button.nav-dropdown");
    });
  });

  describe("3. waitForSelectorTool", () => {
    it("should wait for element to reach specified state", async () => {
      const mockPage = {
        waitForSelector: vi.fn().mockResolvedValue(undefined),
      };

      vi.spyOn(browserManager, "getOrCreateSession").mockResolvedValue({
        browser: {} as any,
        context: {} as any,
        page: mockPage as any,
        lastActive: new Date(),
      });

      const result = await waitForSelectorTool.execute(
        { selector: "#profile-modal", state: "visible", timeoutMs: 5000 },
        { userId: "u1", runId: "r1" },
      );

      expect(mockPage.waitForSelector).toHaveBeenCalledWith("#profile-modal", {
        state: "visible",
        timeout: 5000,
      });
      expect(result.success).toBe(true);
      expect(result.selector).toBe("#profile-modal");
      expect(result.state).toBe("visible");
    });
  });

  describe("4. getPageElementsTool", () => {
    it("should extract interactive elements and return structured JSON", async () => {
      const mockPage = {
        url: vi.fn().mockReturnValue("https://example.com/login"),
        title: vi.fn().mockResolvedValue("Login Portal"),
        evaluate: vi.fn().mockResolvedValue([
          {
            tag: "input",
            id: "email",
            type: "email",
            name: "email",
            placeholder: "name@example.com",
            selector: "#email",
          },
          {
            tag: "button",
            id: "btn-submit",
            text: "Sign In",
            selector: "#btn-submit",
          },
          {
            tag: "a",
            text: "Forgot password?",
            selector: 'a:has-text("Forgot password?")',
          },
        ]),
      };

      vi.spyOn(browserManager, "getOrCreateSession").mockResolvedValue({
        browser: {} as any,
        context: {} as any,
        page: mockPage as any,
        lastActive: new Date(),
      });

      const result = await getPageElementsTool.execute(
        { limit: 20, filter: "all" },
        { userId: "u1", runId: "r1" },
      );

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.totalFound).toBe(3);
      expect(result.elements).toHaveLength(3);
      expect(result.elements[0].selector).toBe("#email");
      expect(result.elements[1].text).toBe("Sign In");
    });
  });

  describe("5. Global Tool Registry", () => {
    it("should have all Sprint 1 and Sprint 2 browser tools registered", () => {
      initializeDefaultTools();
      expect(globalToolRegistry.get("take_screenshot")).toBeDefined();
      expect(globalToolRegistry.get("scroll_page")).toBeDefined();
      expect(globalToolRegistry.get("hover_element")).toBeDefined();
      expect(globalToolRegistry.get("wait_for_selector")).toBeDefined();
      expect(globalToolRegistry.get("get_page_elements")).toBeDefined();
    });
  });
});
