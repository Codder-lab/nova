import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectDB, disconnectDB } from '../db/connection';
import { memoryService } from '../services/memory.service';
import {
  saveMemoryTool,
  recallMemoryTool,
  listMemoriesTool,
} from '../tools/productivity/memory.tools';
import {
  createFileTool,
  readFileTool,
  listFilesTool,
} from '../tools/system/file.tools';
import { AgentEngine } from '../agents/agent.engine';
import { AgentRunModel } from '../models/agent-run.model';
import { LLMProvider } from '../llm/provider';
import { LLMResponse, LLMChunk } from '@nova/shared';
import { createApp } from '../app';
import { initializeDefaultTools } from '../tools';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';

class MockPhase3LLM implements LLMProvider {
  name = 'mock-phase3-llm';

  supportsToolCalling(): boolean {
    return true;
  }

  async generate(): Promise<LLMResponse> {
    return {
      content: 'I have successfully analyzed the goal and recorded it in memory.',
    };
  }

  async *stream(): AsyncGenerator<LLMChunk, void, unknown> {
    yield { contentChunk: 'I have successfully analyzed the goal and recorded it in memory.', isDone: true };
  }
}

describe('Phase 3: Multi-Tier Memory, Run Persistence & File Tools', () => {
  const testUserId = 'test-phase3-user';
  const testContext = { userId: testUserId };
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
    // Clean up test workspace
    try {
      await fs.rm(path.resolve(process.cwd(), 'workspaces', testUserId), { recursive: true, force: true });
    } catch {}
    await disconnectDB();
  });

  describe('MemoryService & Semantic Memory', () => {
    let memoryId: string;

    it('saves a memory item with tags and category', async () => {
      const memory = await memoryService.saveMemory({
        userId: testUserId,
        content: 'Prefers TypeScript over plain JavaScript for backend services.',
        category: 'preference',
        tags: ['typescript', 'coding', 'backend'],
        importance: 8,
      });

      expect(memory.id).toBeDefined();
      expect(memory.category).toBe('preference');
      expect(memory.importance).toBe(8);
      memoryId = memory.id;
    });

    it('searches memory by keyword and tags', async () => {
      const results = await memoryService.searchMemory(testUserId, 'TypeScript');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].content).toContain('TypeScript');
    });

    it('builds system prompt memory context string', async () => {
      const context = await memoryService.buildMemoryContext(testUserId, 'I need help writing backend code');
      expect(context).toContain('RELEVANT USER MEMORY & PREFERENCES');
      expect(context).toContain('PREFERENCE');
      expect(context).toContain('TypeScript');
    });

    it('deletes a memory item', async () => {
      const success = await memoryService.deleteMemory(testUserId, memoryId);
      expect(success).toBe(true);

      const check = await memoryService.searchMemory(testUserId, 'TypeScript');
      expect(check.some((m) => m.id === memoryId)).toBe(false);
    });
  });

  describe('Memory Tools (Agent Interface)', () => {
    it('saveMemoryTool saves a new user preference', async () => {
      const res = await saveMemoryTool.execute(
        {
          content: 'User prefers dark mode and minimal logging.',
          category: 'preference',
          tags: ['ui', 'theme'],
        },
        testContext
      );

      expect(res.success).toBe(true);
      expect(res.memory).toBeDefined();
      expect(res.memory.content).toContain('dark mode');
    });

    it('recallMemoryTool retrieves matching memory', async () => {
      const res = await recallMemoryTool.execute(
        { query: 'dark mode' },
        testContext
      );

      expect(res.count).toBeGreaterThanOrEqual(1);
      expect(res.memories[0].content).toContain('dark mode');
    });

    it('listMemoriesTool lists user memories', async () => {
      const res = await listMemoriesTool.execute({}, testContext);
      expect(res.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Scoped Workspace File Tools', () => {
    it('createFileTool creates file inside user workspace directory', async () => {
      const res = await createFileTool.execute(
        {
          filePath: 'notes/architecture.md',
          content: '# Nova Architecture\nMulti-tier memory is enabled.',
        },
        testContext
      );

      expect(res.success).toBe(true);
      expect(res.filePath).toBe('notes/architecture.md');
      expect(res.sizeBytes).toBeGreaterThan(0);
    });

    it('readFileTool reads back created file content', async () => {
      const res = await readFileTool.execute(
        { filePath: 'notes/architecture.md' },
        testContext
      );

      expect(res.success).toBe(true);
      expect(res.content).toContain('# Nova Architecture');
    });

    it('listFilesTool lists files within user workspace', async () => {
      const res = await listFilesTool.execute({ directoryPath: 'notes' }, testContext);
      expect(res.count).toBeGreaterThanOrEqual(1);
      expect(res.items.some((i: any) => i.name === 'architecture.md')).toBe(true);
    });

    it('blocks directory traversal attempts outside workspace', async () => {
      await expect(
        createFileTool.execute(
          { filePath: '../../outside.txt', content: 'malicious' },
          testContext
        )
      ).rejects.toThrow(/Access denied/);
    });
  });

  describe('AgentRun Persistence in MongoDB', () => {
    it('persists agent run execution timeline to MongoDB in real time', async () => {
      const engine = new AgentEngine({ llm: new MockPhase3LLM() });
      const result = await engine.run({
        userId: testUserId,
        goal: 'Synthesize research findings into a summary',
      });

      expect(result.status).toBe('completed');
      expect(result.runId).toBeDefined();

      // Query database for persisted run
      const savedRun = await AgentRunModel.findOne({ runId: result.runId });
      expect(savedRun).not.toBeNull();
      expect(savedRun!.userId).toBe(testUserId);
      expect(savedRun!.goal).toBe('Synthesize research findings into a summary');
      expect(savedRun!.status).toBe('completed');
      expect(savedRun!.steps.length).toBeGreaterThanOrEqual(2);
      expect(savedRun!.finalResponse).toContain('analyzed the goal');
      expect(savedRun!.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('REST API: GET /api/agent/runs lists persisted runs', async () => {
      const res = await fetch(`${baseUrl}/api/agent/runs`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.runs)).toBe(true);
    });
  });

  describe('Memory REST API', () => {
    let apiMemoryId: string;

    it('POST /api/memories creates a memory document', async () => {
      const res = await fetch(`${baseUrl}/api/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'User timezone is Asia/Kolkata (IST)',
          category: 'fact',
          tags: ['timezone', 'location'],
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.memory.content).toContain('Asia/Kolkata');
      apiMemoryId = data.memory.id;
    });

    it('GET /api/memories/search queries memory via REST', async () => {
      const res = await fetch(`${baseUrl}/api/memories/search?q=timezone`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.memories.some((m: any) => m.id === apiMemoryId)).toBe(true);
    });

    it('DELETE /api/memories/:id removes memory document', async () => {
      const res = await fetch(`${baseUrl}/api/memories/${apiMemoryId}`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});
