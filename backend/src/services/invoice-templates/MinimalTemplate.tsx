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
  orgContactLines,
  resolveBranding,
  shippingAddress,
} from "./shared";
import type { InvoiceTemplateProps } from "./types";

const INK = "#111111";
const MUTED = "#6f6f6f";

const PAD_X = 52;

const dashed = { borderStyle: "dashed" as const, borderColor: INK };

const styles = StyleSheet.create({
  // No lineHeight on the page: react-pdf resolves a unitless page lineHeight
  // against the base fontSize and children inherit the absolute value, so
  // larger text overlaps the next line. Leading is set per-style instead.
  page: {
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: PAD_X,
    fontFamily: FONT.mono,
    fontSize: 8,
    color: INK,
  },
  line: { fontSize: 8, lineHeight: 1.5 },
  muted: { color: MUTED },
  strong: { fontWeight: 600 },
  caps: { textTransform: "uppercase", letterSpacing: 0.8 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orgBlock: { maxWidth: 270 },
  logo: { height: 26, width: 110, objectFit: "contain", objectPosition: "left", marginBottom: 10 },
  docBlock: { alignItems: "flex-end" },
  docTitle: { fontSize: 18, fontWeight: 500, letterSpacing: 4, lineHeight: 1.1 },
  docNumber: { fontSize: 9, marginTop: 4 },
  stamp: {
    marginTop: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: INK,
    fontSize: 7.5,
    fontWeight: 600,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  rule: { borderTopWidth: 1, ...dashed, marginVertical: 14 },
  ruleSolid: { borderTopWidth: 1, borderColor: INK },

  grid: { flexDirection: "row", gap: 24 },
  col: { flex: 1 },
  label: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  kv: { flexDirection: "row" },
  kvKey: { width: 64, color: MUTED },
  kvValue: { flex: 1 },

  th: { flexDirection: "row", paddingBottom: 5, borderBottomWidth: 1, ...dashed },
  thText: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8 },
  tr: { flexDirection: "row", paddingVertical: 6 },
  cIdx: { width: 22, color: MUTED },
  cItem: { flex: 1, paddingRight: 10 },
  cHsn: { width: 50 },
  cQty: { width: 34, textAlign: "right" },
  cRate: { width: 72, textAlign: "right" },
  cDisc: { width: 40, textAlign: "right" },
  cGst: { width: 36, textAlign: "right" },
  cAmt: { width: 82, textAlign: "right" },
  itemMeta: { fontSize: 7, color: MUTED, marginTop: 1.5 },

  bottom: { flexDirection: "row", justifyContent: "space-between", gap: 28 },
  pay: { flex: 1, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  qr: { width: 70, height: 70, marginLeft: -3, marginTop: -3 },
  totals: { width: 236 },
  tRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.5 },
  dueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: INK,
  },
  dueText: { fontSize: 9.5, fontWeight: 600 },
  doubleBottom: { borderTopWidth: 1, borderColor: INK, marginTop: 1.5 },

  section: { marginTop: 22 },
  noteText: { fontSize: 8, lineHeight: 1.55 },
  end: { marginTop: 26, textAlign: "center", color: MUTED, letterSpacing: 2 },

  footer: {
    position: "absolute",
    bottom: 26,
    left: PAD_X,
    right: PAD_X,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: MUTED,
  },
});

