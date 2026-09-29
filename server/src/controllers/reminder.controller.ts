import { Request, Response } from 'express';
import { z } from 'zod';
import { Reminder } from '../models/reminder.model';

const createReminderSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  remindAt: z.string().refine((val) => !isNaN(new Date(val).getTime()), {
    message: 'Valid ISO 8601 date string required for remindAt',
  }),
  description: z.string().optional(),
});

export async function listReminders(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId || 'anonymous';
    const { status, limit } = req.query;

    const query: Record<string, unknown> = { userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    const reminders = await Reminder.find(query)
      .sort({ remindAt: 1 })
      .limit(Number(limit) || 50);

    res.json({
      success: true,
      count: reminders.length,
      reminders: reminders.map((r) => r.toJSON()),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createReminder(req: Request, res: Response): Promise<void> {
  try {
    const parsed = createReminderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.errors });
      return;
    }

    const userId = req.user?.userId || 'anonymous';
    const { title, remindAt, description } = parsed.data;

    const reminder = await Reminder.create({
      userId,
      title,
      remindAt: new Date(remindAt),
      description,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Reminder created successfully',
      reminder: reminder.toJSON(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function cancelReminder(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId || 'anonymous';
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, userId },
      { $set: { status: 'cancelled' } },
      { new: true }
    );

    if (!reminder) {
      res.status(404).json({ success: false, error: 'Reminder not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Reminder cancelled successfully',
      reminder: reminder.toJSON(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteReminder(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId || 'anonymous';
    const reminder = await Reminder.findOneAndDelete({ _id: req.params.id, userId });

    if (!reminder) {
      res.status(404).json({ success: false, error: 'Reminder not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Reminder deleted successfully',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
