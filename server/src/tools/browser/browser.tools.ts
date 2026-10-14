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

async function captureScreenshot(page: any): Promise<{ imageBase64?: string; mimeType?: string }> {
  try {
    const buffer = await page.screenshot({ timeout: 5000 });
    return {
      imageBase64: buffer.toString("base64"),
      mimeType: "image/png",
    };
  } catch {
    return {};
  }
}

export const openBrowserTool: AgentTool = {
  name: "open_browser",
  description:
    "Opens a headless browser session, navigates to an initial URL if provided, and captures a live view.",
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
    const currentUrl = session.page.url();
    const screenshot = await captureScreenshot(session.page);

    return {
      success: true,
      currentUrl,
      url: currentUrl,
      title,
      ...screenshot,
      message: `Browser session opened successfully at ${currentUrl || "blank page"}.`,
    };
  },
};

export const navigateToTool: AgentTool = {
  name: "navigate_to",
  description: "Navigates the browser to a specific URL and captures a screenshot.",
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
    const currentUrl = session.page.url();
    const screenshot = await captureScreenshot(session.page);

    return {
      success: true,
      currentUrl,
      url: currentUrl,
      title,
      ...screenshot,
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
    const currentUrl = session.page.url();
    const title = await session.page.title().catch(() => "");
    const screenshot = await captureScreenshot(session.page);

    return {
      success: true,
      message: `Clicked element matching selector "${input.selector}".`,
      currentUrl,
      url: currentUrl,
      title,
      ...screenshot,
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
    const currentUrl = session.page.url();
    const title = await session.page.title().catch(() => "");
    const screenshot = await captureScreenshot(session.page);

    return {
      success: true,
      message: `Typed text into element "${input.selector}".`,
      currentUrl,
      url: currentUrl,
      title,
      ...screenshot,
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

export const takeScreenshotTool: AgentTool = {
  name: "take_screenshot",
  description:
    "Takes a screenshot of the current browser page and returns it as a base64 image for visual inspection and multi-modal understanding.",
  riskLevel: "READ",
  inputSchema: z.object({
    fullPage: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to capture the entire scrollable page (true) or just the visible viewport (false)"),
  }),
  async execute(input, context: ToolContext) {
    const sessionKey = getSessionKey(context);
    const session = await browserManager.getOrCreateSession(sessionKey);

    const buffer = await session.page.screenshot({
      fullPage: input.fullPage ?? false,
    });
    const currentUrl = session.page.url();
    const title = await session.page.title();
    const imageBase64 = buffer.toString("base64");

    return {
      success: true,
      imageBase64,
      mimeType: "image/png",
      url: currentUrl,
      title,
      message: `Screenshot of "${title || currentUrl || "page"}" captured successfully (${buffer.length} bytes).`,
    };
  },
};

export const scrollPageTool: AgentTool = {
  name: "scroll_page",
  description:
    "Scrolls the current browser window up, down, to the top, or to the bottom.",
  riskLevel: "READ",
  inputSchema: z.object({
    direction: z
      .enum(["down", "up", "top", "bottom"])
      .optional()
      .default("down")
      .describe("Direction to scroll: 'down', 'up', 'top', or 'bottom'"),
    amount: z
      .number()
      .min(50)
      .max(5000)
      .optional()
      .default(500)
      .describe("Distance in pixels to scroll when direction is 'down' or 'up' (default 500)"),
  }),
  async execute(input, context: ToolContext) {
    const sessionKey = getSessionKey(context);
    const session = await browserManager.getOrCreateSession(sessionKey);

    const direction = input.direction ?? "down";
    const amount = input.amount ?? 500;

    const scrollResult = await session.page.evaluate(
      ({ dir, dist }) => {
        if (dir === "top") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (dir === "bottom") {
          window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        } else if (dir === "up") {
          window.scrollBy({ top: -dist, behavior: "smooth" });
        } else {
          window.scrollBy({ top: dist, behavior: "smooth" });
        }
        return {
          scrollY: window.scrollY,
          scrollHeight: document.body.scrollHeight,
          innerHeight: window.innerHeight,
        };
      },
      { dir: direction, dist: amount },
    );

    const currentUrl =
      typeof session.page.url === "function" ? session.page.url() : "";
    const title =
      typeof session.page.title === "function"
        ? await session.page.title().catch(() => "")
        : "";
    const screenshot = await captureScreenshot(session.page);

    return {
      success: true,
      direction,
      amount,
      currentScrollY: scrollResult.scrollY,
      maxScrollY: scrollResult.scrollHeight,
      currentUrl,
      url: currentUrl,
      title,
      ...screenshot,
      message: `Scrolled ${direction} by ${amount}px. Current vertical offset: ${scrollResult.scrollY}px.`,
    };
  },
};

export const hoverElementTool: AgentTool = {
  name: "hover_element",
  description:
    "Hovers the mouse cursor over an interactive element to reveal dropdowns, menus, or tooltips.",
  riskLevel: "READ",
  inputSchema: z.object({
    selector: z
      .string()
      .min(1)
      .describe(
        'The CSS or text selector of the element to hover over (e.g. "button.dropdown", "nav a:has-text(\'Products\')")',
      ),
  }),
  async execute(input, context: ToolContext) {
    const sessionKey = getSessionKey(context);
    const session = await browserManager.getOrCreateSession(sessionKey);

    await session.page.hover(input.selector, { timeout: 10000 });

    return {
      success: true,
      selector: input.selector,
      message: `Hovered over element matching "${input.selector}".`,
    };
  },
};

export const waitForSelectorTool: AgentTool = {
  name: "wait_for_selector",
  description:
    "Waits for a specific selector or element to appear, become visible, or disappear on the browser page before continuing.",
  riskLevel: "READ",
  inputSchema: z.object({
    selector: z
      .string()
      .min(1)
      .describe("The CSS or text selector to wait for"),
    state: z
      .enum(["attached", "detached", "visible", "hidden"])
      .optional()
      .default("visible")
      .describe("State to wait for: 'visible', 'hidden', 'attached', or 'detached'"),
    timeoutMs: z
      .number()
      .min(500)
      .max(30000)
      .optional()
      .default(10000)
      .describe("Max time to wait in milliseconds (default 10,000)"),
  }),
  async execute(input, context: ToolContext) {
    const sessionKey = getSessionKey(context);
    const session = await browserManager.getOrCreateSession(sessionKey);

    await session.page.waitForSelector(input.selector, {
      state: input.state ?? "visible",
      timeout: input.timeoutMs ?? 10000,
    });

    return {
      success: true,
      selector: input.selector,
      state: input.state ?? "visible",
      message: `Element "${input.selector}" reached state "${input.state ?? "visible"}".`,
    };
  },
};

export const getPageElementsTool: AgentTool = {
  name: "get_page_elements",
  description:
    "Enumerates all interactive elements (buttons, inputs, links, forms) on the current browser page in structured JSON format with selectors and labels.",
  riskLevel: "READ",
  inputSchema: z.object({
    limit: z
      .number()
      .min(5)
      .max(100)
      .optional()
      .default(40)
      .describe("Maximum number of interactive elements to retrieve (default 40)"),
    filter: z
      .enum(["all", "buttons", "inputs", "links"])
      .optional()
      .default("all")
      .describe("Filter elements by category: 'all', 'buttons', 'inputs', or 'links'"),
  }),
  async execute(input, context: ToolContext) {
    const sessionKey = getSessionKey(context);
    const session = await browserManager.getOrCreateSession(sessionKey);

    const limit = input.limit ?? 40;
    const filter = input.filter ?? "all";

    const elements = await session.page.evaluate(
      ({ maxCount, cat }) => {
        const interactiveTags = ["button", "input", "select", "textarea", "a", "[role=button]"];
        let selectorQuery = interactiveTags.join(", ");
        if (cat === "buttons") selectorQuery = "button, [role=button], input[type=submit], input[type=button]";
        else if (cat === "inputs") selectorQuery = "input:not([type=hidden]), select, textarea";
        else if (cat === "links") selectorQuery = "a[href]";

        const matches = Array.from(document.querySelectorAll(selectorQuery));
        const results = [];

        for (const el of matches) {
          if (results.length >= maxCount) break;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;

          const htmlEl = el as HTMLElement;
          const tag = htmlEl.tagName.toLowerCase();
          const name = htmlEl.getAttribute("name");
          const type = htmlEl.getAttribute("type");
          const placeholder = htmlEl.getAttribute("placeholder");
          const ariaLabel = htmlEl.getAttribute("aria-label");
          const role = htmlEl.getAttribute("role");
          const text = (htmlEl.innerText || htmlEl.textContent || "").trim().slice(0, 80);

          let suggestedSelector = "";
          if (htmlEl.id) {
            suggestedSelector = `#${htmlEl.id}`;
          } else if (name) {
            suggestedSelector = `${tag}[name="${name}"]`;
          } else if (tag === "a" && text) {
            suggestedSelector = `a:has-text("${text.slice(0, 30)}")`;
          } else if (tag === "button" && text) {
            suggestedSelector = `button:has-text("${text.slice(0, 30)}")`;
          } else if (placeholder) {
            suggestedSelector = `${tag}[placeholder="${placeholder}"]`;
          } else {
            const classes = Array.from(htmlEl.classList).slice(0, 2).join(".");
            suggestedSelector = classes ? `${tag}.${classes}` : tag;
          }

          results.push({
            tag,
            id: htmlEl.id || undefined,
            name: name || undefined,
            type: type || undefined,
            text: text || undefined,
            placeholder: placeholder || undefined,
            ariaLabel: ariaLabel || undefined,
            role: role || undefined,
            selector: suggestedSelector,
          });
        }

        return results;
      },
      { maxCount: limit, cat: filter },
    );

    return {
      success: true,
      url: session.page.url(),
      title: await session.page.title(),
      totalFound: elements.length,
      elements,
    };
  },
};

export const closeBrowserTool: AgentTool = {
  name: "close_browser",
  description:
    "Closes the active browser session, terminates the Playwright browser process, and frees system resources.",
  riskLevel: "LOW",
  inputSchema: z.object({}),
  async execute(_input, context: ToolContext) {
    const sessionKey = getSessionKey(context);
    await browserManager.closeSession(sessionKey);
    await browserManager.closeSession("default_session");
    return {
      success: true,
      message: "Browser session closed and terminated successfully.",
    };
  },
};