export function MinimalTemplate({ invoice, branding, assets }: InvoiceTemplateProps) {
  const org = resolveBranding(invoice, branding);
  const showTax = invoiceHasTax(invoice);
  const showDiscount = invoiceHasDiscount(invoice);
  const { totals } = invoice;
  const customer = invoice.customerSnapshot;
  const shipTo = shippingAddress(invoice);
  const logo = imageSource(org.logoBuffer);
  const qr = imageSource(assets?.upiQr?.buffer);
  const status = documentStatus(invoice.status);

  const meta: [string, string][] = [
    ["Issued", formatDate(invoice.issueDate)],
    ["Due", invoice.dueDate ? formatDate(invoice.dueDate) : invoice.paymentTerms || "On receipt"],
  ];
  if (invoice.paymentTerms && invoice.dueDate) meta.push(["Terms", invoice.paymentTerms]);
  if (invoice.poNumber) meta.push(["P.O.", invoice.poNumber]);

  return (
    <Document title={`Invoice ${invoice.invoiceNumber}`} author={org.name ?? "Invoice"}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.orgBlock}>
            {logo ? <Image src={logo} style={styles.logo} /> : null}
            <Text style={[styles.line, styles.strong, styles.caps]}>{org.name || "Organization"}</Text>
            {orgContactLines(org).map((line, index) => (
              <Text key={index} style={[styles.line, styles.muted]}>
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.docBlock}>
            <Text style={styles.docTitle}>INVOICE</Text>
            <Text style={styles.docNumber}>{invoice.invoiceNumber}</Text>
            {status ? <Text style={styles.stamp}>{status.label}</Text> : null}
          </View>
        </View>

        <View style={styles.rule} />

        <View style={styles.grid}>
          <View style={styles.col}>
            <Text style={styles.label}>Bill to</Text>
            <Text style={[styles.line, styles.strong]}>{customer.company || customer.name || "-"}</Text>
            {customerLines(invoice).map((line, index) => (
              <Text key={index} style={styles.line}>
                {line}
              </Text>
            ))}
          </View>
          {shipTo ? (
            <View style={styles.col}>
              <Text style={styles.label}>Ship to</Text>
              <Text style={styles.line}>{shipTo}</Text>
            </View>
          ) : null}
          <View style={{ width: 170 }}>
            <Text style={styles.label}>Details</Text>
            {meta.map(([key, value]) => (
              <View key={key} style={styles.kv}>
                <Text style={[styles.line, styles.kvKey]}>{key}</Text>
                <Text style={[styles.line, styles.kvValue]}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.rule} />

        <View style={styles.th} fixed>
          <Text style={[styles.thText, styles.cIdx]}>#</Text>
          <Text style={[styles.thText, styles.cItem]}>Item</Text>
          {showTax ? <Text style={[styles.thText, styles.cHsn]}>HSN</Text> : null}
          <Text style={[styles.thText, styles.cQty]}>Qty</Text>
          <Text style={[styles.thText, styles.cRate]}>Rate</Text>
          {showDiscount ? <Text style={[styles.thText, styles.cDisc]}>Disc</Text> : null}
          {showTax ? <Text style={[styles.thText, styles.cGst]}>GST</Text> : null}
          <Text style={[styles.thText, styles.cAmt]}>Amount</Text>
        </View>
        {invoice.lineItems.map((item, index) => {
          const itemMeta = lineItemMeta(item);
          return (
            <View key={index} style={styles.tr} wrap={false}>
              <Text style={[styles.line, styles.cIdx]}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={styles.cItem}>
                <Text style={styles.line}>{item.description || "-"}</Text>
                {itemMeta ? <Text style={styles.itemMeta}>{itemMeta}</Text> : null}
              </View>
              {showTax ? <Text style={[styles.line, styles.cHsn]}>{item.hsnCode || "-"}</Text> : null}
              <Text style={[styles.line, styles.cQty]}>{item.quantity}</Text>
              <Text style={[styles.line, styles.cRate]}>{amount(item.unitPrice)}</Text>
              {showDiscount ? (
                <Text style={[styles.line, styles.cDisc]}>{item.discountPercentage ? `${item.discountPercentage}%` : "-"}</Text>
              ) : null}
              {showTax ? <Text style={[styles.line, styles.cGst]}>{item.gstRate}%</Text> : null}
              <Text style={[styles.line, styles.cAmt]}>{amount(item.totalAmount)}</Text>
            </View>
          );
        })}

        <View style={styles.rule} />

        <View style={styles.bottom} wrap={false}>
          {/* The pay block must be a direct flex child of the row: wrapping it
              in an unsized View lets yoga collapse its width to almost nothing. */}
          {qr && assets?.upiQr ? (
            <View style={styles.pay}>
              <Image src={qr} style={styles.qr} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Pay by UPI</Text>
                <Text style={[styles.line, styles.strong]}>{assets.upiQr.upiId}</Text>
                <Text style={[styles.line, styles.muted]}>Scan with any UPI app.</Text>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <View style={styles.totals}>
            <View style={styles.tRow}>
              <Text style={[styles.line, styles.muted]}>Subtotal</Text>
              <Text style={styles.line}>{money(totals.subtotal)}</Text>
            </View>
            {showDiscount ? (
              <View style={styles.tRow}>
                <Text style={[styles.line, styles.muted]}>Discount</Text>
                <Text style={styles.line}>{money(-totals.discountTotal)}</Text>
              </View>
            ) : null}
            {showTax ? (
              <>
                {showDiscount ? (
                  <View style={styles.tRow}>
                    <Text style={[styles.line, styles.muted]}>Taxable</Text>
                    <Text style={styles.line}>{money(totals.taxableTotal)}</Text>
                  </View>
                ) : null}
                <View style={styles.tRow}>
                  <Text style={[styles.line, styles.muted]}>GST</Text>
                  <Text style={styles.line}>{money(totals.taxTotal)}</Text>
                </View>
              </>
            ) : null}
            <View style={styles.tRow}>
              <Text style={[styles.line, styles.strong]}>Total</Text>
              <Text style={[styles.line, styles.strong]}>{money(totals.grandTotal)}</Text>
            </View>
            {totals.paidTotal > 0 ? (
              <View style={styles.tRow}>
                <Text style={[styles.line, styles.muted]}>Paid</Text>
                <Text style={styles.line}>{money(-totals.paidTotal)}</Text>
              </View>
            ) : null}
            <View style={styles.dueRow}>
              <Text style={[styles.dueText, styles.caps]}>Balance due</Text>
              <Text style={styles.dueText}>{money(totals.balanceDue)}</Text>
            </View>
            <View style={styles.doubleBottom} />
          </View>
        </View>

        {invoice.notes ? (
          <View style={styles.section}>
            <Text style={styles.label}>Notes</Text>
            <Text style={styles.noteText}>{invoice.notes}</Text>
          </View>
        ) : null}
        {invoice.termsAndConditions ? (
          <View style={styles.section}>
            <Text style={styles.label}>Terms</Text>
            <Text style={styles.noteText}>{invoice.termsAndConditions}</Text>
          </View>
        ) : null}

        <Text style={styles.end}>* * *</Text>

        <View style={styles.footer} fixed>
          <Text>{invoice.invoiceNumber}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
