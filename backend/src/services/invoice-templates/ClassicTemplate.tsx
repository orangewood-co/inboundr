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
  resolveBranding,
  shippingAddress,
  websiteLabel,
} from "./shared";
import type { InvoiceTemplateProps } from "./types";

const C = {
  ink: "#1c1a17",
  body: "#3b3833",
  muted: "#857f75",
  rule: "#d9d4ca",
  good: "#2f6b3a",
  bad: "#9f2a1d",
};

const PAD_X = 56;

const styles = StyleSheet.create({
  // No lineHeight on the page: react-pdf resolves a unitless page lineHeight
  // against the base fontSize and children inherit the absolute value, so
  // larger text overlaps the next line. Leading is set per-style instead.
  page: {
    paddingTop: 48,
    paddingBottom: 64,
    paddingHorizontal: PAD_X,
    fontFamily: FONT.serif,
    fontSize: 9.5,
    color: C.body,
  },

  masthead: { alignItems: "center" },
  logo: { height: 40, width: 180, objectFit: "contain", marginBottom: 10 },
  orgName: { fontSize: 22, fontWeight: 500, color: C.ink, letterSpacing: 0.2, textAlign: "center" },
  orgLine: { fontSize: 8.5, fontStyle: "italic", color: C.muted, marginTop: 4, textAlign: "center", lineHeight: 1.4 },
  doubleRule: { marginTop: 18 },
  ruleThick: { height: 1.25 },
  ruleThin: { height: 0.5, marginTop: 1.75 },

  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 26 },
  title: { fontSize: 34, fontStyle: "italic", color: C.ink, lineHeight: 1 },
  status: { fontSize: 9.5, fontStyle: "italic", marginTop: 6 },
  meta: { width: 190 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2.5 },
  metaKey: { fontStyle: "italic", color: C.muted },
  metaValue: { color: C.ink, textAlign: "right" },

  parties: {
    flexDirection: "row",
    gap: 28,
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: C.rule,
  },
  party: { flex: 1 },
  label: { fontSize: 9, fontStyle: "italic", color: C.muted, marginBottom: 4 },
  partyName: { fontSize: 11, fontWeight: 600, color: C.ink, marginBottom: 2, lineHeight: 1.3 },
  partyLine: { fontSize: 9.5, lineHeight: 1.45 },

  table: { marginTop: 28 },
  th: { flexDirection: "row", paddingBottom: 5, borderBottomWidth: 0.75, borderBottomColor: C.ink },
  thText: { fontSize: 9, fontStyle: "italic", color: C.muted },
  tr: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: C.rule },
  cItem: { flex: 1, paddingRight: 12 },
  cHsn: { width: 54 },
  cQty: { width: 38, textAlign: "right" },
  cRate: { width: 70, textAlign: "right" },
  cDisc: { width: 40, textAlign: "right" },
  cGst: { width: 40, textAlign: "right" },
  cAmt: { width: 82, textAlign: "right" },
  itemName: { fontSize: 10, color: C.ink, lineHeight: 1.35 },
  itemMeta: { fontSize: 8.5, fontStyle: "italic", color: C.muted, marginTop: 1.5 },
  amt: { color: C.ink },

  below: { flexDirection: "row", justifyContent: "space-between", gap: 32, marginTop: 16 },
  pay: { flex: 1, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  qr: { width: 76, height: 76, marginLeft: -4, marginTop: -4 },
  payText: { flex: 1 },
  payId: { fontSize: 10, color: C.ink, marginBottom: 3 },
  payHint: { fontSize: 8.5, fontStyle: "italic", color: C.muted, lineHeight: 1.4 },
  totals: { width: 230 },
  tRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  tKey: { fontStyle: "italic", color: C.muted },
  tVal: { color: C.ink },
  dueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 6,
    paddingTop: 7,
    paddingBottom: 5,
    borderTopWidth: 0.75,
    borderTopColor: C.ink,
  },
  dueKey: { fontSize: 11, fontWeight: 600, color: C.ink },
  dueVal: { fontSize: 14, fontWeight: 600, color: C.ink },
  dueUnderline: { borderTopWidth: 0.75, borderTopColor: C.ink, paddingTop: 1.5 },
  dueUnderline2: { borderTopWidth: 0.75, borderTopColor: C.ink },

  notes: { flexDirection: "row", gap: 32, marginTop: 36 },
  note: { flex: 1 },
  noteText: { fontSize: 9, lineHeight: 1.5 },

  footer: {
    position: "absolute",
    bottom: 28,
    left: PAD_X,
    right: PAD_X,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    fontStyle: "italic",
    color: C.muted,
  },
});

