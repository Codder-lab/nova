import mongoose from 'mongoose';
import { z } from 'zod';
import { AgentTool, ToolContext } from '../base/agent-tool.interface';
import { Reminder } from '../../models/reminder.model';

export const createReminderTool: AgentTool = {
  name: 'create_reminder',
  description: 'Creates a scheduled reminder for the user with a title, time (ISO 8601 format), and optional description.',
  riskLevel: 'LOW',
  inputSchema: z.object({
    title: z.string().min(1).describe('The reminder title or message'),
    remindAt: z.string().describe('Target date and time in ISO 8601 format (e.g., 2026-10-01T14:30:00Z)'),
    description: z.string().optional().describe('Additional notes or details'),
  }),
  async execute(input, context: ToolContext) {
    const userId = context.userId || 'anonymous';
    const remindAt = new Date(input.remindAt);

    if (isNaN(remindAt.getTime())) {
      return {
        success: false,
        error: `Invalid date format for remindAt: "${input.remindAt}". Please provide a valid ISO 8601 string.`,
      };
    }

    const reminder = await Reminder.create({
      userId,
      title: input.title,
      remindAt,
      description: input.description,
      status: 'pending',
    });

    return {
      success: true,
      message: `Reminder "${reminder.title}" scheduled for ${remindAt.toISOString()}.`,
      reminder: reminder.toJSON(),
    };
  },
};

export const listRemindersTool: AgentTool = {
  name: 'list_reminders',
  description: 'Lists the user\'s reminders, optionally filtered by status (pending, triggered, cancelled, all).',
  riskLevel: 'READ',
  inputSchema: z.object({
    status: z.enum(['pending', 'triggered', 'cancelled', 'all']).optional().default('pending').describe('Filter by reminder status'),
    limit: z.number().min(1).max(100).optional().default(20).describe('Maximum number of reminders to retrieve'),
  }),
  async execute(input, context: ToolContext) {
    const userId = context.userId || 'anonymous';
    const query: Record<string, unknown> = { userId };

    if (input.status && input.status !== 'all') {
      query.status = input.status;
    }

    const reminders = await Reminder.find(query)
      .sort({ remindAt: 1 })
      .limit(input.limit || 20);

    return {
      count: reminders.length,
      reminders: reminders.map((r) => r.toJSON()),
    };
  },
};

export const cancelReminderTool: AgentTool = {
  name: 'cancel_reminder',
  description: 'Cancels an existing reminder by its ID or title.',
  riskLevel: 'LOW',
  inputSchema: z.object({
    reminderId: z.string().describe('The database ID or title of the reminder to cancel'),
  }),
  async execute(input, context: ToolContext) {
    const userId = context.userId || 'anonymous';
    const filter: Record<string, unknown> = { userId };

    if (mongoose.isValidObjectId(input.reminderId)) {
      filter._id = input.reminderId;
    } else {
      const escaped = input.reminderId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.title = { $regex: new RegExp(escaped, 'i') };
    }

    const reminder = await Reminder.findOneAndUpdate(
      filter,
      { $set: { status: 'cancelled' } },
      { new: true }
    );

    if (!reminder) {
      return {
        success: false,
        error: `Reminder matching "${input.reminderId}" not found.`,
      };
    }

    return {
      success: true,
      message: `Reminder "${reminder.title}" cancelled successfully.`,
      reminder: reminder.toJSON(),
    };
  },
};
