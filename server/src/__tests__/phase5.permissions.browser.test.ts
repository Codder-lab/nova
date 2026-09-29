import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import http from 'http';
import { connectDB, disconnectDB } from '../db/connection';
import { createApp } from '../app';
import { initializeDefaultTools, globalToolRegistry } from '../tools';
import { permissionEngine, PermissionEngine } from '../agents/agent.permissions';
import { AgentEngine } from '../agents/agent.engine';
import { setApprovalEngineFactory } from '../controllers/approval.controller';
import { AgentRunModel } from '../models/agent-run.model';
import { Task } from '../models/task.model';
import { LLMProvider } from '../llm/provider';
import { LLMRequest, LLMResponse, LLMChunk } from '@nova/shared';

class MockLLM implements LLMProvider {
  public name = 'mock-llm';
  public responses: LLMResponse[] = [];

  constructor(responses: LLMResponse[] = []) {
    this.responses = responses;
  }

  public supportsToolCalling(): boolean {
    return true;
  }

  public async generate(_request: LLMRequest): Promise<LLMResponse> {
    const next = this.responses.shift();
    if (!next) {
      return { content: 'LLM default response' };
    }
    return next;
  }

  public async *stream(_request: LLMRequest): AsyncIterable<LLMChunk> {
    yield { contentChunk: 'mock', isDone: true };
  }
}

