import { chromium, Browser, BrowserContext, Page } from "playwright";
import { logger } from "../../utils/logger";

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  lastActive: Date;
}

export class BrowserManager {
  private static instance: BrowserManager;
  private sessions: Map<string, BrowserSession> = new Map();

  private constructor() {}

  public static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  public async getOrCreateSession(sessionId: string): Promise<BrowserSession> {
    const existing = this.sessions.get(sessionId);
    if (existing && !existing.browser.isConnected()) {
      this.sessions.delete(sessionId);
    } else if (existing) {
      existing.lastActive = new Date();
      return existing;
    }

    try {
      const browser = await chromium.launch({
        headless: true,
      });

      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 800 },
      });

      const page = await context.newPage();
      page.setDefaultTimeout(15000);

      const session: BrowserSession = {
        browser,
        context,
        page,
        lastActive: new Date(),
      };

      this.sessions.set(sessionId, session);
      logger.info(
        { sessionId },
        "Launched sandboxed Playwright browser session",
      );
      return session;
    } catch (err: any) {
      logger.error(
        { error: err.message, sessionId },
        "Failed to launch Playwright browser",
      );
      throw new Error(
        `Failed to launch headless browser: ${err.message}. If browser binaries are missing, run 'npx playwright install chromium'.`,
      );
    }
  }

  public async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.context.close().catch(() => {});
        await session.browser.close().catch(() => {});
      } finally {
        this.sessions.delete(sessionId);
        logger.info({ sessionId }, "Closed Playwright browser session");
      }
    }
  }

  public async closeAll(): Promise<void> {
    for (const [id] of this.sessions.entries()) {
      await this.closeSession(id);
    }
  }
}

export const browserManager = BrowserManager.getInstance();
