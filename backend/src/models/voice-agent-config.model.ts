import mongoose, { Schema, type Document } from "mongoose";

/** Per-organization configuration for the AI voice receptionist. */
export interface IVoiceAgentConfig extends Document {
  organizationId: mongoose.Types.ObjectId;
  enabled: boolean;
  businessName: string;
  greeting: string;
  businessInfo: string;
  extraInstructions: string;
  createdAt: Date;
  updatedAt: Date;
}

const voiceAgentConfigSchema = new Schema<IVoiceAgentConfig>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
      index: true,
    },
    enabled: { type: Boolean, default: true },
    businessName: { type: String, default: "", trim: true },
    greeting: { type: String, default: "", trim: true },
    businessInfo: { type: String, default: "" },
    extraInstructions: { type: String, default: "" },
  },
  { timestamps: true }
);

export const VoiceAgentConfig = mongoose.model<IVoiceAgentConfig>(
  "VoiceAgentConfig",
  voiceAgentConfigSchema
);
