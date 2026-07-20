import { registerDomainEventHandler, type RFQDomainEventPayload } from "../events/domain-events";
import {
  Workflow,
  WORKFLOW_TRIGGER_EVENTS,
  type IWorkflow,
  type IWorkflowNode,
  type WorkflowTriggerEvent,
} from "../models/workflow.model";
import { WorkflowRun, type IWorkflowRun } from "../models/workflow-run.model";
import { RFQ } from "../models/rfq.model";
import { Organization } from "../models/organization.model";
import {
  WORKFLOW_NODE_EXECUTORS,
  type WorkflowNodeContext,
} from "./workflow-nodes";

const MAX_STEPS_PER_RUN = 50;

function findNextNode(
  workflow: IWorkflow,
  fromNodeId: string,
  handle: string | null
): IWorkflowNode | null {
  const edge = workflow.edges.find((candidate) => {
    if (candidate.source !== fromNodeId) return false;
    if (handle == null) return true;
    return (candidate.sourceHandle ?? null) === handle;
  });
  if (!edge) return null;
  return workflow.nodes.find((node) => node.id === edge.target) ?? null;
}

async function loadNodeContext(
  workflow: IWorkflow,
  run: IWorkflowRun,
  node: IWorkflowNode
): Promise<WorkflowNodeContext | null> {
  const [rfq, organization] = await Promise.all([
    RFQ.findById(run.rfqId).populate("emailId", "subject from").lean(),
    Organization.findById(run.organizationId).select("name").lean(),
  ]);
  if (!rfq) return null;

  return {
    workflow,
    node,
    rfq: rfq as WorkflowNodeContext["rfq"],
    organizationId: String(run.organizationId),
    organizationName: organization?.name ?? "",
    userId: run.context.userId,
  };
}

async function failRun(run: IWorkflowRun, message: string): Promise<void> {
  run.status = "failed";
  run.errorMessage = message;
  run.finishedAt = new Date();
  await run.save();
}

/**
 * Walks the workflow graph starting at `node`, executing each node in
 * sequence until the run completes, pauses (approval/delay), or fails.
 */
async function executeFrom(
  workflow: IWorkflow,
  run: IWorkflowRun,
  node: IWorkflowNode | null
): Promise<void> {
  let next = node;

  while (next) {
    const current = next;

    if (run.steps.length >= MAX_STEPS_PER_RUN) {
      await failRun(run, "Run exceeded the maximum number of steps");
      return;
    }

    const executor = WORKFLOW_NODE_EXECUTORS[current.type];
    if (!executor) {
      await failRun(run, `No executor for node type ${current.type}`);
      return;
    }

    const context = await loadNodeContext(workflow, run, current);
    if (!context) {
      await failRun(run, "RFQ no longer exists");
      return;
    }

    const startedAt = new Date();
    run.currentNodeId = current.id;

    try {
      const result = await executor(context);

      if (result.pause) {
        run.steps.push({
          nodeId: current.id,
          nodeType: current.type,
          status: "waiting",
          startedAt,
          finishedAt: null,
          output: result.output,
          error: null,
        });

        if (result.pause.type === "approval") {
          run.status = "waiting_approval";
          run.approvalToken = result.pause.token;
          run.approvalTokenExpiresAt = result.pause.expiresAt;
        } else {
          run.status = "waiting_delay";
          run.resumeAt = result.pause.resumeAt;
        }
        await run.save();
        return;
      }

      run.steps.push({
        nodeId: current.id,
        nodeType: current.type,
        status: "succeeded",
        startedAt,
        finishedAt: new Date(),
        output: result.output,
        error: null,
      });
      await run.save();

      next = findNextNode(workflow, current.id, null);
    } catch (err: any) {
      run.steps.push({
        nodeId: current.id,
        nodeType: current.type,
        status: "failed",
        startedAt,
        finishedAt: new Date(),
        output: null,
        error: err?.message || "Unknown error",
      });
      await failRun(run, err?.message || "Node execution failed");
      return;
    }
  }

  run.status = "completed";
  run.currentNodeId = null;
  run.finishedAt = new Date();
  await run.save();
}

async function startWorkflowRun(
  workflow: IWorkflow,
  event: WorkflowTriggerEvent,
  payload: RFQDomainEventPayload
): Promise<void> {
  const triggerNode = workflow.nodes.find((node) => node.type.startsWith("trigger."));
  if (!triggerNode) return;

  const run = await WorkflowRun.create({
    workflowId: workflow._id,
    organizationId: workflow.organizationId,
    rfqId: payload.rfqId,
    status: "running",
    currentNodeId: triggerNode.id,
    steps: [
      {
        nodeId: triggerNode.id,
        nodeType: triggerNode.type,
        status: "succeeded",
        startedAt: new Date(),
        finishedAt: new Date(),
        output: `Triggered by ${event}`,
        error: null,
      },
    ],
    context: {
      triggerEvent: event,
      userId: payload.userId,
    },
    startedAt: new Date(),
  });

  await executeFrom(workflow, run, findNextNode(workflow, triggerNode.id, null));
}

