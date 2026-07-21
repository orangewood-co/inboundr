import crypto from "node:crypto";
import type { Types } from "mongoose";
import { RFQ, type IRFQ } from "../models/rfq.model";
import type { IForm } from "../models/form.model";
import type { IFormSubmission } from "../models/form-submission.model";
import type { IWorkflow, IWorkflowNode } from "../models/workflow.model";
import { sendEmail } from "../lib/email";
import { WorkflowNotificationEmail } from "../emails/workflow-notification";
import { WorkflowApprovalEmail } from "../emails/workflow-approval";
import { createNotificationForRecipient } from "./notification.service";
import { apiOrigin, frontendOrigin } from "../config/origins.config";

export interface WorkflowNodeContext {
  workflow: IWorkflow;
  node: IWorkflowNode;
  runId: string;
  /** Present for RFQ-triggered runs. */
  rfq?: (IRFQ & { emailId?: { subject?: string; from?: string } | Types.ObjectId | null }) | null;
  /** Present for form-triggered runs. */
  form?: IForm | null;
  submission?: IFormSubmission | null;
  organizationId: string;
  organizationName: string;
  userId: string;
}

export type WorkflowNodePause =
  | { type: "approval"; token: string; expiresAt: Date }
  | { type: "delay"; resumeAt: Date };

export interface WorkflowNodeResult {
  output: string | null;
  pause?: WorkflowNodePause;
}

const APPROVAL_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function configString(config: Record<string, unknown>, key: string): string {
  const value = config?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function lookupPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (current && typeof current === "object") {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, source);
}

/** Replaces `{{path.to.value}}` placeholders with values from the context. */
export function interpolateTemplate(
  template: string,
  variables: Record<string, unknown>
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const value = lookupPath(variables, path);
    if (value == null) return "";
    return String(value);
  });
}

/** Turns a raw submission value into a human-readable string for templates. */
function formatSubmissionValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.map(formatSubmissionValue).filter(Boolean).join(", ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    const file = value as { originalName?: unknown };
    if (typeof file.originalName === "string") return file.originalName;
    return "";
  }
  return String(value);
}

export function buildTemplateVariables(context: WorkflowNodeContext): Record<string, unknown> {
  const variables: Record<string, unknown> = {
    workflow: {
      name: context.workflow.name,
    },
    organization: {
      name: context.organizationName,
    },
  };

  const { rfq, form, submission } = context;

  if (rfq) {
    const email =
      rfq.emailId && typeof rfq.emailId === "object" && "subject" in rfq.emailId
        ? rfq.emailId
        : null;
    const quotedProducts = (rfq.savedQuoteProducts ?? []).filter(
      (product) => product.lineStatus !== "regretted"
    );
    const quoteTotal = quotedProducts.reduce((sum, product) => {
      if (product.price == null) return sum;
      return sum + product.price * product.quantity;
    }, 0);

    variables.rfq = {
      id: String(rfq._id),
      subject: email?.subject ?? "",
      from: email?.from ?? "",
      status: rfq.workflowStatus,
      quoteNumber: rfq.quoteNumber ?? "",
      productCount: rfq.queryProducts?.length ?? 0,
      quotedProductCount: quotedProducts.length,
      quoteTotal: quoteTotal ? quoteTotal.toFixed(2) : "",
      link: `${frontendOrigin}/rfq?rfq=${String(rfq._id)}`,
      customer: {
        name: rfq.customer?.name ?? "",
        company: rfq.customer?.company ?? "",
        email: rfq.customer?.email ?? "",
      },
    };
  }

  if (form) {
    variables.form = {
      id: String(form._id),
      title: form.title,
      link: `${frontendOrigin}/forms/${form.slug}`,
    };
  }

  if (form && submission) {
    const submissionVars: Record<string, string> = {};
    for (const field of form.fields ?? []) {
      submissionVars[field.id] = formatSubmissionValue(submission.values?.[field.id]);
    }
    variables.submission = submissionVars;
  }

  return variables;
}

function parseRecipients(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((entry) => entry.trim())
    .filter((entry) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry));
}

async function executeSendEmail(context: WorkflowNodeContext): Promise<WorkflowNodeResult> {
  const config = context.node.config ?? {};
  const variables = buildTemplateVariables(context);
  const to = parseRecipients(interpolateTemplate(configString(config, "to"), variables));
  const subject = interpolateTemplate(configString(config, "subject"), variables);
  const body = interpolateTemplate(configString(config, "body"), variables);

  if (!to.length) throw new Error("Send email node has no valid recipient");
  if (!subject) throw new Error("Send email node has no subject");

  await sendEmail({
    to,
    subject,
    react: WorkflowNotificationEmail({
      subject,
      body,
      workflowName: context.workflow.name,
      organizationName: context.organizationName,
    }),
  });

  return { output: `Email sent to ${to.join(", ")}` };
}

