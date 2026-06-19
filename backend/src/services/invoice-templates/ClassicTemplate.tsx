import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  amount,
  formatDate,
  imageSource,
  invoiceHasDiscount,
  invoiceHasTax,
  money,
  normalizeColor,
  resolveBranding,
} from "./shared";
import type { InvoiceTemplateProps } from "./types";

const COLORS = {
  text: "#1f2937",
  strong: "#111111",
  muted: "#8a8f98",
  headBg: "#efefef",
  border: "#e3e3e3",
  white: "#ffffff",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 50,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLORS.text,
    lineHeight: 1.4,
  },
  logoWrap: { alignItems: "center", marginBottom: 18 },
  logo: { height: 46, width: 200, objectFit: "contain" },
  wordmark: { fontFamily: "Helvetica-Bold", fontSize: 18, letterSpacing: 1, color: COLORS.strong },
  title: { fontFamily: "Helvetica-Bold", fontSize: 44, color: COLORS.strong, letterSpacing: -1 },
  subtitle: { fontSize: 12, color: COLORS.strong, marginTop: 2, marginBottom: 22 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 26 },
  infoCol: { gap: 3 },
  infoColRight: { gap: 3, alignItems: "flex-end" },
  infoLine: { fontSize: 10, color: COLORS.muted },
  infoStrong: { fontFamily: "Helvetica-Bold", color: COLORS.strong },
  headRow: { flexDirection: "row", backgroundColor: COLORS.headBg, paddingVertical: 8, paddingHorizontal: 8 },
  headText: { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: COLORS.muted, letterSpacing: 0.6 },
  bodyRow: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cDesc: { flex: 1, paddingRight: 8 },
  cDescText: { color: COLORS.strong },
  cMeta: { fontSize: 7.5, color: COLORS.muted, marginTop: 1 },
  cHsn: { width: 52 },
  cQty: { width: 50, textAlign: "right" },
  cUnit: { width: 84, textAlign: "right" },
  cGst: { width: 44, textAlign: "right" },
  cTotal: { width: 92, textAlign: "right" },
  summary: { marginTop: 14, alignItems: "flex-end" },
  summaryRow: { flexDirection: "row", width: 240, paddingVertical: 2 },
  summaryKey: { flex: 1, textAlign: "right", paddingRight: 18, color: COLORS.muted, fontFamily: "Helvetica-Bold" },
  summaryValue: { width: 96, textAlign: "right", color: COLORS.strong, fontFamily: "Helvetica-Bold" },
  totalKey: { flex: 1, textAlign: "right", paddingRight: 18, color: COLORS.strong, fontFamily: "Helvetica-Bold", fontSize: 12 },
  totalValue: { width: 96, textAlign: "right", color: COLORS.strong, fontFamily: "Helvetica-Bold", fontSize: 12 },
  bottom: { marginTop: 40, flexDirection: "row", gap: 36 },
  bottomCol: { flex: 1, gap: 4 },
  bottomLabel: { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: COLORS.muted, letterSpacing: 0.8 },
  bottomValue: { color: COLORS.strong },
  upiWrap: { marginTop: 28, flexDirection: "row", gap: 12, alignItems: "center" },
  qr: { width: 72, height: 72 },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: COLORS.muted,
  },
});