export function ClassicTemplate({ invoice, branding, assets }: InvoiceTemplateProps) {
  const org = resolveBranding(invoice, branding);
  const accent = normalizeColor(org.primaryColor);
  const showTax = invoiceHasTax(invoice);
  const showDiscount = invoiceHasDiscount(invoice);
  const { totals } = invoice;
  const customer = invoice.customerSnapshot;
  const shipTo = shippingAddress(invoice);
  const logo = imageSource(org.logoBuffer);
  const qr = imageSource(assets?.upiQr?.buffer);
  const status = documentStatus(invoice.status);
  const statusColor = status?.tone === "bad" ? C.bad : status?.tone === "good" ? C.good : C.muted;

  const address = (org.address ?? "").trim();
  const contact = [org.phoneNumber, org.email, websiteLabel(org.website)]
    .map((line) => (line ?? "").trim())
    .filter(Boolean);

  const meta: [string, string][] = [
    ["Number", invoice.invoiceNumber],
    ["Date of issue", formatDate(invoice.issueDate)],
    ["Payment due", invoice.dueDate ? formatDate(invoice.dueDate) : invoice.paymentTerms || "On receipt"],
  ];

  const reference: [string, string][] = [];
  if (invoice.paymentTerms) reference.push(["Terms", invoice.paymentTerms]);
  if (invoice.poNumber) reference.push(["Order reference", invoice.poNumber]);

  return (
    <Document title={`Invoice ${invoice.invoiceNumber}`} author={org.name ?? "Invoice"}>
      <Page size="A4" style={styles.page}>
        <View style={styles.masthead}>
          {logo ? <Image src={logo} style={styles.logo} /> : null}
          <Text style={styles.orgName}>{org.name || "Organization"}</Text>
          {address ? <Text style={styles.orgLine}>{address}</Text> : null}
          {contact.length ? <Text style={[styles.orgLine, { marginTop: 1 }]}>{contact.join("  ·  ")}</Text> : null}
        </View>
        <View style={styles.doubleRule}>
          <View style={[styles.ruleThick, { backgroundColor: accent }]} />
          <View style={[styles.ruleThin, { backgroundColor: accent }]} />
        </View>

        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>Invoice</Text>
            {status ? <Text style={[styles.status, { color: statusColor }]}>{status.label}</Text> : null}
          </View>
          <View style={styles.meta}>
            {meta.map(([key, value]) => (
              <View key={key} style={styles.metaRow}>
                <Text style={styles.metaKey}>{key}</Text>
                <Text style={styles.metaValue}>{value}</Text>
              </View>
            ))}
          </View>
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
              <Text style={styles.label}>Deliver to</Text>
              <Text style={styles.partyLine}>{shipTo}</Text>
            </View>
          ) : null}
          {reference.length ? (
            <View style={shipTo ? { width: 130 } : styles.party}>
              {reference.map(([key, value]) => (
                <View key={key} style={{ marginBottom: 6 }}>
                  <Text style={styles.label}>{key}</Text>
                  <Text style={styles.partyLine}>{value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.table}>
          <View style={styles.th} fixed>
            <Text style={[styles.thText, styles.cItem]}>Description</Text>
            {showTax ? <Text style={[styles.thText, styles.cHsn]}>HSN/SAC</Text> : null}
            <Text style={[styles.thText, styles.cQty]}>Qty</Text>
            <Text style={[styles.thText, styles.cRate]}>Rate</Text>
            {showDiscount ? <Text style={[styles.thText, styles.cDisc]}>Disc.</Text> : null}
            {showTax ? <Text style={[styles.thText, styles.cGst]}>GST</Text> : null}
            <Text style={[styles.thText, styles.cAmt]}>Amount</Text>
          </View>
          {invoice.lineItems.map((item, index) => {
            const itemMeta = lineItemMeta(item);
            return (
              <View key={index} style={styles.tr} wrap={false}>
                <View style={styles.cItem}>
                  <Text style={styles.itemName}>{item.description || "-"}</Text>
                  {itemMeta ? <Text style={styles.itemMeta}>{itemMeta}</Text> : null}
                </View>
                {showTax ? <Text style={styles.cHsn}>{item.hsnCode || "–"}</Text> : null}
                <Text style={styles.cQty}>{item.quantity}</Text>
                <Text style={styles.cRate}>{amount(item.unitPrice)}</Text>
                {showDiscount ? (
                  <Text style={styles.cDisc}>{item.discountPercentage ? `${item.discountPercentage}%` : "–"}</Text>
                ) : null}
                {showTax ? <Text style={styles.cGst}>{item.gstRate}%</Text> : null}
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
                <Text style={styles.payHint}>Scan with any UPI app; the amount is filled in for you.</Text>
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
                <Text style={styles.tKey}>Less discount</Text>
                <Text style={styles.tVal}>{money(-totals.discountTotal)}</Text>
              </View>
            ) : null}
            {showTax ? (
              <View style={styles.tRow}>
                <Text style={styles.tKey}>GST</Text>
                <Text style={styles.tVal}>{money(totals.taxTotal)}</Text>
              </View>
            ) : null}
            {totals.paidTotal > 0 ? (
              <>
                <View style={styles.tRow}>
                  <Text style={styles.tKey}>Invoice total</Text>
                  <Text style={styles.tVal}>{money(totals.grandTotal)}</Text>
                </View>
                <View style={styles.tRow}>
                  <Text style={styles.tKey}>Received with thanks</Text>
                  <Text style={styles.tVal}>{money(-totals.paidTotal)}</Text>
                </View>
              </>
            ) : null}
            <View style={styles.dueRow}>
              <Text style={styles.dueKey}>{totals.paidTotal > 0 ? "Balance due" : "Total due"}</Text>
              <Text style={styles.dueVal}>{money(totals.balanceDue)}</Text>
            </View>
            <View style={styles.dueUnderline}>
              <View style={styles.dueUnderline2} />
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
                <Text style={styles.label}>Terms &amp; conditions</Text>
                <Text style={styles.noteText}>{invoice.termsAndConditions}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>{invoice.invoiceNumber}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
