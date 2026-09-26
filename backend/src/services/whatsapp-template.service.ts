import { getWhatsAppPlatformConfig } from "../config/whatsapp.config";
import {
  WhatsAppAccount,
  type IWhatsAppAccount,
  type IWhatsAppAccountTemplate,
  type WhatsAppTemplateStatus,
} from "../models/whatsapp-account.model";
import {
  WhatsAppApiError,
  createWhatsAppTemplate,
  listWhatsAppTemplates,
  uploadWhatsAppTemplateSample,
  type WhatsAppTemplateDefinition,
} from "./whatsapp.service";

/**
 * Inboundr-managed message templates. Meta requires every business-initiated
 * message (anything outside the 24h customer-service window) to be an approved
 * template, so invoices and payment reminders are defined here once and
 * created on each connected WABA.
 *
 * Rules to keep Meta's reviewer happy: body must start and end with literal
 * text, variables are sequential `{{n}}`, no more than ~1 variable per short
 * sentence, and UTILITY category for transactional content.
 */

export const WHATSAPP_TEMPLATE_LANGUAGE = "en";

export const WHATSAPP_TEMPLATE_NAMES = {
  invoice: "inboundr_invoice",
  paymentReminder: "inboundr_payment_reminder",
} as const;

export type WhatsAppTemplateKey = keyof typeof WHATSAPP_TEMPLATE_NAMES;

interface CatalogTemplate {
  key: WhatsAppTemplateKey;
  name: string;
  description: string;
  bodyText: string;
  bodyExample: string[];
  headerFormat: "DOCUMENT";
}

export const WHATSAPP_TEMPLATE_CATALOG: CatalogTemplate[] = [
  {
    key: "invoice",
    name: WHATSAPP_TEMPLATE_NAMES.invoice,
    description: "Sends a new invoice with the PDF attached.",
    headerFormat: "DOCUMENT",
    bodyText:
      "Hello {{1}}, please find invoice {{2}} from {{3}} attached. Amount due: {{4}}. Due date: {{5}}. Reply to this message if you have any questions about the invoice.",
    bodyExample: ["Rahul", "INV-0042", "Acme Tools Pvt. Ltd.", "₹12,500.00", "30 Sep 2026"],
  },
  {
    key: "paymentReminder",
    name: WHATSAPP_TEMPLATE_NAMES.paymentReminder,
    description: "Automatic reminder for due and overdue invoices, with the PDF attached.",
    headerFormat: "DOCUMENT",
    bodyText:
      "Hello {{1}}, this is a reminder that invoice {{2}} from {{3}} is {{4}}. Amount due: {{5}}. Due date: {{6}}. The invoice is attached for reference. If you have already made this payment, please ignore this message.",
    bodyExample: [
      "Rahul",
      "INV-0042",
      "Acme Tools Pvt. Ltd.",
      "7 days past its due date",
      "₹12,500.00",
      "23 Sep 2026",
    ],
  },
];

/** Minimal single-page PDF used as the media-header sample when creating templates. */
const SAMPLE_PDF = Buffer.from(
  [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    "4 0 obj << /Length 45 >> stream",
    "BT /F1 24 Tf 72 760 Td (Sample invoice) Tj ET",
    "endstream endobj",
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    "trailer << /Root 1 0 R >>",
    "%%EOF",
  ].join("\n"),
  "utf8"
);

function normalizeStatus(value: string): WhatsAppTemplateStatus {
  const upper = String(value ?? "").toUpperCase();
  if (
    upper === "APPROVED" ||
    upper === "PENDING" ||
    upper === "REJECTED" ||
    upper === "PAUSED" ||
    upper === "DISABLED" ||
    upper === "IN_APPEAL"
  ) {
    return upper;
  }
  return "PENDING";
}

function buildDefinition(template: CatalogTemplate, headerHandle: string): WhatsAppTemplateDefinition {
  return {
    name: template.name,
    language: WHATSAPP_TEMPLATE_LANGUAGE,
    category: "UTILITY",
    components: [
      {
        type: "HEADER",
        format: template.headerFormat,
        example: { header_handle: [headerHandle] },
      },
      {
        type: "BODY",
        text: template.bodyText,
        example: { body_text: [template.bodyExample] },
      },
    ],
  };
}

export function templateStatusFor(
  account: Pick<IWhatsAppAccount, "templates">,
  key: WhatsAppTemplateKey
): IWhatsAppAccountTemplate | null {
  const name = WHATSAPP_TEMPLATE_NAMES[key];
  return account.templates?.find((template) => template.name === name) ?? null;
}

export function isTemplateApproved(
  account: Pick<IWhatsAppAccount, "templates">,
  key: WhatsAppTemplateKey
): boolean {
  return templateStatusFor(account, key)?.status === "APPROVED";
}

export interface TemplateSyncResult {
  templates: IWhatsAppAccountTemplate[];
  created: string[];
  errors: Array<{ name: string; message: string }>;
}

/**
 * Reconciles the catalog with the WABA: refreshes status of existing templates
 * and creates any that are missing (when an app id is available for the sample
 * upload). Persists the snapshot on the account.
 */
