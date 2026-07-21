import type { Request, Response } from "express";
import mongoose from "mongoose";
import {
  Workflow,
  TRIGGER_NODE_EVENT_MAP,
  validateWorkflowGraph,
  type IWorkflowEdge,
  type IWorkflowNode,
  type WorkflowTriggerEvent,
} from "../models/workflow.model";
import { WorkflowRun } from "../models/workflow-run.model";
import { Form } from "../models/form.model";
import { resolveApproval } from "../services/workflow-engine.service";
import type { AuthenticatedRequest, OrganizationRequest } from "../middleware/auth.middleware";
import { frontendOrigin } from "../config/origins.config";

function sanitizeNodes(value: unknown): IWorkflowNode[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const node = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
    return {
      id: String(node.id ?? ""),
      type: String(node.type ?? "") as IWorkflowNode["type"],
      position: {
        x: Number(node.position?.x) || 0,
        y: Number(node.position?.y) || 0,
      },
      config:
        node.config && typeof node.config === "object" && !Array.isArray(node.config)
          ? node.config
          : {},
    };
  });
}

function sanitizeEdges(value: unknown): IWorkflowEdge[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const edge = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
    return {
      id: String(edge.id ?? ""),
      source: String(edge.source ?? ""),
      sourceHandle: edge.sourceHandle ? String(edge.sourceHandle) : null,
      target: String(edge.target ?? ""),
    };
  });
}

interface ResolvedTrigger {
  event: WorkflowTriggerEvent;
  formId: mongoose.Types.ObjectId | null;
}

/**
 * Derives the trigger descriptor from the validated trigger node, verifying
 * that a form trigger points at a real form in this organization.
 */
async function resolveTrigger(
  triggerNode: IWorkflowNode,
  organizationId: mongoose.Types.ObjectId | string
): Promise<{ trigger?: ResolvedTrigger; error?: string }> {
  const event = TRIGGER_NODE_EVENT_MAP[triggerNode.type];
  if (!event) return { error: "Unknown trigger node type" };

  if (triggerNode.type !== "trigger.form_submitted") {
    return { trigger: { event, formId: null } };
  }

  const formId = String(triggerNode.config?.formId ?? "").trim();
  if (!mongoose.Types.ObjectId.isValid(formId)) {
    return { error: "The selected form is invalid" };
  }
  const form = await Form.findOne({ _id: formId, organizationId }).select("_id").lean();
  if (!form) {
    return { error: "The selected form no longer exists in this organization" };
  }
  return { trigger: { event, formId: new mongoose.Types.ObjectId(formId) } };
}

export const listWorkflows = async (req: Request, res: Response): Promise<void> => {
  try {
    const organization = (req as OrganizationRequest).organization;

    const workflows = await Workflow.find({ organizationId: organization._id })
      .sort({ updatedAt: -1 })
      .lean();

    const workflowIds = workflows.map((workflow) => workflow._id);
    const lastRuns = workflowIds.length
      ? await WorkflowRun.aggregate([
          { $match: { workflowId: { $in: workflowIds } } },
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: "$workflowId",
              status: { $first: "$status" },
              startedAt: { $first: "$startedAt" },
              finishedAt: { $first: "$finishedAt" },
            },
          },
        ])
      : [];
    const lastRunByWorkflow = new Map(lastRuns.map((run) => [String(run._id), run]));

    res.json({
      workflows: workflows.map((workflow) => ({
        ...workflow,
        lastRun: lastRunByWorkflow.get(String(workflow._id)) ?? null,
      })),
    });
  } catch (err) {
    console.error("Error listing workflows:", err);
    res.status(500).json({ error: "Failed to fetch workflows" });
  }
};

export const getWorkflow = async (req: Request, res: Response): Promise<void> => {
  try {
    const organization = (req as OrganizationRequest).organization;
    const workflow = await Workflow.findOne({
      _id: req.params.id,
      organizationId: organization._id,
    }).lean();

    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    res.json(workflow);
  } catch (err) {
    console.error("Error fetching workflow:", err);
    res.status(500).json({ error: "Failed to fetch workflow" });
  }
};

export const createWorkflow = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const name = String(req.body?.name ?? "").trim() || "Untitled Workflow";
    const nodes = sanitizeNodes(req.body?.nodes);
    const edges = sanitizeEdges(req.body?.edges);

    const validation = validateWorkflowGraph(nodes, edges);
    if (!validation.valid || !validation.triggerNode) {
      res.status(400).json({ error: validation.error ?? "Invalid workflow graph" });
      return;
    }

    const { trigger, error } = await resolveTrigger(validation.triggerNode, organization._id);
    if (!trigger) {
      res.status(400).json({ error: error ?? "Invalid trigger" });
      return;
    }

    const workflow = await Workflow.create({
      organizationId: organization._id,
      name,
      enabled: false,
      trigger,
      nodes,
      edges,
      createdBy: authReq.user.id,
    });

    res.status(201).json(workflow);
  } catch (err) {
    console.error("Error creating workflow:", err);
    res.status(500).json({ error: "Failed to create workflow" });
  }
};

