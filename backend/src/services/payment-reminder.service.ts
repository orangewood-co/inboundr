import { GmailAccount, type IGmailAccount } from "../models/gmail-account.model";
import { Invoice, type IInvoice, type InvoiceStatus } from "../models/invoice.model";
import {
  Organization,
  type IOrganization,
  type OrganizationReminderChannel,
} from "../models/organization.model";
import type { IWhatsAppAccount } from "../models/whatsapp-account.model";
import { sendStandaloneEmail } from "./gmail-send.service";
import { buildInvoiceUpiAssets, renderInvoicePdfBuffer } from "./invoice-pdf.service";
import {
  invoiceWhatsAppRecipient,
  resolveReminderWhatsAppAccount,
  sendInvoiceReminderOnWhatsApp,
} from "./invoice-whatsapp.service";
import { resolveInvoiceUpiId, resolveStatus } from "./invoice.service";
import { resolveOrganizationPdfBranding } from "./organization-pdf-branding.service";
import type { PdfOrganizationBranding } from "./pdf-branding.service";

const REMINDABLE_STATUSES: InvoiceStatus[] = ["sent", "viewed", "partially_paid", "overdue"];
const DAY_MS = 86_400_000;

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value || 0);
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(value);
}

export function effectiveReminderChannels(
  settings: { channels?: OrganizationReminderChannel[] | null } | null | undefined
): OrganizationReminderChannel[] {
  const channels = (settings?.channels ?? []).filter(
    (channel): channel is OrganizationReminderChannel => channel === "email" || channel === "whatsapp"
  );
  // Legacy orgs saved before channels existed keep the old email-only behaviour.
  return channels.length > 0 ? [...new Set(channels)] : ["email"];
}

