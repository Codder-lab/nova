import mongoose from "mongoose";
import { z } from "zod";
import { AgentTool, ToolContext } from "../base/agent-tool.interface";
import { Task } from "../../models/task.model";

function buildTaskFilter(
  taskIdOrTitle: string,
  userId: string,
): Record<string, unknown> {
  if (mongoose.isValidObjectId(taskIdOrTitle)) {
    return { _id: taskIdOrTitle, userId };
  }
  const escaped = taskIdOrTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return {
    userId,
    title: { $regex: new RegExp(escaped, "i") },
  };
}

export const createTaskTool: AgentTool = {
  name: "create_task",
  description:
    'Creates a static to-do list item for the user to manually track (e.g. "Buy groceries", "Finish essay"). NOTE: If the user asks to schedule an automated task or background job to run at a specific time or recurring interval, use "create_schedule" instead.',
  riskLevel: "LOW",
  inputSchema: z.object({
    title: z.string().min(1).describe("The concise title of the task"),
    description: z
      .string()
      .optional()
      .describe("Optional detailed notes or description of the task"),
    priority: z
      .enum(["low", "medium", "high", "urgent"])
      .optional()
      .default("medium")
      .describe("Priority level"),
    dueDate: z
      .string()
      .optional()
      .describe(
        "Optional due date in ISO 8601 format (e.g. 2026-10-01T15:00:00Z) or YYYY-MM-DD",
      ),
    tags: z
      .array(z.string())
      .optional()
      .default([])
      .describe("Optional tags for categorization"),
  }),
  async execute(input, context: ToolContext) {
    const userId = context.userId || "anonymous";
    const dueDate = input.dueDate ? new Date(input.dueDate) : undefined;

    const task = await Task.create({
      userId,
      title: input.title,
      description: input.description,
      priority: input.priority || "medium",
      dueDate,
      tags: input.tags || [],
      status: "todo",
    });

    return {
      success: true,
      message: `Task "${task.title}" created successfully.`,
      task: task.toJSON(),
    };
  },
};

export const listTasksTool: AgentTool = {
  name: "list_tasks",
  description:
    'Lists static to-do items from the user\'s manual to-do list. NOTE: To view scheduled background automations or recurring jobs, use "list_schedules" instead.',
  riskLevel: "READ",
  inputSchema: z.object({
    status: z
      .enum(["todo", "in_progress", "completed", "cancelled", "all"])
      .optional()
      .default("all")
      .describe("Filter by status"),
    priority: z
      .enum(["low", "medium", "high", "urgent"])
      .optional()
      .describe("Filter by priority"),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .describe("Maximum number of tasks to retrieve"),
  }),
  async execute(input, context: ToolContext) {
    const userId = context.userId || "anonymous";
    const query: Record<string, unknown> = { userId };

    if (input.status && input.status !== "all") {
      query.status = input.status;
    }
    if (input.priority) {
      query.priority = input.priority;
    }

    const tasks = await Task.find(query)
      .sort({ createdAt: -1 })
      .limit(input.limit || 20);

    return {
      count: tasks.length,
      tasks: tasks.map((t) => t.toJSON()),
    };
  },
};

export const updateTaskTool: AgentTool = {
  name: "update_task",
  description:
    "Updates an existing task by its ID or title (change title, description, status, priority, dueDate, or tags).",
  riskLevel: "LOW",
  inputSchema: z.object({
    taskId: z
      .string()
      .describe("The database ID or title of the task to update"),
    title: z.string().optional().describe("New title for the task"),
    description: z.string().optional().describe("New description"),
    status: z
      .enum(["todo", "in_progress", "completed", "cancelled"])
      .optional()
      .describe("New status"),
    priority: z
      .enum(["low", "medium", "high", "urgent"])
      .optional()
      .describe("New priority"),
    dueDate: z.string().optional().describe("New due date in ISO 8601 format"),
    tags: z.array(z.string()).optional().describe("New list of tags"),
  }),
  async execute(input, context: ToolContext) {
    const userId = context.userId || "anonymous";
    const updateData: Record<string, unknown> = {};

    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined)
      updateData.description = input.description;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.dueDate !== undefined)
      updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.tags !== undefined) updateData.tags = input.tags;

    const filter = buildTaskFilter(input.taskId, userId);
    const task = await Task.findOneAndUpdate(
      filter,
      { $set: updateData },
      { new: true },
    );

    if (!task) {
      return {
        success: false,
        error: `Task matching "${input.taskId}" not found.`,
      };
    }

    return {
      success: true,
      message: `Task "${task.title}" updated successfully.`,
      task: task.toJSON(),
    };
  },
};

export const completeTaskTool: AgentTool = {
  name: "complete_task",
  description: "Marks a task as completed by either its ID or its title.",
  riskLevel: "LOW",
  inputSchema: z.object({
    taskId: z
      .string()
      .describe(
        'The database ID or title of the task to mark as completed (e.g. "Prepare Q3 Financial Audit" or an ID)',
      ),
  }),
  async execute(input, context: ToolContext) {
    const userId = context.userId || "anonymous";
    const filter = buildTaskFilter(input.taskId, userId);
    const task = await Task.findOneAndUpdate(
      filter,
      { $set: { status: "completed" } },
      { new: true },
    );

    if (!task) {
      return {
        success: false,
        error: `Task matching "${input.taskId}" not found.`,
      };
    }

    return {
      success: true,
      message: `Task "${task.title}" marked as completed.`,
      task: task.toJSON(),
    };
  },
};

export const deleteTaskTool: AgentTool = {
  name: "delete_task",
  description: "Permanently deletes a task by either its ID or title.",
  riskLevel: "MEDIUM",
  inputSchema: z.object({
    taskId: z
      .string()
      .describe("The database ID or title of the task to delete"),
  }),
  async execute(input, context: ToolContext) {
    const userId = context.userId || "anonymous";
    const filter = buildTaskFilter(input.taskId, userId);
    const task = await Task.findOneAndDelete(filter);

    if (!task) {
      return {
        success: false,
        error: `Task matching "${input.taskId}" not found.`,
      };
    }

    return {
      success: true,
      message: `Task "${task.title}" deleted successfully.`,
    };
  },
};
