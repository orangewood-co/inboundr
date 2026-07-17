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
  getOrCreateCustomerSettings,
  isSpecialDiscountEnabled,
} from "../services/customer-field.service";
import {
  buildRFQProcessingInput,
  hasRFQProcessableContent,
} from "../services/rfq-input.service";
import { streamRFQPdf } from "../services/rfq-pdf.service";
import { resolveOrganizationPdfBranding } from "../services/organization-pdf-branding.service";
import { renderRFQQuotePdfBuffer, rfqQuotePdfFilename } from "../services/rfq-quote-pdf.service";
import type { IRFQ } from "../models/rfq.model";

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
    calibrationCharges?: unknown
    adjustments?: unknown
    deliveryTimeline?: unknown
  }
};
type ManualQuoteProduct = {
  searchResultIndex?: unknown;
  queryName?: unknown;
  quantity?: unknown;
  productId?: unknown;
  brand?: unknown;
  description?: unknown;
  code?: unknown;
  price?: unknown;
  discountPercent?: unknown;
  hsnCode?: unknown;
  gstRate?: unknown;
  calibrationCharges?: unknown;
  adjustments?: unknown;
  attributes?: unknown;
  deliveryTimeline?: unknown;
};
type RegrettedRFQLine = {
  searchResultIndex?: unknown;
  queryName?: unknown;
  quantity?: unknown;
  regretReason?: unknown;
};
type QuotePaymentTerms = {
  paymentTermTemplateId: string | null;
  paymentTermName: string | null;
  paymentTerms: string | null;
};
type QuoteDeliveryTerms = {
  deliveryTermTemplateId: string | null;
  deliveryTermName: string | null;
  deliveryTerms: string | null;
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

function nullableProductId(value: unknown): string | null {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  return text || null;
}

function discountPercent(value: unknown): number {
  const number = nullableNumber(value);
  if (number == null) return 0;
  return Math.min(100, Math.max(0, number));
}

function quoteAdjustments(
  value: unknown,
  quantity: number,
  unitPrice: number | null,
  legacyCalibration?: unknown
) {
  const source = Array.isArray(value) ? value : [];
  const normalized = source.flatMap((raw, index) => {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const label = nullableString(item.label);
    const code = nullableString(item.code) ?? `adjustment_${index + 1}`;
    const type = item.type === "percentage" ? "percentage" as const : "fixed" as const;
    const adjustmentValue = nullableNumber(item.value);
    if (!label || adjustmentValue == null || adjustmentValue < 0) return [];
    const amount = type === "percentage"
      ? (unitPrice ?? 0) * quantity * adjustmentValue / 100
      : adjustmentValue * quantity;
    return [{
      id: nullableString(item.id) ?? code,
      code,
      label,
      type,
      value: adjustmentValue,
      amount,
      taxable: item.taxable === true,
    }];
  });
  const calibration = nullableNumber(legacyCalibration);
  if (normalized.length === 0 && calibration != null && calibration > 0) {
    normalized.push({
      id: "legacy.calibration",
      code: "calibration",
      label: "Calibration",
      type: "fixed",
      value: calibration,
      amount: calibration * quantity,
      taxable: false,
    });
  }
  return normalized;
}

function productAttributes(value: unknown): Record<string, string | number | boolean | null> {
  if (value instanceof Map) return Object.fromEntries(value.entries());
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, string | number | boolean | null>) }
    : {};
}

function pricesEqual(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.001;
}

function resolveSubmittedBasePrice(
  submittedPrice: number | null,
  discount: number,
  previous?: IRFQ["savedQuoteProducts"][number]
): number | null {
  if (
    previous?.basePrice != null &&
    discount > 0 &&
    pricesEqual(previous.price, submittedPrice) &&
    pricesEqual(previous.discountPercent ?? 0, discount)
  ) {
    return previous.basePrice;
  }

  return submittedPrice;
}

