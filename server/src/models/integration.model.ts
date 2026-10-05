import mongoose, { Document, Schema } from "mongoose";
import {
  CustomAppConfig,
  IntegrationCategory,
} from "@nova/shared";
import { EncryptedPayload } from "../services/encryption.service";

export interface IIntegration extends Document {
  userId: string;
  connectorId: string;
  name: string;
  category: IntegrationCategory;
  enabled: boolean;
  status: "connected" | "error" | "unconfigured";
  lastTestedAt?: Date;
  errorMessage?: string;
  encryptedCredentials: EncryptedPayload;
  maskedCredentials: Record<string, string>;
  customConfig?: CustomAppConfig;
  createdAt: Date;
  updatedAt: Date;
}

const IntegrationSchema = new Schema<IIntegration>(
  {
    userId: { type: String, required: true, index: true },
    connectorId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    category: {
      type: String,
      enum: ["developer", "communication", "productivity", "custom"],
      default: "custom",
    },
    enabled: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["connected", "error", "unconfigured"],
      default: "unconfigured",
    },
    lastTestedAt: { type: Date },
    errorMessage: { type: String },
    encryptedCredentials: {
      cipherText: { type: String, default: "" },
      iv: { type: String, default: "" },
      tag: { type: String, default: "" },
    },
    maskedCredentials: {
      type: Map,
      of: String,
      default: {},
    },
    customConfig: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

IntegrationSchema.index({ userId: 1, connectorId: 1 }, { unique: true });

export const IntegrationModel = mongoose.model<IIntegration>(
  "Integration",
  IntegrationSchema
);
