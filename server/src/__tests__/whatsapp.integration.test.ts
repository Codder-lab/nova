import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connectorRegistry } from "../integrations/connector.registry";
import { WhatsAppConnector } from "../integrations/providers/whatsapp.connector";
import { whatsappService } from "../services/whatsapp.service";
import { createApp } from "../app";
import http from "http";

describe("WhatsApp Integration & Multi-Device Connector", () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it("registers WhatsApp connector in connectorRegistry", () => {
    const connector = connectorRegistry.get("whatsapp");
    expect(connector).toBeDefined();
    expect(connector?.name).toBe("WhatsApp");
    expect(connector?.category).toBe("communication");
    expect(connector?.authType).toBe("qr_code");
    expect(connector?.capabilities).toContain("Scan QR Code (No API Key Required)");
    expect(connector?.capabilities).toContain("Two-Way Agent Conversation");
    expect(connector?.capabilities).toContain("Send WhatsApp Messages");
  });

  it("normalizes recipient phone numbers to WhatsApp JIDs", () => {
    expect(whatsappService.normalizeJid("+1 (555) 234-5678")).toBe(
      "15552345678@s.whatsapp.net"
    );
    expect(whatsappService.normalizeJid("919876543210")).toBe(
      "919876543210@s.whatsapp.net"
    );
    expect(whatsappService.normalizeJid("123456789-987654@g.us")).toBe(
      "123456789-987654@g.us"
    );
  });

  it("returns disconnected status when unlinked", () => {
    const status = whatsappService.getStatus();
    expect(status).toHaveProperty("status");
    expect(status).toHaveProperty("isConnected");
    expect(status).toHaveProperty("autoReplyEnabled");
    expect(typeof status.autoReplyEnabled).toBe("boolean");
  });

  it("toggles autoReply setting", () => {
    whatsappService.setAutoReply(false);
    expect(whatsappService.getStatus().autoReplyEnabled).toBe(false);

    whatsappService.setAutoReply(true);
    expect(whatsappService.getStatus().autoReplyEnabled).toBe(true);
  });

  it("generates agent tools with proper schemas", () => {
    const connector = new WhatsAppConnector();
    const tools = connector.createTools({ defaultRecipient: "+1234567890" });

    expect(tools.length).toBe(3);

    const sendMsgTool = tools.find((t) => t.name === "whatsapp_send_message");
    const sendMediaTool = tools.find((t) => t.name === "whatsapp_send_media");
    const getStatusTool = tools.find((t) => t.name === "whatsapp_get_status");

    expect(sendMsgTool).toBeDefined();
    expect(sendMediaTool).toBeDefined();
    expect(getStatusTool).toBeDefined();

    expect(sendMsgTool?.riskLevel).toBe("LOW");
    expect(sendMediaTool?.riskLevel).toBe("LOW");
    expect(getStatusTool?.riskLevel).toBe("LOW");
  });

  it("executes whatsapp_get_status tool", async () => {
    const connector = new WhatsAppConnector();
    const tools = connector.createTools({});
    const getStatusTool = tools.find((t) => t.name === "whatsapp_get_status");

    const result = await getStatusTool?.execute({}, {} as any);
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("isConnected");
    expect(result).toHaveProperty("autoReplyEnabled");
  });

  it("returns test connection result based on connection status", async () => {
    const connector = new WhatsAppConnector();
    const result = await connector.testConnection({});
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("message");
  });

  it("serves /api/whatsapp/status endpoint via Express", async () => {
    const app = createApp();
    const server = http.createServer(app);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://localhost:${port}/api/whatsapp/status`);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("autoReplyEnabled");
    } finally {
      server.close();
    }
  });

  it("updates autoReply preference via /api/whatsapp/settings endpoint", async () => {
    const app = createApp();
    const server = http.createServer(app);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://localhost:${port}/api/whatsapp/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoReplyEnabled: false }),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.autoReplyEnabled).toBe(false);

      // Restore to true
      await fetch(`http://localhost:${port}/api/whatsapp/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoReplyEnabled: true }),
      });
    } finally {
      server.close();
    }
  });

  it("syncs WhatsApp status to IntegrationModel and getUserIntegrations", async () => {
    const { integrationService } = await import("../services/integration.service");

    // Initially disconnected
    const initialIntegrations = await integrationService.getUserIntegrations("test-user");
    const waInitial = initialIntegrations.find((i) => i.connectorId === "whatsapp");
    expect(waInitial?.status).not.toBe("connected");

    // Simulate connected status
    vi.spyOn(whatsappService, "getStatus").mockReturnValue({
      status: "connected",
      isConnected: true,
      user: {
        id: "15551234567:0@s.whatsapp.net",
        phone: "15551234567",
        name: "Test User",
      },
      autoReplyEnabled: true,
      lastActive: new Date(),
    });

    await whatsappService.syncToIntegrationModel("test-user");

    const activeIntegrations = await integrationService.getUserIntegrations("test-user");
    const waActive = activeIntegrations.find((i) => i.connectorId === "whatsapp");
    expect(waActive).toBeDefined();
    expect(waActive?.status).toBe("connected");
    expect(waActive?.maskedCredentials?.defaultRecipient).toBe("15551234567");

    vi.restoreAllMocks();
  });
});
