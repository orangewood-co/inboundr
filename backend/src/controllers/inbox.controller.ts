import type { Request, Response } from "express";
import mongoose from "mongoose";

import { WHATSAPP_TEXT_MAX_LENGTH } from "../config/whatsapp.config";
import type { AuthenticatedRequest, OrganizationRequest } from "../middleware/auth.middleware";
import { InboxConversation } from "../models/inbox-conversation.model";
import {
  serializeConversationDetail,
  serializeInboxMessage,
} from "../services/inbox-conversation.service";
import {
  InboxChannelError,
  createOrRefreshConversationRFQ,
  markConversationRead,
  sendConversationText,
} from "../services/whatsapp-rfq.service";

async function findScopedConversation(req: Request) {
  const id = String(req.params.id ?? "");
  if (!mongoose.isValidObjectId(id)) return null;
  return InboxConversation.findOne({
    _id: id,
    userId: (req as AuthenticatedRequest).user.id,
    organizationId: (req as OrganizationRequest).organization._id,
  });
}

function sendChannelError(res: Response, err: unknown, fallback: string): void {
  if (err instanceof InboxChannelError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(fallback, err);
  res.status(500).json({ error: fallback });
}

export const getConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const conversation = await findScopedConversation(req);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    void markConversationRead(conversation);
    res.json(await serializeConversationDetail(conversation));
  } catch (err) {
    sendChannelError(res, err, "Failed to load conversation");
  }
};

export const sendConversationMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const text = String(req.body?.text ?? "").trim();
    if (!text) {
      res.status(400).json({ error: "Message text is required" });
      return;
    }
    if (text.length > WHATSAPP_TEXT_MAX_LENGTH) {
      res.status(400).json({ error: `Messages can be at most ${WHATSAPP_TEXT_MAX_LENGTH} characters` });
      return;
    }
    const conversation = await findScopedConversation(req);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const message = await sendConversationText(conversation, text, (req as AuthenticatedRequest).user.id);
    res.status(201).json(await serializeInboxMessage(message));
  } catch (err) {
    sendChannelError(res, err, "Failed to send message");
  }
};

export const processConversationRFQ = async (req: Request, res: Response): Promise<void> => {
  try {
    const conversation = await findScopedConversation(req);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.json(await createOrRefreshConversationRFQ(conversation));
  } catch (err) {
    sendChannelError(res, err, "Failed to process this chat");
  }
};