export function ClassicTemplate({ invoice, branding, assets }: InvoiceTemplateProps) {
  const org = resolveBranding(invoice, branding);
  const primary = normalizeColor(org.primaryColor);
  const showTax = invoiceHasTax(invoice);
  const showDiscount = invoiceHasDiscount(invoice);
  const customer = invoice.customerSnapshot;
  const logo = imageSource(org.logoBuffer);
  const qr = imageSource(assets?.upiQr?.buffer);

  return (
    <Document title={`Invoice ${invoice.invoiceNumber}`} author={org.name ?? "Invoice"}>
      <Page size="A4" style={styles.page}>
        <View style={styles.logoWrap}>
          {logo ? <Image src={logo} style={styles.logo} /> : <Text style={styles.wordmark}>{org.name || "Organization"}</Text>}
        </View>

        <Text style={styles.title}>INVOICE</Text>
        <Text style={styles.subtitle}>{[org.name, org.address].filter(Boolean).join(", ") || "Invoice"}</Text>

        <View style={styles.infoRow}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLine}>
              Date: <Text style={styles.infoStrong}>{formatDate(invoice.issueDate)}</Text>
            </Text>
            <Text style={styles.infoLine}>
              Invoice No. <Text style={styles.infoStrong}>{invoice.invoiceNumber}</Text>
            </Text>
            {invoice.dueDate ? (
              <Text style={styles.infoLine}>
                Due: <Text style={styles.infoStrong}>{formatDate(invoice.dueDate)}</Text>
              </Text>
            ) : null}
          </View>
          <View style={styles.infoColRight}>
            <Text style={styles.infoLine}>
              Prepared for <Text style={styles.infoStrong}>{customer.company || customer.name || "-"}</Text>
            </Text>
            {customer.email ? (
              <Text style={styles.infoLine}>
                Contact: <Text style={styles.infoStrong}>{customer.email}</Text>
              </Text>
            ) : null}
            {invoice.poNumber ? (
              <Text style={styles.infoLine}>
                Reference: <Text style={styles.infoStrong}>{invoice.poNumber}</Text>
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.headRow} fixed>
          <Text style={[styles.headText, styles.cDesc]}>DESCRIPTION</Text>
          {showTax ? <Text style={[styles.headText, styles.cHsn]}>HSN</Text> : null}
          <Text style={[styles.headText, styles.cQty]}>QTY</Text>
          <Text style={[styles.headText, styles.cUnit]}>UNIT PRICE</Text>
          {showTax ? <Text style={[styles.headText, styles.cGst]}>GST</Text> : null}
          <Text style={[styles.headText, styles.cTotal]}>TOTAL</Text>
        </View>

        {invoice.lineItems.map((item, index) => {
          const meta = [item.productCode, item.unit].filter(Boolean).join(" · ");
          return (
            <View key={index} style={styles.bodyRow} wrap={false}>
              <View style={styles.cDesc}>
                <Text style={styles.cDescText}>{item.description || "-"}</Text>
                {meta ? <Text style={styles.cMeta}>{meta}</Text> : null}
              </View>
              {showTax ? <Text style={styles.cHsn}>{item.hsnCode || "-"}</Text> : null}
              <Text style={styles.cQty}>{item.quantity}</Text>
              <Text style={styles.cUnit}>{money(item.unitPrice)}</Text>
              {showTax ? <Text style={styles.cGst}>{item.gstRate}%</Text> : null}
              <Text style={styles.cTotal}>{money(item.totalAmount)}</Text>
            </View>
          );
        })}

        <View style={styles.summary}>
          {showDiscount ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>DISCOUNT</Text>
              <Text style={styles.summaryValue}>- {money(invoice.totals.discountTotal)}</Text>
            </View>
          ) : null}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>TAX</Text>
            <Text style={styles.summaryValue}>{money(invoice.totals.taxTotal)}</Text>
          </View>
          {invoice.totals.paidTotal > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>PAID</Text>
              <Text style={styles.summaryValue}>- {money(invoice.totals.paidTotal)}</Text>
            </View>
          ) : null}
          <View style={styles.summaryRow}>
            <Text style={styles.totalKey}>TOTAL</Text>
            <Text style={[styles.totalValue, { color: primary }]}>{money(invoice.totals.balanceDue)}</Text>
          </View>
        </View>

        <View style={styles.bottom}>
          <View style={styles.bottomCol}>
            <Text style={styles.bottomLabel}>PAYMENT TERMS</Text>
            <Text style={styles.bottomValue}>{invoice.paymentTerms || "Due on receipt"}</Text>
            {invoice.termsAndConditions ? <Text style={styles.cMeta}>{invoice.termsAndConditions}</Text> : null}
          </View>
          <View style={styles.bottomCol}>
            <Text style={styles.bottomLabel}>NOTES</Text>
            <Text style={styles.bottomValue}>{invoice.notes || "-"}</Text>
          </View>
        </View>

        <View style={[styles.bottom, { marginTop: 18 }]}>
          <View style={styles.bottomCol}>
            <Text style={styles.bottomLabel}>ADDRESS</Text>
            <Text style={styles.bottomValue}>{org.address || org.name || "-"}</Text>
            {org.email ? <Text style={styles.cMeta}>{org.email}</Text> : null}
            {org.phoneNumber ? <Text style={styles.cMeta}>{org.phoneNumber}</Text> : null}
          </View>
          <View style={styles.bottomCol}>
            {qr && assets?.upiQr ? (
              <View style={styles.upiWrap}>
                <Image src={qr} style={styles.qr} />
                <View>
                  <Text style={styles.bottomLabel}>PAY VIA UPI</Text>
                  <Text style={styles.bottomValue}>{assets.upiQr.upiId}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>{invoice.invoiceNumber}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
