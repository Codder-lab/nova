import path from "path";
import fs from "fs";
import pino from "pino";
import QRCode from "qrcode";
import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  WAMessage,
  WASocket,
  proto,
  WAMessageKey,
  WAMessageContent,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { Conversation, Message } from "../models/conversation.model";
import { IntegrationModel } from "../models/integration.model";
import { AgentEngine } from "../agents/agent.engine";
import { getLLMProviderForUser } from "../llm";
import { logger } from "../utils/logger";

export type WhatsAppConnectionStatus =
  | "disconnected"
  | "connecting"
  | "qr_ready"
  | "connected";

export interface WhatsAppStatusInfo {
  status: WhatsAppConnectionStatus;
  isConnected: boolean;
  qrCode?: string;
  qrDataUrl?: string;
  user?: {
    id: string;
    name?: string;
    phone?: string;
  };
  autoReplyEnabled: boolean;
  lastActive?: Date;
  lastError?: string;
}

const GUEST_USER_IDS = ["cli-user", "anonymous-user", "anonymous"];

function resolveUserFilter(userId: string) {
  if (GUEST_USER_IDS.includes(userId)) {
    return { $in: GUEST_USER_IDS };
  }
  return userId;
}

export class WhatsAppService {
  private sock: WASocket | null = null;
  private status: WhatsAppConnectionStatus = "disconnected";
  private qrCodeRaw?: string;
  private qrDataUrl?: string;
  private autoReplyEnabled: boolean = true;
  private lastActive?: Date;
  private lastError?: string;
  private authDir: string;
  private isInitializing: boolean = false;
  private currentUserId: string = "cli-user";
  private messageCache = new Map<string, proto.IMessage>();
  private msgRetryCounterCache = new Map<string, number>();

  constructor() {
    this.authDir = this.resolveAuthDir();
  }

  /**
   * Resolves the WhatsApp auth storage directory across workspace roots
   */
  private resolveAuthDir(): string {
    const candidates = [
      path.resolve(__dirname, "../../workspaces/whatsapp_auth"),
      path.resolve(process.cwd(), "workspaces", "whatsapp_auth"),
      path.resolve(process.cwd(), "server", "workspaces", "whatsapp_auth"),
    ];

    for (const dir of candidates) {
      if (fs.existsSync(path.join(dir, "creds.json"))) {
        return dir;
      }
    }

    const defaultDir = candidates[0];
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
    return defaultDir;
  }

  /**
   * Normalize an input phone or JID to valid WhatsApp JID format
   */
  public normalizeJid(recipient: string): string {
    const cleaned = recipient.trim();
    if (cleaned.endsWith("@s.whatsapp.net") || cleaned.endsWith("@g.us")) {
      return cleaned;
    }
    // Remove all non-numeric characters (plus signs, spaces, hyphens)
    const digitsOnly = cleaned.replace(/\D/g, "");
    return `${digitsOnly}@s.whatsapp.net`;
  }

  /**
   * Returns current WhatsApp status & details
   */
  public getStatus(): WhatsAppStatusInfo {
    const user = this.sock?.user;
    return {
      status: this.status,
      isConnected: this.status === "connected" && !!this.sock,
      qrCode: this.qrCodeRaw,
      qrDataUrl: this.qrDataUrl,
      user: user
        ? {
            id: user.id,
            name: user.name,
            phone: user.id ? user.id.split(":")[0]?.replace("@s.whatsapp.net", "") : undefined,
          }
        : undefined,
      autoReplyEnabled: this.autoReplyEnabled,
      lastActive: this.lastActive,
      lastError: this.lastError,
    };
  }

  /**
   * Set two-way AI assistant auto-reply
   */
  public setAutoReply(enabled: boolean): void {
    this.autoReplyEnabled = enabled;
    logger.info({ autoReplyEnabled: enabled }, "WhatsApp auto-reply preference updated");
    this.syncToIntegrationModel().catch(() => {});
  }

