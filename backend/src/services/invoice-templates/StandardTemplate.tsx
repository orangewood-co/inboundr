import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { FONT } from "./fonts";
import {
  amount,
  customerLines,
  documentStatus,
  formatDate,
  imageSource,
  invoiceHasDiscount,
  invoiceHasTax,
  lineItemMeta,
  money,
  normalizeColor,
  orgContactLines,
  resolveBranding,
  shippingAddress,
} from "./shared";
import type { InvoiceTemplateProps } from "./types";

const C = {
  ink: "#15171a",
  body: "#3a3d42",
  muted: "#7a7e85",
  rule: "#e3e4e7",
  good: "#067647",
  bad: "#b42318",
};

const PAD_X = 48;

const styles = StyleSheet.create({
  // No lineHeight on the page: react-pdf resolves a unitless page lineHeight
  // against the base fontSize and children inherit the absolute value, so
  // larger text overlaps the next line. Leading is set per-style instead.
  page: {
    paddingTop: 46,
    paddingBottom: 64,
    paddingHorizontal: PAD_X,
    fontFamily: FONT.sans,
    fontSize: 8.5,
    color: C.body,
  },
  edge: { position: "absolute", top: 0, left: 0, right: 0, height: 4 },
  letterhead: { width: "100%", height: 64, objectFit: "contain", marginBottom: 20 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { maxWidth: 270 },
  logo: { height: 30, width: 130, objectFit: "contain", objectPosition: "left", marginBottom: 10 },
  orgName: { fontWeight: 600, fontSize: 12, color: C.ink, marginBottom: 3 },
  orgLine: { fontSize: 8, color: C.muted, lineHeight: 1.45 },
  docBlock: { alignItems: "flex-end" },
  eyebrow: { fontSize: 7, fontWeight: 500, color: C.muted, letterSpacing: 1.2, textTransform: "uppercase" },
  docNumber: { fontSize: 15, fontWeight: 500, color: C.ink, marginTop: 4 },

  hero: { marginTop: 28, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  heroAmount: { fontSize: 26, fontWeight: 600, color: C.ink, letterSpacing: -0.6, lineHeight: 1.1 },
  heroSub: { fontSize: 10, color: C.muted, marginTop: 4 },
  status: { fontSize: 7.5, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },

  parties: {
    marginTop: 22,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.ink,
    flexDirection: "row",
    gap: 24,
  },
  party: { flex: 1 },
  details: { width: 172 },
  label: { fontSize: 7, fontWeight: 500, color: C.muted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 },
  partyName: { fontSize: 9.5, fontWeight: 600, color: C.ink, marginBottom: 2 },
  partyLine: { fontSize: 8.5, lineHeight: 1.45 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  detailKey: { color: C.muted },
  detailValue: { color: C.ink, fontWeight: 500, textAlign: "right", maxWidth: 110 },

  table: { marginTop: 26 },
  th: {
    flexDirection: "row",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.ink,
  },
  thText: { fontSize: 7, fontWeight: 500, color: C.muted, letterSpacing: 1, textTransform: "uppercase" },
  tr: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 0.75, borderBottomColor: C.rule },
  cIdx: { width: 22, color: C.muted },
  cItem: { flex: 1, paddingRight: 12 },
  cHsn: { width: 52, color: C.muted },
  cQty: { width: 36, textAlign: "right" },
  cRate: { width: 70, textAlign: "right" },
  cDisc: { width: 40, textAlign: "right" },
  cGst: { width: 56, textAlign: "right" },
  cAmt: { width: 80, textAlign: "right" },
  itemName: { fontSize: 8.5, color: C.ink, fontWeight: 500, lineHeight: 1.35 },
  itemMeta: { fontSize: 7.5, color: C.muted, marginTop: 2 },
  sub: { fontSize: 7, color: C.muted, marginTop: 2, textAlign: "right" },
  amt: { color: C.ink, fontWeight: 500 },

  below: { flexDirection: "row", justifyContent: "space-between", marginTop: 18, gap: 32 },
  pay: { flex: 1, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  qr: { width: 74, height: 74, marginLeft: -4, marginTop: -4 },
  payText: { flex: 1, paddingTop: 2 },
  payId: { fontSize: 9, fontWeight: 500, color: C.ink, marginBottom: 3 },
  payHint: { fontSize: 7.5, color: C.muted, lineHeight: 1.45 },
  totals: { width: 220 },
  tRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  tKey: { color: C.muted },
  tVal: { color: C.ink },
  tStrong: { color: C.ink, fontWeight: 600 },
  dueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.ink,
  },
  dueKey: { fontSize: 9.5, fontWeight: 600, color: C.ink },
  dueVal: { fontSize: 13, fontWeight: 600 },

  notes: { flexDirection: "row", gap: 32, marginTop: 40 },
  note: { flex: 1 },
  noteText: { fontSize: 8, lineHeight: 1.55 },

  footer: {
    position: "absolute",
    bottom: 28,
    left: PAD_X,
    right: PAD_X,
    paddingTop: 8,
    borderTopWidth: 0.75,
    borderTopColor: C.rule,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: C.muted,
  },
});

export function StandardTemplate({ invoice, branding, assets }: InvoiceTemplateProps) {
  const org = resolveBranding(invoice, branding);
  const accent = normalizeColor(org.primaryColor);
  const showTax = invoiceHasTax(invoice);
  const showDiscount = invoiceHasDiscount(invoice);
  const { totals } = invoice;
  const customer = invoice.customerSnapshot;
  const shipTo = shippingAddress(invoice);
  const letterhead = imageSource(org.letterheadBuffer);
  const logo = imageSource(org.logoBuffer);
  const qr = imageSource(assets?.upiQr?.buffer);
  const status = documentStatus(invoice.status);
  const statusColor = status?.tone === "bad" ? C.bad : status?.tone === "good" ? C.good : C.muted;
  const settled = totals.balanceDue <= 0 && totals.grandTotal > 0;

  const details: [string, string][] = [
    ["Issued", formatDate(invoice.issueDate)],
    ["Due", invoice.dueDate ? formatDate(invoice.dueDate) : invoice.paymentTerms || "On receipt"],
  ];
  if (invoice.paymentTerms && invoice.dueDate) details.push(["Terms", invoice.paymentTerms]);
  if (invoice.poNumber) details.push(["Reference", invoice.poNumber]);

  return (
    <Document title={`Invoice ${invoice.invoiceNumber}`} author={org.name ?? "Invoice"}>
      <Page size="A4" style={styles.page}>
        <View style={[styles.edge, { backgroundColor: accent }]} fixed />
        {letterhead ? <Image src={letterhead} style={styles.letterhead} /> : null}

        <View style={styles.header}>
          <View style={styles.brand}>
            {logo ? <Image src={logo} style={styles.logo} /> : null}
            <Text style={styles.orgName}>{org.name || "Organization"}</Text>
            {orgContactLines(org).map((line, index) => (
              <Text key={index} style={styles.orgLine}>
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.docBlock}>
            <Text style={styles.eyebrow}>Invoice</Text>
            <Text style={styles.docNumber}>{invoice.invoiceNumber}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View>
            <Text style={styles.heroAmount}>{money(settled ? totals.grandTotal : totals.balanceDue)}</Text>
            <Text style={styles.heroSub}>
              {settled
                ? "Paid in full. Thank you."
                : invoice.dueDate
                  ? `Due ${formatDate(invoice.dueDate)}`
                  : `Due ${invoice.paymentTerms ? invoice.paymentTerms.toLowerCase() : "on receipt"}`}
            </Text>
          </View>
          {status ? <Text style={[styles.status, { color: statusColor }]}>{status.label}</Text> : null}
        </View>

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.label}>Billed to</Text>
            <Text style={styles.partyName}>{customer.company || customer.name || "-"}</Text>
            {customerLines(invoice).map((line, index) => (
              <Text key={index} style={styles.partyLine}>
                {line}
              </Text>
            ))}
          </View>
          {shipTo ? (
            <View style={styles.party}>
              <Text style={styles.label}>Ship to</Text>
              <Text style={styles.partyLine}>{shipTo}</Text>
            </View>
          ) : null}
          <View style={styles.details}>
            <Text style={styles.label}>Details</Text>
            {details.map(([key, value]) => (
              <View key={key} style={styles.detailRow}>
                <Text style={styles.detailKey}>{key}</Text>
                <Text style={styles.detailValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.th} fixed>
            <Text style={[styles.thText, styles.cIdx]}>#</Text>
            <Text style={[styles.thText, styles.cItem]}>Item</Text>
            {showTax ? <Text style={[styles.thText, styles.cHsn]}>HSN/SAC</Text> : null}
            <Text style={[styles.thText, styles.cQty]}>Qty</Text>
            <Text style={[styles.thText, styles.cRate]}>Rate</Text>
            {showDiscount ? <Text style={[styles.thText, styles.cDisc]}>Disc</Text> : null}
            {showTax ? <Text style={[styles.thText, styles.cGst]}>GST</Text> : null}
            <Text style={[styles.thText, styles.cAmt]}>Amount</Text>
          </View>
          {invoice.lineItems.map((item, index) => {
            const meta = lineItemMeta(item);
            return (
              <View key={index} style={styles.tr} wrap={false}>
                <Text style={styles.cIdx}>{String(index + 1).padStart(2, "0")}</Text>
                <View style={styles.cItem}>
                  <Text style={styles.itemName}>{item.description || "-"}</Text>
                  {meta ? <Text style={styles.itemMeta}>{meta}</Text> : null}
                </View>
                {showTax ? <Text style={styles.cHsn}>{item.hsnCode || "-"}</Text> : null}
                <Text style={styles.cQty}>{item.quantity}</Text>
                <Text style={styles.cRate}>{amount(item.unitPrice)}</Text>
                {showDiscount ? (
                  <Text style={styles.cDisc}>{item.discountPercentage ? `${item.discountPercentage}%` : "-"}</Text>
                ) : null}
                {showTax ? (
                  <View style={styles.cGst}>
                    <Text>{item.gstRate}%</Text>
                    {item.taxAmount ? <Text style={styles.sub}>{amount(item.taxAmount)}</Text> : null}
                  </View>
                ) : null}
                <Text style={[styles.cAmt, styles.amt]}>{amount(item.totalAmount)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.below} wrap={false}>
          {/* The pay block must be a direct flex child of the row: wrapping it
              in an unsized View lets yoga collapse its width to almost nothing. */}
          {qr && assets?.upiQr ? (
            <View style={styles.pay}>
              <Image src={qr} style={styles.qr} />
              <View style={styles.payText}>
                <Text style={styles.label}>Pay by UPI</Text>
                <Text style={styles.payId}>{assets.upiQr.upiId}</Text>
                <Text style={styles.payHint}>Scan with any UPI app. The amount is filled in for you.</Text>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <View style={styles.totals}>
            <View style={styles.tRow}>
              <Text style={styles.tKey}>Subtotal</Text>
              <Text style={styles.tVal}>{money(totals.subtotal)}</Text>
            </View>
            {showDiscount ? (
              <View style={styles.tRow}>
                <Text style={styles.tKey}>Discount</Text>
                <Text style={styles.tVal}>{money(-totals.discountTotal)}</Text>
              </View>
            ) : null}
            {showTax ? (
              <>
                {showDiscount ? (
                  <View style={styles.tRow}>
                    <Text style={styles.tKey}>Taxable value</Text>
                    <Text style={styles.tVal}>{money(totals.taxableTotal)}</Text>
                  </View>
                ) : null}
                <View style={styles.tRow}>
                  <Text style={styles.tKey}>GST</Text>
                  <Text style={styles.tVal}>{money(totals.taxTotal)}</Text>
                </View>
              </>
            ) : null}
            <View style={styles.tRow}>
              <Text style={styles.tStrong}>Total</Text>
              <Text style={styles.tStrong}>{money(totals.grandTotal)}</Text>
            </View>
            {totals.paidTotal > 0 ? (
              <View style={styles.tRow}>
                <Text style={styles.tKey}>Paid</Text>
                <Text style={styles.tVal}>{money(-totals.paidTotal)}</Text>
              </View>
            ) : null}
            <View style={styles.dueRow}>
              <Text style={styles.dueKey}>Amount due</Text>
              <Text style={[styles.dueVal, { color: settled ? C.ink : accent }]}>{money(totals.balanceDue)}</Text>
            </View>
          </View>
        </View>

        {invoice.notes || invoice.termsAndConditions ? (
          <View style={styles.notes}>
            {invoice.notes ? (
              <View style={styles.note}>
                <Text style={styles.label}>Notes</Text>
                <Text style={styles.noteText}>{invoice.notes}</Text>
              </View>
            ) : null}
            {invoice.termsAndConditions ? (
              <View style={styles.note}>
                <Text style={styles.label}>Terms</Text>
                <Text style={styles.noteText}>{invoice.termsAndConditions}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>
            {org.name ? `${org.name}  ·  ` : ""}
            {invoice.invoiceNumber}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
