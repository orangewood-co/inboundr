import { GmailAccount } from "../models/gmail-account.model";
import { Invoice, type IInvoice, type InvoiceStatus } from "../models/invoice.model";
import { Organization, type IOrganization } from "../models/organization.model";
import { sendStandaloneEmail } from "./gmail-send.service";
import { buildInvoiceUpiAssets, renderInvoicePdfBuffer } from "./invoice-pdf.service";
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

async function sendInvoiceReminder(
  invoice: IInvoice,
  organization: IOrganization,
  account: Parameters<typeof sendStandaloneEmail>[0]["account"],
  branding: PdfOrganizationBranding,
  offsetDays: number,
  daysPastDue: number
): Promise<void> {
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

  invoice.reminders.push({
    offsetDays,
    sentAt: new Date(),
    gmailMessageId: gmailMessageId ?? "",
  });
  invoice.status = resolveStatus(invoice.status, invoice.totals, invoice.dueDate);
  await invoice.save();
}

async function sendOrganizationReminders(organization: IOrganization, now: Date): Promise<void> {
  const settings = organization.preferences?.paymentReminders;
  const offsets = settings?.offsets ?? [];
  if (offsets.length === 0) return;

  const invoices = await Invoice.find({
    organizationId: organization._id,
    status: { $in: REMINDABLE_STATUSES },
    remindersEnabled: true,
    dueDate: { $ne: null, $lte: now },
    "totals.balanceDue": { $gt: 0 },
    "customerSnapshot.email": { $nin: [null, ""] },
  });
  if (invoices.length === 0) return;

  // Customer-facing reminders go out from the business's own Gmail address,
  // mirroring how invoices are sent. Orgs without a connected account are skipped.
  const account = await GmailAccount.findOne({
    organizationId: organization._id,
    status: "connected",
  }).sort({ updatedAt: -1 });
  if (!account) {
    console.warn(
      `Payment reminders skipped for organization ${organization._id}: no connected Gmail account`
    );
    return;
  }

  const branding = await resolveOrganizationPdfBranding(organization);

  for (const invoice of invoices) {
    try {
      const daysPastDue = Math.floor((now.getTime() - new Date(invoice.dueDate!).getTime()) / DAY_MS);
      // Each offset fires at most once. When several offsets have already
      // elapsed (e.g. reminders enabled on an old invoice), only the latest
      // one is sent so the customer doesn't get a backlog of emails.
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
        account,
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
