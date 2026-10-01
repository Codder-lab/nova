import mongoose, { Schema } from "mongoose";
import { AgentRunStatus, AgentStep, PendingApprovalAction } from "@nova/shared";

export interface IAgentRun {
  id?: string;
  runId: string;
  userId: string;
  conversationId?: string;
  goal: string;
  status: AgentRunStatus;
  steps: AgentStep[];
  finalResponse?: string;
  error?: string;
  pendingApproval?: PendingApprovalAction;
  toolCallsCount: number;
  durationMs: number;
  provider?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  metadata?: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ToolCallRecordSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    arguments: { type: Schema.Types.Mixed, default: {} },
    result: { type: Schema.Types.Mixed },
    error: { type: String },
    durationMs: { type: Number },
    status: {
      type: String,
      enum: ["pending", "executing", "completed", "failed"],
      default: "pending",
    },
  },
  { _id: false },
);

const AgentStepSchema = new Schema(
  {
    id: { type: String, required: true },
    stepNumber: { type: Number, required: true },
    type: {
      type: String,
      enum: ["planning", "tool", "observation", "response"],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String },
    toolCall: { type: ToolCallRecordSchema },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { _id: false },
);

const PendingApprovalSchema = new Schema(
  {
    id: { type: String, required: true },
    toolName: { type: String, required: true },
    arguments: { type: Schema.Types.Mixed, default: {} },
    riskLevel: { type: String, required: true },
    explanation: { type: String },
    requestedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const AgentRunSchema = new Schema<IAgentRun>(
  {
    runId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    conversationId: { type: String, index: true },
    goal: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "queued",
        "planning",
        "running",
        "waiting_for_approval",
        "completed",
        "failed",
        "cancelled",
      ],
      default: "running",
      index: true,
    },
    steps: { type: [AgentStepSchema], default: [] },
    pendingApproval: { type: PendingApprovalSchema },
    finalResponse: { type: String },
    error: { type: String },
    toolCallsCount: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    provider: { type: String, default: "ollama", index: true },
    model: { type: String, default: "qwen2.5:7b", index: true },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
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

AgentRunSchema.index({ userId: 1, createdAt: -1 });

export const AgentRunModel = mongoose.model<IAgentRun>(
  "AgentRun",
  AgentRunSchema,
);
