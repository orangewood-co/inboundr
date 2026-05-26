import type { Request, Response } from "express";
import { RFQ } from "../models/rfq.model";
import { Email } from "../models/email.model";
import { RFQReply } from "../models/rfq-reply.model";
import { processEmailForRFQ } from "../services/rfq.service";
import { generateQuoteReply } from "../agents/generate_quote";
import type { AuthenticatedRequest, OrganizationRequest } from "../middleware/auth.middleware";
import { GmailAccount } from "../models/gmail-account.model";
import { sendQuoteOnGmailThread } from "../services/gmail-send.service";
import { Customer } from "../models/customer.model";
import {
  buildRFQProcessingInput,
  hasRFQProcessableContent,
} from "../services/rfq-input.service";
import { streamRFQPdf } from "../services/rfq-pdf.service";

export const archiveRFQ = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;

    const rfq = await RFQ.findOneAndUpdate(
      { _id: req.params.id, userId: authReq.user.id, organizationId: organization._id },
      { isArchived: true },
      { new: true }
    ).lean();

    if (!rfq) {
      res.status(404).json({ error: "RFQ not found" });
      return;
    }

    res.json({ message: "RFQ archived", rfq });
  } catch (err) {
    console.error("Error archiving RFQ:", err);
    res.status(500).json({ error: "Failed to archive RFQ" });
  }
};

function extractEmailAddress(value: string | null | undefined): string {
  if (!value) return "";

  const angleMatch = value.match(/<([^>]+)>/);
  const email = angleMatch?.[1] ?? value;

  return email.trim().replace(/^mailto:/i, "");
}

type SelectedRFQProduct = {
  searchResultIndex: number
  matchIndex: number
  overrides?: {
    description?: unknown
    brand?: unknown
    code?: unknown
    price?: unknown
    hsnCode?: unknown
    gstRate?: unknown
    quantity?: unknown
    discountPercent?: unknown
  }
};
type ManualQuoteProduct = {
  queryName?: unknown;
  quantity?: unknown;
  productId?: unknown;
  brand?: unknown;
  description?: unknown;
  code?: unknown;
  price?: unknown;
  hsnCode?: unknown;
  gstRate?: unknown;
};

function nullableString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function resolveManualProduct(product: ManualQuoteProduct) {
  const queryName = nullableString(product.queryName);
  const quantity = positiveNumber(product.quantity);
  const description = nullableString(product.description);
  const code = nullableString(product.code);

  if (!queryName || !quantity || (!description && !code)) {
    throw new Error("Manual products require a name, quantity, and description or code");
  }

  return {
    queryName,
    quantity,
    productId: nullableNumber(product.productId) ?? 0,
    brand: nullableString(product.brand),
    description,
    code,
    price: nullableNumber(product.price),
    hsnCode: nullableString(product.hsnCode),
    gstRate: nullableNumber(product.gstRate),
  };
}

export const listRFQs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const listFilter = { userId: authReq.user.id, organizationId: organization._id, isRFQ: true, isArchived: { $ne: true } };
    const [rfqs, total] = await Promise.all([
      RFQ.find(listFilter)
        .populate("emailId", "subject from date snippet status")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RFQ.countDocuments(listFilter),
    ]);

    res.json({ rfqs, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Error listing RFQs:", err);
    res.status(500).json({ error: "Failed to fetch RFQs" });
  }
};

export const getRFQ = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const rfq = await RFQ.findOne({
      _id: req.params.id,
      userId: authReq.user.id,
      organizationId: organization._id,
    })
      .populate("emailId")
      .lean();

    if (!rfq) {
      res.status(404).json({ error: "RFQ not found" });
      return;
    }

    res.json(rfq);
  } catch (err) {
    console.error("Error fetching RFQ:", err);
    res.status(500).json({ error: "Failed to fetch RFQ" });
  }
};

export const downloadRFQPdf = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const rfq = await RFQ.findOne({
      _id: req.params.id,
      userId: authReq.user.id,
      organizationId: organization._id,
    })
      .populate("emailId", "subject from date snippet status")
      .lean();

    if (!rfq) {
      res.status(404).json({ error: "RFQ not found" });
      return;
    }

    streamRFQPdf(
      rfq as any,
      {
        name: organization.name,
        email: organization.defaultContact?.email,
        phoneNumber: organization.defaultContact?.phoneNumber,
        address: organization.address,
        website: organization.website,
        primaryColor: organization.preferences?.primaryColor,
      },
      res
    );
  } catch (err) {
    console.error("Error rendering RFQ PDF:", err);
    res.status(500).json({ error: "Failed to render RFQ PDF" });
  }
};

