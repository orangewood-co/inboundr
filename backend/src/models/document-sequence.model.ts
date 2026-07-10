import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IDocumentSequence extends Document {
  organizationId: Types.ObjectId;
  prefix: string;
  fiscalYear: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

const documentSequenceSchema = new Schema<IDocumentSequence>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    prefix: { type: String, required: true, trim: true, uppercase: true },
    fiscalYear: { type: String, required: true, trim: true },
    value: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

documentSequenceSchema.index({ organizationId: 1, prefix: 1, fiscalYear: 1 }, { unique: true });

export const DocumentSequence = mongoose.model<IDocumentSequence>("DocumentSequence", documentSequenceSchema);
