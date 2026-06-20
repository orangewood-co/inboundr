import type { Request, Response } from "express";
import mongoose from "mongoose";

import type { OrganizationRequest } from "../middleware/auth.middleware";
import { Organization } from "../models/organization.model";
import { SupportAiDraft } from "../models/support-ai-draft.model";
import {
  SupportKnowledgeArticle,
  type ISupportKnowledgeArticle,
} from "../models/support-knowledge-article.model";
import { Ticket } from "../models/ticket.model";
import { TicketMessage } from "../models/ticket-message.model";
import { generateSupportAiDraft } from "../services/support-chat.service";
import {
  broadcastMessageCreated,
  broadcastSupportAiDraftUpdate,
  broadcastTicketUpdate,
} from "../services/support-ws.service";
import {
  serializeSupportAiDraft,
  serializeTicket,
} from "../services/ticket.service";

const INSTRUCTIONS_MAX = 8000;
const ARTICLE_TITLE_MAX = 160;
const ARTICLE_BODY_MAX = 12000;
const TAG_MAX = 40;

function serializeSettings(organization: any) {
  const supportAi = organization.preferences?.supportAi ?? {};
  return {
    enabled: supportAi.enabled !== false,
    instructions: supportAi.instructions ?? "",
    updatedBy: supportAi.updatedBy ?? null,
    updatedAt: supportAi.updatedAt ?? null,
  };
}

function serializeArticle(article: ISupportKnowledgeArticle | any) {
  return {
    id: String(article._id),
    title: article.title,
    body: article.body,
    tags: article.tags ?? [],
    enabled: Boolean(article.enabled),
    createdBy: article.createdBy ?? null,
    updatedBy: article.updatedBy ?? null,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
  };
}

function normalizeTags(value: unknown): string[] {
  const tags = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return [
    ...new Set(
      tags
        .map((tag) => String(tag).trim().toLowerCase().slice(0, TAG_MAX))
        .filter(Boolean)
    ),
  ].slice(0, 12);
}

async function ticketForResponse(ticketId: unknown) {
  return Ticket.findById(ticketId).populate("customerId").lean();
}

export async function getSupportAiSettings(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const organization = await Organization.findById(orgReq.organization._id)
      .select("preferences.supportAi")
      .lean();
    res.json({ settings: serializeSettings(organization ?? orgReq.organization) });
  } catch (err) {
    console.error("Failed to load support AI settings:", err);
    res.status(500).json({ error: "Failed to load AI agent settings" });
  }
}

export async function updateSupportAiSettings(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const enabled = Boolean(req.body?.enabled);
    const instructions = String(req.body?.instructions ?? "").trim().slice(0, INSTRUCTIONS_MAX);
    const now = new Date();

    const organization = await Organization.findByIdAndUpdate(
      orgReq.organization._id,
      {
        "preferences.supportAi.enabled": enabled,
        "preferences.supportAi.instructions": instructions,
        "preferences.supportAi.updatedBy": orgReq.user.id,
        "preferences.supportAi.updatedAt": now,
      },
      { new: true }
    ).lean();

    res.json({ settings: serializeSettings(organization) });
  } catch (err) {
    console.error("Failed to update support AI settings:", err);
    res.status(500).json({ error: "Failed to update AI agent settings" });
  }
}

export async function listKnowledgeArticles(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const search = String(req.query.search ?? "").trim();
    const filter: Record<string, unknown> = { organizationId: orgReq.organization._id };
    if (search) {
      filter.$or = ["title", "body", "tags"].map((field) => ({
        [field]: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
      }));
    }

    const articles = await SupportKnowledgeArticle.find(filter)
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
    res.json({ articles: articles.map(serializeArticle) });
  } catch (err) {
    console.error("Failed to list support knowledge articles:", err);
    res.status(500).json({ error: "Failed to load knowledge base" });
  }
}

export async function createKnowledgeArticle(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const title = String(req.body?.title ?? "").trim();
    const body = String(req.body?.body ?? "").trim();
    if (!title) {
      res.status(400).json({ error: "Article title is required" });
      return;
    }
    if (!body) {
      res.status(400).json({ error: "Article content cannot be empty" });
      return;
    }

    const article = await SupportKnowledgeArticle.create({
      organizationId: orgReq.organization._id,
      title: title.slice(0, ARTICLE_TITLE_MAX),
      body: body.slice(0, ARTICLE_BODY_MAX),
      tags: normalizeTags(req.body?.tags),
      enabled: req.body?.enabled !== false,
      createdBy: orgReq.user.id,
      updatedBy: orgReq.user.id,
    });
    res.status(201).json({ article: serializeArticle(article) });
  } catch (err) {
    console.error("Failed to create support knowledge article:", err);
    res.status(500).json({ error: "Failed to create knowledge article" });
  }
}

export async function updateKnowledgeArticle(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({ error: "Knowledge article not found" });
      return;
    }

    const update: Record<string, unknown> = { updatedBy: orgReq.user.id };
    if (req.body?.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) {
        res.status(400).json({ error: "Article title is required" });
        return;
      }
      update.title = title.slice(0, ARTICLE_TITLE_MAX);
    }
    if (req.body?.body !== undefined) {
      const body = String(req.body.body).trim();
      if (!body) {
        res.status(400).json({ error: "Article content cannot be empty" });
        return;
      }
      update.body = body.slice(0, ARTICLE_BODY_MAX);
    }
    if (req.body?.tags !== undefined) update.tags = normalizeTags(req.body.tags);
    if (req.body?.enabled !== undefined) update.enabled = Boolean(req.body.enabled);

    const article = await SupportKnowledgeArticle.findOneAndUpdate(
      { _id: id, organizationId: orgReq.organization._id },
      update,
      { new: true }
    ).lean();
    if (!article) {
      res.status(404).json({ error: "Knowledge article not found" });
      return;
    }
    res.json({ article: serializeArticle(article) });
  } catch (err) {
    console.error("Failed to update support knowledge article:", err);
    res.status(500).json({ error: "Failed to update knowledge article" });
  }
}

