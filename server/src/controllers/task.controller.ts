import { Request, Response } from "express";
import { z } from "zod";
import { Task } from "../models/task.model";

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z
    .enum(["low", "medium", "high", "urgent"])
    .optional()
    .default("medium"),
  dueDate: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dueDate: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export async function listTasks(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId || "anonymous";
    const { status, priority, limit } = req.query;

    const query: Record<string, unknown> = { userId };
    if (status && status !== "all") {
      query.status = status;
    }
    if (priority) {
      query.priority = priority;
    }

    const tasks = await Task.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit) || 50);

    res.json({
      success: true,
      count: tasks.length,
      tasks: tasks.map((t) => t.toJSON()),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createTask(req: Request, res: Response): Promise<void> {
  try {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.errors });
      return;
    }

    const userId = req.user?.userId || "anonymous";
    const { title, description, priority, dueDate, tags } = parsed.data;

    const task = await Task.create({
      userId,
      title,
      description,
      priority,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      tags,
      status: "todo",
    });

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      task: task.toJSON(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getTaskById(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId || "anonymous";
    const task = await Task.findOne({ _id: req.params.id, userId });

    if (!task) {
      res.status(404).json({ success: false, error: "Task not found" });
      return;
    }

    res.json({ success: true, task: task.toJSON() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateTask(req: Request, res: Response): Promise<void> {
  try {
    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.errors });
      return;
    }

    const userId = req.user?.userId || "anonymous";
    const updateData: Record<string, unknown> = {};

    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.description !== undefined)
      updateData.description = parsed.data.description;
    if (parsed.data.status !== undefined)
      updateData.status = parsed.data.status;
    if (parsed.data.priority !== undefined)
      updateData.priority = parsed.data.priority;
    if (parsed.data.dueDate !== undefined) {
      updateData.dueDate = parsed.data.dueDate
        ? new Date(parsed.data.dueDate)
        : null;
    }
    if (parsed.data.tags !== undefined) updateData.tags = parsed.data.tags;

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId },
      { $set: updateData },
      { new: true },
    );

    if (!task) {
      res.status(404).json({ success: false, error: "Task not found" });
      return;
    }

    res.json({
      success: true,
      message: "Task updated successfully",
      task: task.toJSON(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteTask(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId || "anonymous";
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId });

    if (!task) {
      res.status(404).json({ success: false, error: "Task not found" });
      return;
    }

    res.json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
