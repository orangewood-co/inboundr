import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  amount,
  formatDate,
  imageSource,
  invoiceHasDiscount,
  invoiceHasTax,
  money,
  normalizeColor,
  orgContactLines,
  resolveBranding,
  statusLabel,
} from "./shared";
import type { InvoiceTemplateProps } from "./types";

const COLORS = {
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  soft: "#f9fafb",
  white: "#ffffff",
};

const styles = StyleSheet.create({
  // No lineHeight here: react-pdf resolves a unitless page lineHeight against
  // the base fontSize and children inherit that absolute value, so larger text
  // (e.g. the 26pt title) overlaps the line below it. Leading is set per-style.
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLORS.text,
  },
  letterhead: { width: "100%", height: 64, objectFit: "contain", marginBottom: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandBlock: { maxWidth: 280 },
  logo: { height: 34, width: 120, objectFit: "contain", marginBottom: 8 },
  orgName: { fontFamily: "Helvetica-Bold", fontSize: 15, color: COLORS.text },
  orgLine: { fontSize: 8.5, color: COLORS.muted, lineHeight: 1.4 },
  titleBlock: { alignItems: "flex-end" },
  title: { fontFamily: "Helvetica-Bold", fontSize: 26, letterSpacing: 1 },
  invoiceNo: { fontSize: 10, color: COLORS.muted, marginTop: 2 },
  statusPill: {
    marginTop: 8,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
    color: COLORS.white,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  rule: { height: 2, marginTop: 16, marginBottom: 18, borderRadius: 2 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  partyBlock: { flex: 1 },
  metaBlock: { width: 200 },
  blockLabel: { fontFamily: "Helvetica-Bold", fontSize: 7.5, color: COLORS.muted, letterSpacing: 0.6, marginBottom: 4 },
  partyName: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  partyLine: { fontSize: 9, color: COLORS.muted, lineHeight: 1.4 },
  metaItem: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  metaKey: { color: COLORS.muted, fontSize: 9 },
  metaValue: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  table: { marginTop: 22, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, overflow: "hidden" },
  tableHead: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 10 },
  tableHeadText: { color: COLORS.white, fontFamily: "Helvetica-Bold", fontSize: 7.5, letterSpacing: 0.4 },
  row: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  rowAlt: { backgroundColor: COLORS.soft },
  cellDesc: { flex: 1, paddingRight: 8 },
  descText: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  descMeta: { fontSize: 7.5, color: COLORS.muted, marginTop: 1 },
  num: { width: 38, textAlign: "right" },
  rate: { width: 64, textAlign: "right" },
  disc: { width: 40, textAlign: "right" },
  hsn: { width: 48, textAlign: "left" },
  gst: { width: 40, textAlign: "right" },
  total: { width: 74, textAlign: "right", fontFamily: "Helvetica-Bold" },
  footRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20, gap: 24 },
  payBox: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, alignSelf: "flex-start" },
  payTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 8 },
  payInner: { flexDirection: "row", gap: 10, alignItems: "center" },
  qr: { width: 76, height: 76 },
  payHint: { fontSize: 8, color: COLORS.muted, lineHeight: 1.4 },
  payUpi: { fontFamily: "Helvetica-Bold", fontSize: 9, marginTop: 4 },
  totalsBox: { width: 230 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  totalsKey: { fontSize: 9, color: COLORS.muted },
  totalsValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  totalsDivider: { borderTopWidth: 1, borderTopColor: COLORS.border, marginVertical: 5 },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 4,
  },
  balanceKey: { color: COLORS.white, fontFamily: "Helvetica-Bold", fontSize: 10 },
  balanceValue: { color: COLORS.white, fontFamily: "Helvetica-Bold", fontSize: 12 },
  notesWrap: { marginTop: 22, gap: 12 },
  noteBlock: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12 },
  noteTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginBottom: 4 },
  noteText: { fontSize: 8.5, color: COLORS.muted, lineHeight: 1.4 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: COLORS.muted,
  },
});

