import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../app";
import { connectDB, disconnectDB } from "../db/connection";
import { UserBotPreferenceModel } from "../models/bot-preference.model";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import http from "http";

describe("Bot REST API Endpoints", () => {
  let server: http.Server;
  let baseUrl: string;
  const testUserId = "test-api-user-99";
  const userToken = jwt.sign(
    { userId: testUserId, email: "botuser@example.com", role: "user" },
    env.JWT_SECRET,
  );

  beforeAll(async () => {
    await connectDB();
    const app = createApp();
    server = app.listen(0);
    const address = server.address() as any;
    baseUrl = `http://localhost:${address.port}`;
  }, 35000);

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await UserBotPreferenceModel.deleteMany({ userId: testUserId });
    await disconnectDB();
  });

  it("GET /api/bots returns all 4 platform bots hydrated", async () => {
    const res = await fetch(`${baseUrl}/api/bots`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bots).toBeDefined();
    expect(data.bots.length).toBe(4);
    expect(data.bots[0].slug).toBe("nova-core");
    expect(data.bots[0].userPreference).toBeDefined();
  });

  it("GET /api/bots/:botSlug returns single bot", async () => {
    const res = await fetch(`${baseUrl}/api/bots/nova-taskmaster`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bot.slug).toBe("nova-taskmaster");
    expect(data.bot.name).toBe("Nova TaskMaster");
  });

  it("PATCH /api/bots/:botSlug/preferences saves user adjustments", async () => {
    const res = await fetch(`${baseUrl}/api/bots/nova-taskmaster/preferences`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        tone: "friendly",
        customInstructions: "Keep it under 3 bullets.",
        temperature: 0.4,
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bot.userPreference.tone).toBe("friendly");
    expect(data.bot.userPreference.customInstructions).toBe("Keep it under 3 bullets.");
    expect(data.bot.userPreference.temperature).toBe(0.4);
  });

  it("POST /api/bots/:botSlug/preferences/reset reverts to platform defaults", async () => {
    const res = await fetch(
      `${baseUrl}/api/bots/nova-taskmaster/preferences/reset`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
      },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bot.userPreference.tone).toBe("concise"); // default
    expect(data.bot.userPreference.customInstructions).toBe("");
  });
});
