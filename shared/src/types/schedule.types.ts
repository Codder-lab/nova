export interface ScheduledTaskItem {
  id: string;
  userId: string;
  prompt: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  active: boolean;
  nextRunAt: Date | string;
  lastRunAt?: Date | string;
  runCount: number;
  metadata?: Record<string, unknown>;
  createdAt: Date | string;
  updatedAt: Date | string;
}
