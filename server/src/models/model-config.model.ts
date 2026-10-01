import mongoose, { Document, Schema } from "mongoose";
import { ModelProviderType } from "@nova/shared";

export interface IModelConfig extends Document {
  userId: string;
  activeProvider: ModelProviderType;
  activeModel: string;
  apiKeys: {
    openai?: string;
    anthropic?: string;
    gemini?: string;
    groq?: string;
  };
  customBaseUrls: {
    ollama?: string;
    openai?: string;
    groq?: string;
  };
  temperature: number;
  maxTokens?: number;
  updatedAt: Date;
  createdAt: Date;
}

const ModelConfigSchema = new Schema<IModelConfig>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    activeProvider: {
      type: String,
      enum: ["ollama", "openai", "anthropic", "gemini", "groq"],
      default: "ollama",
    },
    activeModel: {
      type: String,
      default: "qwen2.5:7b",
    },
    apiKeys: {
      openai: { type: String, default: "" },
      anthropic: { type: String, default: "" },
      gemini: { type: String, default: "" },
      groq: { type: String, default: "" },
    },
    customBaseUrls: {
      ollama: { type: String, default: "http://localhost:11434" },
      openai: { type: String, default: "" },
      groq: { type: String, default: "" },
    },
    temperature: { type: Number, default: 0.1 },
    maxTokens: { type: Number, default: 4096 },
  },
  {
    timestamps: true,
  },
);

export const ModelConfigModel = mongoose.model<IModelConfig>(
  "ModelConfig",
  ModelConfigSchema,
);
