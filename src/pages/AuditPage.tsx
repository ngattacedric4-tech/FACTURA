import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { useAuth } from '@/hooks/useAuth';
import { usePlan } from '@/hooks/usePlan';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/lib/supabase';
import { AuditLog } from '@/types/database';
import { History, Lock, Download, Filter } from 'lucide-react';
import { toast } from 'sonner';

interface Props { onNavigate: (page: string) => void; }

const ACTION_LABELS: Record<string, string> = {
  INSERT: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
};

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'bg-emerald-50 text-emerald-700',
  UPDATE: 'bg-blue-50 text-blue-700',
  DELETE: 'bg-red-50 text-red-700',
};

export function AuditPage({ onNavigate }: Props) {
  const { company } = useAuth();
  const { plan } = usePlan();
  const { isAdmin } = useRole();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');

  useEffect(() => { if (company) load(); }, [company, entityFilter, actionFilter]);

  async function load() {
    if (!company) return;
    setLoading(true);
    let q = supabase
      .from('audit_logs')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (entityFilter !== 'all') q = q.eq('entity_type', entityFilter);
    if (actionFilter !== 'all') q = q.eq('action', actionFilter);
    const { data } = await q;
    setLogs((data ?? []) as AuditLog[]);
    setLoading(false);
  }

  function exportCsv() {
    const header = 'date,user,action,entity,id\n';
    const rows = logs.map(l => [
      new Date(l.created_at).toISOString(),
      l.user_id ?? '',
      l.action,
      l.entity_type ?? '',
      l.entity_id ?? '',
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Audit exporté');
  }

  if (plan !== 'enterprise') {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-amber-50 rounded-2xl flex items-center justify-center">
          <Lock size={28} className="text-amber-600" />
        </div>
        <h2 className="text-[22px] font-bold text-[#0A0A0A]">Réservé au plan Enterprise</h2>
        <p className="text-[14px] text-[#6B7280] max-w-md mx-auto">
          Le journal d'audit complet (toutes les actions sur factures, clients, paiements) est disponible
          uniquement sur le plan Enterprise pour vos besoins de conformité.
        </p>
        <Button onClick={() => onNavigate('pricing')} className="bg-[#111827] hover:bg-[#1F2937] text-white">
          Découvrir Enterprise
        </Button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <Lock size={32} className="mx-auto text-[#9CA3AF]" />
        <p className="text-[14px] text-[#6B7280]">Réservé aux administrateurs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-[#0A0A0A]">Journal d'audit</h1>
          <p className="text-[13px] text-[#6B7280] mt-1">Traçabilité complète des actions (500 dernières entrées)</p>
        </div>
        <Button onClick={exportCsv} variant="outline">
          <Download size={14} className="mr-1.5" /> Exporter CSV
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex flex-wrap items-center gap-3">
        <Filter size={14} className="text-[#9CA3AF]" />
        <span className="text-[12px] font-bold uppercase tracking-widest text-[#374151]">Filtres :</span>
        <div className="min-w-[180px]">
          <CustomSelect
            size="sm"
            value={entityFilter}
            onChange={setEntityFilter}
            options={[
              { value: 'all', label: 'Toutes les entités' },
              { value: 'invoices', label: 'Factures' },
              { value: 'clients', label: 'Clients' },
              { value: 'payments', label: 'Paiements' },
            ]}
          />
        </div>
        <div className="min-w-[160px]">
          <CustomSelect
            size="sm"
            value={actionFilter}
            onChange={setActionFilter}
            options={[
              { value: 'all', label: 'Toutes les actions' },
              { value: 'INSERT', label: 'Créations' },
              { value: 'UPDATE', label: 'Modifications' },
              { value: 'DELETE', label: 'Suppressions' },
            ]}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[13px] text-[#9CA3AF]">Chargement...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <History size={28} className="mx-auto text-[#9CA3AF]" />
            <p className="text-[13px] text-[#9CA3AF]">Aucune entrée pour les filtres actuels</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
              <tr>
                <th className="text-left text-[11px] font-bold text-[#6B7280] uppercase tracking-widest px-6 py-3">Date</th>
                <th className="text-left text-[11px] font-bold text-[#6B7280] uppercase tracking-widest px-6 py-3">Action</th>
                <th className="text-left text-[11px] font-bold text-[#6B7280] uppercase tracking-widest px-6 py-3">Entité</th>
                <th className="text-left text-[11px] font-bold text-[#6B7280] uppercase tracking-widest px-6 py-3">ID</th>
                <th className="text-left text-[11px] font-bold text-[#6B7280] uppercase tracking-widest px-6 py-3">Utilisateur</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB]">
                  <td className="px-6 py-3 text-[12px] text-[#6B7280] whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${ACTION_COLORS[l.action] ?? 'bg-[#F3F4F6]'}`}>
                      {ACTION_LABELS[l.action] ?? l.action}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-[12px] font-medium text-[#111827]">{l.entity_type ?? '—'}</td>
                  <td className="px-6 py-3 text-[11px] font-mono text-[#9CA3AF] truncate max-w-[120px]">{l.entity_id ?? '—'}</td>
                  <td className="px-6 py-3 text-[11px] font-mono text-[#9CA3AF] truncate max-w-[120px]">{l.user_id ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
