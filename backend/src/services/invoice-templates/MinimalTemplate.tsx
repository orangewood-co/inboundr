import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  amount,
  formatDate,
  invoiceHasDiscount,
  invoiceHasTax,
  money,
  orgContactLines,
  resolveBranding,
  statusLabel,
} from "./shared";
import { imageSource } from "./shared";
import type { InvoiceTemplateProps } from "./types";

const INK = "#1a1a1a";
const FAINT = "#000000";

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 52,
    fontFamily: "Courier",
    fontSize: 8.5,
    color: INK,
    lineHeight: 1.5,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orgBlock: { maxWidth: 280 },
  orgName: { fontFamily: "Courier-Bold", fontSize: 10 },
  orgLine: { fontSize: 8.5 },
  metaBox: { borderWidth: 1, borderColor: FAINT, padding: 8, width: 230 },
  metaRow: { flexDirection: "row" },
  metaKey: { fontFamily: "Courier-Bold", width: 96 },
  metaValue: { flex: 1, textAlign: "right" },
  section: { marginTop: 18 },
  label: { fontFamily: "Courier-Bold" },
  kvRow: { flexDirection: "row" },
  kvKey: { width: 110 },
  orderTitle: { textAlign: "center", fontFamily: "Courier-Bold", marginTop: 22, marginBottom: 6 },
  hr: { borderTopWidth: 1, borderTopColor: FAINT, marginVertical: 4 },
  hrThin: { borderTopWidth: 0.5, borderTopColor: FAINT, marginVertical: 4 },
  tableRow: { flexDirection: "row" },
  th: { fontFamily: "Courier-Bold" },
  cNum: { width: 22 },
  cSku: { width: 62 },
  cDesc: { flex: 1, paddingRight: 6 },
  cHsn: { width: 50 },
  cRate: { width: 70, textAlign: "right" },
  cQty: { width: 40, textAlign: "right" },
  cGst: { width: 42, textAlign: "right" },
  cAmt: { width: 78, textAlign: "right" },
  totalsBlock: { marginTop: 6, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", justifyContent: "flex-end", width: 280 },
  totalsKey: { textAlign: "right", flex: 1, paddingRight: 16 },
  totalsKeyBold: { textAlign: "right", flex: 1, paddingRight: 16, fontFamily: "Courier-Bold" },
  totalsValue: { width: 96, textAlign: "right" },
  totalsValueBold: { width: 96, textAlign: "right", fontFamily: "Courier-Bold" },
  statusLine: { textAlign: "center", fontFamily: "Courier-Bold", letterSpacing: 3, marginVertical: 14 },
  payLine: { marginTop: 14 },
  upiWrap: { marginTop: 16, flexDirection: "row", gap: 12, alignItems: "center" },
  qr: { width: 72, height: 72 },
  thanks: { textAlign: "center", marginTop: 22 },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 52,
    right: 52,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
  },
});

