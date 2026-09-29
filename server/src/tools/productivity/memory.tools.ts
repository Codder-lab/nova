import { z } from "zod";
import { AgentTool, ToolContext } from "../base/agent-tool.interface";
import { memoryService } from "../../services/memory.service";
import { MemoryCategory } from "@nova/shared";

export const saveMemoryTool: AgentTool = {
  name: "save_memory",
  description:
    "Saves facts, user preferences, instructions, or important context into the user's long-term semantic memory.",
  riskLevel: "LOW",
  inputSchema: z.object({
    content: z
      .string()
      .min(1)
      .describe("The concise fact, user preference, or note to remember"),
    category: z
      .enum(["preference", "fact", "instruction", "context", "general"])
      .optional()
      .default("general")
      .describe("Category of the memory"),
    tags: z
      .array(z.string())
      .optional()
      .default([])
      .describe("Optional tags for indexing and recall"),
    importance: z
      .number()
      .min(1)
      .max(10)
      .optional()
      .default(5)
      .describe("Importance rating from 1 to 10"),
  }),
  async execute(input, context: ToolContext) {
    const userId = context.userId || "anonymous";
    const memory = await memoryService.saveMemory({
      userId,
      content: input.content,
      category: input.category as MemoryCategory,
      tags: input.tags,
      importance: input.importance,
    });

    return {
      success: true,
      message: `Memory saved successfully under category "${memory.category}".`,
      memory: memory.toJSON(),
    };
  },
};

export const recallMemoryTool: AgentTool = {
  name: "recall_memory",
  description:
    "Searches long-term memory for previously remembered facts, preferences, or context by topic or keyword.",
  riskLevel: "READ",
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .describe("The topic, keyword, or concept to recall from memory"),
    category: z
      .enum(["preference", "fact", "instruction", "context", "general"])
      .optional()
      .describe("Optional filter by memory category"),
    limit: z
      .number()
      .min(1)
      .max(20)
      .optional()
      .default(5)
      .describe("Max memories to retrieve"),
  }),
  async execute(input, context: ToolContext) {
    const userId = context.userId || "anonymous";
    const memories = await memoryService.searchMemory(userId, input.query, {
      category: input.category as MemoryCategory,
      limit: input.limit || 5,
    });

    return {
      query: input.query,
      count: memories.length,
      memories: memories.map((m) => m.toJSON()),
    };
  },
};

export const listMemoriesTool: AgentTool = {
  name: "list_memories",
  description: "Lists all stored long-term memories for the current user.",
  riskLevel: "READ",
  inputSchema: z.object({
    category: z
      .enum(["preference", "fact", "instruction", "context", "general", "all"])
      .optional()
      .default("all")
      .describe("Category filter"),
    limit: z
      .number()
      .min(1)
      .max(50)
      .optional()
      .default(20)
      .describe("Max memories to return"),
  }),
  async execute(input, context: ToolContext) {
    const userId = context.userId || "anonymous";
    const category =
      input.category === "all" ? undefined : (input.category as MemoryCategory);
    const memories = await memoryService.listMemories(
      userId,
      category,
      input.limit || 20,
    );

    return {
      count: memories.length,
      memories: memories.map((m) => m.toJSON()),
    };
  },
};