export function StandardTemplate({ invoice, branding, assets }: InvoiceTemplateProps) {
  const org = resolveBranding(invoice, branding);
  const primary = normalizeColor(org.primaryColor);
  const showTax = invoiceHasTax(invoice);
  const showDiscount = invoiceHasDiscount(invoice);
  const customer = invoice.customerSnapshot;
  const letterhead = imageSource(org.letterheadBuffer);
  const logo = imageSource(org.logoBuffer);
  const qr = imageSource(assets?.upiQr?.buffer);

  const contactLines = orgContactLines(org);

  return (
    <Document title={`Invoice ${invoice.invoiceNumber}`} author={org.name ?? "Invoice"}>
      <Page size="A4" style={styles.page}>
        {letterhead ? <Image src={letterhead} style={styles.letterhead} /> : null}

        <View style={styles.header}>
          <View style={styles.brandBlock}>
            {logo ? <Image src={logo} style={styles.logo} /> : null}
            <Text style={styles.orgName}>{org.name || "Organization"}</Text>
            {contactLines.map((line, index) => (
              <Text key={index} style={styles.orgLine}>
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.invoiceNo}>{invoice.invoiceNumber}</Text>
            <Text style={[styles.statusPill, { backgroundColor: primary }]}>
              {statusLabel(invoice.status).toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={[styles.rule, { backgroundColor: primary }]} />

        <View style={styles.metaRow}>
          <View style={styles.partyBlock}>
            <Text style={styles.blockLabel}>BILL TO</Text>
            <Text style={styles.partyName}>{customer.company || customer.name || "-"}</Text>
            {customer.company && customer.name && customer.company !== customer.name ? (
              <Text style={styles.partyLine}>{customer.name}</Text>
            ) : null}
            {customer.billingAddress ? <Text style={styles.partyLine}>{customer.billingAddress}</Text> : null}
            {customer.email ? <Text style={styles.partyLine}>{customer.email}</Text> : null}
            {customer.contactNumber ? <Text style={styles.partyLine}>{customer.contactNumber}</Text> : null}
          </View>
          <View style={styles.metaBlock}>
            <View style={styles.metaItem}>
              <Text style={styles.metaKey}>Issue date</Text>
              <Text style={styles.metaValue}>{formatDate(invoice.issueDate)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaKey}>Due date</Text>
              <Text style={styles.metaValue}>{formatDate(invoice.dueDate)}</Text>
            </View>
            {invoice.paymentTerms ? (
              <View style={styles.metaItem}>
                <Text style={styles.metaKey}>Payment terms</Text>
                <Text style={styles.metaValue}>{invoice.paymentTerms}</Text>
              </View>
            ) : null}
            {invoice.poNumber ? (
              <View style={styles.metaItem}>
                <Text style={styles.metaKey}>PO / Reference</Text>
                <Text style={styles.metaValue}>{invoice.poNumber}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.tableHead, { backgroundColor: primary }]} fixed>
            <Text style={[styles.tableHeadText, styles.cellDesc]}>Item</Text>
            {showTax ? <Text style={[styles.tableHeadText, styles.hsn]}>HSN</Text> : null}
            <Text style={[styles.tableHeadText, styles.num]}>Qty</Text>
            <Text style={[styles.tableHeadText, styles.rate]}>Rate</Text>
            {showDiscount ? <Text style={[styles.tableHeadText, styles.disc]}>Disc</Text> : null}
            {showTax ? <Text style={[styles.tableHeadText, styles.gst]}>GST</Text> : null}
            <Text style={[styles.tableHeadText, styles.total]}>Amount</Text>
          </View>
          {invoice.lineItems.map((item, index) => {
            const meta = [item.productCode, item.unit].filter(Boolean).join(" · ");
            return (
              <View key={index} style={[styles.row, index % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
                <View style={styles.cellDesc}>
                  <Text style={styles.descText}>{item.description || "-"}</Text>
                  {meta ? <Text style={styles.descMeta}>{meta}</Text> : null}
                </View>
                {showTax ? <Text style={styles.hsn}>{item.hsnCode || "-"}</Text> : null}
                <Text style={styles.num}>{item.quantity}</Text>
                <Text style={styles.rate}>{amount(item.unitPrice)}</Text>
                {showDiscount ? <Text style={styles.disc}>{item.discountPercentage}%</Text> : null}
                {showTax ? <Text style={styles.gst}>{item.gstRate}%</Text> : null}
                <Text style={styles.total}>{amount(item.totalAmount)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.footRow}>
          {/* The pay box must be a direct flex child of the row: wrapping it in
              an unsized View lets yoga collapse its width to almost nothing. */}
          {qr && assets?.upiQr ? (
            <View style={styles.payBox}>
              <Text style={styles.payTitle}>Pay via UPI</Text>
              <View style={styles.payInner}>
                <Image src={qr} style={styles.qr} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.payHint}>Scan with any UPI app to pay the balance due.</Text>
                  <Text style={[styles.payUpi, { color: primary }]}>{assets.upiQr.upiId}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>Subtotal</Text>
              <Text style={styles.totalsValue}>{money(invoice.totals.subtotal)}</Text>
            </View>
            {showDiscount ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsKey}>Discount</Text>
                <Text style={styles.totalsValue}>- {money(invoice.totals.discountTotal)}</Text>
              </View>
            ) : null}
            {showTax ? (
              <>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsKey}>Taxable</Text>
                  <Text style={styles.totalsValue}>{money(invoice.totals.taxableTotal)}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsKey}>Tax (GST)</Text>
                  <Text style={styles.totalsValue}>{money(invoice.totals.taxTotal)}</Text>
                </View>
              </>
            ) : null}
            <View style={styles.totalsDivider} />
            <View style={styles.totalsRow}>
              <Text style={[styles.totalsKey, { fontFamily: "Helvetica-Bold", color: COLORS.text }]}>Grand total</Text>
              <Text style={styles.totalsValue}>{money(invoice.totals.grandTotal)}</Text>
            </View>
            {invoice.totals.paidTotal > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsKey}>Paid</Text>
                <Text style={styles.totalsValue}>- {money(invoice.totals.paidTotal)}</Text>
              </View>
            ) : null}
            <View style={[styles.balanceRow, { backgroundColor: primary }]}>
              <Text style={styles.balanceKey}>Balance due</Text>
              <Text style={styles.balanceValue}>{money(invoice.totals.balanceDue)}</Text>
            </View>
          </View>
        </View>

        {invoice.notes || invoice.termsAndConditions ? (
          <View style={styles.notesWrap}>
            {invoice.notes ? (
              <View style={styles.noteBlock}>
                <Text style={styles.noteTitle}>Notes</Text>
                <Text style={styles.noteText}>{invoice.notes}</Text>
              </View>
            ) : null}
            {invoice.termsAndConditions ? (
              <View style={styles.noteBlock}>
                <Text style={styles.noteTitle}>Terms &amp; conditions</Text>
                <Text style={styles.noteText}>{invoice.termsAndConditions}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>{invoice.invoiceNumber}</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