export const retryRFQ = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const rfq = await RFQ.findOne({
      _id: req.params.id,
      userId: authReq.user.id,
      organizationId: organization._id,
    }).lean();
    if (!rfq) {
      res.status(404).json({ error: "RFQ not found" });
      return;
    }

    const email = await Email.findOne({
      _id: rfq.emailId,
      userId: authReq.user.id,
      organizationId: organization._id,
    }).lean();
    if (!email) {
      res.status(404).json({ error: "Associated email not found" });
      return;
    }

    const account = await GmailAccount.findOne({
      _id: email.gmailAccountId,
      userId: authReq.user.id,
      organizationId: organization._id,
    });
    if (!account) {
      res.status(404).json({ error: "Associated Gmail account not found" });
      return;
    }

    if (!hasRFQProcessableContent(email)) {
      res.status(400).json({ error: "Email has no processable body or supported attachments" });
      return;
    }

    // Reset the RFQ for reprocessing
    await RFQ.deleteOne({ _id: rfq._id });

    const body = await buildRFQProcessingInput(account, email);

    processEmailForRFQ(
      email._id.toString(),
      body,
      email.messageId,
      authReq.user.id,
      email.gmailAccountId.toString(),
      organization._id.toString()
    ).catch(
      (err) => console.error(`RFQ retry failed for ${email.messageId}:`, err)
    );

    res.json({ message: "RFQ reprocessing started" });
  } catch (err) {
    console.error("Error retrying RFQ:", err);
    res.status(500).json({ error: "Failed to retry RFQ" });
  }
};

export const generateQuote = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const rfq = await RFQ.findOne({
      _id: req.params.id,
      userId: authReq.user.id,
      organizationId: organization._id,
    }).populate("emailId").lean();
    if (!rfq) {
      res.status(404).json({ error: "RFQ not found" });
      return;
    }

    if (!rfq.isProcessed || !rfq.customer) {
      res.status(400).json({ error: "RFQ is not fully processed yet" });
      return;
    }

    // selectedProducts: [{ searchResultIndex, matchIndex }]
    const selections: SelectedRFQProduct[] = Array.isArray(req.body?.selectedProducts)
      ? req.body.selectedProducts
      : [];
    const manualProducts: ManualQuoteProduct[] = Array.isArray(req.body?.manualProducts)
      ? req.body.manualProducts
      : [];

    if (selections.length === 0 && manualProducts.length === 0) {
      res.status(400).json({ error: "No products selected" });
      return;
    }

    const selectedProducts = selections.map((sel) => {
      const sr = rfq.searchResults[sel.searchResultIndex];
      if (!sr) throw new Error(`Invalid searchResultIndex: ${sel.searchResultIndex}`);
      const match = sr.matches[sel.matchIndex];
      if (!match) throw new Error(`Invalid matchIndex: ${sel.matchIndex}`);

      const overrides = sel.overrides || {};
      const overridePrice = nullableNumber(overrides.price);
      const overrideDiscount = nullableNumber(overrides.discountPercent) ?? 0;
      const basePrice = overridePrice ?? match.price;
      const finalPrice = basePrice != null ? basePrice * (1 - overrideDiscount / 100) : null;

      return {
        queryName: sr.query.name,
        quantity: positiveNumber(overrides.quantity) ?? sr.query.quantity,
        productId: match.id,
        brand: nullableString(overrides.brand) ?? match.brand,
        description: nullableString(overrides.description) ?? match.description,
        code: nullableString(overrides.code) ?? match.code,
        price: finalPrice,
        hsnCode: nullableString(overrides.hsnCode) ?? match.hsnCode,
        gstRate: nullableNumber(overrides.gstRate) ?? match.gstRate,
        discountPercent: overrideDiscount,
      };
    });
    const products = [...selectedProducts, ...manualProducts.map(resolveManualProduct)];

    const email = rfq.emailId as any;
    const originalSenderEmail = extractEmailAddress(email?.from);
    const customerEmail = extractEmailAddress(rfq.customer.email) || originalSenderEmail;
    const savedCustomer = customerEmail
      ? await Customer.findOne({
          email: customerEmail,
          organizationId: organization._id,
        }).lean()
      : null;

    const { subject, body } = await generateQuoteReply({
      customerName: savedCustomer?.name || rfq.customer.name,
      customerCompany: savedCustomer?.company || rfq.customer.company,
      customerEmail,
      customerNotes: savedCustomer?.notes ?? null,
      specialDiscountPercentage: savedCustomer?.specialDiscountPercentage ?? null,
      organizationName: organization.name,
      organizationContactName: organization.defaultContact?.name,
      organizationContactEmail: organization.defaultContact?.email,
      organizationContactPhone: organization.defaultContact?.phoneNumber,
      organizationDefaultTerms: organization.preferences?.defaultTerms,
      originalSubject: email?.subject || "",
      products: products.map((p) => ({
        queryName: p.queryName,
        quantity: p.quantity,
        brand: p.brand,
        description: p.description,
        code: p.code,
        price: p.price,
        hsnCode: p.hsnCode,
        gstRate: p.gstRate,
      })),
    });

    // Upsert: replace existing reply if regenerating
    const reply = await RFQReply.findOneAndUpdate(
      { rfqId: rfq._id },
      {
        userId: authReq.user.id,
        organizationId: organization._id,
        gmailAccountId: rfq.gmailAccountId,
        rfqId: rfq._id,
        selectedProducts: products,
        subject,
        body,
        to: originalSenderEmail,
        generatedAt: new Date(),
        sendStatus: "draft",
        sentAt: null,
        gmailMessageId: null,
        sendErrorMessage: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json(reply);
  } catch (err: any) {
    console.error("Error generating quote:", err);
    res.status(500).json({ error: err.message || "Failed to generate quote" });
  }
};