async function handleTriggerEvent(
  event: WorkflowTriggerEvent,
  payload: RFQDomainEventPayload
): Promise<void> {
  const workflows = await Workflow.find({
    organizationId: payload.organizationId,
    enabled: true,
    "trigger.event": event,
  });

  for (const workflow of workflows) {
    try {
      await startWorkflowRun(workflow, event, payload);
    } catch (err) {
      console.error(`Workflow run failed to start for "${workflow.name}":`, err);
    }
  }
}

let handlersRegistered = false;

export function registerWorkflowEventHandlers(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  for (const event of WORKFLOW_TRIGGER_EVENTS) {
    registerDomainEventHandler(event, (payload) => handleTriggerEvent(event, payload));
  }
}

export interface ApprovalResolution {
  status: "resolved" | "not_found" | "expired" | "already_decided";
  workflowName?: string;
  decision?: "approved" | "rejected";
}

export async function resolveApproval(
  token: string,
  decision: "approved" | "rejected"
): Promise<ApprovalResolution> {
  if (!token || !/^[a-f0-9]{48}$/.test(token)) return { status: "not_found" };

  const existing = await WorkflowRun.findOne({ approvalToken: token }).lean();
  if (!existing) return { status: "not_found" };
  if (existing.status !== "waiting_approval") return { status: "already_decided" };
  if (existing.approvalTokenExpiresAt && existing.approvalTokenExpiresAt < new Date()) {
    return { status: "expired" };
  }

  // Atomic claim so double-clicking the email link resolves only once.
  const run = await WorkflowRun.findOneAndUpdate(
    { approvalToken: token, status: "waiting_approval" },
    {
      $set: {
        status: "running",
        approvalDecision: decision,
        approvalDecidedAt: new Date(),
        approvalToken: null,
      },
    },
    { new: true }
  );
  if (!run) return { status: "already_decided" };

  const workflow = await Workflow.findById(run.workflowId);
  if (!workflow) {
    await failRun(run, "Workflow definition no longer exists");
    return { status: "not_found" };
  }

  const approvalNodeId = run.currentNodeId;
  const waitingStep = run.steps.findLast(
    (step) => step.nodeId === approvalNodeId && step.status === "waiting"
  );
  if (waitingStep) {
    waitingStep.status = "succeeded";
    waitingStep.finishedAt = new Date();
    waitingStep.output = `${waitingStep.output ?? ""} — ${decision}`.trim();
    run.markModified("steps");
  }

  const nextNode = approvalNodeId
    ? findNextNode(workflow, approvalNodeId, decision)
    : null;

  if (!nextNode && decision === "rejected") {
    run.status = "rejected";
    run.currentNodeId = null;
    run.finishedAt = new Date();
    await run.save();
  } else {
    await run.save();
    await executeFrom(workflow, run, nextNode);
  }

  return { status: "resolved", workflowName: workflow.name, decision };
}

async function resumeDueDelays(): Promise<void> {
  const due = await WorkflowRun.find({
    status: "waiting_delay",
    resumeAt: { $lte: new Date() },
  }).limit(20);

  for (const run of due) {
    // Atomic claim so overlapping worker ticks don't resume a run twice.
    const claimed = await WorkflowRun.findOneAndUpdate(
      { _id: run._id, status: "waiting_delay" },
      { $set: { status: "running", resumeAt: null } },
      { new: true }
    );
    if (!claimed) continue;

    const workflow = await Workflow.findById(claimed.workflowId);
    if (!workflow) {
      await failRun(claimed, "Workflow definition no longer exists");
      continue;
    }

    const delayNodeId = claimed.currentNodeId;
    const waitingStep = claimed.steps.findLast(
      (step) => step.nodeId === delayNodeId && step.status === "waiting"
    );
    if (waitingStep) {
      waitingStep.status = "succeeded";
      waitingStep.finishedAt = new Date();
      claimed.markModified("steps");
    }
    await claimed.save();

    const nextNode = delayNodeId ? findNextNode(workflow, delayNodeId, null) : null;

    try {
      await executeFrom(workflow, claimed, nextNode);
    } catch (err) {
      console.error("Failed to resume delayed workflow run:", err);
    }
  }
}

const DELAY_WORKER_INTERVAL_MS = 30 * 1000;
let delayWorkerTimer: ReturnType<typeof setInterval> | null = null;

export function startWorkflowDelayWorker(): void {
  if (delayWorkerTimer) return;

  delayWorkerTimer = setInterval(() => {
    resumeDueDelays().catch((err) => {
      console.error("Workflow delay worker failed:", err);
    });
  }, DELAY_WORKER_INTERVAL_MS);

  console.log("Workflow delay worker started (checks every 30 seconds)");
}
