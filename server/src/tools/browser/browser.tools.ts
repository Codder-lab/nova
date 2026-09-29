import { z } from "zod";
import { AgentTool, ToolContext } from "../base/agent-tool.interface";
import { browserManager } from "./browser.manager";

function getSessionKey(context: ToolContext): string {
  return (
    context.runId ||
    context.conversationId ||
    context.userId ||
    "default_session"
  );
}

export const openBrowserTool: AgentTool = {
  name: "open_browser",
  description:
    "Opens a headless browser session and optionally navigates to an initial URL.",
  riskLevel: "LOW",
  inputSchema: z.object({
    initialUrl: z
      .string()
      .url()
      .optional()
      .describe("Optional initial URL to open"),
  }),
  async execute(input, context: ToolContext) {
    const sessionKey = getSessionKey(context);
    const session = await browserManager.getOrCreateSession(sessionKey);

    if (input.initialUrl) {
      await session.page.goto(input.initialUrl, {
        waitUntil: "domcontentloaded",
      });
    }

    const title = await session.page.title();
    return {
      success: true,
      currentUrl: session.page.url(),
      title,
      message: "Browser session opened successfully.",
    };
  },
};

export const navigateToTool: AgentTool = {
  name: "navigate_to",
  description: "Navigates the browser to a specific URL.",
  riskLevel: "READ",
  inputSchema: z.object({
    url: z
      .string()
      .url()
      .describe(
        "The complete URL to navigate to (must include http:// or https://)",
      ),
  }),
  async execute(input, context: ToolContext) {
    const sessionKey = getSessionKey(context);
    const session = await browserManager.getOrCreateSession(sessionKey);

    await session.page.goto(input.url, { waitUntil: "domcontentloaded" });
    const title = await session.page.title();

    return {
      success: true,
      currentUrl: session.page.url(),
      title,
    };
  },
};

export const clickElementTool: AgentTool = {
  name: "click_element",
  description:
    "Clicks an interactive button, link, or element on the current browser page. Requires human authorization.",
  riskLevel: "HIGH",
  inputSchema: z.object({
    selector: z
      .string()
      .min(1)
      .describe(
        'The CSS selector or text selector of the element to click (e.g. "button#submit", "a:has-text(\'Sign In\')")',
      ),
  }),
  async execute(input, context: ToolContext) {
    const sessionKey = getSessionKey(context);
    const session = await browserManager.getOrCreateSession(sessionKey);

    await session.page.click(input.selector, { timeout: 10000 });
    // Wait briefly for potential navigation or DOM update
    await session.page.waitForLoadState("domcontentloaded").catch(() => {});

    return {
      success: true,
      message: `Clicked element matching selector "${input.selector}".`,
      currentUrl: session.page.url(),
    };
  },
};

export const typeIntoTool: AgentTool = {
  name: "type_into",
  description:
    "Types text into an input field or form on the browser page. Requires human authorization.",
  riskLevel: "HIGH",
  inputSchema: z.object({
    selector: z
      .string()
      .min(1)
      .describe(
        'CSS selector of the input field (e.g. "input#email", "textarea[name=\'query\']")',
      ),
    text: z.string().describe("The text string to type into the field"),
  }),
  async execute(input, context: ToolContext) {
    const sessionKey = getSessionKey(context);
    const session = await browserManager.getOrCreateSession(sessionKey);

    await session.page.fill(input.selector, input.text, { timeout: 10000 });

    return {
      success: true,
      message: `Typed text into element "${input.selector}".`,
      currentUrl: session.page.url(),
    };
  },
};

export const extractPageContentTool: AgentTool = {
  name: "extract_page_content",
  description:
    "Extracts the visible text and structure of the current browser page.",
  riskLevel: "READ",
  inputSchema: z.object({
    maxLength: z
      .number()
      .min(500)
      .max(20000)
      .optional()
      .default(4000)
      .describe("Maximum characters of text to return"),
  }),
  async execute(input, context: ToolContext) {
    const sessionKey = getSessionKey(context);
    const session = await browserManager.getOrCreateSession(sessionKey);

    const title = await session.page.title();
    const currentUrl = session.page.url();
    const innerText = await session.page.evaluate(() => {
      // Remove noisy elements
      const clone = document.body.cloneNode(true) as HTMLElement;
      const removeTags = ["script", "style", "svg", "noscript", "iframe"];
      for (const tag of removeTags) {
        const els = clone.getElementsByTagName(tag);
        while (els.length > 0) {
          els[0].parentNode?.removeChild(els[0]);
        }
      }
      return clone.innerText.replace(/\s+/g, " ").trim();
    });

    const isTruncated = innerText.length > input.maxLength;
    const content = isTruncated
      ? `${innerText.slice(0, input.maxLength)}\n\n[... Truncated ${innerText.length - input.maxLength} characters ...]`
      : innerText;

    return {
      success: true,
      title,
      url: currentUrl,
      content,
    };
  },
};
