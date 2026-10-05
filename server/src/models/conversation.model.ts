import mongoose, { Document, Schema } from "mongoose";

export interface IConversation extends Document {
  id: string;
  userId: string;
  title: string;
  lastMessage?: string;
  messageCount?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessage extends Document {
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
  createdAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    userId: { type: String, required: true, index: true },
    title: {
      type: String,
      required: true,
      trim: true,
      default: "New Chat",
    },
    lastMessage: { type: String },
    messageCount: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id ? ret._id.toString() : undefined;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: {
      type: String,
      enum: ["user", "assistant", "system", "tool"],
      required: true,
    },
    content: { type: String, default: "" },
    toolCalls: { type: [Schema.Types.Mixed], default: [] },
    steps: { type: [Schema.Types.Mixed], default: [] },
    runId: { type: String },
    durationMs: { type: Number },
    toolCallsCount: { type: Number },
    status: { type: String },
    pendingApproval: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id ? ret._id.toString() : undefined;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

ConversationSchema.index({ userId: 1, updatedAt: -1 });
MessageSchema.index({ conversationId: 1, createdAt: 1 });

export const Conversation = mongoose.model<IConversation>(
  "Conversation",
  ConversationSchema,
);
export const Message = mongoose.model<IMessage>("Message", MessageSchema);