function defaultPaymentTermsFromOrganization(organization: any): QuotePaymentTerms {
  const paymentTerms = organization.preferences?.paymentTerms;
  const defaultTemplate = Array.isArray(paymentTerms)
    ? paymentTerms.find((term) => term?.isDefault) ?? paymentTerms[0]
    : null;

  if (defaultTemplate?.text) {
    return {
      paymentTermTemplateId: nullableString(defaultTemplate.id),
      paymentTermName: nullableString(defaultTemplate.name),
      paymentTerms: nullableString(defaultTemplate.text),
    };
  }

  return {
    paymentTermTemplateId: null,
    paymentTermName: organization.preferences?.defaultTerms ? "Default" : null,
    paymentTerms: nullableString(organization.preferences?.defaultTerms),
  };
}

function defaultDeliveryTermsFromOrganization(organization: any): QuoteDeliveryTerms {
  const deliveryTerms = organization.preferences?.deliveryTerms;
  const defaultTemplate = Array.isArray(deliveryTerms)
    ? deliveryTerms.find((term) => term?.isDefault) ?? deliveryTerms[0]
    : null;

  if (defaultTemplate?.text) {
    return {
      deliveryTermTemplateId: nullableString(defaultTemplate.id),
      deliveryTermName: nullableString(defaultTemplate.name),
      deliveryTerms: nullableString(defaultTemplate.text),
    };
  }

  return {
    deliveryTermTemplateId: null,
    deliveryTermName: null,
    deliveryTerms: null,
  };
}

function resolveQuotePaymentTerms(
  body: Record<string, unknown> | undefined,
  rfq: Partial<IRFQ>,
  organization: any,
  requireTerms = false
): QuotePaymentTerms {
  const source = body ?? {};
  const hasPaymentTermPayload =
    "paymentTerms" in source || "paymentTermTemplateId" in source || "paymentTermName" in source;

  const terms = hasPaymentTermPayload
    ? {
        paymentTermTemplateId: nullableString(source.paymentTermTemplateId),
        paymentTermName: nullableString(source.paymentTermName),
        paymentTerms: nullableString(source.paymentTerms),
      }
    : rfq.paymentTerms
      ? {
          paymentTermTemplateId: nullableString(rfq.paymentTermTemplateId),
          paymentTermName: nullableString(rfq.paymentTermName),
          paymentTerms: nullableString(rfq.paymentTerms),
        }
      : defaultPaymentTermsFromOrganization(organization);

  if (requireTerms && !terms.paymentTerms) {
    const error = new Error("Payment terms are required to generate or send a quote");
    (error as any).statusCode = 400;
    throw error;
  }

  return terms;
}

function resolveQuoteDeliveryTerms(
  body: Record<string, unknown> | undefined,
  rfq: Partial<IRFQ>,
  organization: any,
  requireTerms = false
): QuoteDeliveryTerms {
  const source = body ?? {};
  const hasDeliveryTermPayload =
    "deliveryTerms" in source || "deliveryTermTemplateId" in source || "deliveryTermName" in source;

  const terms = hasDeliveryTermPayload
    ? {
        deliveryTermTemplateId: nullableString(source.deliveryTermTemplateId),
        deliveryTermName: nullableString(source.deliveryTermName),
        deliveryTerms: nullableString(source.deliveryTerms),
      }
    : rfq.deliveryTerms
      ? {
          deliveryTermTemplateId: nullableString(rfq.deliveryTermTemplateId),
          deliveryTermName: nullableString(rfq.deliveryTermName),
          deliveryTerms: nullableString(rfq.deliveryTerms),
        }
      : defaultDeliveryTermsFromOrganization(organization);

  if (requireTerms && !terms.deliveryTerms) {
    const error = new Error("Delivery terms are required to generate or send a quote");
    (error as any).statusCode = 400;
    throw error;
  }

  return terms;
}

