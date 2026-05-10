import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, CreditCard, Smartphone, Banknote, Repeat, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentsPageProps { onNavigate: (page: string) => void; }

interface PaymentRow {
  id: string; invoice_id: string; amount: number;
  method: string; reference?: string; payment_date: string;
  invoice_number?: string; client_name?: string;
}

export function PaymentsPage({ onNavigate }: PaymentsPageProps) {
  const { company } = useAuth();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [filtered, setFiltered] = useState<PaymentRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [totalEncaisse, setTotalEncaisse] = useState(0);

  useEffect(() => { if (company) fetchPayments(); }, [company]);

  useEffect(() => {
    if (!search) { setFiltered(payments); return; }
    const q = search.toLowerCase();
    setFiltered(payments.filter(p =>
      p.invoice_number?.toLowerCase().includes(q) ||
      p.client_name?.toLowerCase().includes(q) ||
      p.reference?.toLowerCase().includes(q)
    ));
  }, [search, payments]);

  async function fetchPayments() {
    try {
      // Récupère les paiements via les factures de la company
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, number, clients(name)')
        .eq('company_id', company?.id);

      if (!invoices || invoices.length === 0) { setLoading(false); return; }

      const invoiceIds = invoices.map(i => i.id);
      const invoiceMap: Record<string, { number: string; client_name: string }> = {};
      invoices.forEach(i => {
        invoiceMap[i.id] = { number: i.number, client_name: (i.clients as any)?.name || '' };
      });

      const { data: pays } = await supabase
        .from('payments')
        .select('*')
        .in('invoice_id', invoiceIds)
        .order('payment_date', { ascending: false });

      if (pays) {
        const enriched = pays.map(p => ({
          ...p,
          invoice_number: invoiceMap[p.invoice_id]?.number || '',
          client_name: invoiceMap[p.invoice_id]?.client_name || '',
        }));
        setPayments(enriched);
        setFiltered(enriched);
        setTotalEncaisse(enriched.reduce((a, p) => a + (p.amount || 0), 0));
      }
    } catch(e) { console.log(e); }
    finally { setLoading(false); }
  }

  function exportCSV() {
    const headers = ['Facture','Client','Montant','Méthode','Référence','Date'];
    const rows = filtered.map(p => [
      p.invoice_number, p.client_name, p.amount,
      methodLabel(p.method), p.reference || '', p.payment_date
    ]);
    const csv = "data:text/csv;charset=utf-8," + headers.join(',') + '\n' + rows.map(r=>r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csv);
    a.download = `paiements_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Export CSV généré !');
  }

  function methodLabel(m: string) {
    return { wave:'Wave', om:'Orange Money', mtn:'MTN Money', cash:'Espèces', transfer:'Virement', check:'Chèque' }[m] || m;
  }

  function methodBadge(m: string) {
    const cfg: Record<string,{cls:string;icon:React.ReactNode}> = {
      wave:     {cls:'bg-blue-50 text-blue-700',     icon:<Smartphone size={11} className="mr-1"/>},
      om:       {cls:'bg-orange-50 text-orange-700', icon:<Smartphone size={11} className="mr-1"/>},
      mtn:      {cls:'bg-yellow-50 text-yellow-700', icon:<Smartphone size={11} className="mr-1"/>},
      cash:     {cls:'bg-emerald-50 text-emerald-700',icon:<Banknote size={11} className="mr-1"/>},
      transfer: {cls:'bg-indigo-50 text-indigo-700', icon:<Repeat size={11} className="mr-1"/>},
      check:    {cls:'bg-[#F3F4F6] text-[#6B7280]',  icon:<CheckSquare size={11} className="mr-1"/>},
    };
    const c = cfg[m] || {cls:'bg-[#F3F4F6] text-[#6B7280]', icon:null};
    return <span className={`flex items-center w-fit px-2.5 py-1 rounded-full text-[11px] font-semibold ${c.cls}`}>{c.icon}{methodLabel(m)}</span>;
  }

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-6 border border-[#F3F4F6] shadow-sm md:col-span-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl"><CreditCard size={18}/></div>
            <p className="text-[11px] font-bold text-[#374151] uppercase tracking-wider">Total encaissé</p>
          </div>
          <p className="text-2xl font-bold text-[#0A0A0A] font-mono">{totalEncaisse.toLocaleString('fr-FR')} FCFA</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-[#F3F4F6] shadow-sm">
          <p className="text-[11px] font-bold text-[#374151] uppercase tracking-wider mb-3">Nombre de paiements</p>
          <p className="text-2xl font-bold text-[#0A0A0A]">{payments.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-[#F3F4F6] shadow-sm">
          <p className="text-[11px] font-bold text-[#374151] uppercase tracking-wider mb-3">Paiement moyen</p>
          <p className="text-2xl font-bold text-[#0A0A0A] font-mono">
            {payments.length > 0 ? Math.round(totalEncaisse / payments.length).toLocaleString('fr-FR') : 0} FCFA
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={15}/>
          <Input placeholder="Rechercher par facture, client, référence..."
            className="pl-9 h-10 rounded-xl border-[#E5E7EB] text-[13px]"
            value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <Button variant="outline" className="rounded-xl h-10 px-4 text-[13px] border-[#E5E7EB]" onClick={exportCSV}>
          <Download size={15} className="mr-1.5"/> Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#F3F4F6]">
              {['Facture','Client','Montant','Méthode','Référence','Date'].map(h=>(
                <th key={h} className="px-6 py-3 text-[11px] font-bold text-[#374151] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1,2,3].map(i=>(
                <tr key={i}><td colSpan={6} className="px-6 py-4"><div className="h-8 bg-[#F9FAFB] rounded animate-pulse"/></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-16 text-center">
                <CreditCard size={32} className="mx-auto text-[#D1D5DB] mb-3"/>
                <p className="text-[14px] text-[#9CA3AF]">Aucun paiement enregistré</p>
                <p className="text-[12px] text-[#D1D5DB] mt-1">Les paiements apparaissent quand une facture est marquée comme payée.</p>
              </td></tr>
            ) : (
              filtered.map(p=>(
                <tr key={p.id} className="border-b border-[#F9FAFB] hover:bg-[#F9FAFB] transition-colors">
                  <td className="px-6 py-4 text-[13px] font-semibold text-[#0A0A0A]">{p.invoice_number}</td>
                  <td className="px-6 py-4 text-[13px] text-[#374151]">{p.client_name}</td>
                  <td className="px-6 py-4 text-[13px] font-bold text-emerald-600 font-mono">{(p.amount||0).toLocaleString('fr-FR')} FCFA</td>
                  <td className="px-6 py-4">{methodBadge(p.method)}</td>
                  <td className="px-6 py-4 text-[12px] text-[#9CA3AF] font-mono">{p.reference || '—'}</td>
                  <td className="px-6 py-4 text-[13px] text-[#6B7280]">{new Date(p.payment_date).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
