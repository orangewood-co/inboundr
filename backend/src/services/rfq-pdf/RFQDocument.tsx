import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  formatPdfDateTime,
  normalizePdfColor,
  pdfImageSource,
  type PdfOrganizationBranding,
} from "../pdf-branding.service";
import { limitLength, parseEmailAddresses, toPdfSafeText } from "../email-pdf/text";
import type { PdfRFQ, PdfRFQMatch, PdfRFQSearchResult } from "./types";

const COLORS = {
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  soft: "#f9fafb",
  danger: "#b91c1c",
  white: "#ffffff",
};

const MAX_MATCHES_PER_QUERY = 3;

const styles = StyleSheet.create({
  // See EmailDocument: no unitless lineHeight on the page, it would be inherited
  // as an absolute value and make larger text overlap.
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
  orgName: { fontFamily: "Helvetica-Bold", fontSize: 11.5, textAlign: "right", lineHeight: 1.3 },
  orgLine: { fontSize: 8, color: COLORS.muted, lineHeight: 1.45, textAlign: "right" },
  rule: { height: 2, borderRadius: 2, marginTop: 12, marginBottom: 14 },
  subject: { fontFamily: "Helvetica-Bold", fontSize: 15, lineHeight: 1.3 },
  subjectMeta: { fontSize: 8.5, color: COLORS.muted, marginTop: 4 },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    marginTop: 14,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  metaCard: { flexDirection: "row" },
  metaRows: { flex: 1, paddingRight: 12 },
  metaRow: { flexDirection: "row", paddingVertical: 5 },
  rowDivider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  metaLabel: {
    width: 60,
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: COLORS.muted,
    letterSpacing: 0.5,
    paddingTop: 1.5,
  },
  metaValue: { flex: 1, fontSize: 9, lineHeight: 1.45 },
  muted: { color: COLORS.muted },
  pillColumn: { width: 100, alignItems: "flex-end", paddingVertical: 7 },
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
  section: { marginTop: 16 },
  sectionLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: COLORS.muted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  paragraph: { fontSize: 9, lineHeight: 1.5, color: COLORS.muted },
  errorText: { fontSize: 9, lineHeight: 1.5, color: COLORS.danger },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", paddingVertical: 4 },
  field: { width: "50%", paddingVertical: 5, paddingRight: 12 },
  fieldWide: { width: "100%" },
  fieldLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: COLORS.muted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fieldValue: { fontSize: 9, lineHeight: 1.45 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.text,
    paddingBottom: 4,
  },
  tableHeadCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: COLORS.muted,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 6,
  },
  colIndex: { width: 22, fontSize: 8.5, color: COLORS.muted },
  colMain: { flex: 1, paddingRight: 10 },
  colQty: { width: 50, fontSize: 9, textAlign: "right" },
  colTax: { width: 56, fontSize: 8.5, textAlign: "right" },
  colPrice: { width: 90, fontSize: 9, textAlign: "right" },
  colScore: { width: 40, fontSize: 8.5, color: COLORS.muted, textAlign: "right" },
  cellTitle: { fontSize: 9, lineHeight: 1.4 },
  cellTitleBold: { fontFamily: "Helvetica-Bold", fontSize: 9, lineHeight: 1.4 },
  cellSub: { fontSize: 7.5, color: COLORS.muted, lineHeight: 1.4, marginTop: 1 },
  queryBlock: { marginBottom: 12 },
  queryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  queryTitle: { flex: 1, paddingRight: 10 },
  queryStatus: { fontFamily: "Helvetica-Bold", fontSize: 6.5, letterSpacing: 0.4, paddingTop: 2 },
  emptyMatches: { fontSize: 8.5, color: COLORS.muted, paddingVertical: 6, paddingLeft: 22 },
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
});

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Gmail snippets arrive HTML-escaped ("Ma&#39;am"). */
function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function clean(value: string | number | null | undefined): string {
  if (value == null) return "";
  return toPdfSafeText(decodeEntities(String(value))).replace(/\s+/g, " ").trim();
}

function money(value: number | null | undefined, currency: string): string {
  if (value == null) return "-";
  // Helvetica has no rupee glyph, so print the currency code instead of the symbol.
  return toPdfSafeText(
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      maximumFractionDigits: 2,
    }).format(value)
  );
}

