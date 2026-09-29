import mongoose from "mongoose";
import { z } from "zod";
import { AgentTool, ToolContext } from "../base/agent-tool.interface";
import { schedulerService } from "../../services/scheduler.service";
import { ScheduledTask } from "../../models/scheduled-task.model";
import { Task } from "../../models/task.model";

export const createScheduleTool: AgentTool = {
  name: "create_schedule",
  description:
    'Schedules an automated agent job to run in the background at a specific recurring time or interval (e.g. "daily at 3:30 PM", "every Monday at 10am", "every 2 hours").',
  riskLevel: "LOW",
  inputSchema: z.object({
    prompt: z
      .string()
      .min(1)
      .describe(
        "The goal or instruction the agent should execute on each schedule tick",
      ),
    schedule: z
      .string()
      .min(1)
      .describe(
        'Natural language schedule (e.g. "daily at 3:30 pm", "every 2 hours") or standard 5-part cron expression',
      ),
    timezone: z
      .string()
      .optional()
      .default("UTC")
      .describe('Timezone (e.g. "UTC", "America/New_York", "Asia/Kolkata")'),
  }),
  async execute(input, context: ToolContext) {
    const userId = context.userId || "anonymous";

    try {
      const scheduledTask = await schedulerService.createSchedule({
        userId,
        prompt: input.prompt,
        schedule: input.schedule,
        timezone: input.timezone,
      });

      return {
        success: true,
        message: `Recurring task scheduled successfully. Next execution at ${scheduledTask.nextRunAt.toISOString()}.`,
        task: scheduledTask.toJSON(),
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to schedule task: ${err.message}`,
      };
    }
  },
};

export const listSchedulesTool: AgentTool = {
  name: "list_schedules",
  description:
    "Lists all recurring background automations or scheduled jobs. Use when the user asks for scheduled tasks, jobs, or recurring automations.",
  riskLevel: "READ",
  inputSchema: z.object({
    enabledOnly: z
      .boolean()
      .optional()
      .default(false)
      .describe("Filter to only show active enabled schedules"),
  }),
  async execute(input, context: ToolContext) {
    const userId = context.userId || "anonymous";
    const schedules = await schedulerService.listSchedules(
      userId,
      input.enabledOnly,
    );

    return {
      count: schedules.length,
      schedules: schedules.map((s) => s.toJSON()),
    };
  },
};

export const cancelScheduleTool: AgentTool = {
  name: "cancel_schedule",
  description:
    "Cancels or deletes a recurring or scheduled automation by its ID, title, or keywords from its goal description.",
  riskLevel: "LOW",
  inputSchema: z.object({
    scheduleId: z
      .string()
      .describe(
        "The database ID, title, or keywords of the scheduled automation to cancel",
      ),
  }),
  async execute(input, context: ToolContext) {
    const userId = context.userId || "anonymous";

    // 1. Build regex matching keywords separated by spaces, underscores, or hyphens
    const cleanQuery = input.scheduleId.replace(/[_-]/g, " ").trim();
    const words = cleanQuery.split(/\s+/).filter((w: string) => w.length > 2);
    const regexPattern =
      words.length > 0
        ? words.map((w: string) => `(?=.*${w})`).join("")
        : cleanQuery;

    const scheduleFilter = mongoose.isValidObjectId(input.scheduleId)
      ? { _id: input.scheduleId, userId }
      : { userId, prompt: { $regex: new RegExp(regexPattern, "i") } };

    const task = await ScheduledTask.findOneAndUpdate(
      scheduleFilter,
      { $set: { active: false, enabled: false } },
      { new: true },
    );
    if (task) {
      return {
        success: true,
        message: `Schedule for "${task.prompt}" has been deactivated (active: false).`,
        task: task.toJSON(),
      };
    }

    // 2. Fallback: If it was saved in the manual Task collection
    const taskFilter = mongoose.isValidObjectId(input.scheduleId)
      ? { _id: input.scheduleId, userId }
      : { userId, title: { $regex: new RegExp(regexPattern, "i") } };

    const manualTask = await Task.findOneAndUpdate(
      taskFilter,
      { $set: { status: "cancelled" } },
      { new: true },
    );
    if (manualTask) {
      return {
        success: true,
        message: `Cancelled task "${manualTask.title}".`,
        task: manualTask.toJSON(),
      };
    }

    return {
      success: false,
      error: `Schedule matching "${input.scheduleId}" not found.`,
    };
  },
};
