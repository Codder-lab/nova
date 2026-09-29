import mongoose, { Document, Schema } from "mongoose";
import { MemoryCategory } from "@nova/shared";

export interface IMemory extends Document {
  id: string;
  userId: string;
  content: string;
  category: MemoryCategory;
  tags: string[];
  importance: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const MemorySchema = new Schema<IMemory>(
  {
    userId: { type: String, required: true, index: true },
    content: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["preference", "fact", "instruction", "context", "general"],
      default: "general",
      index: true,
    },
    tags: { type: [String], default: [], index: true },
    importance: { type: Number, min: 1, max: 10, default: 5 },
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

// Indexes
MemorySchema.index({ userId: 1, category: 1 });
MemorySchema.index({ userId: 1, createdAt: -1 });
MemorySchema.index({ content: "text", tags: "text" });

export const Memory = mongoose.model<IMemory>("Memory", MemorySchema);