describe('Phase 5: Permission Engine, Human-in-the-Loop & Browser Automation', () => {
  const testUserId = 'test-phase5-user';
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    initializeDefaultTools();
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    const app = createApp();
    server = app.listen(0);
    const address = server.address() as any;
    baseUrl = `http://localhost:${address.port}`;
  }, 25000);

  afterAll(async () => {
    setApprovalEngineFactory(() => new AgentEngine());
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await AgentRunModel.deleteMany({ userId: testUserId });
    await Task.deleteMany({ userId: testUserId });
    if (mongoose.connection.readyState === 1) {
      await disconnectDB();
    }
  }, 25000);

  describe('Permission Engine Policies & Risk Evaluation', () => {
    it('allows READ and LOW risk actions by default without approval', () => {
      expect(permissionEngine.requiresApproval('list_tasks', 'READ')).toBe(false);
      expect(permissionEngine.requiresApproval('web_search', 'READ')).toBe(false);
      expect(permissionEngine.requiresApproval('read_file', 'READ')).toBe(false);
      expect(permissionEngine.requiresApproval('create_task', 'LOW')).toBe(false);
      expect(permissionEngine.requiresApproval('create_file', 'LOW')).toBe(false);
    });

    it('requires approval for MEDIUM, HIGH, and CRITICAL actions by default', () => {
      expect(permissionEngine.requiresApproval('delete_task', 'MEDIUM')).toBe(true);
      expect(permissionEngine.requiresApproval('click_element', 'MEDIUM')).toBe(true);
      expect(permissionEngine.requiresApproval('type_into', 'MEDIUM')).toBe(true);
      expect(permissionEngine.requiresApproval('cancel_schedule', 'MEDIUM')).toBe(true);
      expect(permissionEngine.requiresApproval('danger_tool', 'HIGH')).toBe(true);
      expect(permissionEngine.requiresApproval('critical_tool', 'CRITICAL')).toBe(true);
    });

    it('respects alwaysRequireApprovalTools even if risk level is low', () => {
      const customEngine = new PermissionEngine({
        autoApproveThreshold: 'CRITICAL',
        alwaysRequireApprovalTools: ['read_file'],
      });
      expect(customEngine.requiresApproval('read_file', 'READ')).toBe(true);
    });

    it('respects alwaysApproveTools override even if risk level is high', () => {
      const customEngine = new PermissionEngine({
        autoApproveThreshold: 'LOW',
        alwaysApproveTools: ['delete_task'],
      });
      expect(customEngine.requiresApproval('delete_task', 'HIGH')).toBe(false);
    });

    it('generates clear, contextual risk explanations for human review', () => {
      const explanation = permissionEngine.getRiskExplanation('delete_task', 'MEDIUM', {
        taskId: 'task-12345',
      });
      expect(explanation).toContain('Permanently deleting a task');
      expect(explanation).toContain('task-12345');

      const clickExplanation = permissionEngine.getRiskExplanation('click_element', 'MEDIUM', {
        selector: '#checkout-btn',
      });
      expect(clickExplanation).toContain('Clicking interactive element');
      expect(clickExplanation).toContain('#checkout-btn');
    });
  });

  describe('Browser Automation Tools Registration & Metadata', () => {
    it('registers all 5 browser automation tools in the tool registry', () => {
      const expectedTools = [
        'open_browser',
        'navigate_to',
        'click_element',
        'type_into',
        'extract_page_content',
      ];

      for (const name of expectedTools) {
        const tool = globalToolRegistry.get(name);
        expect(tool).toBeDefined();
        expect(tool?.name).toBe(name);
        expect(tool?.description).toBeTruthy();
      }
    });

    it('enforces interactive browser actions have HIGH risk level', () => {
      const clickTool = globalToolRegistry.get('click_element');
      const typeTool = globalToolRegistry.get('type_into');
      const openTool = globalToolRegistry.get('open_browser');

      expect(clickTool?.riskLevel).toBe('HIGH');
      expect(typeTool?.riskLevel).toBe('HIGH');
      expect(openTool?.riskLevel).toBe('LOW');
    });

    it('validates browser tool inputs against Zod schema', () => {
      const navTool = globalToolRegistry.get('navigate_to')!;
      expect(navTool.inputSchema.safeParse({ url: 'https://example.com' }).success).toBe(true);
      expect(navTool.inputSchema.safeParse({ url: 'not-a-url' }).success).toBe(false);

      const typeTool = globalToolRegistry.get('type_into')!;
      expect(typeTool.inputSchema.safeParse({ selector: '#search', text: 'AI agents' }).success).toBe(true);
      expect(typeTool.inputSchema.safeParse({ selector: '#search' }).success).toBe(false);
    });
  });

  describe('Human-in-the-Loop Execution & Approval Endpoints', () => {
    it('suspends agent run when tool requires approval and resumes upon authorization', async () => {
      // 1. Create a dummy task to be deleted
      const task = await Task.create({
        userId: testUserId,
        title: 'Task to be safely removed',
        priority: 'medium',
        status: 'todo',
      });

      const taskId = (task._id as mongoose.Types.ObjectId).toString();

      // 2. Setup mock LLM:
      // First call: requests delete_task (which requires approval)
      // Second call (after resume): acknowledges deletion and provides final response
      const mockLLM = new MockLLM([
        {
          content: 'I need to delete the task.',
          toolCalls: [
            {
              id: 'call-delete-1',
              name: 'delete_task',
              arguments: { taskId },
            },
          ],
        },
        {
          content: 'Task has been deleted successfully after your authorization.',
        },
      ]);

      const engine = new AgentEngine({ llm: mockLLM, tools: globalToolRegistry });
      setApprovalEngineFactory(() => engine);

      // 3. Run the agent
      const runResult = await engine.run({
        userId: testUserId,
        goal: 'Delete the task safely',
      });

      // 4. Verify run was suspended into waiting_for_approval
      expect(runResult.status).toBe('waiting_for_approval');
      expect(runResult.pendingApproval).toBeDefined();
      expect(runResult.pendingApproval?.toolName).toBe('delete_task');
      expect(runResult.pendingApproval?.arguments).toEqual({ taskId });

      // Verify Atlas document state
      const dbRun = await AgentRunModel.findOne({ runId: runResult.runId });
      expect(dbRun?.status).toBe('waiting_for_approval');
      expect(dbRun?.pendingApproval?.toolName).toBe('delete_task');

      // 5. Test GET /api/agent/runs/:runId/pending-approval
      const pendingRes = await fetch(`${baseUrl}/api/agent/runs/${runResult.runId}/pending-approval`);
      const pendingJson = await pendingRes.json();
      expect(pendingJson.success).toBe(true);
      expect(pendingJson.waiting).toBe(true);
      expect(pendingJson.pendingApproval.toolName).toBe('delete_task');

      // 6. Test POST /api/agent/runs/:runId/approve
      const approveRes = await fetch(`${baseUrl}/api/agent/runs/${runResult.runId}/approve`, {
        method: 'POST',
      });
      const approveJson = await approveRes.json();
      expect(approveJson.success).toBe(true);
      expect(approveJson.result.status).toBe('completed');
      expect(approveJson.result.response).toContain('Task has been deleted successfully');

      // Verify task was deleted from database
      const deletedTask = await Task.findById(taskId);
      expect(deletedTask).toBeNull();

      // Verify run status in database is now completed
      const finalizedRun = await AgentRunModel.findOne({ runId: runResult.runId });
      expect(finalizedRun?.status).toBe('completed');
      expect(finalizedRun?.pendingApproval).toBeNull();
    }, 20000);

    it('rejects action and resumes execution cleanly when user rejects approval', async () => {
      // 1. Create a dummy task
      const task = await Task.create({
        userId: testUserId,
        title: 'Task that must NOT be deleted',
        priority: 'high',
        status: 'todo',
      });

      const taskId = (task._id as mongoose.Types.ObjectId).toString();

      // 2. Setup mock LLM:
      // First call: requests delete_task
      // Second call (after rejection): acknowledges denial gracefully
      const mockLLM = new MockLLM([
        {
          content: 'I will attempt to delete this task.',
          toolCalls: [
            {
              id: 'call-delete-2',
              name: 'delete_task',
              arguments: { taskId },
            },
          ],
        },
        {
          content: 'Understood, the task deletion was rejected and the task was kept intact.',
        },
      ]);

      const engine = new AgentEngine({ llm: mockLLM, tools: globalToolRegistry });
      setApprovalEngineFactory(() => engine);

      // 3. Run the agent
      const runResult = await engine.run({
        userId: testUserId,
        goal: 'Attempt task deletion',
      });

      expect(runResult.status).toBe('waiting_for_approval');

      // 4. Test POST /api/agent/runs/:runId/reject
      const rejectRes = await fetch(`${baseUrl}/api/agent/runs/${runResult.runId}/reject`, {
        method: 'POST',
      });
      const rejectJson = await rejectRes.json();
      expect(rejectJson.success).toBe(true);
      expect(rejectJson.result.status).toBe('completed');
      expect(rejectJson.result.response).toContain('rejected and the task was kept intact');

      // 5. Verify task was NOT deleted
      const preservedTask = await Task.findById(taskId);
      expect(preservedTask).not.toBeNull();
      expect(preservedTask?.title).toBe('Task that must NOT be deleted');
    }, 20000);
  });
});
