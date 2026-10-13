import mongoose, { Document, Schema } from "mongoose";
import { BotTone } from "@nova/shared";

export interface UserBotPreferenceData {
  userId: string;
  botSlug: string;
  tone: BotTone;
  customInstructions: string;
  enabledTools: string[];
  temperature: number;
  routineSchedules: Record<string, { enabled: boolean; cron: string }>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserBotPreference extends Document, UserBotPreferenceData {
  id: string;
}

const UserBotPreferenceSchema = new Schema<IUserBotPreference>(
  {
    userId: { type: String, required: true, index: true },
    botSlug: { type: String, required: true, index: true },
    tone: {
      type: String,
      enum: ["concise", "friendly", "formal", "analytical", "default"],
      default: "default",
    },
    customInstructions: { type: String, maxlength: 1000, default: "" },
    enabledTools: { type: [String], default: [] },
    temperature: { type: Number, default: 0.2, min: 0, max: 1 },
    routineSchedules: { type: Schema.Types.Mixed, default: {} },
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

UserBotPreferenceSchema.index({ userId: 1, botSlug: 1 }, { unique: true });

export const UserBotPreferenceModel = mongoose.model<IUserBotPreference>(
  "UserBotPreference",
  UserBotPreferenceSchema,
);
