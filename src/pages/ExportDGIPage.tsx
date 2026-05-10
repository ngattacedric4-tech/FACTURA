import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Download, Calendar, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { CustomSelect } from '@/components/ui/CustomSelect';

interface ExportDGIPageProps { onNavigate: (page: string) => void; }

interface TVAStats { baseHT_18: number; tva_18: number; baseHT_0: number; totalTTC: number; count: number; }

export function ExportDGIPage({ onNavigate }: ExportDGIPageProps) {
  const { company } = useAuth();
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  });
  const [stats, setStats] = useState<TVAStats>({ baseHT_18:0, tva_18:0, baseHT_0:0, totalTTC:0, count:0 });
  const [loading, setLoading] = useState(false);
  const [allInvoices, setAllInvoices] = useState<any[]>([]);

  useEffect(() => { if (company) fetchData(); }, [company, period]);

  async function fetchData() {
    setLoading(true);
    try {
      const [year, month] = period.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

      const { data: invoices } = await supabase
        .from('invoices')
        .select('*, clients(name, ncc)')
        .eq('company_id', company?.id)
        .eq('type', 'invoice')
        .neq('status', 'draft')
        .neq('status', 'canceled')
        .gte('issue_date', startDate)
        .lte('issue_date', endDate)
        .order('issue_date', { ascending: true });

      if (invoices) {
        setAllInvoices(invoices);
        const s: TVAStats = { baseHT_18:0, tva_18:0, baseHT_0:0, totalTTC:0, count:invoices.length };
        invoices.forEach(inv => {
          s.totalTTC += inv.total_ttc || 0;
          s.tva_18 += inv.total_tva || 0;
          s.baseHT_18 += inv.subtotal_ht || 0;
        });
        setStats(s);
      }
    } catch(e) { console.log(e); }
    finally { setLoading(false); }
  }

  function exportTVACSV() {
    const headers = ['N° Facture','Date','Client','NCC Client','Montant HT','TVA (18%)','Total TTC'];
    const rows = allInvoices.map(inv => [
      inv.number,
      new Date(inv.issue_date).toLocaleDateString('fr-FR'),
      (inv.clients as any)?.name || '',
      (inv.clients as any)?.ncc || '',
      inv.subtotal_ht || 0,
      inv.total_tva || 0,
      inv.total_ttc || 0,
    ]);
    const csv = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(';') + '\n' + rows.map(r=>r.join(';')).join('\n');
    const a = document.createElement('a'); a.href = encodeURI(csv);
    a.download = `declaration_TVA_${period}.csv`; a.click();
    toast.success('Export TVA généré !');
  }

  function exportRegistreCSV() {
    const headers = ['N°','Date émission','Date échéance','N° Facture','Client','NCC Client','Montant HT','TVA','Total TTC','Statut'];
    const rows = allInvoices.map((inv,i) => [
      i+1, new Date(inv.issue_date).toLocaleDateString('fr-FR'),
      inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-FR') : '',
      inv.number, (inv.clients as any)?.name || '', (inv.clients as any)?.ncc || '',
      inv.subtotal_ht||0, inv.total_tva||0, inv.total_ttc||0, inv.status,
    ]);
    const csv = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(';') + '\n' + rows.map(r=>r.join(';')).join('\n');
    const a = document.createElement('a'); a.href = encodeURI(csv);
    a.download = `registre_factures_${period}.csv`; a.click();
    toast.success('Registre des factures généré !');
  }

  const months = Array.from({length: 12}, (_,i) => {
    const d = new Date(new Date().getFullYear(), i, 1);
    return { value: `${d.getFullYear()}-${String(i+1).padStart(2,'0')}`, label: d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}) };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0A0A0A]">Export DGI — Côte d'Ivoire</h1>
        <p className="text-[14px] text-[#6B7280] mt-0.5">Générez vos rapports mensuels conformes à la Direction Générale des Impôts.</p>
      </div>

      {/* Sélecteur de période */}
      <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-[#F3F4F6] p-2 rounded-xl"><Calendar size={16} className="text-[#6B7280]"/></div>
          <div>
            <p className="text-[13px] font-semibold text-[#0A0A0A]">Période fiscale</p>
            <p className="text-[12px] text-[#9CA3AF]">Sélectionnez le mois de déclaration</p>
          </div>
        </div>
        <CustomSelect
          size="lg"
          value={period}
          onChange={setPeriod}
          className="w-full md:w-80"
          options={months.map(m => ({ value: m.value, label: m.label.charAt(0).toUpperCase() + m.label.slice(1) }))}
        />
      </div>

      {/* Stats TVA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Base de déclaration */}
        <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[15px] font-semibold text-[#0A0A0A]">Base de déclaration TVA</h2>
              <p className="text-[12px] text-[#9CA3AF] mt-0.5">{stats.count} facture(s) sur la période</p>
            </div>
            <Button onClick={exportTVACSV} className="bg-[#111827] text-white rounded-xl h-9 px-4 text-[12px]" disabled={allInvoices.length===0}>
              <Download size={14} className="mr-1.5"/> Télécharger
            </Button>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-10 bg-[#F9FAFB] rounded animate-pulse"/>)}</div>
          ) : (
            <div className="space-y-3">
              {[
                {label:'Total HT (Base 18%)', value:stats.baseHT_18, cls:'text-[#374151]'},
                {label:'TVA collectée (18%)', value:stats.tva_18, cls:'text-[#374151]'},
                {label:'Base exonérée (0%)',  value:stats.baseHT_0, cls:'text-[#374151]'},
              ].map(row=>(
                <div key={row.label} className="flex justify-between items-center py-3 border-b border-[#F9FAFB]">
                  <span className="text-[13px] text-[#6B7280]">{row.label}</span>
                  <span className={`text-[14px] font-semibold font-mono ${row.cls}`}>{(row.value||0).toLocaleString('fr-FR')} FCFA</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-3">
                <span className="text-[14px] font-bold text-[#0A0A0A]">Total TTC</span>
                <span className="text-[16px] font-bold text-[#0A0A0A] font-mono">{(stats.totalTTC||0).toLocaleString('fr-FR')} FCFA</span>
              </div>
            </div>
          )}
        </div>

        {/* Registre des factures */}
        <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[15px] font-semibold text-[#0A0A0A]">Registre des factures émises</h2>
              <p className="text-[12px] text-[#9CA3AF] mt-0.5">Format légal obligatoire — contrôle DGI</p>
            </div>
            <Button onClick={exportRegistreCSV} className="bg-[#111827] text-white rounded-xl h-9 px-4 text-[12px]" disabled={allInvoices.length===0}>
              <Download size={14} className="mr-1.5"/> Télécharger
            </Button>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 bg-[#F9FAFB] rounded-xl">
              <ShieldCheck size={18} className="text-emerald-600 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="text-[13px] font-semibold text-[#0A0A0A]">Conformité assurée</p>
                <p className="text-[12px] text-[#6B7280] mt-0.5">Inclut : Date, N°, Client, NCC Client, Montant HT, TVA, TTC, Statut.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-[#F9FAFB] rounded-xl">
              <FileSpreadsheet size={18} className="text-blue-600 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="text-[13px] font-semibold text-[#0A0A0A]">Format CSV (Excel)</p>
                <p className="text-[12px] text-[#6B7280] mt-0.5">Encodage UTF-8 BOM — compatible Excel et LibreOffice.</p>
              </div>
            </div>
          </div>
          {allInvoices.length === 0 && !loading && (
            <div className="text-center py-8">
              <FileSpreadsheet size={28} className="mx-auto text-[#D1D5DB] mb-2"/>
              <p className="text-[13px] text-[#9CA3AF]">Aucune facture sur cette période</p>
            </div>
          )}
        </div>
      </div>

      {/* Mention légale */}
      <div className="bg-[#F9FAFB] rounded-2xl border border-[#F3F4F6] p-5">
        <p className="text-[12px] text-[#9CA3AF] text-center">
          Ces exports sont générés conformément au Code Général des Impôts de Côte d'Ivoire.
          Conservez vos registres pendant au minimum 10 ans selon l'article L.23 du Livre des Procédures Fiscales.
        </p>
      </div>
    </div>
  );
}