async function executeRequestApproval(context: WorkflowNodeContext): Promise<WorkflowNodeResult> {
  const config = context.node.config ?? {};
  const variables = buildTemplateVariables(context);
  const to = parseRecipients(interpolateTemplate(configString(config, "to"), variables));
  const subject =
    interpolateTemplate(configString(config, "subject"), variables) ||
    `Approval needed: ${String(lookupPath(variables, "rfq.subject") ?? "RFQ")}`;
  const message =
    interpolateTemplate(configString(config, "message"), variables) ||
    "A workflow run is waiting for your decision.";

  if (!to.length) throw new Error("Approval node has no valid recipient");

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + APPROVAL_TOKEN_TTL_MS);

  await sendEmail({
    to,
    subject,
    react: WorkflowApprovalEmail({
      subject,
      message,
      approveUrl: `${apiOrigin}/api/v1/workflows/approval/${token}/approve`,
      rejectUrl: `${apiOrigin}/api/v1/workflows/approval/${token}/reject`,
      workflowName: context.workflow.name,
      organizationName: context.organizationName,
    }),
  });

  return {
    output: `Approval requested from ${to.join(", ")}`,
    pause: { type: "approval", token, expiresAt },
  };
}

async function executePlaceOrder(context: WorkflowNodeContext): Promise<WorkflowNodeResult> {
  if (!context.rfq) {
    throw new Error("Place Order can only run in an RFQ-triggered workflow");
  }
  const config = context.node.config ?? {};
  const variables = buildTemplateVariables(context);
  const configured = interpolateTemplate(configString(config, "quoteNumber"), variables);
  const quoteNumber =
    configured || `Q-${Date.now().toString(36).toUpperCase()}${crypto.randomInt(100, 999)}`;

  const updated = await RFQ.findOneAndUpdate(
    { _id: context.rfq._id, organizationId: context.organizationId },
    {
      $set: {
        quoteNumber,
        workflowStatus: "processed",
        processedAt: new Date(),
      },
    },
    { new: true }
  ).lean();

  if (!updated) throw new Error("RFQ not found while placing order");

  return { output: `Order placed with quote number ${quoteNumber}` };
}

async function executeArchiveRFQ(context: WorkflowNodeContext): Promise<WorkflowNodeResult> {
  if (!context.rfq) {
    throw new Error("Archive RFQ can only run in an RFQ-triggered workflow");
  }
  const updated = await RFQ.findOneAndUpdate(
    { _id: context.rfq._id, organizationId: context.organizationId },
    { $set: { isArchived: true } },
    { new: true }
  ).lean();

  if (!updated) throw new Error("RFQ not found while archiving");

  return { output: "RFQ archived" };
}

async function executeNotify(context: WorkflowNodeContext): Promise<WorkflowNodeResult> {
  const config = context.node.config ?? {};
  const variables = buildTemplateVariables(context);
  const title =
    interpolateTemplate(configString(config, "title"), variables) ||
    `Workflow "${context.workflow.name}" update`;
  const body = interpolateTemplate(configString(config, "body"), variables) || null;

  const actionUrl = context.rfq
    ? `/rfq?rfq=${String(context.rfq._id)}`
    : context.form
      ? `/forms/${context.form.slug}`
      : null;
  const entityId = context.rfq
    ? String(context.rfq._id)
    : context.submission
      ? String(context.submission._id)
      : context.runId;

  await createNotificationForRecipient({
    organizationId: context.organizationId,
    recipientUserId: context.userId,
    type: "workflow.notify",
    title,
    body,
    actionUrl,
    entityType: "workflow_run",
    entityId,
    metadata: { workflowId: String(context.workflow._id) },
    // One notification per run step, even if the step is ever re-executed.
    dedupeKey: `workflow-run:${context.runId}:${context.node.id}`,
  });

  return { output: `Notified ${context.userId}` };
}

const DELAY_UNIT_MS: Record<string, number> = {
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
};

async function executeDelay(context: WorkflowNodeContext): Promise<WorkflowNodeResult> {
  const config = context.node.config ?? {};
  const amount = Number(config.amount);
  const unit = configString(config, "unit") || "minutes";
  const unitMs = DELAY_UNIT_MS[unit];

  if (!Number.isFinite(amount) || amount <= 0 || !unitMs) {
    throw new Error("Delay node needs a positive amount and a valid unit");
  }

  const resumeAt = new Date(Date.now() + amount * unitMs);
  return {
    output: `Waiting ${amount} ${unit}`,
    pause: { type: "delay", resumeAt },
  };
}

type WorkflowNodeExecutor = (context: WorkflowNodeContext) => Promise<WorkflowNodeResult>;

export const WORKFLOW_NODE_EXECUTORS: Record<string, WorkflowNodeExecutor> = {
  "action.send_email": executeSendEmail,
  "action.request_approval": executeRequestApproval,
  "action.place_order": executePlaceOrder,
  "action.archive_rfq": executeArchiveRFQ,
  "action.notify": executeNotify,
  "logic.delay": executeDelay,
};
