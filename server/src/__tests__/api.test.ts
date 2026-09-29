import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../app';
import { connectDB, disconnectDB } from '../db/connection';
import { initializeDefaultTools } from '../tools';
import http from 'http';

describe('HTTP API Endpoints', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    initializeDefaultTools();
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
    await disconnectDB();
  });

  it('GET /health returns 200 and server status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('nova-assistant-api');
  });

  it('GET /api/agent/tools lists registered tools', async () => {
    const res = await fetch(`${baseUrl}/api/agent/tools`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.tools)).toBe(true);
    expect(data.tools.some((t: any) => t.name === 'calculate')).toBe(true);
    expect(data.tools.some((t: any) => t.name === 'get_current_time')).toBe(true);
    expect(data.tools.some((t: any) => t.name === 'create_task')).toBe(true);
    expect(data.tools.some((t: any) => t.name === 'list_tasks')).toBe(true);
    expect(data.tools.some((t: any) => t.name === 'create_reminder')).toBe(true);
    expect(data.tools.some((t: any) => t.name === 'web_search')).toBe(true);
    expect(data.tools.some((t: any) => t.name === 'fetch_web_page')).toBe(true);
  });

  it('POST and GET /api/tasks manages user tasks', async () => {
    // Create task
    const postRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'REST API Test Task',
        priority: 'high',
        tags: ['test', 'api'],
      }),
    });
    expect(postRes.status).toBe(201);
    const postData = await postRes.json();
    expect(postData.success).toBe(true);
    expect(postData.task.title).toBe('REST API Test Task');

    // List tasks
    const getRes = await fetch(`${baseUrl}/api/tasks`);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.success).toBe(true);
    expect(getData.tasks.some((t: any) => t.title === 'REST API Test Task')).toBe(true);
  });

  it('POST and GET /api/reminders manages user reminders', async () => {
    const remindAt = new Date(Date.now() + 7200000).toISOString();
    const postRes = await fetch(`${baseUrl}/api/reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'REST API Test Reminder',
        remindAt,
      }),
    });
    expect(postRes.status).toBe(201);
    const postData = await postRes.json();
    expect(postData.success).toBe(true);
    expect(postData.reminder.title).toBe('REST API Test Reminder');

    // List reminders
    const getRes = await fetch(`${baseUrl}/api/reminders`);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.success).toBe(true);
    expect(getData.reminders.some((r: any) => r.title === 'REST API Test Reminder')).toBe(true);
  });

  it('POST /api/auth/register and /login handles user authentication', async () => {
    const testEmail = `test_${Date.now()}@example.com`;
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Agent User',
        email: testEmail,
        password: 'password123',
      }),
    });

    expect(regRes.status).toBe(201);
    const regData = await regRes.json();
    expect(regData.token).toBeDefined();
    expect(regData.user.email).toBe(testEmail);

    // Login with same credentials
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'password123',
      }),
    });

    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.token).toBeDefined();
  });
});
