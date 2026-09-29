import { ScheduledTask, IScheduledTask } from "../models/scheduled-task.model";
import {
  parseNaturalScheduleToCron,
  calculateNextRun,
} from "../utils/cron.util";
import { queueService } from "./queue.service";
import { socketService } from "./socket.service";
import { logger } from "../utils/logger";

export class SchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  public async createSchedule(input: {
    userId: string;
    prompt: string;
    schedule: string;
    timezone?: string;
  }): Promise<IScheduledTask> {
    const timezone = input.timezone || "UTC";
    const cronExpression = parseNaturalScheduleToCron(input.schedule);
    const nextRunAt = calculateNextRun(cronExpression, timezone);

    const task = await ScheduledTask.create({
      userId: input.userId,
      prompt: input.prompt.trim(),
      cronExpression,
      timezone,
      enabled: true,
      active: true,
      nextRunAt,
      runCount: 0,
    });

    logger.info(
      {
        scheduleId: task.id,
        userId: input.userId,
        cron: cronExpression,
        nextRunAt,
      },
      "Scheduled recurring agent automation",
    );

    return task;
  }

  public async listSchedules(
    userId: string,
    enabledOnly = false,
  ): Promise<IScheduledTask[]> {
    const filter: Record<string, unknown> = { userId };
    if (enabledOnly) {
      filter.enabled = true;
      filter.active = { $ne: false };
    }

    return ScheduledTask.find(filter).sort({ createdAt: -1 });
  }

  public async toggleSchedule(
    userId: string,
    scheduleId: string,
    enabled: boolean,
  ): Promise<IScheduledTask | null> {
    const task = await ScheduledTask.findOne({ _id: scheduleId, userId });
    if (!task) return null;

    task.enabled = enabled;
    task.active = enabled;
    if (enabled) {
      task.nextRunAt = calculateNextRun(task.cronExpression, task.timezone);
    }
    await task.save();
    return task;
  }

  public async deactivateSchedule(
    userId: string,
    scheduleId: string,
  ): Promise<IScheduledTask | null> {
    return this.toggleSchedule(userId, scheduleId, false);
  }

  public async deleteSchedule(
    userId: string,
    scheduleId: string,
  ): Promise<boolean> {
    const res = await ScheduledTask.findOneAndDelete({
      _id: scheduleId,
      userId,
    });
    return !!res;
  }

  /**
   * Evaluates and dispatches any scheduled tasks that are currently due.
   */
  public async tick(): Promise<number> {
    const now = new Date();
    const dueTasks = await ScheduledTask.find({
      enabled: true,
      active: { $ne: false },
      nextRunAt: { $lte: now },
    });

    if (dueTasks.length === 0) return 0;

    logger.info(
      { count: dueTasks.length },
      "Processing due scheduled automations",
    );

    for (const task of dueTasks) {
      try {
        const nextRunAt = calculateNextRun(
          task.cronExpression,
          task.timezone,
          now,
        );
        task.lastRunAt = now;
        task.nextRunAt = nextRunAt;
        task.runCount += 1;
        await task.save();

        logger.info(
          { scheduleId: task.id, prompt: task.prompt, nextRunAt },
          "Dispatching scheduled agent run to background queue",
        );

        queueService.enqueue({
          userId: task.userId,
          goal: task.prompt,
          metadata: {
            scheduleId: task.id,
            cron: task.cronExpression,
            triggeredAt: now.toISOString(),
          },
        });

        socketService.emitEvent(task.userId, task.id, "schedule:triggered", {
          scheduleId: task.id,
          prompt: task.prompt,
          nextRunAt,
        });
      } catch (err: any) {
        logger.error(
          { scheduleId: task.id, error: err.message },
          "Failed triggering scheduled task",
        );
      }
    }

    return dueTasks.length;
  }

  public start(intervalMs = 30000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info(
      "SchedulerWorker started. Polling every 30s for due automations.",
    );

    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        logger.error({ error: err.message }, "Scheduler tick failed");
      });
    }, intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info("SchedulerWorker stopped.");
  }
}

export const schedulerService = new SchedulerService();