export const updateWorkflow = async (req: Request, res: Response): Promise<void> => {
  try {
    const organization = (req as OrganizationRequest).organization;
    const workflow = await Workflow.findOne({
      _id: req.params.id,
      organizationId: organization._id,
    });

    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    if (typeof req.body?.name === "string" && req.body.name.trim()) {
      workflow.name = req.body.name.trim();
    }

    if (req.body?.nodes !== undefined || req.body?.edges !== undefined) {
      const nodes = req.body?.nodes !== undefined ? sanitizeNodes(req.body.nodes) : workflow.nodes;
      const edges = req.body?.edges !== undefined ? sanitizeEdges(req.body.edges) : workflow.edges;

      const validation = validateWorkflowGraph(nodes, edges);
      if (!validation.valid || !validation.triggerNode) {
        res.status(400).json({ error: validation.error ?? "Invalid workflow graph" });
        return;
      }

      const { trigger, error } = await resolveTrigger(validation.triggerNode, organization._id);
      if (!trigger) {
        res.status(400).json({ error: error ?? "Invalid trigger" });
        return;
      }

      workflow.nodes = nodes;
      workflow.edges = edges;
      workflow.trigger = trigger;
    }

    await workflow.save();
    res.json(workflow);
  } catch (err) {
    console.error("Error updating workflow:", err);
    res.status(500).json({ error: "Failed to update workflow" });
  }
};

export const setWorkflowEnabled = async (req: Request, res: Response): Promise<void> => {
  try {
    const organization = (req as OrganizationRequest).organization;
    const enabled = req.body?.enabled === true;

    const workflow = await Workflow.findOne({
      _id: req.params.id,
      organizationId: organization._id,
    });

    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    if (enabled) {
      const validation = validateWorkflowGraph(workflow.nodes, workflow.edges);
      if (!validation.valid) {
        res.status(400).json({
          error: `Cannot enable workflow: ${validation.error ?? "invalid graph"}`,
        });
        return;
      }
    }

    workflow.enabled = enabled;
    await workflow.save();
    res.json(workflow);
  } catch (err) {
    console.error("Error toggling workflow:", err);
    res.status(500).json({ error: "Failed to update workflow" });
  }
};

export const deleteWorkflow = async (req: Request, res: Response): Promise<void> => {
  try {
    const organization = (req as OrganizationRequest).organization;
    const workflow = await Workflow.findOneAndDelete({
      _id: req.params.id,
      organizationId: organization._id,
    });

    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    res.json({ message: "Workflow deleted" });
  } catch (err) {
    console.error("Error deleting workflow:", err);
    res.status(500).json({ error: "Failed to delete workflow" });
  }
};

export const listWorkflowRuns = async (req: Request, res: Response): Promise<void> => {
  try {
    const organization = (req as OrganizationRequest).organization;
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const runs = await WorkflowRun.find({
      workflowId: req.params.id,
      organizationId: organization._id,
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("rfqId", "customer quoteNumber workflowStatus")
      .populate("formId", "title slug")
      .lean();

    res.json({ runs });
  } catch (err) {
    console.error("Error listing workflow runs:", err);
    res.status(500).json({ error: "Failed to fetch workflow runs" });
  }
};

function approvalResultPage(title: string, message: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} - Inboundr</title>
<style>
  body { margin: 0; font-family: Inter, -apple-system, "Segoe UI", sans-serif; background: #f5f5f3; color: #171717; display: flex; min-height: 100vh; align-items: center; justify-content: center; }
  .card { background: #ffffff; border-radius: 12px; padding: 48px 40px; max-width: 420px; margin: 24px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  h1 { font-size: 22px; margin: 0 0 12px; }
  p { font-size: 15px; line-height: 22px; color: #454541; margin: 0 0 24px; }
  a { display: inline-block; background: #171717; color: #ffffff; text-decoration: none; border-radius: 8px; padding: 12px 24px; font-size: 14px; }
</style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="${frontendOrigin}">Open Inboundr</a>
  </div>
</body>
</html>`;
}

export const handleApprovalDecision = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = String(req.params.token ?? "");
    const decisionParam = String(req.params.decision ?? "");
    const decision =
      decisionParam === "approve" ? "approved" : decisionParam === "reject" ? "rejected" : null;

    if (!decision) {
      res.status(404).send(approvalResultPage("Link Not Found", "This approval link is invalid."));
      return;
    }

    const result = await resolveApproval(token, decision);

    if (result.status === "resolved") {
      res.send(
        approvalResultPage(
          decision === "approved" ? "Approved" : "Rejected",
          `Your decision has been recorded and the "${result.workflowName}" workflow will continue accordingly.`
        )
      );
      return;
    }

    if (result.status === "already_decided") {
      res.send(
        approvalResultPage(
          "Already Decided",
          "This approval request has already been answered. No further action is needed."
        )
      );
      return;
    }

    if (result.status === "expired") {
      res.status(410).send(
        approvalResultPage("Link Expired", "This approval link has expired. Ask for a new request.")
      );
      return;
    }

    res.status(404).send(
      approvalResultPage("Link Not Found", "This approval link is invalid or no longer exists.")
    );
  } catch (err) {
    console.error("Error handling approval decision:", err);
    res.status(500).send(
      approvalResultPage("Something Went Wrong", "We could not record your decision. Try again.")
    );
  }
};
