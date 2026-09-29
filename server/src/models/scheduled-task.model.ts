import mongoose, { Document, Schema } from "mongoose";

export interface IScheduledTask extends Document {
  id: string;
  userId: string;
  prompt: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  active: boolean;
  nextRunAt: Date;
  lastRunAt?: Date;
  runCount: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduledTaskSchema = new Schema<IScheduledTask>(
  {
    userId: { type: String, required: true, index: true },
    prompt: { type: String, required: true, trim: true },
    cronExpression: { type: String, required: true },
    timezone: { type: String, default: "UTC" },
    enabled: { type: Boolean, default: true, index: true },
    active: { type: Boolean, default: true, index: true },
    nextRunAt: { type: Date, required: true, index: true },
    lastRunAt: { type: Date },
    runCount: { type: Number, default: 0 },
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

ScheduledTaskSchema.index({ enabled: 1, nextRunAt: 1 });
ScheduledTaskSchema.index({ userId: 1, createdAt: -1 });

export const ScheduledTask = mongoose.model<IScheduledTask>(
  "ScheduledTask",
  ScheduledTaskSchema,
);