function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function indexNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function sortQuoteProductsByItem<T extends { searchResultIndex: number | null }>(products: T[]): T[] {
  return products
    .map((product, originalIndex) => ({ product, originalIndex }))
    .sort((a, b) => {
      const aIndex = a.product.searchResultIndex;
      const bIndex = b.product.searchResultIndex;

      if (aIndex == null && bIndex == null) return a.originalIndex - b.originalIndex;
      if (aIndex == null) return 1;
      if (bIndex == null) return -1;

      return aIndex - bIndex || a.originalIndex - b.originalIndex;
    })
    .map(({ product }) => product);
}

function resolveManualProduct(product: ManualQuoteProduct, previous?: IRFQ["savedQuoteProducts"][number]) {
  const queryName = nullableString(product.queryName);
  const quantity = positiveNumber(product.quantity);
  const description = nullableString(product.description);
  const code = nullableString(product.code);
  const discount = discountPercent(product.discountPercent);
  const basePrice = resolveSubmittedBasePrice(nullableNumber(product.price), discount, previous);
  const finalPrice = basePrice != null ? basePrice * (1 - discount / 100) : null;
  const resolvedQuantity = quantity ?? 1;
  const adjustments = quoteAdjustments(
    product.adjustments,
    resolvedQuantity,
    finalPrice,
    product.calibrationCharges
  );

  if (!queryName || !quantity || (!description && !code)) {
    throw new Error("Manual products require a name, quantity, and description or code");
  }

  return {
    searchResultIndex: indexNumber(product.searchResultIndex),
    queryName,
    quantity: resolvedQuantity,
    productId: nullableProductId(product.productId) ?? "0",
    brand: nullableString(product.brand),
    description,
    code,
    basePrice,
    price: finalPrice,
    hsnCode: nullableString(product.hsnCode),
    gstRate: nullableNumber(product.gstRate),
    discountPercent: discount,
    calibrationCharges: nullableNumber(product.calibrationCharges),
    tax: {
      code: nullableString(product.hsnCode),
      rate: nullableNumber(product.gstRate),
      label: "Tax",
    },
    attributes: productAttributes(product.attributes),
    adjustments,
    deliveryTimeline: nullableString(product.deliveryTimeline),
    lineStatus: "quoted" as const,
    regretReason: null,
  };
}

