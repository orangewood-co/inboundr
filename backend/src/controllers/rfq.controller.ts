import type { Request, Response } from "express";
import { RFQ } from "../models/rfq.model";
import { Email } from "../models/email.model";
import { RFQReply } from "../models/rfq-reply.model";
import { processEmailForRFQ } from "../services/rfq.service";
import { generateQuoteReply } from "../agents/generate_quote";

export const listRFQs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [rfqs, total] = await Promise.all([
      RFQ.find({ isRFQ: true })
        .populate("emailId", "subject from date snippet status")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RFQ.countDocuments({ isRFQ: true }),
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
    const rfq = await RFQ.findById(req.params.id)
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

export const retryRFQ = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const rfq = await RFQ.findById(req.params.id).lean();
    if (!rfq) {
      res.status(404).json({ error: "RFQ not found" });
      return;
    }

    const email = await Email.findById(rfq.emailId).lean();
    if (!email) {
      res.status(404).json({ error: "Associated email not found" });
      return;
    }

    // Reset the RFQ for reprocessing
    await RFQ.deleteOne({ _id: rfq._id });

    const body = `SENT FROM: ${email.from}, SENT TO: ${email.to}, DATE: ${email.date}\n${email.bodyText || email.bodyHtml}`;

    processEmailForRFQ(email._id.toString(), body, email.messageId).catch(
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
    const rfq = await RFQ.findById(req.params.id).populate("emailId").lean();
    if (!rfq) {
      res.status(404).json({ error: "RFQ not found" });
      return;
    }

    if (!rfq.isProcessed || !rfq.customer) {
      res.status(400).json({ error: "RFQ is not fully processed yet" });
      return;
    }

    // selectedProducts: [{ searchResultIndex, matchIndex }]
    const selections: { searchResultIndex: number; matchIndex: number }[] =
      req.body?.selectedProducts;

    if (!selections || !Array.isArray(selections) || selections.length === 0) {
      res.status(400).json({ error: "No products selected" });
      return;
    }

    const products = selections.map((sel) => {
      const sr = rfq.searchResults[sel.searchResultIndex];
      if (!sr) throw new Error(`Invalid searchResultIndex: ${sel.searchResultIndex}`);
      const match = sr.matches[sel.matchIndex];
      if (!match) throw new Error(`Invalid matchIndex: ${sel.matchIndex}`);
      return {
        queryName: sr.query.name,
        quantity: sr.query.quantity,
        productId: match.id,
        brand: match.brand,
        description: match.description,
        code: match.code,
        price: match.price,
        hsnCode: match.hsnCode,
        gstRate: match.gstRate,
      };
    });

    const email = rfq.emailId as any;
    const customerEmail = rfq.customer.email || email?.from || "";

    const { subject, body } = await generateQuoteReply({
      customerName: rfq.customer.name,
      customerCompany: rfq.customer.company,
      customerEmail,
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
        rfqId: rfq._id,
        selectedProducts: products,
        subject,
        body,
        to: customerEmail,
        generatedAt: new Date(),
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
    const reply = await RFQReply.findOne({ rfqId: req.params.id }).lean();
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
