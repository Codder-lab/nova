import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { AgentEngine } from "../agents/agent.engine";
import { getLLMProviderForUser } from "../llm";
import { globalToolRegistry } from "../tools/base/tool-registry";
import { Conversation, Message } from "../models/conversation.model";
import { logger } from "../utils/logger";
import { queueService } from "../services/queue.service";

const runAgentSchema = z.object({
  goal: z.string().min(1, "Goal is required"),
  conversationId: z.string().optional(),
  maxSteps: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
});

function getUserId(req: Request): string {
  return (
    req.user?.userId ||
    (req.headers["x-user-id"] as string) ||
    (req.query.userId as string) ||
    "cli-user"
  );
}

export async function runAgent(req: Request, res: Response): Promise<void> {
  const parseResult = runAgentSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "Validation failed",
      details: parseResult.error.format(),
    });
    return;
  }

  const userId = getUserId(req);
  const { goal, conversationId, maxSteps, timeoutMs, provider, model } =
    parseResult.data;
  const isDbConnected = mongoose.connection.readyState === 1;

  let activeSessionId = conversationId;

  // 1. Session Setup & Persistence
  if (isDbConnected) {
    try {
      if (activeSessionId && mongoose.Types.ObjectId.isValid(activeSessionId)) {
        const conv = await Conversation.findById(activeSessionId);
        if (conv) {
          const isOwner = conv.userId === userId;
          const isPublicGuestSession = [
            "cli-user",
            "anonymous-user",
            "anonymous",
          ].includes(conv.userId);
          if (!isOwner && !isPublicGuestSession) {
            res
              .status(403)
              .json({
                error: "Access denied: Conversation belongs to another user",
              });
            return;
          }

          // If title is default, update it with goal
          if (conv.title === "New Chat" || conv.title === "New Conversation") {
            conv.title = goal.length > 45 ? `${goal.slice(0, 42)}...` : goal;
            await conv.save();
          }
        } else {
          // Specified ID wasn't found; create new session with this ID or a new doc
          const newConv = await Conversation.create({
            _id: new mongoose.Types.ObjectId(activeSessionId),
            userId,
            title: goal.length > 45 ? `${goal.slice(0, 42)}...` : goal,
            messageCount: 0,
            lastMessage: goal,
          });
          activeSessionId = newConv._id.toString();
        }
      } else {
        // Auto-create new session
        const newConv = await Conversation.create({
          userId,
          title: goal.length > 45 ? `${goal.slice(0, 42)}...` : goal,
          messageCount: 0,
          lastMessage: goal,
        });
        activeSessionId = newConv._id.toString();
      }

      // Record the User's Message in MongoDB
      if (activeSessionId) {
        await Message.create({
          conversationId: activeSessionId,
          userId,
          role: "user",
          content: goal,
        });
      }
    } catch (dbErr: any) {
      logger.warn(
        { error: dbErr.message },
        "Error during initial session storage",
      );
    }
  }

  try {
    // Resolve provider & model per-request (override > user DB preference > env default)
    const llm = await getLLMProviderForUser(userId, { provider, model });
    const engine = new AgentEngine({ llm });
    const result = await engine.run({
      userId,
      goal,
      conversationId: activeSessionId,
      maxSteps,
      timeoutMs,
      provider: llm.name,
      model: llm.model,
    });

    // 2. Persist Assistant Response in Session
    if (isDbConnected && activeSessionId) {
      try {
        await Message.create({
          conversationId: activeSessionId,
          userId,
          role: "assistant",
          content: result.response,
          runId: result.runId,
          steps: result.steps,
          durationMs: result.durationMs,
          toolCallsCount: result.toolCallsCount,
          status: result.status,
          pendingApproval: result.pendingApproval,
          metadata: {
            provider: result.provider || llm.name,
            model: result.model || llm.model,
            promptTokens: result.promptTokens || 0,
            completionTokens: result.completionTokens || 0,
            totalTokens: result.totalTokens || 0,
          },
        });

        const totalMsgs = await Message.countDocuments({
          conversationId: activeSessionId,
        });
        await Conversation.findByIdAndUpdate(activeSessionId, {
          $set: {
            lastMessage: result.response || goal,
            messageCount: totalMsgs,
            updatedAt: new Date(),
          },
        });
      } catch (saveErr: any) {
        logger.warn(
          { error: saveErr.message },
          "Failed storing assistant message in session",
        );
      }
    }

    res.status(200).json({
      ...result,
      conversationId: activeSessionId,
    });
  } catch (error: any) {
    logger.error({ error: error.message }, "Agent controller execution failed");
    res
      .status(500)
      .json({ error: "Agent execution failed", details: error.message });
  }
}

export function enqueueJob(req: Request, res: Response): void {
  const parseResult = runAgentSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "Validation failed",
      details: parseResult.error.format(),
    });
    return;
  }

  const userId = getUserId(req);
  const { goal, conversationId } = parseResult.data;

  const job = queueService.enqueue({
    userId,
    goal,
    conversationId,
  });

  res.status(202).json({
    success: true,
    message: "Goal enqueued for background processing",
    job,
  });
}

export function listTools(_req: Request, res: Response): void {
  const tools = globalToolRegistry.getAll().map((tool) => ({
    name: tool.name,
    description: tool.description,
    riskLevel: tool.riskLevel,
  }));

  res.status(200).json({ tools });
}
