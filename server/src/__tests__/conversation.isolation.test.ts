import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../app";
import { connectDB, disconnectDB } from "../db/connection";
import { Conversation, Message } from "../models/conversation.model";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import http from "http";

describe("Conversation Multi-User Isolation", () => {
  let server: http.Server;
  let baseUrl: string;

  const userAToken = jwt.sign(
    { userId: "user-alice-101", email: "alice@example.com", role: "user" },
    env.JWT_SECRET,
  );
  const userBToken = jwt.sign(
    { userId: "user-bob-202", email: "bob@example.com", role: "user" },
    env.JWT_SECRET,
  );

  beforeAll(async () => {
    await connectDB();
    const app = createApp();
    server = app.listen(0);
    const address = server.address() as any;
    baseUrl = `http://localhost:${address.port}`;
  }, 25000);

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await Conversation.deleteMany({ userId: { $in: ["user-alice-101", "user-bob-202"] } });
    await disconnectDB();
  });

  it("User A creates a session; User A can see it, but User B cannot", async () => {
    // 1. User A creates session
    const createRes = await fetch(`${baseUrl}/api/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ title: "Alice Secret Project" }),
    });
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    const aliceSessionId = createData.session.id;

    // 2. User A lists sessions -> Alice sees her session
    const listResA = await fetch(`${baseUrl}/api/conversations`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    const listDataA = await listResA.json();
    expect(listDataA.sessions.some((s: any) => s.id === aliceSessionId)).toBe(true);

    // 3. User B lists sessions -> Bob DOES NOT see Alice's session
    const listResB = await fetch(`${baseUrl}/api/conversations`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const listDataB = await listResB.json();
    expect(listDataB.sessions.some((s: any) => s.id === aliceSessionId)).toBe(false);

    // 4. User B attempts to access Alice's session directly -> 403 Forbidden
    const getResB = await fetch(`${baseUrl}/api/conversations/${aliceSessionId}`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    expect(getResB.status).toBe(403);

    // 5. User B attempts to update Alice's session -> 403 Forbidden
    const patchResB = await fetch(`${baseUrl}/api/conversations/${aliceSessionId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({ title: "Hacked by Bob" }),
    });
    expect(patchResB.status).toBe(403);

    // 6. User B attempts to delete Alice's session -> 403 Forbidden
    const deleteResB = await fetch(`${baseUrl}/api/conversations/${aliceSessionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    expect(deleteResB.status).toBe(403);

    // 7. User A can still retrieve, update, and delete their own session
    const getResA = await fetch(`${baseUrl}/api/conversations/${aliceSessionId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    expect(getResA.status).toBe(200);

    const deleteResA = await fetch(`${baseUrl}/api/conversations/${aliceSessionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    expect(deleteResA.status).toBe(200);
  });
});