export function MinimalTemplate({ invoice, branding, assets }: InvoiceTemplateProps) {
  const org = resolveBranding(invoice, branding);
  const showTax = invoiceHasTax(invoice);
  const showDiscount = invoiceHasDiscount(invoice);
  const customer = invoice.customerSnapshot;
  const contactLines = orgContactLines(org);
  const qr = imageSource(assets?.upiQr?.buffer);
  const isPaid = invoice.totals.balanceDue <= 0 && invoice.totals.grandTotal > 0;

  const billedToLines = [
    customer.name && customer.company && customer.name !== customer.company ? customer.name : null,
    customer.billingAddress,
    customer.email,
    customer.contactNumber,
  ].filter(Boolean) as string[];

  return (
    <Document title={`Invoice ${invoice.invoiceNumber}`} author={org.name ?? "Invoice"}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.orgBlock}>
            <Text style={styles.orgName}>{org.name || "Organization"}</Text>
            {contactLines.map((line, index) => (
              <Text key={index} style={styles.orgLine}>
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.metaBox}>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Invoice #:</Text>
              <Text style={styles.metaValue}>{invoice.invoiceNumber}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Created:</Text>
              <Text style={styles.metaValue}>{formatDate(invoice.issueDate)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Due:</Text>
              <Text style={styles.metaValue}>{formatDate(invoice.dueDate)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Billed To:</Text>
          <Text style={styles.orgName}>{customer.company || customer.name || "-"}</Text>
          {billedToLines.map((line, index) => (
            <Text key={index}>{line}</Text>
          ))}
        </View>

        {invoice.poNumber || invoice.paymentTerms ? (
          <View style={styles.section}>
            {invoice.poNumber ? (
              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>P.O. No.:</Text>
                <Text>{invoice.poNumber}</Text>
              </View>
            ) : null}
            {invoice.paymentTerms ? (
              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>Terms:</Text>
                <Text>{invoice.paymentTerms}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.orderTitle}>Invoice {invoice.invoiceNumber}</Text>

        <View style={styles.hr} />
        <View style={styles.tableRow} fixed>
          <Text style={[styles.th, styles.cNum]}>#</Text>
          <Text style={[styles.th, styles.cSku]}>SKU</Text>
          <Text style={[styles.th, styles.cDesc]}>Desc.</Text>
          {showTax ? <Text style={[styles.th, styles.cHsn]}>HSN</Text> : null}
          <Text style={[styles.th, styles.cRate]}>Unit Rate</Text>
          <Text style={[styles.th, styles.cQty]}>Count</Text>
          {showTax ? <Text style={[styles.th, styles.cGst]}>GST</Text> : null}
          <Text style={[styles.th, styles.cAmt]}>Amount</Text>
        </View>
        <View style={styles.hrThin} />

        {invoice.lineItems.map((item, index) => (
          <View key={index} style={styles.tableRow} wrap={false}>
            <Text style={styles.cNum}>{index + 1}</Text>
            <Text style={styles.cSku}>{item.productCode || "-"}</Text>
            <Text style={styles.cDesc}>{item.description || "-"}</Text>
            {showTax ? <Text style={styles.cHsn}>{item.hsnCode || "-"}</Text> : null}
            <Text style={styles.cRate}>{amount(item.unitPrice)}</Text>
            <Text style={styles.cQty}>{item.quantity}</Text>
            {showTax ? <Text style={styles.cGst}>{item.gstRate}%</Text> : null}
            <Text style={styles.cAmt}>{amount(item.totalAmount)}</Text>
          </View>
        ))}

        <View style={styles.hr} />

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsKey}>Subtotal</Text>
            <Text style={styles.totalsValue}>{amount(invoice.totals.subtotal)}</Text>
          </View>
          {showDiscount ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>Discount</Text>
              <Text style={styles.totalsValue}>-{amount(invoice.totals.discountTotal)}</Text>
            </View>
          ) : null}
          {showDiscount || showTax ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>Net Sales Total</Text>
              <Text style={styles.totalsValue}>{amount(invoice.totals.taxableTotal)}</Text>
            </View>
          ) : null}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsKey}>Tax</Text>
            <Text style={styles.totalsValue}>{amount(invoice.totals.taxTotal)}</Text>
          </View>
          <View style={[styles.hrThin, { width: 280 }]} />
          <View style={styles.totalsRow}>
            <Text style={styles.totalsKeyBold}>Total</Text>
            <Text style={styles.totalsValueBold}>{money(invoice.totals.grandTotal)}</Text>
          </View>
        </View>

        {isPaid ? <Text style={styles.statusLine}>INVOICE STATUS: {statusLabel(invoice.status).toUpperCase()}</Text> : null}

        <View style={styles.totalsBlock}>
          {invoice.totals.paidTotal > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>Paid</Text>
              <Text style={styles.totalsValue}>-{amount(invoice.totals.paidTotal)}</Text>
            </View>
          ) : null}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsKeyBold}>Balance</Text>
            <Text style={styles.totalsValueBold}>{money(invoice.totals.balanceDue)}</Text>
          </View>
        </View>

        {qr && assets?.upiQr ? (
          <View style={styles.upiWrap}>
            <Image src={qr} style={styles.qr} />
            <View>
              <Text style={styles.label}>Pay via UPI</Text>
              <Text>{assets.upiQr.upiId}</Text>
              <Text>Scan with any UPI app to pay the balance due.</Text>
            </View>
          </View>
        ) : null}

        {invoice.notes ? (
          <View style={styles.section}>
            <Text>{invoice.notes}</Text>
          </View>
        ) : null}
        {invoice.termsAndConditions ? (
          <View style={styles.section}>
            <Text style={styles.label}>Terms &amp; Conditions</Text>
            <Text>{invoice.termsAndConditions}</Text>
          </View>
        ) : null}

        <View style={styles.thanks}>
          <Text>***</Text>
          <Text>Thank you for your business.</Text>
          <Text>{org.name || ""}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>{invoice.invoiceNumber}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
