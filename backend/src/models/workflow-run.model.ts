import mongoose, { Schema, type Document, type Types } from "mongoose";

export const WORKFLOW_RUN_STATUSES = [
  "running",
  "waiting_approval",
  "waiting_delay",
  "completed",
  "failed",
  "rejected",
] as const;
export type WorkflowRunStatus = (typeof WORKFLOW_RUN_STATUSES)[number];

export interface IWorkflowRunStep {
  nodeId: string;
  nodeType: string;
  status: "succeeded" | "failed" | "waiting";
  startedAt: Date;
  finishedAt: Date | null;
  output: string | null;
  error: string | null;
}

export interface IWorkflowRun extends Document {
  workflowId: Types.ObjectId;
  organizationId: Types.ObjectId;
  rfqId: Types.ObjectId | null;
  formId: Types.ObjectId | null;
  formSubmissionId: Types.ObjectId | null;
  status: WorkflowRunStatus;
  currentNodeId: string | null;
  steps: IWorkflowRunStep[];
  approvalToken: string | null;
  approvalTokenExpiresAt: Date | null;
  approvalDecision: "approved" | "rejected" | null;
  approvalDecidedAt: Date | null;
  resumeAt: Date | null;
  context: {
    triggerEvent: string;
    userId: string;
  };
  errorMessage: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const workflowRunStepSchema = new Schema<IWorkflowRunStep>(
  {
    nodeId: { type: String, required: true },
    nodeType: { type: String, required: true },
    status: {
      type: String,
      enum: ["succeeded", "failed", "waiting"],
      required: true,
    },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
    output: { type: String, default: null },
    error: { type: String, default: null },
  },
  { _id: false }
);

const workflowRunSchema = new Schema<IWorkflowRun>(
  {
    workflowId: {
      type: Schema.Types.ObjectId,
      ref: "Workflow",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    rfqId: {
      type: Schema.Types.ObjectId,
      ref: "RFQ",
      default: null,
      index: true,
    },
    formId: {
      type: Schema.Types.ObjectId,
      ref: "Form",
      default: null,
    },
    formSubmissionId: {
      type: Schema.Types.ObjectId,
      ref: "FormSubmission",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: WORKFLOW_RUN_STATUSES,
      default: "running",
      index: true,
    },
    currentNodeId: { type: String, default: null },
    steps: { type: [workflowRunStepSchema], default: [] },
    approvalToken: { type: String, default: null, index: true },
    approvalTokenExpiresAt: { type: Date, default: null },
    approvalDecision: {
      type: String,
      enum: ["approved", "rejected", null],
      default: null,
    },
    approvalDecidedAt: { type: Date, default: null },
    resumeAt: { type: Date, default: null },
    context: {
      triggerEvent: { type: String, required: true },
      userId: { type: String, required: true },
    },
    errorMessage: { type: String, default: null },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

workflowRunSchema.index({ workflowId: 1, createdAt: -1 });
workflowRunSchema.index({ status: 1, resumeAt: 1 });

export const WorkflowRun = mongoose.model<IWorkflowRun>(
  "WorkflowRun",
  workflowRunSchema
);