export async function syncWhatsAppTemplates(account: IWhatsAppAccount): Promise<TemplateSyncResult> {
  const errors: TemplateSyncResult["errors"] = [];
  const created: string[] = [];
  const now = new Date();

  if (!account.wabaId) {
    const templates = WHATSAPP_TEMPLATE_CATALOG.map<IWhatsAppAccountTemplate>((template) => ({
      name: template.name,
      language: WHATSAPP_TEMPLATE_LANGUAGE,
      category: "UTILITY",
      status: "MISSING",
      metaId: null,
      rejectedReason: "Add the WhatsApp Business Account ID to manage templates.",
      updatedAt: now,
    }));
    await WhatsAppAccount.updateOne({ _id: account._id }, { templates, templatesSyncedAt: now });
    account.templates = templates;
    return { templates, created, errors };
  }

  const scoped = account as IWhatsAppAccount & { wabaId: string };
  const remote = await listWhatsAppTemplates(scoped);
  const remoteByName = new Map(
    remote
      .filter((template) => template.language === WHATSAPP_TEMPLATE_LANGUAGE)
      .map((template) => [template.name, template])
  );

  const appId = account.appId || getWhatsAppPlatformConfig().appId;
  let headerHandle: string | null = null;

  const templates: IWhatsAppAccountTemplate[] = [];
  for (const catalog of WHATSAPP_TEMPLATE_CATALOG) {
    const existing = remoteByName.get(catalog.name);
    if (existing) {
      templates.push({
        name: catalog.name,
        language: WHATSAPP_TEMPLATE_LANGUAGE,
        category: existing.category || "UTILITY",
        status: normalizeStatus(existing.status),
        metaId: existing.id,
        rejectedReason: existing.rejectedReason,
        updatedAt: now,
      });
      continue;
    }

    if (!appId) {
      templates.push({
        name: catalog.name,
        language: WHATSAPP_TEMPLATE_LANGUAGE,
        category: "UTILITY",
        status: "MISSING",
        metaId: null,
        rejectedReason: "Add the Meta App ID so Inboundr can create this template.",
        updatedAt: now,
      });
      continue;
    }

    try {
      headerHandle ??= await uploadWhatsAppTemplateSample(account, appId, {
        name: "sample-invoice.pdf",
        contentType: "application/pdf",
        data: SAMPLE_PDF,
      });
      const result = await createWhatsAppTemplate(scoped, buildDefinition(catalog, headerHandle));
      created.push(catalog.name);
      templates.push({
        name: catalog.name,
        language: WHATSAPP_TEMPLATE_LANGUAGE,
        category: result.category || "UTILITY",
        status: normalizeStatus(result.status),
        metaId: result.id,
        rejectedReason: null,
        updatedAt: now,
      });
    } catch (err) {
      const message =
        err instanceof WhatsAppApiError ? err.details || err.message : (err as Error)?.message || "Failed";
      console.error(`Failed to create WhatsApp template ${catalog.name} on WABA ${account.wabaId}:`, err);
      errors.push({ name: catalog.name, message });
      templates.push({
        name: catalog.name,
        language: WHATSAPP_TEMPLATE_LANGUAGE,
        category: "UTILITY",
        status: "MISSING",
        metaId: null,
        rejectedReason: message.slice(0, 500),
        updatedAt: now,
      });
    }
  }

  await WhatsAppAccount.updateOne({ _id: account._id }, { templates, templatesSyncedAt: now });
  account.templates = templates;
  account.templatesSyncedAt = now;
  return { templates, created, errors };
}

/**
 * Applies a `message_template_status_update` webhook to the stored snapshot.
 * Unknown templates (not in the catalog) are ignored.
 */
export async function applyTemplateStatusUpdate(
  account: IWhatsAppAccount,
  update: {
    message_template_id?: string | number;
    message_template_name?: string;
    message_template_language?: string;
    event?: string;
    reason?: string;
  }
): Promise<void> {
  const name = String(update.message_template_name ?? "");
  if (!Object.values(WHATSAPP_TEMPLATE_NAMES).includes(name as never)) return;
  if (update.message_template_language && update.message_template_language !== WHATSAPP_TEMPLATE_LANGUAGE) return;

  const status = normalizeStatus(String(update.event ?? ""));
  const now = new Date();
  const existing = account.templates.find((template) => template.name === name);
  const next: IWhatsAppAccountTemplate = {
    name,
    language: WHATSAPP_TEMPLATE_LANGUAGE,
    category: existing?.category ?? "UTILITY",
    status,
    metaId: update.message_template_id ? String(update.message_template_id) : existing?.metaId ?? null,
    rejectedReason: status === "REJECTED" ? String(update.reason ?? "Rejected by Meta") : null,
    updatedAt: now,
  };
  const templates = existing
    ? account.templates.map((template) => (template.name === name ? next : template))
    : [...account.templates, next];
  await WhatsAppAccount.updateOne({ _id: account._id }, { templates });
}