function resolveSelectedProducts(
  rfq: Pick<IRFQ, "searchResults" | "savedQuoteProducts">,
  selections: SelectedRFQProduct[],
  manualProducts: ManualQuoteProduct[],
  regrettedLines: RegrettedRFQLine[] = []
) {
  const regrettedIndexes = new Set(
    regrettedLines
      .map((line) => indexNumber(line.searchResultIndex))
      .filter((index): index is number => index != null)
  );
  const quotedIndexes = new Set<number>();
  selections.forEach((sel) => quotedIndexes.add(sel.searchResultIndex));
  manualProducts.forEach((product) => {
    const index = indexNumber(product.searchResultIndex);
    if (index != null) quotedIndexes.add(index);
  });
  for (const index of regrettedIndexes) {
    if (quotedIndexes.has(index)) {
      throw new Error("A regretted line item cannot also have selected products");
    }
  }

  const selectedProducts = selections.map((sel) => {
    const sr = rfq.searchResults[sel.searchResultIndex];
    if (!sr) throw new Error(`Invalid searchResultIndex: ${sel.searchResultIndex}`);
    const match = sr.matches[sel.matchIndex];
    if (!match) throw new Error(`Invalid matchIndex: ${sel.matchIndex}`);

    const overrides = sel.overrides || {};
    const overridePrice = nullableNumber(overrides.price);
    const discount = discountPercent(overrides.discountPercent);
    const previous = rfq.savedQuoteProducts.find(
      (product) =>
        product.lineStatus !== "regretted" &&
        product.searchResultIndex === sel.searchResultIndex &&
        product.productId === match.id
    );
    const basePrice = resolveSubmittedBasePrice(overridePrice ?? match.price, discount, previous);
    const finalPrice = basePrice != null ? basePrice * (1 - discount / 100) : null;
    const quantity = positiveNumber(overrides.quantity) ?? sr.query.quantity;
    const adjustments = quoteAdjustments(
      overrides.adjustments ?? match.defaultAdjustments,
      quantity,
      finalPrice,
      overrides.calibrationCharges ?? match.calibrationCharges
    );

    return {
      searchResultIndex: sel.searchResultIndex,
      queryName: sr.query.name,
      quantity,
      productId: match.id,
      brand: nullableString(overrides.brand) ?? match.brand,
      description: nullableString(overrides.description) ?? match.description,
      code: nullableString(overrides.code) ?? match.code,
      basePrice,
      price: finalPrice,
      hsnCode: nullableString(overrides.hsnCode) ?? match.hsnCode,
      gstRate: nullableNumber(overrides.gstRate) ?? match.gstRate,
      discountPercent: discount,
      calibrationCharges: nullableNumber(overrides.calibrationCharges) ?? match.calibrationCharges,
      tax: {
        code: nullableString(overrides.hsnCode) ?? match.tax?.code ?? match.hsnCode,
        rate: nullableNumber(overrides.gstRate) ?? match.tax?.rate ?? match.gstRate,
        label: match.tax?.label ?? "Tax",
      },
      attributes: productAttributes(match.attributes),
      adjustments,
      deliveryTimeline: nullableString(overrides.deliveryTimeline),
      lineStatus: "quoted" as const,
      regretReason: null,
    };
  });

  const regrettedProducts = regrettedLines.map((line) => {
    const searchResultIndex = indexNumber(line.searchResultIndex);
    const searchResult = searchResultIndex != null ? rfq.searchResults[searchResultIndex] : null;
    const queryName = nullableString(line.queryName) ?? searchResult?.query.name;
    const quantity = positiveNumber(line.quantity) ?? searchResult?.query.quantity ?? 1;
    if (!queryName) {
      throw new Error("Regretted lines require a requested item");
    }
    return {
      searchResultIndex,
      queryName,
      quantity,
      productId: "0",
      brand: null,
      description: null,
      code: null,
      basePrice: null,
      price: null,
      hsnCode: null,
      gstRate: null,
      discountPercent: 0,
      calibrationCharges: null,
      tax: { code: null, rate: null, label: "Tax" },
      attributes: {},
      adjustments: [],
      deliveryTimeline: null,
      lineStatus: "regretted" as const,
      regretReason: nullableString(line.regretReason) ?? "Not available in catalog",
    };
  });

  return sortQuoteProductsByItem([
    ...selectedProducts,
    ...manualProducts.map((product) => {
      const previous = rfq.savedQuoteProducts.find(
        (saved) =>
          saved.lineStatus !== "regretted" &&
          saved.searchResultIndex === indexNumber(product.searchResultIndex) &&
          saved.productId === (nullableProductId(product.productId) ?? "0") &&
          saved.queryName === nullableString(product.queryName)
      );

      return resolveManualProduct(product, previous);
    }),
    ...regrettedProducts,
  ]);
}

const rfqListStatuses = new Set(["all", "analyzing", "ready", "draft", "processed", "failed"]);
const rfqListSorts = new Set(["created_desc", "created_asc", "updated_desc", "updated_asc"]);

function parseRFQListStatus(value: unknown): string {
  const status = typeof value === "string" ? value : "all";
  return rfqListStatuses.has(status) ? status : "all";
}

function parseRFQListSort(value: unknown): string {
  const sort = typeof value === "string" ? value : "created_desc";
  return rfqListSorts.has(sort) ? sort : "created_desc";
}

