import type { ReactNode } from "react";
import { Document, Image, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  formatPdfDateTime,
  normalizePdfColor,
  pdfImageSource,
  type PdfOrganizationBranding,
} from "../pdf-branding.service";
import { parseEmailHtml } from "./email-html";
import { parsePlainTextBody } from "./plain-text";
import { RichBody } from "./RichBody";
import {
  formatEmailLabel,
  formatFileSize,
  formatMimeType,
  limitLength,
  parseEmailAddresses,
  toPdfSafeText,
  type EmailAddress,
} from "./text";
import type { ParsedBody, PdfEmail, PdfEmailClassification } from "./types";

const COLORS = {
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  soft: "#f9fafb",
  danger: "#b91c1c",
  white: "#ffffff",
};

const MAX_LABEL_CHIPS = 6;

const styles = StyleSheet.create({
  // No unitless lineHeight on the page: react-pdf resolves it against the base
  // font size and children inherit the absolute value, which makes larger text
  // overlap the following line.
  page: {
    paddingTop: 40,
    paddingBottom: 54,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: COLORS.text,
  },
  letterhead: { width: "100%", height: 64, objectFit: "contain", marginBottom: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  wordmarkBlock: { maxWidth: 240 },
  wordmark: { fontFamily: "Helvetica-Bold", fontSize: 22, letterSpacing: 1.5 },
  wordmarkSub: { fontSize: 7.5, color: COLORS.muted, letterSpacing: 0.8, marginTop: 3 },
  orgBlock: { maxWidth: 230, alignItems: "flex-end" },
  logo: { height: 30, width: 110, objectFit: "contain", marginBottom: 6 },
  orgName: { fontFamily: "Helvetica-Bold", fontSize: 11.5, textAlign: "right" },
  orgLine: { fontSize: 8, color: COLORS.muted, lineHeight: 1.45, textAlign: "right" },
  rule: { height: 2, borderRadius: 2, marginTop: 14, marginBottom: 16 },
  subject: { fontFamily: "Helvetica-Bold", fontSize: 15, lineHeight: 1.3 },
  subjectMeta: { fontSize: 8.5, color: COLORS.muted, marginTop: 4 },
  metaCard: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    marginTop: 14,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  metaRows: { flex: 1, paddingRight: 12 },
  metaRow: { flexDirection: "row", paddingVertical: 5 },
  metaRowDivider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  metaLabel: {
    width: 46,
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: COLORS.muted,
    letterSpacing: 0.5,
    paddingTop: 1.5,
  },
  metaValue: { flex: 1, fontSize: 9, lineHeight: 1.45 },
  metaValueMuted: { color: COLORS.muted },
  metaValueLink: { color: COLORS.muted, textDecoration: "none" },
  pillColumn: { width: 118, alignItems: "flex-end", paddingVertical: 7 },
  pill: {
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    letterSpacing: 0.4,
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  pillOutline: { borderWidth: 1 },
  chip: {
    fontSize: 6.5,
    color: COLORS.muted,
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 3,
    marginBottom: 3,
  },
  bodyDivider: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 18, marginBottom: 16 },
  sectionLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: COLORS.muted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  attachments: { marginTop: 16 },
  attachmentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 5,
  },
  attachmentName: { flex: 1, fontSize: 8.5, paddingRight: 10 },
  attachmentType: { width: 120, fontSize: 8, color: COLORS.muted },
  attachmentSize: { width: 52, fontSize: 8, color: COLORS.muted, textAlign: "right" },
  footnotes: { marginTop: 18, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  footnote: { fontSize: 7.5, color: COLORS.muted, lineHeight: 1.45, marginBottom: 3 },
  footnoteLabel: { fontFamily: "Helvetica-Bold", color: COLORS.muted },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: COLORS.muted,
  },
  footerReference: { flex: 1, paddingRight: 12, maxLines: 1, textOverflow: "ellipsis" },
  emptyBody: { fontSize: 9, color: COLORS.muted, fontFamily: "Helvetica-Oblique" },
});

function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function selectBody(email: PdfEmail): ParsedBody {
  const html = email.bodyHtml?.trim();
  const parsedHtml = html ? parseEmailHtml(html) : null;
  if (parsedHtml && parsedHtml.blocks.length > 0) return parsedHtml;

  // An HTML part that yielded no blocks can still tell us it carried images.
  const hasImages = parsedHtml?.hasImages ?? false;
  const text = parsePlainTextBody(email.bodyText);
  if (text.blocks.length > 0) return { ...text, hasImages };

  return { ...parsePlainTextBody(email.snippet), hasImages };
}

function AddressValue({ addresses, raw }: { addresses: EmailAddress[]; raw: string }) {
  if (addresses.length === 0) {
    return <Text style={styles.metaValue}>{toPdfSafeText(raw) || "-"}</Text>;
  }

  const parts: ReactNode[] = [];
  addresses.forEach((address, index) => {
    if (index > 0) parts.push(<Text key={`sep-${index}`}>, </Text>);
    if (address.name) {
      parts.push(<Text key={`name-${index}`}>{address.name}</Text>);
      if (address.email) {
        parts.push(
          <Text key={`mail-${index}`} style={styles.metaValueMuted}>
            {` <${address.email}>`}
          </Text>
        );
      }
      return;
    }
    parts.push(
      <Link key={`link-${index}`} src={`mailto:${address.email}`} style={styles.metaValueLink}>
        {address.email}
      </Link>
    );
  });

  return <Text style={styles.metaValue}>{parts}</Text>;
}