function renderReminderEmail(invoice: IInvoice, daysPastDue: number, upiId: string): string {
  const organizationName = invoice.organizationSnapshot.name || "us";
  const dueLabel =
    daysPastDue > 0
      ? `${daysPastDue} day${daysPastDue === 1 ? "" : "s"} past its due date`
      : "due";

  return [
    `Hello ${invoice.customerSnapshot.name || invoice.customerSnapshot.company || "there"},`,
    "",
    `This is a friendly reminder that invoice ${invoice.invoiceNumber} from ${organizationName} is ${dueLabel}.`,
    `Amount due: ${formatMoney(invoice.totals.balanceDue)}`,
    invoice.dueDate ? `Due date: ${formatDate(new Date(invoice.dueDate))}` : "",
    upiId ? `Pay via UPI: ${upiId}` : "",
    "",
    "The invoice PDF is attached for your reference.",
    "",
    "If you have already made this payment, please disregard this email.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

async function sendEmailReminder(
  invoice: IInvoice,
  organization: IOrganization,
  account: IGmailAccount,
  branding: PdfOrganizationBranding,
  daysPastDue: number
): Promise<string> {
  const upiId = resolveInvoiceUpiId(invoice, organization);
  const assets = await buildInvoiceUpiAssets(invoice, organization);
  const pdf = await renderInvoicePdfBuffer(invoice, branding, assets);

  const gmailMessageId = await sendStandaloneEmail({
    account,
    to: invoice.customerSnapshot.email,
    subject: `Payment Reminder: Invoice ${invoice.invoiceNumber} from ${invoice.organizationSnapshot.name}`,
    body: renderReminderEmail(invoice, daysPastDue, upiId),
    attachments: [
      {
        filename: `${invoice.invoiceNumber}.pdf`,
        contentType: "application/pdf",
        content: pdf,
      },
    ],
  });
  return gmailMessageId ?? "";
}

interface ReminderSenders {
  email: IGmailAccount | null;
  whatsapp: IWhatsAppAccount | null;
}

/**
 * Sends one reminder offset for an invoice on every enabled channel that can
 * reach this customer. An offset is recorded as sent once at least one channel
 * succeeded; per-channel entries are logged so the invoice timeline shows how
 * the customer was reached.
 */
async function sendInvoiceReminder(
  invoice: IInvoice,
  organization: IOrganization,
  senders: ReminderSenders,
  channels: OrganizationReminderChannel[],
  branding: PdfOrganizationBranding,
  offsetDays: number,
  daysPastDue: number
): Promise<boolean> {
  const now = new Date();
  let sentAny = false;

  if (channels.includes("email") && senders.email && invoice.customerSnapshot.email) {
    try {
      const gmailMessageId = await sendEmailReminder(invoice, organization, senders.email, branding, daysPastDue);
      invoice.reminders.push({ offsetDays, sentAt: now, channel: "email", gmailMessageId, whatsappMessageId: "" });
      sentAny = true;
    } catch (err) {
      console.error(`Email payment reminder failed for invoice ${invoice._id}:`, err);
    }
  }

  if (channels.includes("whatsapp") && senders.whatsapp && invoiceWhatsAppRecipient(invoice)) {
    try {
      const result = await sendInvoiceReminderOnWhatsApp(invoice, organization, daysPastDue, {
        account: senders.whatsapp,
        branding,
      });
      invoice.reminders.push({
        offsetDays,
        sentAt: now,
        channel: "whatsapp",
        gmailMessageId: "",
        whatsappMessageId: result.messageId,
      });
      sentAny = true;
    } catch (err) {
      console.error(`WhatsApp payment reminder failed for invoice ${invoice._id}:`, (err as Error).message);
    }
  }

  if (sentAny) {
    invoice.status = resolveStatus(invoice.status, invoice.totals, invoice.dueDate);
    await invoice.save();
  }
  return sentAny;
}

async function sendOrganizationReminders(organization: IOrganization, now: Date): Promise<void> {
  const settings = organization.preferences?.paymentReminders;
  const offsets = settings?.offsets ?? [];
  if (offsets.length === 0) return;
  const channels = effectiveReminderChannels(settings);

  const invoices = await Invoice.find({
    organizationId: organization._id,
    status: { $in: REMINDABLE_STATUSES },
    remindersEnabled: true,
    dueDate: { $ne: null, $lte: now },
    "totals.balanceDue": { $gt: 0 },
  });
  if (invoices.length === 0) return;

  const senders: ReminderSenders = { email: null, whatsapp: null };

  if (channels.includes("email")) {
    // Customer-facing reminders go out from the business's own Gmail address,
    // mirroring how invoices are sent.
    senders.email = await GmailAccount.findOne({
      organizationId: organization._id,
      status: "connected",
    }).sort({ updatedAt: -1 });
    if (!senders.email) {
      console.warn(`Email payment reminders skipped for organization ${organization._id}: no connected Gmail account`);
    }
  }

  if (channels.includes("whatsapp")) {
    const resolved = await resolveReminderWhatsAppAccount(organization._id);
    senders.whatsapp = resolved.account;
    if (!resolved.account) {
      console.warn(`WhatsApp payment reminders skipped for organization ${organization._id}: ${resolved.reason}`);
    }
  }

  if (!senders.email && !senders.whatsapp) return;

  const branding = await resolveOrganizationPdfBranding(organization);

  for (const invoice of invoices) {
    try {
      const daysPastDue = Math.floor((now.getTime() - new Date(invoice.dueDate!).getTime()) / DAY_MS);
      // Each offset fires at most once. When several offsets have already
      // elapsed (e.g. reminders enabled on an old invoice), only the latest
      // one is sent so the customer doesn't get a backlog of reminders.
      const maxSentOffset = invoice.reminders.reduce(
        (max, reminder) => Math.max(max, reminder.offsetDays),
        -1
      );
      const pendingOffsets = offsets.filter(
        (offset) => offset <= daysPastDue && offset > maxSentOffset
      );
      if (pendingOffsets.length === 0) continue;

      await sendInvoiceReminder(
        invoice,
        organization,
        senders,
        channels,
        branding,
        Math.max(...pendingOffsets),
        daysPastDue
      );
    } catch (err) {
      console.error(`Failed to send payment reminder for invoice ${invoice._id}:`, err);
    }
  }
}

export async function sendDuePaymentReminders(now = new Date()): Promise<void> {
  const organizations = await Organization.find({
    status: "active",
    "preferences.paymentReminders.enabled": true,
    "preferences.paymentReminders.sendHourUtc": now.getUTCHours(),
  });

  for (const organization of organizations) {
    try {
      await sendOrganizationReminders(organization, now);
    } catch (err) {
      console.error(`Payment reminders failed for organization ${organization._id}:`, err);
    }
  }
}
