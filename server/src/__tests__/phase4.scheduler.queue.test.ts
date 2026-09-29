import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectDB, disconnectDB } from '../db/connection';
import { parseNaturalScheduleToCron, calculateNextRun } from '../utils/cron.util';
import { schedulerService } from '../services/scheduler.service';
import { queueService } from '../services/queue.service';
import {
  createScheduleTool,
  listSchedulesTool,
  cancelScheduleTool,
} from '../tools/productivity/scheduler.tools';
import { ScheduledTask } from '../models/scheduled-task.model';
import { createApp } from '../app';
import { initializeDefaultTools } from '../tools';
import http from 'http';

describe('Phase 4: Background Execution, Queues & Scheduled Automations', () => {
  const testUserId = 'test-phase4-user';
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
    schedulerService.stop();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await ScheduledTask.deleteMany({ userId: testUserId });
    await disconnectDB();
  });

  describe('Natural Language Cron Parser', () => {
    it('converts natural language schedules into valid cron expressions', () => {
      expect(parseNaturalScheduleToCron('every minute')).toBe('* * * * *');
      expect(parseNaturalScheduleToCron('every 10 minutes')).toBe('*/10 * * * *');
      expect(parseNaturalScheduleToCron('daily at 9am')).toBe('0 9 * * *');
      expect(parseNaturalScheduleToCron('daily at 2:30 pm')).toBe('30 14 * * *');
      expect(parseNaturalScheduleToCron('every Monday at 10am')).toBe('0 10 * * 1');
      expect(parseNaturalScheduleToCron('every weekday at 8am')).toBe('0 8 * * 1-5');
      expect(parseNaturalScheduleToCron('0 12 * * *')).toBe('0 12 * * *');
    });

    it('calculates the next valid execution date correctly', () => {
      const nextDate = calculateNextRun('0 9 * * *', 'UTC', new Date('2026-10-01T08:00:00Z'));
      expect(nextDate.toISOString()).toBe('2026-10-01T09:00:00.000Z');
    });

    it('throws informative error on unsupported schedule expressions', () => {
      expect(() => parseNaturalScheduleToCron('whenever you feel like it')).toThrow(
        /Unable to parse schedule/
      );
    });
  });

  describe('SchedulerService & Due Task Dispatching', () => {
    let createdScheduleId: string;

    it('creates a scheduled automation with calculated nextRunAt', async () => {
      const schedule = await schedulerService.createSchedule({
        userId: testUserId,
        prompt: 'Check stock prices and send daily digest',
        schedule: 'daily at 9am',
      });

      expect(schedule.id).toBeDefined();
      expect(schedule.cronExpression).toBe('0 9 * * *');
      expect(schedule.enabled).toBe(true);
      expect(schedule.nextRunAt.getTime()).toBeGreaterThan(Date.now());
      createdScheduleId = schedule.id;
    });

    it('lists schedules for user', async () => {
      const list = await schedulerService.listSchedules(testUserId);
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.some((s) => s.id === createdScheduleId)).toBe(true);
    });

    it('toggles schedule enabled status', async () => {
      const disabled = await schedulerService.toggleSchedule(testUserId, createdScheduleId, false);
      expect(disabled?.enabled).toBe(false);

      const enabled = await schedulerService.toggleSchedule(testUserId, createdScheduleId, true);
      expect(enabled?.enabled).toBe(true);
    });

    it('dispatches due tasks during tick() cycle', async () => {
      // Create a task due in the past
      const pastDue = await ScheduledTask.create({
        userId: testUserId,
        prompt: 'Generate weekly backup report',
        cronExpression: '* * * * *',
        nextRunAt: new Date(Date.now() - 10000),
        enabled: true,
      });

      const dispatchedCount = await schedulerService.tick();
      expect(dispatchedCount).toBeGreaterThanOrEqual(1);

      // Verify task's nextRunAt was updated into the future
      const updated = await ScheduledTask.findById(pastDue.id);
      expect(updated!.lastRunAt).toBeDefined();
      expect(updated!.runCount).toBeGreaterThanOrEqual(1);
      expect(updated!.nextRunAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('deletes a schedule', async () => {
      const deleted = await schedulerService.deleteSchedule(testUserId, createdScheduleId);
      expect(deleted).toBe(true);
    });
  });

  describe('QueueService Background Processing', () => {
    it('enqueues a background agent job and updates job status', () => {
      const job = queueService.enqueue({
        userId: testUserId,
        goal: 'Calculate 15 * 14',
      });

      expect(job.id).toBeDefined();
      expect(job.status === 'queued' || job.status === 'running').toBe(true);
    });
  });

  describe('Scheduler Tools (Agent Interface)', () => {
    let toolScheduleId: string;

    it('createScheduleTool creates recurring automation', async () => {
      const res = await createScheduleTool.execute(
        {
          prompt: 'Fetch latest server performance metrics',
          schedule: 'every 2 hours',
        },
        testContext
      );

      expect(res.success).toBe(true);
      expect(res.task).toBeDefined();
      expect(res.task.cronExpression).toBe('0 */2 * * *');
      toolScheduleId = res.task.id;
    });

    it('listSchedulesTool lists automations', async () => {
      const res = await listSchedulesTool.execute({}, testContext);
      expect(res.count).toBeGreaterThanOrEqual(1);
      expect(res.schedules.some((s: any) => s.id === toolScheduleId)).toBe(true);
    });

    it('cancelScheduleTool deactivates schedule by prompt title without deleting it', async () => {
      const res = await cancelScheduleTool.execute(
        { scheduleId: 'Fetch latest server performance metrics' },
        testContext
      );

      expect(res.success).toBe(true);
      expect(res.task.active).toBe(false);

      // Verify it still exists in the database with active: false
      const inDb = await ScheduledTask.findById(toolScheduleId);
      expect(inDb).not.toBeNull();
      expect(inDb!.active).toBe(false);
      expect(inDb!.enabled).toBe(false);

      // Verify active-only list does not include it
      const check = await listSchedulesTool.execute({ enabledOnly: true }, testContext);
      expect(check.schedules.some((s: any) => s.id === toolScheduleId)).toBe(false);
    });
  });

  describe('Schedules & Background Enqueue REST API', () => {
    let apiScheduleId: string;

    it('POST /api/schedules creates a recurring schedule via REST', async () => {
      const res = await fetch(`${baseUrl}/api/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Sync team calendar updates',
          schedule: 'daily at 8am',
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.schedule.cronExpression).toBe('0 8 * * *');
      apiScheduleId = data.schedule.id;
    });

    it('GET /api/schedules lists schedules via REST', async () => {
      const res = await fetch(`${baseUrl}/api/schedules`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.schedules.some((s: any) => s.id === apiScheduleId)).toBe(true);
    });

    it('PATCH /api/schedules/:id/toggle toggles status', async () => {
      const res = await fetch(`${baseUrl}/api/schedules/${apiScheduleId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.schedule.enabled).toBe(false);
    });

    it('POST /api/agent/enqueue submits asynchronous background job', async () => {
      const res = await fetch(`${baseUrl}/api/agent/enqueue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: 'Research latest cybersecurity vulnerabilities',
        }),
      });

      expect(res.status).toBe(202);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.job).toBeDefined();
      expect(data.job.id).toBeDefined();
    });

    it('DELETE /api/schedules/:id removes schedule', async () => {
      const res = await fetch(`${baseUrl}/api/schedules/${apiScheduleId}`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);
    });
  });
});