function MetaRow({
  label,
  value,
  first,
}: {
  label: string;
  value: string | null | undefined;
  first: boolean;
}) {
  const addresses = parseEmailAddresses(value);
  return (
    <View style={[styles.metaRow, first ? {} : styles.metaRowDivider]}>
      <Text style={styles.metaLabel}>{label.toUpperCase()}</Text>
      <AddressValue addresses={addresses} raw={value ?? ""} />
    </View>
  );
}

export type EmailDocumentProps = {
  email: PdfEmail;
  branding: PdfOrganizationBranding;
  classification?: PdfEmailClassification | null;
};

export function EmailDocument({ email, branding, classification }: EmailDocumentProps) {
  const primary = normalizePdfColor(branding.primaryColor);
  const letterhead = pdfImageSource(branding.letterheadBuffer);
  const logo = pdfImageSource(branding.logoBuffer);
  const subject = toPdfSafeText(email.subject || "").trim() || "(no subject)";
  const orgName = toPdfSafeText(branding.name || "").trim() || "Organization";
  const contactLines = [branding.address, branding.email, branding.phoneNumber, branding.website]
    .map((line) => toPdfSafeText(line ?? "").trim())
    .filter(Boolean);

  const body = selectBody(email);
  const attachments = email.attachments ?? [];
  const labels = (email.labels ?? []).map(formatEmailLabel).filter(Boolean);
  const rfqErrorNote = toPdfSafeText(classification?.errorMessage ?? "")
    .replace(/\s+/g, " ")
    .trim();

  const showFootnotes = Boolean(rfqErrorNote) || body.hasImages || body.truncated;

  return (
    <Document
      title={subject}
      author={orgName}
      subject="Email"
      keywords="email, inbox, correspondence"
    >
      <Page size="A4" style={styles.page}>
        {letterhead ? <Image src={letterhead} style={styles.letterhead} /> : null}

        <View style={styles.header}>
          <View style={styles.wordmarkBlock}>
            <Text style={[styles.wordmark, { color: primary }]}>EMAIL</Text>
            <Text style={styles.wordmarkSub}>CORRESPONDENCE RECORD</Text>
          </View>
          <View style={styles.orgBlock}>
            {logo ? <Image src={logo} style={styles.logo} /> : null}
            <Text style={styles.orgName}>{orgName}</Text>
            {contactLines.map((line, index) => (
              <Text key={index} style={styles.orgLine}>
                {line}
              </Text>
            ))}
          </View>
        </View>

        <View style={[styles.rule, { backgroundColor: primary }]} />

        <Text style={styles.subject}>{subject}</Text>
        <Text style={styles.subjectMeta}>{formatPdfDateTime(email.date)}</Text>

        <View style={styles.metaCard}>
          <View style={styles.metaRows}>
            <MetaRow label="From" value={email.from} first />
            <MetaRow label="To" value={email.to} first={false} />
            {email.cc ? <MetaRow label="Cc" value={email.cc} first={false} /> : null}
            {email.bcc ? <MetaRow label="Bcc" value={email.bcc} first={false} /> : null}
          </View>
          <View style={styles.pillColumn}>
            <Text style={[styles.pill, { backgroundColor: primary, color: COLORS.white }]}>
              {titleCase(email.status || "received").toUpperCase()}
            </Text>
            {classification?.isRFQ == null ? null : (
              <Text style={[styles.pill, styles.pillOutline, { borderColor: primary, color: primary }]}>
                {classification.isRFQ ? "RFQ" : "NOT AN RFQ"}
              </Text>
            )}
            {attachments.length > 0 ? (
              <Text style={styles.chip}>
                {attachments.length} {attachments.length === 1 ? "attachment" : "attachments"}
              </Text>
            ) : null}
            {labels.slice(0, MAX_LABEL_CHIPS).map((label, index) => (
              <Text key={index} style={styles.chip}>
                {label}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.bodyDivider} />

        {body.blocks.length > 0 ? (
          <RichBody blocks={body.blocks} accent={primary} />
        ) : (
          <Text style={styles.emptyBody}>This email has no readable content.</Text>
        )}

        {attachments.length > 0 ? (
          <View style={styles.attachments}>
            <Text style={styles.sectionLabel}>ATTACHMENTS</Text>
            {attachments.map((attachment, index) => (
              <View key={index} style={styles.attachmentRow} wrap={false}>
                <Text style={styles.attachmentName}>
                  {toPdfSafeText(attachment.filename || "").trim() || "Attachment"}
                </Text>
                <Text style={styles.attachmentType}>{formatMimeType(attachment.mimeType)}</Text>
                <Text style={styles.attachmentSize}>{formatFileSize(attachment.size)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {showFootnotes ? (
          <View style={styles.footnotes}>
            {rfqErrorNote ? (
              <Text style={[styles.footnote, { color: COLORS.danger }]}>
                <Text style={styles.footnoteLabel}>RFQ processing error: </Text>
                {rfqErrorNote}
              </Text>
            ) : null}
            {body.hasImages ? (
              <Text style={styles.footnote}>Inline email images are not embedded in this export.</Text>
            ) : null}
            {body.truncated ? (
              <Text style={styles.footnote}>
                This email was unusually long; the trailing content was omitted.
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerReference}>
            {limitLength(`${orgName} \u00b7 ${subject}`, 110)}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
