import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Conversation, Message } from "../models/conversation.model";
import { logger } from "../utils/logger";

const createConversationSchema = z.object({
  title: z.string().trim().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateConversationSchema = z.object({
  title: z.string().trim().min(1, "Title cannot be empty").optional(),
  metadata: z.record(z.unknown()).optional(),
});

function getUserId(req: Request): string {
  return (
    req.user?.userId ||
    (req.headers["x-user-id"] as string) ||
    (req.query.userId as string) ||
    "cli-user"
  );
}

export async function listConversations(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const isAuthUser = Boolean(req.user?.userId);
    const userId = getUserId(req);
    const search = req.query.search as string;

    // Strict user segregation:
    // Authenticated users ONLY see their own chat sessions.
    // Unauthenticated/guest/CLI users only see guest/cli sessions.
    const query: Record<string, unknown> = isAuthUser
      ? { userId }
      : {
          userId: { $in: [userId, "cli-user", "anonymous-user", "anonymous"] },
        };

    if (search && search.trim()) {
      query.title = { $regex: search.trim(), $options: "i" };
    }

    const conversations = await Conversation.find(query)
      .sort({ updatedAt: -1 })
      .lean();

    const sessionsWithStats = await Promise.all(
      conversations.map(async (c: any) => {
        const id = c._id.toString();
        let messageCount = c.messageCount;
        let lastMessage = c.lastMessage;

        // If not cached on document, calculate on the fly
        if (messageCount === undefined || messageCount === null) {
          messageCount = await Message.countDocuments({ conversationId: id });
        }
        if (!lastMessage && messageCount > 0) {
          const last = await Message.findOne({ conversationId: id })
            .sort({ createdAt: -1 })
            .lean();
          if (last) {
            lastMessage =
              last.content ||
              (last.role === "assistant" ? "Agent responded" : "");
          }
        }

        return {
          id,
          userId: c.userId,
          title: c.title,
          lastMessage: lastMessage || "",
          messageCount: messageCount || 0,
          metadata: c.metadata || {},
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
      }),
    );

    res.json({
      success: true,
      count: sessionsWithStats.length,
      sessions: sessionsWithStats,
    });
  } catch (err: any) {
    logger.error({ error: err.message }, "Failed listing conversations");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function createConversation(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const parsed = createConversationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.errors });
      return;
    }

    const userId = getUserId(req);
    const title = parsed.data.title || "New Chat";
    const metadata = parsed.data.metadata || {};

    const conversation = await Conversation.create({
      userId,
      title,
      metadata,
      messageCount: 0,
      lastMessage: "",
    });

    res.status(201).json({
      success: true,
      session: conversation.toJSON(),
    });
  } catch (err: any) {
    logger.error({ error: err.message }, "Failed creating conversation");
    res.status(500).json({ success: false, error: err.message });
  }
}

function canAccessConversation(
  conversationUserId: string,
  currentUserId: string,
  isAuthUser: boolean,
): boolean {
  if (conversationUserId === currentUserId) return true;
  if (
    !isAuthUser &&
    ["cli-user", "anonymous-user", "anonymous"].includes(conversationUserId)
  ) {
    return true;
  }
  return false;
}

export async function getConversation(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res
        .status(400)
        .json({ success: false, error: "Invalid conversation ID format" });
      return;
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      res.status(404).json({ success: false, error: "Conversation not found" });
      return;
    }

    const userId = getUserId(req);
    const isAuthUser = Boolean(req.user?.userId);

    if (!canAccessConversation(conversation.userId, userId, isAuthUser)) {
      res.status(403).json({
        success: false,
        error:
          "Access denied: You do not have permission to view this conversation.",
      });
      return;
    }

    const messages = await Message.find({ conversationId: id })
      .sort({ createdAt: 1 })
      .lean();

    const formattedMessages = messages.map((m: any) => ({
      id: m._id.toString(),
      conversationId: m.conversationId,
      userId: m.userId,
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls || [],
      steps: m.steps || [],
      runId: m.runId,
      durationMs: m.durationMs,
      toolCallsCount: m.toolCallsCount,
      status: m.status,
      pendingApproval: m.pendingApproval,
      metadata: m.metadata || {},
      createdAt: m.createdAt,
    }));

    res.json({
      success: true,
      session: {
        ...conversation.toJSON(),
        messageCount: formattedMessages.length,
        lastMessage:
          formattedMessages[formattedMessages.length - 1]?.content ||
          conversation.lastMessage ||
          "",
      },
      messages: formattedMessages,
    });
  } catch (err: any) {
    logger.error({ error: err.message }, "Failed retrieving conversation");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateConversation(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res
        .status(400)
        .json({ success: false, error: "Invalid conversation ID format" });
      return;
    }

    const parsed = updateConversationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.errors });
      return;
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      res.status(404).json({ success: false, error: "Conversation not found" });
      return;
    }

    const userId = getUserId(req);
    const isAuthUser = Boolean(req.user?.userId);

    if (!canAccessConversation(conversation.userId, userId, isAuthUser)) {
      res.status(403).json({
        success: false,
        error:
          "Access denied: You do not have permission to update this conversation.",
      });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.metadata !== undefined)
      updateData.metadata = parsed.data.metadata;

    const updated = await Conversation.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true },
    );

    res.json({
      success: true,
      session: updated?.toJSON(),
    });
  } catch (err: any) {
    logger.error({ error: err.message }, "Failed updating conversation");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteConversation(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res
        .status(400)
        .json({ success: false, error: "Invalid conversation ID format" });
      return;
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      res.status(404).json({ success: false, error: "Conversation not found" });
      return;
    }

    const userId = getUserId(req);
    const isAuthUser = Boolean(req.user?.userId);

    if (!canAccessConversation(conversation.userId, userId, isAuthUser)) {
      res.status(403).json({
        success: false,
        error:
          "Access denied: You do not have permission to delete this conversation.",
      });
      return;
    }

    await Conversation.findByIdAndDelete(id);

    // Delete associated messages
    await Message.deleteMany({ conversationId: id });

    res.json({
      success: true,
      message: "Conversation and associated messages deleted successfully",
    });
  } catch (err: any) {
    logger.error({ error: err.message }, "Failed deleting conversation");
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function clearConversation(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res
        .status(400)
        .json({ success: false, error: "Invalid conversation ID format" });
      return;
    }

    const conv = await Conversation.findById(id);
    if (!conv) {
      res.status(404).json({ success: false, error: "Conversation not found" });
      return;
    }

    const userId = getUserId(req);
    const isAuthUser = Boolean(req.user?.userId);

    if (!canAccessConversation(conv.userId, userId, isAuthUser)) {
      res.status(403).json({
        success: false,
        error:
          "Access denied: You do not have permission to clear this conversation.",
      });
      return;
    }

    await Message.deleteMany({ conversationId: id });
    conv.messageCount = 0;
    conv.lastMessage = "";
    await conv.save();

    res.json({
      success: true,
      message: "Conversation messages cleared successfully",
    });
  } catch (err: any) {
    logger.error({ error: err.message }, "Failed clearing conversation");
    res.status(500).json({ success: false, error: err.message });
  }
}
