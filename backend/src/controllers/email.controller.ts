import type { Request, Response } from "express";
import { processHistoryUpdate } from "../services/email.service";
import { Email } from "../models/email.model";

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

    await processHistoryUpdate(historyId);
  } catch (err) {
    console.error("Error processing Gmail webhook:", err);
  }
};

export const listEmails = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [emails, total] = await Promise.all([
      Email.find()
        .select("-bodyText -bodyHtml")
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Email.countDocuments(),
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
    const email = await Email.findById(req.params.id).lean();
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
