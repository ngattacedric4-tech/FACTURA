import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { Company, Client, Invoice, InvoiceItem } from '@/types/database';

// Register a standard font for French characters
// Font.register({ family: 'Inter', src: 'https://fonts.gstatic.com/s/inter/v12/UcCOjFwrH2o8i0nOtjt4_A.woff2' });

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  companyLogo: {
    width: 60,
    height: 60,
    marginBottom: 10,
  },
  companyInfo: {
    maxWidth: 200,
  },
  companyName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#1e293b',
  },
  clientInfo: {
    marginTop: 20,
    alignSelf: 'flex-end',
    textAlign: 'right',
    maxWidth: 200,
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#1e293b',
    textTransform: 'uppercase',
  },
  metaSection: {
    flexDirection: 'row',
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 20,
  },
  metaItem: {
    marginRight: 40,
  },
  metaLabel: {
    fontSize: 8,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  table: {
    marginTop: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  colDesc: { flex: 4 },
  colQty: { flex: 1, textAlign: 'center' },
  colPrice: { flex: 2, textAlign: 'right' },
  colTva: { flex: 1, textAlign: 'center' },
  colTotal: { flex: 2, textAlign: 'right' },
  headerText: {
    fontWeight: 'bold',
    fontSize: 8,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  totalsSection: {
    marginTop: 30,
    alignSelf: 'flex-end',
    width: 200,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingVertical: 8,
    borderTopWidth: 2,
    borderTopColor: '#1d4ed8',
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  grandTotalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1d4ed8',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 8,
  },
  legalMention: {
    marginTop: 20,
    fontSize: 7,
    color: '#64748b',
    fontStyle: 'italic',
  }
});

interface InvoicePDFProps {
  company: Company;
  client: Client;
  invoice: Invoice;
  items: InvoiceItem[];
  showBrand?: boolean;
}

const TYPE_TITLES: Record<string, string> = {
  invoice: 'FACTURE',
  estimate: 'DEVIS',
  purchase_order: 'BON DE COMMANDE',
  delivery_note: 'BON DE LIVRAISON',
  credit_note: 'AVOIR',
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  XOF: 'FCFA',
  EUR: 'EUR',
  USD: 'USD',
};

export const InvoicePDF = ({ company, client, invoice, items, showBrand = true }: InvoicePDFProps) => {
  const isInvoice = invoice.type === 'invoice';
  const title = TYPE_TITLES[invoice.type] ?? 'DOCUMENT';
  const currencyLabel = CURRENCY_SYMBOLS[invoice.currency ?? 'XOF'] ?? 'FCFA';
  const showFinancials = invoice.type !== 'delivery_note'; // BL = pas de montants

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            {company.logo_url && <Image src={company.logo_url} style={styles.companyLogo} />}
            <Text style={styles.companyName}>{company.name}</Text>
            <Text>{company.address}</Text>
            <Text>Tél: {company.phone}</Text>
            <Text>NCC: {company.ncc}</Text>
          </View>
          <View style={styles.clientInfo}>
            <Text style={styles.metaLabel}>
              {invoice.type === 'purchase_order' ? 'Fournisseur :' : invoice.type === 'delivery_note' ? 'Livré à :' : 'Facturé à :'}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>{client.name}</Text>
            <Text>{client.address}</Text>
            <Text>{client.phone}</Text>
          </View>
        </View>

        <Text style={styles.documentTitle}>{title}</Text>

        {/* Meta Info */}
        <View style={styles.metaSection}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>N° Document</Text>
            <Text style={styles.metaValue}>{invoice.number}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Date d'émission</Text>
            <Text style={styles.metaValue}>{new Date(invoice.issue_date).toLocaleDateString('fr-FR')}</Text>
          </View>
          {invoice.due_date && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Date d'échéance</Text>
              <Text style={styles.metaValue}>{new Date(invoice.due_date).toLocaleDateString('fr-FR')}</Text>
            </View>
          )}
          {invoice.terms && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Conditions</Text>
              <Text style={styles.metaValue}>{invoice.terms}</Text>
            </View>
          )}
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colDesc, styles.headerText]}>Désignation</Text>
            <Text style={[styles.colQty, styles.headerText]}>Qté</Text>
            <Text style={[styles.colPrice, styles.headerText]}>P.U HT</Text>
            <Text style={[styles.colTva, styles.headerText]}>TVA</Text>
            <Text style={[styles.colTotal, styles.headerText]}>Total HT</Text>
          </View>

          {items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{item.unit_price.toLocaleString('fr-FR')}</Text>
              <Text style={styles.colTva}>{item.tva_rate}%</Text>
              <Text style={styles.colTotal}>{item.amount_ht.toLocaleString('fr-FR')}</Text>
            </View>
          ))}
        </View>

        {/* Totals (cachés pour les bons de livraison) */}
        {showFinancials && (
          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text>Total Hors Taxes</Text>
              <Text>{invoice.subtotal_ht.toLocaleString('fr-FR')} {currencyLabel}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>Total TVA (18%)</Text>
              <Text>{invoice.total_tva.toLocaleString('fr-FR')} {currencyLabel}</Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>{invoice.type === 'credit_note' ? 'TOTAL AVOIR' : 'TOTAL TTC'}</Text>
              <Text style={styles.grandTotalValue}>{invoice.total_ttc.toLocaleString('fr-FR')} {currencyLabel}</Text>
            </View>
          </View>
        )}

        {invoice.notes && (
          <View style={{ marginTop: 40 }}>
            <Text style={styles.metaLabel}>Notes / Conditions de paiement</Text>
            <Text style={{ fontSize: 9 }}>{invoice.notes}</Text>
          </View>
        )}

        <Text style={styles.legalMention}>
          Tout règlement effectué après la date d'échéance entraîne des pénalités de retard au taux légal en vigueur.
        </Text>

        <View style={styles.footer}>
          <Text>{company.name} - NCC: {company.ncc} - {company.address}</Text>
          {showBrand && (
            <Text style={{ marginTop: 2 }}>Généré avec FACTURA.ci — Passez à Pro pour retirer ce message</Text>
          )}
        </View>
      </Page>
    </Document>
  );
};