function percent(value: number | null | undefined): string {
  if (value == null) return "-";
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
}

const STATUS_LABELS: Record<PdfRFQSearchResult["status"], string> = {
  matched: "MATCHED",
  ambiguous: "NEEDS REVIEW",
  no_match: "NO MATCH",
};

function rfqStatus(rfq: PdfRFQ): { label: string; danger: boolean } {
  if (rfq.errorMessage) return { label: "ERROR", danger: true };
  if (!rfq.isRFQ) return { label: "NOT AN RFQ", danger: false };
  return { label: rfq.isProcessed ? "PROCESSED" : "PENDING", danger: false };
}

function MetaRow({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <View style={[styles.metaRow, first ? {} : styles.rowDivider]}>
      <Text style={styles.metaLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.metaValue}>{value || "-"}</Text>
    </View>
  );
}

function SenderRow({ raw }: { raw: string | null | undefined }) {
  const [sender] = parseEmailAddresses(raw);
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>FROM</Text>
      {sender?.name ? (
        <Text style={styles.metaValue}>
          {sender.name}
          <Text style={styles.muted}>{` <${sender.email}>`}</Text>
        </Text>
      ) : (
        <Text style={styles.metaValue}>{sender?.email || clean(raw) || "-"}</Text>
      )}
    </View>
  );
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.field, wide ? styles.fieldWide : {}]}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.fieldValue}>{value || "-"}</Text>
    </View>
  );
}

function matchDetails(match: PdfRFQMatch): string {
  const hsn = clean(match.tax?.code ?? match.hsnCode);
  return [clean(match.brand), clean(match.code), hsn ? `HSN ${hsn}` : "", match.isTopSeller ? "Featured" : ""]
    .filter(Boolean)
    .join("  ·  ");
}