export const getQuoteReply = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const reply = await RFQReply.findOne({
      rfqId: req.params.id,
      userId: authReq.user.id,
      organizationId: organization._id,
    }).lean();
    if (!reply) {
      res.status(404).json({ error: "No reply found for this RFQ" });
      return;
    }
    res.json(reply);
  } catch (err) {
    console.error("Error fetching quote reply:", err);
    res.status(500).json({ error: "Failed to fetch quote reply" });
  }
};

export const sendQuoteReply = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;

  try {
    const organization = (req as OrganizationRequest).organization;
    const rfq = await RFQ.findOne({
      _id: req.params.id,
      userId: authReq.user.id,
      organizationId: organization._id,
    }).lean();
    if (!rfq) {
      res.status(404).json({ error: "RFQ not found" });
      return;
    }

    const [email, account, reply] = await Promise.all([
      Email.findOne({
        _id: rfq.emailId,
        userId: authReq.user.id,
        organizationId: organization._id,
      }),
      GmailAccount.findOne({
        _id: rfq.gmailAccountId,
        userId: authReq.user.id,
        organizationId: organization._id,
        status: "connected",
      }),
      RFQReply.findOne({
        rfqId: rfq._id,
        userId: authReq.user.id,
        organizationId: organization._id,
      }),
    ]);

    if (!email) {
      res.status(404).json({ error: "Associated email not found" });
      return;
    }
    if (!account) {
      res.status(400).json({ error: "Connected Gmail account not found" });
      return;
    }
    if (!reply) {
      res.status(404).json({ error: "Generate a quote before sending" });
      return;
    }
    if (reply.sendStatus === "sent") {
      res.json(reply);
      return;
    }

    await RFQReply.updateOne(
      { _id: reply._id },
      { sendStatus: "sending", sendErrorMessage: null }
    );

    try {
      const gmailMessageId = await sendQuoteOnGmailThread({
        account,
        email,
        to: reply.to,
        subject: reply.subject,
        body: reply.body,
      });

      const sentReply = await RFQReply.findOneAndUpdate(
        { _id: reply._id },
        {
          sendStatus: "sent",
          sentAt: new Date(),
          gmailMessageId,
          sendErrorMessage: null,
        },
        { new: true }
      ).lean();

      res.json(sentReply);
    } catch (err: any) {
      const failedReply = await RFQReply.findOneAndUpdate(
        { _id: reply._id },
        {
          sendStatus: "failed",
          sendErrorMessage: err.message || "Failed to send quote",
        },
        { new: true }
      ).lean();

      res.status(500).json({
        error: err.message || "Failed to send quote",
        reply: failedReply,
      });
    }
  } catch (err: any) {
    console.error("Error sending quote reply:", err);
    res.status(500).json({ error: err.message || "Failed to send quote reply" });
  }
};
