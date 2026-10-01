export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  lastMessage?: string;
  messageCount?: number;
  metadata?: Record<string, unknown>;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ChatMessageRecord {
  id: string;
  conversationId: string;
  userId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: unknown[];
  steps?: unknown[];
  runId?: string;
  durationMs?: number;
  toolCallsCount?: number;
  status?: string;
  pendingApproval?: unknown;
  metadata?: Record<string, unknown>;
  createdAt: string | Date;
}