function SearchResultBlock({
  result,
  currency,
  accent,
  taxLabel,
}: {
  result: PdfRFQSearchResult;
  currency: string;
  accent: string;
  taxLabel: string;
}) {
  const matches = result.matches.slice(0, MAX_MATCHES_PER_QUERY);
  const statusColor = result.status === "no_match" ? COLORS.danger : result.status === "matched" ? accent : COLORS.muted;
  const brand = clean(result.matchedBrand);

  return (
    <View style={styles.queryBlock}>
      <View style={styles.queryHeader} wrap={false} minPresenceAhead={60}>
        <View style={styles.queryTitle}>
          <Text style={styles.cellTitleBold}>{clean(result.query.name) || "Requested product"}</Text>
          <Text style={styles.cellSub}>
            {[`Qty ${result.query.quantity}`, brand ? `Brand ${brand}` : ""].filter(Boolean).join("  ·  ")}
          </Text>
        </View>
        <Text style={[styles.queryStatus, { color: statusColor }]}>{STATUS_LABELS[result.status]}</Text>
      </View>

      {matches.length === 0 ? (
        <Text style={styles.emptyMatches}>No catalogue matches found.</Text>
      ) : (
        <>
          <View style={[styles.tableHead, { borderBottomColor: COLORS.border, paddingTop: 4 }]} wrap={false}>
            <Text style={[styles.tableHeadCell, styles.colIndex]}>#</Text>
            <Text style={[styles.tableHeadCell, styles.colMain]}>MATCHED PRODUCT</Text>
            <Text style={[styles.tableHeadCell, styles.colTax]}>{taxLabel.toUpperCase()}</Text>
            <Text style={[styles.tableHeadCell, styles.colPrice]}>PRICE</Text>
            <Text style={[styles.tableHeadCell, styles.colScore]}>SCORE</Text>
          </View>
          {matches.map((match, index) => {
            const details = matchDetails(match);
            return (
              <View key={index} style={styles.tableRow} wrap={false}>
                <Text style={styles.colIndex}>{index + 1}</Text>
                <View style={styles.colMain}>
                  <Text style={styles.cellTitle}>
                    {clean(match.description) || clean(match.code) || "Matched product"}
                  </Text>
                  {details ? <Text style={styles.cellSub}>{details}</Text> : null}
                </View>
                <Text style={styles.colTax}>{percent(match.tax?.rate ?? match.gstRate)}</Text>
                <Text style={styles.colPrice}>{money(match.price, currency)}</Text>
                <Text style={styles.colScore}>{Math.round(match.score)}</Text>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

export type RFQDocumentProps = {
  rfq: PdfRFQ;
  branding: PdfOrganizationBranding;
  currency: string;
};

export function RFQDocument({ rfq, branding, currency }: RFQDocumentProps) {
  const primary = normalizePdfColor(branding.primaryColor);
  const letterhead = pdfImageSource(branding.letterheadBuffer);
  const logo = pdfImageSource(branding.logoBuffer);
  const email = rfq.emailId;
  const subject = clean(email?.subject) || "Request for quotation";
  const orgName = clean(branding.name) || "Organization";
  const contactLines = [branding.address, branding.email, branding.phoneNumber, branding.website]
    .map(clean)
    .filter(Boolean);

  const status = rfqStatus(rfq);
  const snippet = clean(email?.snippet);
  const errorMessage = clean(rfq.errorMessage);
  const customer = rfq.customer;
  const products = rfq.queryProducts ?? [];
  const searchResults = rfq.searchResults ?? [];
  const taxLabel =
    clean(searchResults.flatMap((result) => result.matches).find((match) => match.tax?.label)?.tax?.label) || "Tax";

  return (
    <Document title={subject} author={orgName} subject="RFQ" keywords="rfq, request for quote, pdf">
      <Page size="A4" style={styles.page}>
        {letterhead ? <Image src={letterhead} style={styles.letterhead} /> : null}

        <View style={styles.header}>
          <View style={styles.wordmarkBlock}>
            <Text style={[styles.wordmark, { color: primary }]}>RFQ</Text>
            <Text style={styles.wordmarkSub}>REQUEST FOR QUOTATION</Text>
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
        <Text style={styles.subjectMeta}>Captured {formatPdfDateTime(rfq.createdAt)}</Text>

        <View style={[styles.card, styles.metaCard]} wrap={false}>
          <View style={styles.metaRows}>
            {email ? (
              <>
                <SenderRow raw={email.from} />
                <MetaRow label="Received" value={formatPdfDateTime(email.date)} />
              </>
            ) : (
              <MetaRow label="Source" value="Manual entry" first />
            )}
            <MetaRow label="Items" value={`${products.length} requested`} />
          </View>
          <View style={styles.pillColumn}>
            <Text
              style={[
                styles.pill,
                { backgroundColor: status.danger ? COLORS.danger : primary, color: COLORS.white },
              ]}
            >
              {status.label}
            </Text>
          </View>
        </View>

        {errorMessage ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel} minPresenceAhead={48}>PROCESSING ERROR</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {customer ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionLabel} minPresenceAhead={48}>CUSTOMER</Text>
            <View style={[styles.card, styles.fieldGrid, { marginTop: 0 }]}>
              <Field label="Name" value={clean(customer.name)} />
              <Field label="Company" value={clean(customer.company)} />
              <Field label="Email" value={clean(customer.email)} />
              <Field label="Phone" value={clean(customer.contactNumber)} />
              <Field label="Address" value={clean(customer.address)} wide />
            </View>
          </View>
        ) : null}

        {snippet ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel} minPresenceAhead={48}>SOURCE EMAIL</Text>
            <Text style={styles.paragraph}>{limitLength(snippet, 600)}</Text>
          </View>
        ) : null}

        {products.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel} minPresenceAhead={48}>REQUESTED PRODUCTS</Text>
            <View style={styles.tableHead} wrap={false}>
              <Text style={[styles.tableHeadCell, styles.colIndex]}>#</Text>
              <Text style={[styles.tableHeadCell, styles.colMain]}>PRODUCT</Text>
              <Text style={[styles.tableHeadCell, styles.colQty]}>QTY</Text>
            </View>
            {products.map((product, index) => (
              <View key={index} style={styles.tableRow} wrap={false}>
                <Text style={styles.colIndex}>{index + 1}</Text>
                <Text style={[styles.colMain, styles.cellTitle]}>{clean(product.name) || "-"}</Text>
                <Text style={styles.colQty}>{product.quantity}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {searchResults.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel} minPresenceAhead={48}>PRODUCT MATCHES</Text>
            {searchResults.map((result, index) => (
              <SearchResultBlock
                key={index}
                result={result}
                currency={currency}
                accent={primary}
                taxLabel={taxLabel}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerReference}>{limitLength(`${orgName} · ${subject}`, 110)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