function parseDateParam(value: unknown, endOfDay = false): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
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
    const status = parseRFQListStatus(req.query.status);
    const sort = parseRFQListSort(req.query.sort);
    const dateFrom = parseDateParam(req.query.dateFrom);
    const dateTo = parseDateParam(req.query.dateTo, true);

    const listFilter: Record<string, any> = {
      userId: authReq.user.id,
      organizationId: organization._id,
      isRFQ: true,
      isArchived: { $ne: true },
    };
    if (dateFrom || dateTo) {
      listFilter.createdAt = {};
      if (dateFrom) listFilter.createdAt.$gte = dateFrom;
      if (dateTo) listFilter.createdAt.$lte = dateTo;
    }
    if (status === "analyzing") {
      listFilter.isProcessed = false;
      listFilter.errorMessage = null;
    } else if (status === "failed") {
      listFilter.errorMessage = { $ne: null };
    } else if (status === "ready") {
      listFilter.isProcessed = true;
      listFilter.errorMessage = null;
      listFilter.$or = [
        { workflowStatus: { $exists: false } },
        { workflowStatus: "new" },
      ];
    } else if (status === "draft" || status === "processed") {
      listFilter.workflowStatus = status;
    }

    const sortOptions: Record<string, Record<string, 1 | -1>> = {
      created_desc: { createdAt: -1 },
      created_asc: { createdAt: 1 },
      updated_desc: { updatedAt: -1 },
      updated_asc: { updatedAt: 1 },
    };
    const [rfqs, total] = await Promise.all([
      RFQ.find(listFilter)
        .populate("emailId", "subject from date snippet status")
        .sort(sortOptions[sort])
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

export const listDraftRFQs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;

    const rfqs = await RFQ.find({
      userId: authReq.user.id,
      organizationId: organization._id,
      isRFQ: true,
      isArchived: { $ne: true },
      workflowStatus: "draft",
    })
      .populate("emailId", "subject from date snippet status")
      .sort({ draftSavedAt: -1, updatedAt: -1 })
      .lean();

    res.json({ rfqs });
  } catch (err) {
    console.error("Error listing draft RFQs:", err);
    res.status(500).json({ error: "Failed to fetch draft RFQs" });
  }
};

export const saveRFQDraft = async (
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
    });

    if (!rfq) {
      res.status(404).json({ error: "RFQ not found" });
      return;
    }

    if (!rfq.isProcessed || !rfq.customer) {
      res.status(400).json({ error: "RFQ is not ready for draft saving yet" });
      return;
    }

    const selections: SelectedRFQProduct[] = Array.isArray(req.body?.selectedProducts)
      ? req.body.selectedProducts
      : [];
    const manualProducts: ManualQuoteProduct[] = Array.isArray(req.body?.manualProducts)
      ? req.body.manualProducts
      : [];
    const regrettedLines: RegrettedRFQLine[] = Array.isArray(req.body?.regrettedLines)
      ? req.body.regrettedLines
      : [];

    if (selections.length === 0 && manualProducts.length === 0 && regrettedLines.length === 0) {
      res.status(400).json({ error: "No products selected" });
      return;
    }

    const products = resolveSelectedProducts(rfq, selections, manualProducts, regrettedLines);
    const paymentTerms = resolveQuotePaymentTerms(req.body ?? {}, rfq, organization);
    const deliveryTerms = resolveQuoteDeliveryTerms(req.body ?? {}, rfq, organization);
    const quoteNotes =
      req.body && "quoteNotes" in req.body ? nullableString(req.body.quoteNotes) : rfq.quoteNotes ?? null;
    const savedAt = new Date();
    rfq.savedQuoteProducts = products;
    rfq.paymentTermTemplateId = paymentTerms.paymentTermTemplateId;
    rfq.paymentTermName = paymentTerms.paymentTermName;
    rfq.paymentTerms = paymentTerms.paymentTerms;
    rfq.deliveryTermTemplateId = deliveryTerms.deliveryTermTemplateId;
    rfq.deliveryTermName = deliveryTerms.deliveryTermName;
    rfq.deliveryTerms = deliveryTerms.deliveryTerms;
    rfq.quoteNotes = quoteNotes;
    rfq.workflowStatus = "draft";
    rfq.draftSavedAt = savedAt;
    rfq.quoteNumber = null;
    rfq.processedAt = null;
    await rfq.save();

    const saved = await RFQ.findById(rfq._id)
      .populate("emailId", "subject from date snippet status")
      .lean();

    res.json(saved);
  } catch (err: any) {
    console.error("Error saving RFQ draft:", err);
    res.status(500).json({ error: err.message || "Failed to save RFQ draft" });
  }
};

