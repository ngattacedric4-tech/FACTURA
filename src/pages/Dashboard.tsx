import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, Clock, CheckCircle2, AlertCircle, Users, Receipt, FilePlus, UserPlus, TrendingUp, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { usePlan } from '@/hooks/usePlan';
import { PLAN_LABEL, isUnlimited } from '@/lib/plans';

interface DashboardProps { onNavigate: (page: string) => void; }
interface RecentInvoice { id: string; number: string; client_name: string; total_ttc: number; status: string; issue_date: string; }

export function Dashboard({ onNavigate }: DashboardProps) {
  const { company } = useAuth();
  const { plan, limits, usage } = usePlan();
  const isStarter = plan === 'starter';
  const [stats, setStats] = useState({ totalMonthly: 0, unpaid: 0, pendingEstimates: 0, activeClients: 0 });
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [topClients, setTopClients] = useState<{name:string;total:number}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (company) fetchAll(); }, [company]);

  async function fetchAll() {
    try {
      const [{ data: invoices }, { count: clientsCount }] = await Promise.all([
        supabase.from('invoices').select('*, clients(name)').eq('company_id', company?.id).order('created_at', { ascending: false }),
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('company_id', company?.id)
      ]);
      if (invoices) {
        const now = new Date(); const month = now.getMonth(); const year = now.getFullYear();
        // CA du mois = factures du mois 'paid' (full) + avances encaissées sur 'partial' du mois.
        const monthly = invoices
          .filter(i => { const d = new Date(i.issue_date); return d.getMonth()===month && d.getFullYear()===year; })
          .reduce((a, i) => {
            if (i.status === 'paid') return a + (i.total_ttc || 0);
            if (i.status === 'partial') return a + (i.advance_amount || 0);
            return a;
          }, 0);
        // Impayés = solde restant (total - avance) sur sent/overdue/partial.
        const unpaid = invoices
          .filter(i => i.status === 'sent' || i.status === 'overdue' || i.status === 'partial')
          .reduce((a, i) => a + ((i.total_ttc || 0) - (i.advance_amount || 0)), 0);
        const pendingEst = invoices.filter(i=>i.type==='estimate'&&i.status==='draft').reduce((a,i)=>a+(i.total_ttc||0),0);
        setStats({ totalMonthly: monthly, unpaid, pendingEstimates: pendingEst, activeClients: clientsCount||0 });
        setRecentInvoices(invoices.slice(0,5).map(i=>({ id:i.id, number:i.number, client_name:(i.clients as any)?.name||'Client inconnu', total_ttc:i.total_ttc, status:i.status, issue_date:i.issue_date })));

        const acc: Record<string, {name:string; total:number}> = {};
        invoices.filter(i=>i.status==='paid').forEach(i=>{
          const name = (i.clients as any)?.name || 'Client';
          const k = i.client_id || name;
          if(!acc[k]) acc[k] = { name, total: 0 };
          acc[k].total += (i.total_ttc||0);
        });
        setTopClients(Object.values(acc).sort((a,b)=>b.total-a.total).slice(0,5));
      }
    } catch(e){ console.log(e); } finally { setLoading(false); }
  }

  const statusMap: Record<string, {label:string;cls:string;icon?:React.ReactNode}> = {
    draft:   {label:'Brouillon',  cls:'bg-[#F3F4F6] text-[#6B7280]'},
    sent:    {label:'Envoyé',     cls:'bg-blue-50 text-blue-700',    icon:<Clock size={11} className="mr-1"/>},
    partial: {label:'Partiel',    cls:'bg-amber-50 text-amber-700',  icon:<Clock size={11} className="mr-1"/>},
    paid:    {label:'Payée',      cls:'bg-emerald-50 text-emerald-700', icon:<CheckCircle2 size={11} className="mr-1"/>},
    overdue: {label:'En retard',  cls:'bg-red-50 text-red-700',      icon:<AlertCircle size={11} className="mr-1"/>},
    canceled:{label:'Annulée',    cls:'bg-[#F3F4F6] text-[#9CA3AF]'},
  };

  const statCards = [
    {title:"CA du mois",        value:stats.totalMonthly, suffix:' FCFA', badge:'Ce mois',     Icon:TrendingUp, ibg:'bg-emerald-50', ic:'text-emerald-600'},
    {title:"Factures impayées", value:stats.unpaid,       suffix:' FCFA', badge:'À recouvrer', Icon:Clock,      ibg:'bg-amber-50',   ic:'text-amber-600'},
    {title:"Devis en attente",  value:stats.pendingEstimates, suffix:' FCFA', badge:'Opportunités',Icon:Receipt,ibg:'bg-blue-50',    ic:'text-blue-600'},
    {title:"Clients actifs",    value:stats.activeClients,suffix:'',      badge:'Total',        Icon:Users,      ibg:'bg-purple-50',  ic:'text-purple-600'},
  ];

  return (
    <div className="space-y-8">
      {isStarter && (
        <div className="bg-gradient-to-r from-[#111827] to-[#1F2937] text-white rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Sparkles size={18} className="text-amber-400"/>
            </div>
            <div>
              <p className="text-[14px] font-semibold">Plan {PLAN_LABEL[plan]} — {usage.invoicesThisMonth}/{isUnlimited(limits.invoicesPerMonth)?'∞':limits.invoicesPerMonth} factures ce mois · {usage.clientsCount}/{isUnlimited(limits.clients)?'∞':limits.clients} clients</p>
              <p className="text-[12px] text-white/60">Passez à Pro pour des factures et clients illimités, et un PDF sans marque.</p>
            </div>
          </div>
          <Button onClick={()=>onNavigate('pricing')} className="bg-white text-[#111827] hover:bg-white/90 rounded-xl h-10 px-5 text-[13px] font-semibold">
            Voir les plans
          </Button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0A0A0A]">Bonjour, {company?.name}</h1>
          <p className="text-[14px] text-[#6B7280] mt-0.5">Voici un aperçu de votre activité commerciale.</p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-[#111827] text-white rounded-xl h-10 px-4 text-[13px] font-medium hover:bg-[#1F2937]" onClick={()=>onNavigate('invoices')}>
            <FilePlus size={15} className="mr-1.5"/> Nouvelle facture
          </Button>
          <Button variant="outline" className="rounded-xl h-10 px-4 text-[13px] font-medium border-[#E5E7EB]" onClick={()=>onNavigate('clients')}>
            <UserPlus size={15} className="mr-1.5"/> Ajouter client
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s=>(
          <div key={s.title} className="bg-white rounded-2xl p-6 border border-[#F3F4F6] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={`${s.ibg} ${s.ic} p-2 rounded-xl`}><s.Icon size={18}/></div>
              <span className="text-[11px] text-[#9CA3AF] bg-[#F9FAFB] px-2 py-1 rounded-full">{s.badge}</span>
            </div>
            <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-1">{s.title}</p>
            {loading ? <div className="h-6 w-28 bg-[#F3F4F6] rounded animate-pulse"/> :
              <p className="text-xl font-bold text-[#0A0A0A] font-mono">{s.suffix?`${(s.value||0).toLocaleString('fr-FR')}${s.suffix}`:s.value}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#F3F4F6] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
            <h2 className="text-[15px] font-semibold text-[#0A0A0A]">Factures récentes</h2>
            <Button variant="ghost" size="sm" className="text-[13px] text-[#6B7280] h-8" onClick={()=>onNavigate('invoices')}>
              Tout voir <ArrowUpRight size={14} className="ml-1"/>
            </Button>
          </div>
          {loading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i=><div key={i} className="h-12 bg-[#F9FAFB] rounded-xl animate-pulse"/>)}</div>
          ) : recentInvoices.length===0 ? (
            <div className="p-12 text-center">
              <Receipt size={32} className="mx-auto text-[#D1D5DB] mb-3"/>
              <p className="text-[14px] text-[#9CA3AF]">Aucune facture pour l'instant</p>
              <Button className="mt-4 bg-[#111827] text-white rounded-xl h-9 px-4 text-[13px]" onClick={()=>onNavigate('invoices')}>Créer ma première facture</Button>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead><tr className="border-b border-[#F3F4F6]">
                {['Document','Client','Montant','Statut'].map(h=><th key={h} className="px-6 py-3 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">{h}</th>)}
              </tr></thead>
              <tbody>
                {recentInvoices.map(inv=>{
                  const s=statusMap[inv.status]||{label:inv.status,cls:'bg-[#F3F4F6] text-[#6B7280]',icon:null};
                  return (
                    <tr key={inv.id} className="border-b border-[#F9FAFB] hover:bg-[#F9FAFB] cursor-pointer">
                      <td className="px-6 py-4"><p className="text-[13px] font-semibold text-[#0A0A0A]">{inv.number}</p><p className="text-[11px] text-[#9CA3AF]">{new Date(inv.issue_date).toLocaleDateString('fr-FR')}</p></td>
                      <td className="px-6 py-4 text-[13px] text-[#374151]">{inv.client_name}</td>
                      <td className="px-6 py-4 text-[13px] font-semibold text-[#0A0A0A] font-mono">{(inv.total_ttc||0).toLocaleString('fr-FR')} FCFA</td>
                      <td className="px-6 py-4"><span className={`flex items-center w-fit px-2.5 py-1 rounded-full text-[11px] font-semibold ${s.cls}`}>{s.icon}{s.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm p-5">
            <h3 className="font-semibold text-[14px] text-[#0A0A0A] mb-3">Top clients</h3>
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-8 bg-[#F9FAFB] rounded-lg animate-pulse"/>)}</div>
            ) : topClients.length===0 ? (
              <p className="text-[12px] text-[#9CA3AF]">Aucun paiement encore.</p>
            ) : (
              <ul className="space-y-2">
                {topClients.map((c,idx)=>(
                  <li key={idx} className="flex items-center justify-between text-[12px]">
                    <span className="text-[#374151] truncate">{idx+1}. {c.name}</span>
                    <span className="font-mono font-semibold text-[#0A0A0A]">{c.total.toLocaleString('fr-FR')} FCFA</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm p-5">
            <h3 className="font-semibold text-[14px] text-[#0A0A0A] mb-3">Raccourcis</h3>
            <div className="space-y-1">
              {[{label:'Nouveau client',page:'clients',Icon:UserPlus},{label:'Nouveau produit',page:'products',Icon:Receipt},{label:'Voir paiements',page:'payments',Icon:Clock},{label:'Export DGI',page:'export-dgi',Icon:ArrowUpRight}].map(({label,page,Icon})=>(
                <button key={page} onClick={()=>onNavigate(page)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-[#374151] hover:bg-[#F3F4F6] transition-colors text-left">
                  <Icon size={14} className="text-[#9CA3AF]"/>{label}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-[12px] font-semibold text-amber-800 flex items-center gap-1.5"><AlertCircle size={12}/> Rappel DGI</p>
            <p className="text-[12px] text-amber-700 mt-1">L'article 25 du CGI exige votre NCC sur chaque facture émise.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
