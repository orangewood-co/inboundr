import type { Request, Response } from "express";
import { processHistoryUpdate } from "../services/email.service";
import { Email } from "../models/email.model";
import { GmailAccount } from "../models/gmail-account.model";
import type { AuthenticatedRequest, OrganizationRequest } from "../middleware/auth.middleware";

export const emailWebhookController = async (
  req: Request,
  res: Response
): Promise<void> => {
  res.status(200).send();

  try {
    const message = req.body?.message;
    if (!message?.data) {
      console.warn("Webhook received with no message data");
      return;
    }

    const decoded = JSON.parse(
      Buffer.from(message.data, "base64").toString("utf-8")
    );

    const { emailAddress, historyId } = decoded;

    if (!historyId) {
      console.warn("Webhook message missing historyId");
      return;
    }

    console.log(
      `Gmail Notification: ${emailAddress}, historyId: ${historyId}`
    );

    if (!emailAddress) {
      console.warn("Webhook message missing emailAddress");
      return;
    }

    const account = await GmailAccount.findOne({
      emailAddress: String(emailAddress).toLowerCase(),
      status: "connected",
    });

    if (!account) {
      console.warn(`No connected Gmail account found for ${emailAddress}`);
      return;
    }

    await processHistoryUpdate(account, historyId);
  } catch (err) {
    console.error("Error processing Gmail webhook:", err);
  }
};

export const listEmails = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [emails, total] = await Promise.all([
      Email.find()
        .where({ userId: authReq.user.id, organizationId: organization._id })
        .select("-bodyText -bodyHtml")
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Email.countDocuments({ userId: authReq.user.id, organizationId: organization._id }),
    ]);

    res.json({ emails, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Error listing emails:", err);
    res.status(500).json({ error: "Failed to fetch emails" });
  }
};

export const getEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const email = await Email.findOne({
      _id: req.params.id,
      userId: authReq.user.id,
      organizationId: organization._id,
    }).lean();
    if (!email) {
      res.status(404).json({ error: "Email not found" });
      return;
    }
    res.json(email);
  } catch (err) {
    console.error("Error fetching email:", err);
    res.status(500).json({ error: "Failed to fetch email" });
  }
};