export const setRFQQuoteNumber = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const quoteNumber = nullableString(req.body?.quoteNumber);

    if (!quoteNumber) {
      res.status(400).json({ error: "Quote number is required" });
      return;
    }

    const rfq = await RFQ.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: authReq.user.id,
        organizationId: organization._id,
        isRFQ: true,
        isArchived: { $ne: true },
      },
      {
        $set: {
          quoteNumber,
          workflowStatus: "processed",
          processedAt: new Date(),
        },
      },
      { new: true }
    )
      .populate("emailId", "subject from date snippet status")
      .lean();

    if (!rfq) {
      res.status(404).json({ error: "RFQ not found" });
      return;
    }

    res.json(rfq);
  } catch (err) {
    console.error("Error setting RFQ quote number:", err);
    res.status(500).json({ error: "Failed to set quote number" });
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
      await resolveOrganizationPdfBranding(organization),
      res,
      organization.preferences?.pricing || "INR"
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

    const selections: SelectedRFQProduct[] = Array.isArray(req.body?.selectedProducts)
      ? req.body.selectedProducts
      : [];
    const manualProducts: ManualQuoteProduct[] = Array.isArray(req.body?.manualProducts)
      ? req.body.manualProducts
      : [];
    const regrettedLines: RegrettedRFQLine[] = Array.isArray(req.body?.regrettedLines)
      ? req.body.regrettedLines
      : [];

    if (selections.length === 0 && manualProducts.length === 0 && regrettedLines.length === 0 && rfq.savedQuoteProducts.length === 0) {
      res.status(400).json({ error: "No products selected" });
      return;
    }

    const products =
      selections.length === 0 && manualProducts.length === 0 && regrettedLines.length === 0
        ? rfq.savedQuoteProducts
        : resolveSelectedProducts(rfq, selections, manualProducts, regrettedLines);
    const quotedProducts = products.filter((p) => p.lineStatus !== "regretted");
    const paymentTerms = resolveQuotePaymentTerms(req.body ?? {}, rfq, organization, true);
    const deliveryTerms = resolveQuoteDeliveryTerms(req.body ?? {}, rfq, organization, true);
    const quoteNotes =
      req.body && "quoteNotes" in req.body ? nullableString(req.body.quoteNotes) : rfq.quoteNotes ?? null;

    const email = rfq.emailId as any;
    const originalSenderEmail = extractEmailAddress(email?.from);
    const customerEmail = extractEmailAddress(rfq.customer.email) || originalSenderEmail;
    const [savedCustomer, customerSettings] = await Promise.all([
      customerEmail
        ? Customer.findOne({
            email: customerEmail,
            organizationId: organization._id,
          }).lean()
        : null,
      getOrCreateCustomerSettings(organization._id),
    ]);
    const customerDiscountEnabled = isSpecialDiscountEnabled([
      ...customerSettings.fieldDefinitions,
    ]);

    const { subject, body } = await generateQuoteReply({
      customerName: savedCustomer?.name || rfq.customer.name,
      customerCompany: savedCustomer?.company || rfq.customer.company,
      customerEmail,
      customerNotes: savedCustomer?.notes ?? null,
      specialDiscountPercentage: customerDiscountEnabled
        ? savedCustomer?.specialDiscountPercentage ?? null
        : null,
      organizationName: organization.name,
      organizationContactName: organization.defaultContact?.name,
      organizationContactEmail: organization.defaultContact?.email,
      organizationContactPhone: organization.defaultContact?.phoneNumber,
      currency: organization.preferences?.pricing || "INR",
      quotePaymentTerms: paymentTerms.paymentTerms,
      quoteDeliveryTerms: deliveryTerms.deliveryTerms,
      originalSubject: email?.subject || "",
      products: quotedProducts.map((p) => ({
        queryName: p.queryName,
        quantity: p.quantity,
        brand: p.brand,
        description: p.description,
        code: p.code,
        basePrice: p.basePrice,
        price: p.price,
        hsnCode: p.hsnCode,
        gstRate: p.gstRate,
        tax: p.tax ?? { code: p.hsnCode, rate: p.gstRate, label: "Tax" },
        adjustments: p.adjustments ?? quoteAdjustments(
          [],
          p.quantity,
          p.price,
          p.calibrationCharges
        ),
        discountPercent: p.discountPercent ?? 0,
      })),
    });

    // Upsert: replace existing reply if regenerating
    await RFQ.updateOne(
      { _id: rfq._id },
      {
        $set: {
          savedQuoteProducts: products,
          paymentTermTemplateId: paymentTerms.paymentTermTemplateId,
          paymentTermName: paymentTerms.paymentTermName,
          paymentTerms: paymentTerms.paymentTerms,
          deliveryTermTemplateId: deliveryTerms.deliveryTermTemplateId,
          deliveryTermName: deliveryTerms.deliveryTermName,
          deliveryTerms: deliveryTerms.deliveryTerms,
          quoteNotes,
          workflowStatus: "draft",
          draftSavedAt: new Date(),
          quoteNumber: null,
          processedAt: null,
        },
      }
    );

    const reply = await RFQReply.findOneAndUpdate(
      { rfqId: rfq._id },
      {
        userId: authReq.user.id,
        organizationId: organization._id,
        gmailAccountId: rfq.gmailAccountId,
        rfqId: rfq._id,
        selectedProducts: quotedProducts,
        specialDiscountPercentage: customerDiscountEnabled
          ? savedCustomer?.specialDiscountPercentage ?? 0
          : 0,
        paymentTermTemplateId: paymentTerms.paymentTermTemplateId,
        paymentTermName: paymentTerms.paymentTermName,
        paymentTerms: paymentTerms.paymentTerms ?? "",
        deliveryTermTemplateId: deliveryTerms.deliveryTermTemplateId,
        deliveryTermName: deliveryTerms.deliveryTermName,
        deliveryTerms: deliveryTerms.deliveryTerms ?? "",
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
    res.status(err.statusCode || 500).json({
      error: err.message || "Failed to generate quote",
    });
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

    const paymentTerms = reply.paymentTerms || rfq.paymentTerms;
    if (!paymentTerms?.trim()) {
      res.status(400).json({ error: "Payment terms are required to send a quote" });
      return;
    }
    const deliveryTerms = reply.deliveryTerms || rfq.deliveryTerms;
    if (!deliveryTerms?.trim()) {
      res.status(400).json({ error: "Delivery terms are required to send a quote" });
      return;
    }

    await RFQReply.updateOne(
      { _id: reply._id },
      { sendStatus: "sending", sendErrorMessage: null }
    );

    try {
      const quotePdf = await renderRFQQuotePdfBuffer({
        rfq: rfq as any,
        reply: reply as any,
        organization: await resolveOrganizationPdfBranding(organization),
        paymentTerms,
        deliveryTerms,
        currency: organization.preferences?.pricing || "INR",
      });
      const gmailMessageId = await sendQuoteOnGmailThread({
        account,
        email,
        to: reply.to,
        subject: reply.subject,
        body: reply.body,
        attachments: [
          {
            filename: rfqQuotePdfFilename(rfq as any),
            contentType: "application/pdf",
            content: quotePdf,
          },
        ],
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
