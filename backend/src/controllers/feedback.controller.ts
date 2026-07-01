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
  hasFeedbackMessageContent,
  listFeedbackForUser,
  normalizeFeedbackModule,
  normalizeFeedbackAttachments,
} from "../services/feedback.service";

const createSchema = z.object({
  type: z.enum(FEEDBACK_TYPES as [string, ...string[]]),
  module: z.enum(FEEDBACK_MODULES as unknown as [string, ...string[]]).optional(),
  message: z.string().trim().max(5000).optional().default(""),
  attachments: z.unknown().optional(),
});

const replySchema = z.object({
  message: z.string().trim().max(5000).optional().default(""),
  attachments: z.unknown().optional(),
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
    const actor = actorFromRequest(req);
    const { attachments, error } = normalizeFeedbackAttachments(
      parsed.data.attachments,
      actor.id
    );
    if (error) {
      res.status(400).json({ error });
      return;
    }
    if (!hasFeedbackMessageContent(parsed.data.message, attachments)) {
      res.status(400).json({ error: "Message or attachment is required" });
      return;
    }

    const organizationId = req.header("x-organization-id") ?? null;
    const feedback = await createFeedback({
      actor,
      organizationId,
      type: parsed.data.type as any,
      module: normalizeFeedbackModule(parsed.data.module),
      message: parsed.data.message,
      attachments,
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
    const actor = actorFromRequest(req);
    const { attachments, error } = normalizeFeedbackAttachments(
      parsed.data.attachments,
      actor.id
    );
    if (error) {
      res.status(400).json({ error });
      return;
    }
    if (!hasFeedbackMessageContent(parsed.data.message, attachments)) {
      res.status(400).json({ error: "Message or attachment is required" });
      return;
    }

    const feedback = await addUserMessage({
      feedbackId: String(req.params.id),
      actor,
      body: parsed.data.message,
      attachments,
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
