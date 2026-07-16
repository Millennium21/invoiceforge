import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import type { Client, InvoiceItem, Profile } from "@/types";
import { formatMoney } from "@/lib/money";

// @react-pdf/renderer ships its own PDF rendering engine (not a browser),
// so it can't use next/font — it needs fonts registered directly by URL.
// Helvetica is always available with zero registration as a safe
// fallback; we layer IBM Plex Mono on top purely for the numbers column
// so it matches the product's on-screen tabular-numeral treatment.
Font.register({
  family: "IBM Plex Mono",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/ibmplexmono/v19/-F63fjptAgt5VM-kVkqdyU8n1i8q131nj-o.ttf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/ibmplexmono/v19/-F6qfjptAgt5VM-kVkqdyU8n3lyU2Fw31D2GT4o.ttf",
      fontWeight: 600,
    },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#16302a" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  logo: { width: 56, height: 56, objectFit: "contain", marginBottom: 8 },
  businessName: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  muted: { color: "#5b6d66", fontSize: 9 },
  invoiceTitle: { fontSize: 20, fontFamily: "IBM Plex Mono", fontWeight: 600, textAlign: "right" },
  invoiceNumber: { fontFamily: "IBM Plex Mono", fontSize: 10, textAlign: "right", marginTop: 4 },
  metaGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  metaBlock: { flexDirection: "column" },
  metaLabel: { fontSize: 8, textTransform: "uppercase", letterSpacing: 1, color: "#5b6d66", marginBottom: 3 },
  metaValue: { fontSize: 10 },
  table: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#dbd7c9" },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#dbd7c9",
    paddingVertical: 6,
  },
  tableRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: "#ebe9df" },
  colDescription: { flex: 4 },
  colQty: { flex: 1, textAlign: "right", fontFamily: "IBM Plex Mono" },
  colPrice: { flex: 1.5, textAlign: "right", fontFamily: "IBM Plex Mono" },
  colAmount: { flex: 1.5, textAlign: "right", fontFamily: "IBM Plex Mono" },
  headerCell: { fontSize: 8, textTransform: "uppercase", letterSpacing: 1, color: "#5b6d66" },
  totalsBlock: { marginTop: 16, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", width: 200, paddingVertical: 3 },
  totalsLabel: { fontSize: 9, color: "#5b6d66" },
  totalsValue: { fontSize: 9, fontFamily: "IBM Plex Mono" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 200,
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#16302a",
  },
  grandTotalLabel: { fontSize: 11, fontWeight: 700 },
  grandTotalValue: { fontSize: 12, fontFamily: "IBM Plex Mono", fontWeight: 600 },
  notes: { marginTop: 28, fontSize: 9, color: "#5b6d66" },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#5b6d66",
    textAlign: "center",
  },
});

interface InvoiceDocumentProps {
  profile: Profile;
  client: Client;
  items: InvoiceItem[];
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotalPence: number;
  discountPence: number;
  taxPence: number;
  taxRatePercent: number;
  totalPence: number;
  notes: string | null;
}

export function InvoiceDocument({
  profile,
  client,
  items,
  invoiceNumber,
  issueDate,
  dueDate,
  currency,
  subtotalPence,
  discountPence,
  taxPence,
  taxRatePercent,
  totalPence,
  notes,
}: InvoiceDocumentProps) {
  return (
    <Document
      title={`Invoice ${invoiceNumber}`}
      author={profile.business_name || profile.full_name || "InvoiceForge"}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- this Image is @react-pdf/renderer's PDF layout primitive, not an HTML img; it has no alt prop in its API */}
            {profile.logo_url ? <Image src={profile.logo_url} style={styles.logo} /> : null}
            <Text style={styles.businessName}>{profile.business_name || profile.full_name}</Text>
            {profile.address ? <Text style={styles.muted}>{profile.address}</Text> : null}
            {profile.tax_number ? <Text style={styles.muted}>Tax ref: {profile.tax_number}</Text> : null}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Billed to</Text>
            <Text style={styles.metaValue}>{client.company_name || client.name}</Text>
            {client.company_name ? <Text style={styles.metaValue}>{client.name}</Text> : null}
            {client.email ? <Text style={styles.muted}>{client.email}</Text> : null}
            {client.address ? <Text style={styles.muted}>{client.address}</Text> : null}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Issue date</Text>
            <Text style={styles.metaValue}>{issueDate}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Due date</Text>
            <Text style={styles.metaValue}>{dueDate}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colDescription, styles.headerCell]}>Description</Text>
            <Text style={[styles.colQty, styles.headerCell]}>Qty</Text>
            <Text style={[styles.colPrice, styles.headerCell]}>Unit price</Text>
            <Text style={[styles.colAmount, styles.headerCell]}>Amount</Text>
          </View>
          {items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colDescription}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{formatMoney(item.unit_price_pence, currency)}</Text>
              <Text style={styles.colAmount}>
                {formatMoney(Math.round(item.quantity * item.unit_price_pence), currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{formatMoney(subtotalPence, currency)}</Text>
          </View>
          {discountPence > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text style={styles.totalsValue}>-{formatMoney(discountPence, currency)}</Text>
            </View>
          ) : null}
          {taxRatePercent > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax ({taxRatePercent}%)</Text>
              <Text style={styles.totalsValue}>{formatMoney(taxPence, currency)}</Text>
            </View>
          ) : null}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total due</Text>
            <Text style={styles.grandTotalValue}>{formatMoney(totalPence, currency)}</Text>
          </View>
        </View>

        {notes ? (
          <View style={styles.notes}>
            <Text style={styles.metaLabel}>Notes</Text>
            <Text>{notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          This document is not legal or tax advice. Generated with InvoiceForge.
        </Text>
      </Page>
    </Document>
  );
}