export async function deleteKnowledgeArticle(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({ error: "Knowledge article not found" });
      return;
    }
    const deleted = await SupportKnowledgeArticle.findOneAndDelete({
      _id: id,
      organizationId: orgReq.organization._id,
    });
    if (!deleted) {
      res.status(404).json({ error: "Knowledge article not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete support knowledge article:", err);
    res.status(500).json({ error: "Failed to delete knowledge article" });
  }
}

export async function updateTicketAiMode(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const mode = String(req.body?.aiMode ?? "");
    if (!["autonomous", "review", "paused"].includes(mode)) {
      res.status(400).json({ error: "Invalid AI mode" });
      return;
    }

    if (mode !== "review") {
      await SupportAiDraft.updateMany(
        {
          ticketId: req.params.id,
          organizationId: orgReq.organization._id,
          status: "pending",
        },
        {
          status: "rejected",
          rejectedByUserId: orgReq.user.id,
        }
      );
    }

    const ticket = await Ticket.findOneAndUpdate(
      { _id: req.params.id, organizationId: orgReq.organization._id },
      { aiMode: mode, botEnabled: mode === "autonomous" },
      { new: true }
    )
      .populate("customerId")
      .lean();
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const serialized = serializeTicket(ticket);
    broadcastTicketUpdate(String(orgReq.organization._id), serialized);
    res.json({ ticket: serialized });
  } catch (err) {
    console.error("Failed to update ticket AI mode:", err);
    res.status(500).json({ error: "Failed to update AI mode" });
  }
}

export async function createTicketAiDraft(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const ticket = await Ticket.findOne({
      _id: req.params.id,
      organizationId: orgReq.organization._id,
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    if (ticket.aiMode !== "review") {
      res.status(400).json({ error: "Take over the conversation before generating drafts" });
      return;
    }

    const existing = await SupportAiDraft.findOne({
      ticketId: ticket._id,
      organizationId: orgReq.organization._id,
      status: "pending",
    }).lean();
    if (existing) {
      res.status(409).json({ error: "Resolve the existing AI draft first" });
      return;
    }

    const draft = await generateSupportAiDraft(ticket, orgReq.user.id);
    if (!draft) {
      res.status(400).json({ error: "There is no customer message to draft a reply for" });
      return;
    }
    const serialized = serializeSupportAiDraft(draft);
    broadcastSupportAiDraftUpdate(String(orgReq.organization._id), draft, "created");
    res.status(201).json({ draft: serialized });
  } catch (err) {
    console.error("Failed to create support AI draft:", err);
    res.status(500).json({ error: "Failed to generate AI draft" });
  }
}

export async function approveTicketAiDraft(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const draftId = String(req.params.draftId ?? "");
    const draft = await SupportAiDraft.findOne({
      _id: draftId,
      ticketId: req.params.id,
      organizationId: orgReq.organization._id,
      status: "pending",
    });
    if (!draft) {
      res.status(404).json({ error: "AI draft not found" });
      return;
    }
    const bodyText = String(req.body?.bodyText ?? draft.bodyText).trim();
    if (!bodyText) {
      res.status(400).json({ error: "Approved reply cannot be empty" });
      return;
    }

    const now = new Date();
    const message = await TicketMessage.create({
      ticketId: draft.ticketId,
      organizationId: draft.organizationId,
      authorType: "agent",
      authorUserId: orgReq.user.id,
      bodyText: bodyText.slice(0, 4000),
    });
    draft.status = "approved";
    draft.bodyText = bodyText.slice(0, 4000);
    draft.approvedByUserId = orgReq.user.id;
    await draft.save();

    await Ticket.updateOne(
      { _id: draft.ticketId, organizationId: orgReq.organization._id },
      {
        aiMode: "review",
        botEnabled: false,
        status: "open",
        lastMessageAt: now,
        lastAgentMessageAt: now,
      }
    );

    await broadcastMessageCreated(message);
    const freshTicket = await ticketForResponse(draft.ticketId);
    if (freshTicket) broadcastTicketUpdate(String(orgReq.organization._id), serializeTicket(freshTicket));
    const serializedDraft = serializeSupportAiDraft(draft);
    broadcastSupportAiDraftUpdate(String(orgReq.organization._id), draft, "updated");
    res.json({ message, draft: serializedDraft });
  } catch (err) {
    console.error("Failed to approve support AI draft:", err);
    res.status(500).json({ error: "Failed to approve AI draft" });
  }
}

export async function rejectTicketAiDraft(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const draft = await SupportAiDraft.findOneAndUpdate(
      {
        _id: req.params.draftId,
        ticketId: req.params.id,
        organizationId: orgReq.organization._id,
        status: "pending",
      },
      {
        status: "rejected",
        rejectedByUserId: orgReq.user.id,
      },
      { new: true }
    ).lean();
    if (!draft) {
      res.status(404).json({ error: "AI draft not found" });
      return;
    }
    const serialized = serializeSupportAiDraft(draft);
    broadcastSupportAiDraftUpdate(String(orgReq.organization._id), draft, "updated");
    res.json({ draft: serialized });
  } catch (err) {
    console.error("Failed to reject support AI draft:", err);
    res.status(500).json({ error: "Failed to reject AI draft" });
  }
}