  /**
   * Connect or reconnect to WhatsApp Multi-Device session
   */
  public async connect(userId?: string): Promise<WhatsAppStatusInfo> {
    if (userId) {
      this.currentUserId = userId;
    }
    this.authDir = this.resolveAuthDir();

    if (this.status === "connected" && this.sock) {
      this.syncToIntegrationModel(userId).catch(() => {});
      return this.getStatus();
    }

    if (this.isInitializing) {
      return this.getStatus();
    }

    this.isInitializing = true;
    this.status = "connecting";
    this.lastError = undefined;

    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      const silentLogger = pino({ level: "silent" }) as any;

      const sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
        },
        printQRInTerminal: true,
        logger: silentLogger,
        browser: ["Nova Assistant", "Chrome", "1.0.0"],
        syncFullHistory: false,
        msgRetryCounterCache: {
          get: <T>(key: string): T | undefined => {
            return this.msgRetryCounterCache.get(key) as T | undefined;
          },
          set: <T>(key: string, value: T): void => {
            this.msgRetryCounterCache.set(key, Number(value));
          },
          del: (key: string): void => {
            this.msgRetryCounterCache.delete(key);
          },
          flushAll: (): void => {
            this.msgRetryCounterCache.clear();
          },
        },
        getMessage: async (key: WAMessageKey): Promise<WAMessageContent | undefined> => {
          if (key.id && this.messageCache.has(key.id)) {
            return this.messageCache.get(key.id) as WAMessageContent;
          }
          return undefined;
        },
      });

      this.sock = sock;

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrCodeRaw = qr;
          try {
            this.qrDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              scale: 8,
              color: {
                dark: "#000000",
                light: "#ffffff",
              },
            });
          } catch (err: any) {
            logger.warn({ err: err.message }, "Failed to generate QR data URL");
          }
          this.status = "qr_ready";
          logger.info("WhatsApp QR code generated and ready for scanning");
        }

        if (connection === "open") {
          this.status = "connected";
          this.qrCodeRaw = undefined;
          this.qrDataUrl = undefined;
          this.lastActive = new Date();
          this.lastError = undefined;
          this.isInitializing = false;
          logger.info(
            { user: sock.user },
            "WhatsApp connected successfully via multi-device"
          );
          await this.syncToIntegrationModel();
        } else if (connection === "close") {
          this.isInitializing = false;
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          logger.warn(
            { statusCode, shouldReconnect, error: lastDisconnect?.error },
            "WhatsApp connection closed"
          );

          if (shouldReconnect) {
            this.status = "connecting";
            setTimeout(() => {
              this.connect().catch((err) => {
                logger.error({ err }, "WhatsApp auto-reconnect failed");
              });
            }, 3000);
          } else {
            this.status = "disconnected";
            this.sock = null;
            this.lastError = "Logged out from WhatsApp";
            this.cleanAuthDirectory();
            this.syncToIntegrationModel().catch(() => {});
          }
        }
      });

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("messages.upsert", async ({ messages, type }) => {
        for (const msg of messages) {
          if (msg.key?.id && msg.message) {
            this.messageCache.set(msg.key.id, msg.message);
            if (this.messageCache.size > 1000) {
              const oldest = this.messageCache.keys().next().value;
              if (oldest) this.messageCache.delete(oldest);
            }
          }
        }
        if (type !== "notify") return;
        for (const msg of messages) {
          await this.handleIncomingMessage(msg);
        }
      });

      return this.getStatus();
    } catch (err: any) {
      this.isInitializing = false;
      this.status = "disconnected";
      this.lastError = err.message || "Failed initializing WhatsApp connection";
      logger.error({ err }, "Error connecting to WhatsApp");
      return this.getStatus();
    }
  }

  /**
   * Handle incoming message from WhatsApp for two-way agent conversation
   */
  private async handleIncomingMessage(msg: WAMessage): Promise<void> {
    const remoteJid = msg.key.remoteJid;
    if (!remoteJid || remoteJid === "status@broadcast") return;
    if (msg.key.fromMe) return; // Do not respond to self

    // Extract text from text message or image caption
    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      "";

    if (!text || !text.trim()) return;

    this.lastActive = new Date();

    if (!this.autoReplyEnabled) {
      logger.debug(
        { from: remoteJid, text },
        "WhatsApp message received, but auto-reply is disabled"
      );
      return;
    }

    logger.info(
      { from: remoteJid, textSnippet: text.slice(0, 50) },
      "Processing incoming WhatsApp message through Nova Agent"
    );

    try {
      // 1. Send typing indicator
      if (this.sock) {
        await this.sock.sendPresenceUpdate("composing", remoteJid);
      }

      // 2. Find or create conversation session
      const cleanSender = remoteJid.replace(/[^a-zA-Z0-9_-]/g, "_");
      const sessionTitle = `WhatsApp (${remoteJid.split("@")[0]})`;
      const userId = "whatsapp-user";

      let conv = await Conversation.findOne({
        userId,
        title: sessionTitle,
      });

      if (!conv) {
        conv = await Conversation.create({
          userId,
          title: sessionTitle,
          messageCount: 0,
          lastMessage: text,
        });
      }

      const conversationId = conv._id.toString();

      // Record incoming message in conversation history
      await Message.create({
        conversationId,
        userId,
        role: "user",
        content: text,
      });

      // 3. Run Nova AgentEngine
      const llm = await getLLMProviderForUser(userId);
      const engine = new AgentEngine({ llm });
      const result = await engine.run({
        userId,
        goal: text,
        conversationId,
        maxSteps: 10,
        provider: llm.name,
        model: llm.model,
      });

      // 4. Save Assistant Response
      if (result.response) {
        await Message.create({
          conversationId,
          userId,
          role: "assistant",
          content: result.response,
          runId: result.runId,
          steps: result.steps,
          durationMs: result.durationMs,
          status: result.status,
        });

        const totalMsgs = await Message.countDocuments({ conversationId });
        await Conversation.findByIdAndUpdate(conversationId, {
          $set: {
            lastMessage: result.response,
            messageCount: totalMsgs,
            updatedAt: new Date(),
          },
        });

        // 5. Send message reply back on WhatsApp
        if (this.sock) {
          await this.sock.sendMessage(
            remoteJid,
            { text: result.response },
            { quoted: msg }
          );
        }
      }

      // Clear typing presence
      if (this.sock) {
        await this.sock.sendPresenceUpdate("paused", remoteJid);
      }
    } catch (err: any) {
      logger.error(
        { err: err.message, from: remoteJid },
        "Error in WhatsApp incoming message handler"
      );
      if (this.sock) {
        try {
          await this.sock.sendMessage(remoteJid, {
            text: `⚠️ Nova encountered an issue processing your request: ${err.message}`,
          });
        } catch {}
      }
    }
  }

  /**
   * Send an outbound text message to a phone or JID
   */
  public async sendMessage(
    recipient: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; to: string }> {
    if (!this.sock || this.status !== "connected") {
      throw new Error(
        "WhatsApp client is not connected. Scan QR code in Settings / Integrations first."
      );
    }

    let jid = this.normalizeJid(recipient);

    // If recipient is a direct phone number, verify canonical JID and initiate pre-key exchange
    if (jid.endsWith("@s.whatsapp.net")) {
      try {
        const phoneDigits = jid.replace("@s.whatsapp.net", "");
        const [waCheck] = (await this.sock.onWhatsApp(phoneDigits)) || [];
        if (waCheck?.exists && waCheck.jid) {
          jid = waCheck.jid;
        }
      } catch (err: any) {
        logger.debug({ err: err.message }, "WhatsApp pre-check bypassed");
      }
    }

    const sent = await this.sock.sendMessage(jid, { text: message });

    if (sent?.key?.id && sent.message) {
      this.messageCache.set(sent.key.id, sent.message);
    }

    this.lastActive = new Date();

    return {
      success: true,
      messageId: sent?.key?.id || undefined,
      to: jid,
    };
  }

  /**
   * Send media (image or document) to a recipient
   */
  public async sendMedia(
    recipient: string,
    mediaUrl: string,
    caption?: string,
    mediaType: "image" | "document" = "image"
  ): Promise<{ success: boolean; messageId?: string; to: string }> {
    if (!this.sock || this.status !== "connected") {
      throw new Error("WhatsApp client is not connected.");
    }

    let jid = this.normalizeJid(recipient);

    if (jid.endsWith("@s.whatsapp.net")) {
      try {
        const phoneDigits = jid.replace("@s.whatsapp.net", "");
        const [waCheck] = (await this.sock.onWhatsApp(phoneDigits)) || [];
        if (waCheck?.exists && waCheck.jid) {
          jid = waCheck.jid;
        }
      } catch (err: any) {
        logger.debug({ err: err.message }, "WhatsApp pre-check bypassed");
      }
    }

    let sent: any;

    if (mediaType === "image") {
      sent = await this.sock.sendMessage(jid, {
        image: { url: mediaUrl },
        caption,
      });
    } else {
      sent = await this.sock.sendMessage(jid, {
        document: { url: mediaUrl },
        mimetype: "application/octet-stream",
        caption,
      });
    }

    if (sent?.key?.id && sent.message) {
      this.messageCache.set(sent.key.id, sent.message);
    }

    this.lastActive = new Date();

    return {
      success: true,
      messageId: sent?.key?.id || undefined,
      to: jid,
    };
  }

  /**
   * Synchronize current WhatsApp connection status into MongoDB IntegrationModel
   */
  public async syncToIntegrationModel(userId?: string): Promise<void> {
    try {
      const targetUserId = userId || this.currentUserId || "cli-user";
      const isConnected = this.status === "connected" && !!this.sock;
      const user = this.sock?.user;
      const phoneNumber = user?.id
        ? user.id.split(":")[0]?.replace("@s.whatsapp.net", "")
        : undefined;

      const maskedCredentials: Record<string, string> = {};
      if (phoneNumber) {
        maskedCredentials.defaultRecipient = phoneNumber;
      }

      const userIdsToSync = new Set<string>([
        targetUserId,
        "cli-user",
        "anonymous-user",
        "anonymous",
      ]);

      for (const uid of userIdsToSync) {
        await IntegrationModel.findOneAndUpdate(
          { userId: resolveUserFilter(uid), connectorId: "whatsapp" },
          {
            userId: uid,
            connectorId: "whatsapp",
            name: "WhatsApp",
            category: "communication",
            enabled: isConnected,
            status: isConnected ? "connected" : "unconfigured",
            lastTestedAt: this.lastActive || new Date(),
            errorMessage: isConnected ? undefined : this.lastError,
            maskedCredentials,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }

      logger.info(
        { isConnected, phoneNumber, userIds: Array.from(userIdsToSync) },
        "WhatsApp integration status synced to database"
      );
    } catch (err: any) {
      logger.warn({ err: err.message }, "Failed to sync WhatsApp status to IntegrationModel");
    }
  }

  /**
   * Disconnect the active socket
   */
  public async disconnect(): Promise<void> {
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch {}
      this.sock = null;
    }
    this.status = "disconnected";
    this.qrCodeRaw = undefined;
    this.qrDataUrl = undefined;
    await this.syncToIntegrationModel();
    logger.info("WhatsApp client disconnected");
  }

  /**
   * Logout and clear local credentials to allow re-scanning a new QR code
   */
  public async logout(): Promise<void> {
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch {}
      this.sock = null;
    }
    this.status = "disconnected";
    this.qrCodeRaw = undefined;
    this.qrDataUrl = undefined;
    this.cleanAuthDirectory();
    await this.syncToIntegrationModel();
    logger.info("WhatsApp logged out and session credentials cleared");
  }

  /**
   * Clean auth directory
   */
  private cleanAuthDirectory(): void {
    try {
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
        fs.mkdirSync(this.authDir, { recursive: true });
      }
    } catch (err: any) {
      logger.warn({ err: err.message }, "Failed to clear WhatsApp auth directory");
    }
  }

  /**
   * Auto-restore existing session on server startup if credentials exist
   */
  public async autoRestoreIfSessionExists(): Promise<void> {
    try {
      this.authDir = this.resolveAuthDir();
      if (fs.existsSync(this.authDir)) {
        const files = fs.readdirSync(this.authDir);
        if (files.length > 0 && files.some((f) => f.includes("creds.json"))) {
          logger.info(
            { authDir: this.authDir },
            "Found existing WhatsApp credentials, attempting auto-restore..."
          );
          await this.connect();
        }
      }
    } catch (err: any) {
      logger.warn({ err: err.message }, "WhatsApp auto-restore skipped or failed");
    }
  }
}

export const whatsappService = new WhatsAppService();
