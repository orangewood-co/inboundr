import type { Request, Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  FEEDBACK_MODULES,
  FEEDBACK_TYPES,
} from "../models/feedback.model";
import {
  addUserMessage,
  createFeedback,
  getFeedbackForUser,
  listFeedbackForUser,
  normalizeFeedbackModule,
} from "../services/feedback.service";

const createSchema = z.object({
  type: z.enum(FEEDBACK_TYPES as [string, ...string[]]),
  module: z.enum(FEEDBACK_MODULES as unknown as [string, ...string[]]).optional(),
  message: z.string().trim().min(1, "Message is required").max(5000),
});

const replySchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(5000),
});

function actorFromRequest(req: Request) {
  const user = (req as AuthenticatedRequest).user;
  return { id: user.id, name: user.name, email: user.email };
}

export async function submitFeedback(req: Request, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid feedback submission",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const organizationId = req.header("x-organization-id") ?? null;
    const feedback = await createFeedback({
      actor: actorFromRequest(req),
      organizationId,
      type: parsed.data.type as any,
      module: normalizeFeedbackModule(parsed.data.module),
      message: parsed.data.message,
    });

    res.status(201).json({ feedback });
  } catch (err) {
    console.error("Failed to submit feedback:", err);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
}

export async function listMyFeedback(req: Request, res: Response): Promise<void> {
  try {
    const feedback = await listFeedbackForUser(actorFromRequest(req).id);
    res.json({ feedback });
  } catch (err) {
    console.error("Failed to list feedback:", err);
    res.status(500).json({ error: "Failed to load feedback" });
  }
}

export async function getMyFeedback(req: Request, res: Response): Promise<void> {
  try {
    const feedback = await getFeedbackForUser(
      String(req.params.id),
      actorFromRequest(req).id,
      { markRead: true }
    );
    if (!feedback) {
      res.status(404).json({ error: "Feedback not found" });
      return;
    }
    res.json({ feedback });
  } catch (err) {
    console.error("Failed to get feedback:", err);
    res.status(500).json({ error: "Failed to load feedback" });
  }
}

export async function replyToMyFeedback(req: Request, res: Response): Promise<void> {
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid reply",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const feedback = await addUserMessage({
      feedbackId: String(req.params.id),
      actor: actorFromRequest(req),
      body: parsed.data.message,
    });
    if (!feedback) {
      res.status(404).json({ error: "Feedback not found" });
      return;
    }
    res.status(201).json({ feedback });
  } catch (err) {
    console.error("Failed to reply to feedback:", err);
    res.status(500).json({ error: "Failed to send reply" });
  }
}
