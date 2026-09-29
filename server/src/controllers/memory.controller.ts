import { Request, Response } from "express";
import { z } from "zod";
import { memoryService } from "../services/memory.service";
import { MemoryCategory } from "@nova/shared";

const createMemorySchema = z.object({
  content: z.string().min(1, "Content is required"),
  category: z
    .enum(["preference", "fact", "instruction", "context", "general"])
    .optional()
    .default("general"),
  tags: z.array(z.string()).optional().default([]),
  importance: z.number().min(1).max(10).optional().default(5),
});

export async function listMemories(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId || "anonymous";
    const { category, limit } = req.query;

    const memories = await memoryService.listMemories(
      userId,
      category as MemoryCategory,
      Number(limit) || 30,
    );

    res.json({
      success: true,
      count: memories.length,
      memories: memories.map((m) => m.toJSON()),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createMemory(req: Request, res: Response): Promise<void> {
  try {
    const parsed = createMemorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.errors });
      return;
    }

    const userId = req.user?.userId || "anonymous";
    const memory = await memoryService.saveMemory({
      userId,
      ...parsed.data,
    });

    res.status(201).json({
      success: true,
      message: "Memory saved successfully",
      memory: memory.toJSON(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function searchMemories(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.userId || "anonymous";
    const query = req.query.q as string;

    if (!query) {
      res
        .status(400)
        .json({ success: false, error: 'Query parameter "q" is required' });
      return;
    }

    const memories = await memoryService.searchMemory(userId, query, {
      category: req.query.category as MemoryCategory,
      limit: Number(req.query.limit) || 10,
    });

    res.json({
      success: true,
      query,
      count: memories.length,
      memories: memories.map((m) => m.toJSON()),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteMemory(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId || "anonymous";
    const deleted = await memoryService.deleteMemory(userId, req.params.id);

    if (!deleted) {
      res.status(404).json({ success: false, error: "Memory not found" });
      return;
    }

    res.json({
      success: true,
      message: "Memory deleted successfully",
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
