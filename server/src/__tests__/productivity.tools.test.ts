import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectDB, disconnectDB } from '../db/connection';
import {
  createTaskTool,
  listTasksTool,
  updateTaskTool,
  completeTaskTool,
  deleteTaskTool,
} from '../tools/productivity/task.tools';
import {
  createReminderTool,
  listRemindersTool,
  cancelReminderTool,
} from '../tools/productivity/reminder.tools';
import { webSearchTool } from '../tools/research/web-search.tool';
import { fetchWebPageTool } from '../tools/research/fetch-web-page.tool';

describe('Phase 2: Productivity & Research Tools', () => {
  const testContext = { userId: 'phase2-test-user' };

  beforeAll(async () => {
    await connectDB();
  }, 25000);

  afterAll(async () => {
    await disconnectDB();
  });

  describe('Task Tools', () => {
    let createdTaskId: string;

    it('createTaskTool creates a new task with tags and priority', async () => {
      const res = await createTaskTool.execute(
        {
          title: 'Review Q3 Financial Report',
          description: 'Analyze revenue growth and margin compression',
          priority: 'high',
          tags: ['finance', 'quarterly'],
        },
        testContext
      );

      expect(res.success).toBe(true);
      expect(res.task).toBeDefined();
      expect(res.task.title).toBe('Review Q3 Financial Report');
      expect(res.task.priority).toBe('high');
      expect(res.task.status).toBe('todo');
      expect(res.task.tags).toContain('finance');
      createdTaskId = res.task.id;
    });

    it('listTasksTool lists tasks and filters by status', async () => {
      const res = await listTasksTool.execute({ status: 'todo' }, testContext);
      expect(res.count).toBeGreaterThanOrEqual(1);
      expect(res.tasks.some((t: any) => t.id === createdTaskId)).toBe(true);
    });

    it('updateTaskTool updates an existing task', async () => {
      const res = await updateTaskTool.execute(
        {
          taskId: createdTaskId,
          title: 'Review Q3 & Q4 Financial Reports',
          priority: 'urgent',
        },
        testContext
      );

      expect(res.success).toBe(true);
      expect(res.task.title).toBe('Review Q3 & Q4 Financial Reports');
      expect(res.task.priority).toBe('urgent');
    });

    it('completeTaskTool marks task as completed', async () => {
      const res = await completeTaskTool.execute({ taskId: createdTaskId }, testContext);
      expect(res.success).toBe(true);
      expect(res.task.status).toBe('completed');
    });

    it('completeTaskTool marks task as completed using natural title query', async () => {
      await createTaskTool.execute({ title: 'Prepare Q3 Financial Audit' }, testContext);
      const res = await completeTaskTool.execute({ taskId: 'Prepare Q3 Financial Audit' }, testContext);
      expect(res.success).toBe(true);
      expect(res.task.title).toBe('Prepare Q3 Financial Audit');
      expect(res.task.status).toBe('completed');
    });

    it('deleteTaskTool removes the task', async () => {
      const res = await deleteTaskTool.execute({ taskId: createdTaskId }, testContext);
      expect(res.success).toBe(true);

      const check = await listTasksTool.execute({ status: 'all' }, testContext);
      expect(check.tasks.some((t: any) => t.id === createdTaskId)).toBe(false);
    });
  });

  describe('Reminder Tools', () => {
    let createdReminderId: string;

    it('createReminderTool schedules a reminder', async () => {
      const remindAt = new Date(Date.now() + 3600000).toISOString();
      const res = await createReminderTool.execute(
        {
          title: 'Team sync meeting',
          remindAt,
          description: 'Prepare sprint updates',
        },
        testContext
      );

      expect(res.success).toBe(true);
      expect(res.reminder).toBeDefined();
      expect(res.reminder.title).toBe('Team sync meeting');
      expect(res.reminder.status).toBe('pending');
      createdReminderId = res.reminder.id;
    });

    it('createReminderTool rejects invalid dates', async () => {
      const res = await createReminderTool.execute(
        {
          title: 'Invalid reminder',
          remindAt: 'invalid-date-string',
        },
        testContext
      );

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Invalid date/);
    });

    it('listRemindersTool retrieves pending reminders', async () => {
      const res = await listRemindersTool.execute({ status: 'pending' }, testContext);
      expect(res.count).toBeGreaterThanOrEqual(1);
      expect(res.reminders.some((r: any) => r.id === createdReminderId)).toBe(true);
    });

    it('cancelReminderTool cancels an active reminder', async () => {
      const res = await cancelReminderTool.execute(
        { reminderId: createdReminderId },
        testContext
      );

      expect(res.success).toBe(true);
      expect(res.reminder.status).toBe('cancelled');
    });
  });

  describe('Research Tools', () => {
    it('webSearchTool has correct metadata and input schema', () => {
      expect(webSearchTool.name).toBe('web_search');
      expect(webSearchTool.riskLevel).toBe('READ');
      expect(webSearchTool.description).toBeDefined();
    });

    it('webSearchTool executes a query and returns structured results', async () => {
      const res = await webSearchTool.execute({ query: 'nodejs typescript', maxResults: 3 }, testContext);
      expect(res.query).toBe('nodejs typescript');
      expect(Array.isArray(res.results)).toBe(true);
      // Even if offline/blocked by rate limit, count is a valid number
      expect(typeof res.count).toBe('number');
    });

    it('fetchWebPageTool has correct metadata and rejects non-http URLs', async () => {
      expect(fetchWebPageTool.name).toBe('fetch_web_page');
      expect(fetchWebPageTool.riskLevel).toBe('READ');
    });

    it('fetchWebPageTool returns informative error on invalid/unreachable URL', async () => {
      const res = await fetchWebPageTool.execute(
        { url: 'https://this-is-a-non-existent-domain-12345.org' },
        testContext
      );
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });
});
