import type { Request, Response } from "express";
import { getAttachment, processHistoryUpdate } from "../services/email.service";
import { Email } from "../models/email.model";
import { GmailAccount } from "../models/gmail-account.model";
import { RFQ } from "../models/rfq.model";
import type { AuthenticatedRequest, OrganizationRequest } from "../middleware/auth.middleware";
import { streamEmailPdf } from "../services/email-pdf.service";

const INLINE_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function sanitizeAttachmentFilename(filename: string): string {
  return filename.replace(/[\r\n"\\]/g, "_").trim() || "attachment";
}

function buildContentDisposition(filename: string, forceDownload: boolean): string {
  const disposition = forceDownload ? "attachment" : "inline";
  const safeFilename = sanitizeAttachmentFilename(filename);
  const encodedFilename = encodeURIComponent(safeFilename);

  return `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`;
}

function attachClassification(email: any, rfq: any | undefined, gmailAccountEmail: string | null = null) {
  return {
    ...email,
    gmailAccountEmail,
    rfqId: rfq?._id ?? null,
    isRFQ: rfq?.isRFQ ?? null,
    classificationReason: rfq?.reason ?? null,
    rfqErrorMessage: rfq?.errorMessage ?? null,
  };
}

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

    const emailIds = emails.map((email) => email._id);
    const rfqs = await RFQ.find({
      userId: authReq.user.id,
      organizationId: organization._id,
      emailId: { $in: emailIds },
    })
      .select("emailId isRFQ reason errorMessage")
      .lean();
    const rfqByEmailId = new Map(rfqs.map((rfq) => [rfq.emailId.toString(), rfq]));
    const accountIds = [...new Set(emails.map((email) => email.gmailAccountId?.toString()).filter(Boolean))];
    const accounts = await GmailAccount.find({
      _id: { $in: accountIds },
      userId: authReq.user.id,
      organizationId: organization._id,
    })
      .select("emailAddress")
      .lean();
    const accountEmailById = new Map(
      accounts.map((account) => [account._id.toString(), account.emailAddress])
    );

    res.json({
      emails: emails.map((email) =>
        attachClassification(
          email,
          rfqByEmailId.get(email._id.toString()),
          accountEmailById.get(email.gmailAccountId.toString()) ?? null
        )
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
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
    const rfq = await RFQ.findOne({
      emailId: email._id,
      userId: authReq.user.id,
      organizationId: organization._id,
    })
      .select("emailId isRFQ reason errorMessage")
      .lean();
    const account = await GmailAccount.findOne({
      _id: email.gmailAccountId,
      userId: authReq.user.id,
      organizationId: organization._id,
    })
      .select("emailAddress")
      .lean();

    res.json(attachClassification(email, rfq, account?.emailAddress ?? null));
  } catch (err) {
    console.error("Error fetching email:", err);
    res.status(500).json({ error: "Failed to fetch email" });
  }
};

export const downloadEmailPdf = async (
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

    const rfq = await RFQ.findOne({
      emailId: email._id,
      userId: authReq.user.id,
      organizationId: organization._id,
    })
      .select("isRFQ reason errorMessage")
      .lean();

    streamEmailPdf(
      email,
      {
        name: organization.name,
        email: organization.defaultContact?.email,
        phoneNumber: organization.defaultContact?.phoneNumber,
        address: organization.address,
        website: organization.website,
        primaryColor: organization.preferences?.primaryColor,
      },
      rfq,
      res
    );
  } catch (err) {
    console.error("Error rendering email PDF:", err);
    res.status(500).json({ error: "Failed to render email PDF" });
  }
};

export const getEmailAttachment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const forceDownload = req.path.endsWith("/download");

    const email = await Email.findOne({
      _id: req.params.id,
      userId: authReq.user.id,
      organizationId: organization._id,
    }).lean();
    if (!email) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    const attachment = email.attachments.find(
      (item) => item.attachmentId === req.params.attachmentId
    );
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    const account = await GmailAccount.findOne({
      _id: email.gmailAccountId,
      userId: authReq.user.id,
      organizationId: organization._id,
    });
    if (!account) {
      res.status(404).json({ error: "Gmail account not found" });
      return;
    }

    const data = await getAttachment(account, email.messageId, attachment.attachmentId);
    const shouldDownload =
      forceDownload || !INLINE_ATTACHMENT_MIME_TYPES.has(attachment.mimeType);

    res.setHeader("Content-Type", attachment.mimeType || "application/octet-stream");
    res.setHeader("Content-Length", data.byteLength);
    res.setHeader(
      "Content-Disposition",
      buildContentDisposition(attachment.filename, shouldDownload)
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(data);
  } catch (err) {
    console.error("Error fetching email attachment:", err);
    res.status(500).json({ error: "Failed to fetch attachment" });
  }
};
