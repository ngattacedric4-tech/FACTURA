import React from 'react';
import { Button } from '@/components/ui/button';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { InvoicePDF } from './InvoicePDF';
import { Download, ArrowLeft } from 'lucide-react';
import { Company } from '@/types/database';

interface Props {
  onClose: () => void;
  company: Company;
  invoice: any;
  showBrand: boolean;
}

export function InvoicePreviewModal({ onClose, company, invoice, showBrand }: Props) {
  const client = invoice.clients || { name: 'Client inconnu' };
  const items: any[] = invoice.invoice_items || [];
  const isInvoice = invoice.type === 'invoice';

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 64px)' }}>

      {/* ── Barre d'outils ── */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-[#F3F4F6] shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl h-8 text-[13px] gap-1.5">
            <ArrowLeft size={14} /> Retour
          </Button>
          <div className="w-px h-4 bg-[#E5E7EB]" />
          <span className="font-black text-[#0A0A0A] text-[14px]">{invoice.number}</span>
          <span className="text-[12px] text-[#9CA3AF]">{client.name}</span>
        </div>
        <PDFDownloadLink
          document={
            <InvoicePDF
              company={company}
              client={client}
              invoice={invoice}
              items={items}
              showBrand={showBrand}
            />
          }
          fileName={`${invoice.number}.pdf`}
        >
          {({ loading: pdfLoading }) => (
            <Button
              variant="outline"
              size="sm"
              disabled={pdfLoading}
              className="rounded-xl h-8 text-[12px] border-[#E5E7EB] bg-white"
            >
              <Download size={13} className="mr-1.5" />
              {pdfLoading ? 'Préparation...' : 'Télécharger PDF'}
            </Button>
          )}
        </PDFDownloadLink>
      </div>

      {/* ── Zone papier ── */}
      <div className="flex-1 overflow-auto bg-[#E8EAED] py-10 px-4">
        {/* Feuille A4 : 794 × 1123 px à 96 dpi */}
        <div
          className="mx-auto bg-white shadow-2xl"
          style={{
            width: '794px',
            minHeight: '1123px',
            padding: '60px',
            boxSizing: 'border-box',
          }}
        >
          {/* ── EN-TÊTE ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
            <div style={{ maxWidth: '280px' }}>
              {company.logo_url && (
                <img
                  src={company.logo_url}
                  alt="logo"
                  style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', marginBottom: '10px', display: 'block' }}
                />
              )}
              <p style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b', margin: '0 0 4px' }}>{company.name}</p>
              {company.address && <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0' }}>{company.address}</p>}
              {company.phone && <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0' }}>Tél : {company.phone}</p>}
              {company.email && <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0' }}>{company.email}</p>}
              {company.ncc && <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0' }}>NCC : {company.ncc}</p>}
              {company.registration_number && (
                <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0' }}>RCCM : {company.registration_number}</p>
              )}
            </div>

            <div style={{ textAlign: 'right', maxWidth: '240px' }}>
              <p style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
                Facturé à
              </p>
              <p style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b', margin: '0 0 4px' }}>{client.name}</p>
              {client.address && <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0' }}>{client.address}</p>}
              {client.phone && <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0' }}>{client.phone}</p>}
              {client.email && <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0' }}>{client.email}</p>}
            </div>
          </div>

          {/* ── TITRE ── */}
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', margin: '0 0 24px', letterSpacing: '-0.5px' }}>
            {isInvoice ? 'FACTURE' : 'DEVIS'}
          </h1>

          {/* ── MÉTA ── */}
          <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9', marginBottom: '28px' }}>
            <div>
              <p style={{ fontSize: '8px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>N° Document</p>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', margin: 0 }}>{invoice.number}</p>
            </div>
            <div>
              <p style={{ fontSize: '8px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Date d'émission</p>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                {new Date(invoice.issue_date).toLocaleDateString('fr-FR')}
              </p>
            </div>
            {invoice.due_date && (
              <div>
                <p style={{ fontSize: '8px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Échéance</p>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                  {new Date(invoice.due_date).toLocaleDateString('fr-FR')}
                </p>
              </div>
            )}
            {invoice.terms && (
              <div>
                <p style={{ fontSize: '8px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Conditions</p>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', margin: 0 }}>{invoice.terms}</p>
              </div>
            )}
          </div>

          {/* ── TABLEAU ── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '11px', marginBottom: '28px' }}>
            <colgroup>
              <col style={{ width: '42%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '22%' }} />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {[
                  ['left',   'Désignation'],
                  ['center', 'Qté'],
                  ['right',  'P.U HT (FCFA)'],
                  ['center', 'TVA'],
                  ['right',  'Total HT (FCFA)'],
                ].map(([align, label]) => (
                  <th key={label as string} style={{ textAlign: align as any, padding: '8px 10px', fontSize: '8px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>Aucun article</td>
                </tr>
              ) : items.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</td>
                  <td style={{ padding: '10px', textAlign: 'center', color: '#475569' }}>{item.quantity}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: '#475569', fontFamily: 'monospace' }}>
                    {(item.unit_price || 0).toLocaleString('fr-FR')}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center', color: '#475569' }}>{item.tva_rate}%</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: '#1e293b', fontFamily: 'monospace' }}>
                    {(item.amount_ht ?? (item.unit_price * item.quantity) ?? 0).toLocaleString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── TOTAUX ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
            <div style={{ width: '240px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '12px' }}>
                <span style={{ color: '#64748b' }}>Total Hors Taxes</span>
                <span style={{ fontFamily: 'monospace' }}>{(invoice.subtotal_ht || 0).toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '12px' }}>
                <span style={{ color: '#64748b' }}>TVA</span>
                <span style={{ fontFamily: 'monospace' }}>{(invoice.total_tva || 0).toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0 6px', marginTop: '8px', borderTop: '2px solid #1d4ed8' }}>
                <span style={{ fontSize: '13px', fontWeight: 900, color: '#1e293b' }}>TOTAL TTC</span>
                <span style={{ fontSize: '16px', fontWeight: 900, color: '#1d4ed8', fontFamily: 'monospace' }}>
                  {(invoice.total_ttc || 0).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>
          </div>

          {/* ── NOTES ── */}
          {invoice.notes && (
            <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '8px', marginBottom: '24px' }}>
              <p style={{ fontSize: '8px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
                Notes / Conditions de paiement
              </p>
              <p style={{ fontSize: '11px', color: '#475569', margin: 0, whiteSpace: 'pre-line' }}>{invoice.notes}</p>
            </div>
          )}

          {/* ── MENTION LÉGALE ── */}
          <p style={{ fontSize: '9px', color: '#94a3b8', fontStyle: 'italic', marginTop: '20px' }}>
            Tout règlement effectué après la date d'échéance entraîne des pénalités de retard au taux légal en vigueur.
          </p>

          {/* ── PIED DE PAGE ── */}
          <div style={{ marginTop: '40px', paddingTop: '14px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
            <p style={{ fontSize: '9px', color: '#94a3b8', margin: '0 0 3px' }}>
              {company.name}{company.ncc ? ` — NCC : ${company.ncc}` : ''}{company.address ? ` — ${company.address}` : ''}
            </p>
            {showBrand && (
              <p style={{ fontSize: '8px', color: '#cbd5e1', margin: 0 }}>
                Généré avec FACTURA.ci — Passez à Pro pour retirer ce message
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
