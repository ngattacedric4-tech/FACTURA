import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import {
  Users, ReceiptText, CreditCard, TrendingUp,
  Building2, MessageSquare, Activity, Shield,
  AlertTriangle, LogOut, Settings, Search, Plus, Trash2,
  ChevronLeft, ChevronRight, Menu, Key, Zap, CheckCircle2, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PLAN_LABEL } from '@/lib/plans';
import { CustomSelect } from '@/components/ui/CustomSelect';

const PLAN_COLORS: Record<string, string> = {
  starter:    'bg-gray-100 text-gray-600',
  pro:        'bg-blue-100 text-blue-700',
  business:   'bg-purple-100 text-purple-700',
  enterprise: 'bg-amber-100 text-amber-700',
};
const PLAN_PRICES: Record<string, number> = {
  starter: 0, pro: 5000, business: 15000, enterprise: 75000,
};
const LEAD_STATUS = [
  { value: 'new',       label: 'Nouveau',   color: 'bg-blue-100 text-blue-700' },
  { value: 'contacted', label: 'Contacté',  color: 'bg-yellow-100 text-yellow-700' },
  { value: 'qualified', label: 'Qualifié',  color: 'bg-indigo-100 text-indigo-700' },
  { value: 'won',       label: 'Signé',     color: 'bg-emerald-100 text-emerald-700' },
  { value: 'lost',      label: 'Perdu',     color: 'bg-red-100 text-red-700' },
];

export function AdminPage() {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [tab, setTab] = useState<'overview' | 'users' | 'leads' | 'activity' | 'keys' | 'settings'>('overview');

  // Stats
  const [stats, setStats] = useState({
    totalCompanies: 0, totalInvoices: 0, totalClients: 0,
    totalRevenue: 0, mrr: 0,
    planBreakdown: { starter: 0, pro: 0, business: 0, enterprise: 0 } as Record<string, number>,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Users
  const [companies, setCompanies] = useState<any[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Leads
  const [leads, setLeads] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Activity
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Settings — admins
  const [admins, setAdmins] = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [newAdminInput, setNewAdminInput] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);

  // Settings — AI config
  const [aiConfig, setAiConfig] = useState({
    provider:         'deepseek',
    api_key:          '',
    api_key_name:     'Clé API',
    api_key_set:      false,
    api_key_suffix:   '',
    key_updated_at:   '',
    model_pro:        'deepseek-chat',
    model_business:   'deepseek-chat',
    model_enterprise: 'deepseek-reasoner',
    tokens_total:     0,
    calls_total:      0,
  });
  const [savingAi, setSavingAi] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean; latency: number; tokens: number; model: string; response: string; timestamp: string;
  } | null>(null);

  // Keys (activation system)
  const [keys, setKeys] = useState<any[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [activationEnforced, setActivationEnforced] = useState(false);
  const [keyForm, setKeyForm] = useState<{ plan: string; duration_minutes: number; notes: string }>({ plan: 'pro', duration_minutes: 30 * 1440, notes: '' });
  const [generatingKey, setGeneratingKey] = useState(false);
  const [justGenerated, setJustGenerated] = useState<{ code: string; plan: string; duration_minutes: number } | null>(null);

  // Layout
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => supabase.auth.signOut();

  useEffect(() => { if (isAdmin) fetchStats(); }, [isAdmin]);
  useEffect(() => { if (tab === 'users'    && isAdmin) fetchCompanies(); },  [tab, isAdmin]);
  useEffect(() => { if (tab === 'leads'    && isAdmin) fetchLeads(); },      [tab, isAdmin]);
  useEffect(() => { if (tab === 'activity' && isAdmin) fetchActivity(); },   [tab, isAdmin]);
  useEffect(() => {
    if (tab === 'settings' && isAdmin) { fetchAdmins(); fetchAiConfig(); }
  }, [tab, isAdmin]);
  useEffect(() => { if (tab === 'keys' && isAdmin) { fetchKeys(); fetchEnforced(); } }, [tab, isAdmin]);

  // Realtime: refresh users + stats quand un abonnement ou une activation change
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel('admin-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => {
        fetchStats();
        if (tab === 'users') fetchCompanies();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_activations' }, () => {
        if (tab === 'users') fetchCompanies();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, () => {
        fetchStats();
        if (tab === 'users') fetchCompanies();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activation_keys' }, () => {
        if (tab === 'keys') fetchKeys();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, tab]);

  async function fetchStats() {
    setLoadingStats(true);
    try {
      const [
        { count: companiesCount },
        { count: invoicesCount },
        { count: clientsCount },
        { data: paymentsData },
        { data: subsData },
      ] = await Promise.all([
        supabase.from('companies').select('*', { count: 'exact', head: true }),
        supabase.from('invoices').select('*', { count: 'exact', head: true }),
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('payments').select('amount'),
        supabase.from('subscriptions').select('plan').eq('status', 'active'),
      ]);
      const totalRevenue = paymentsData?.reduce((s, p) => s + Number(p.amount || 0), 0) || 0;
      const breakdown: Record<string, number> = { starter: 0, pro: 0, business: 0, enterprise: 0 };
      subsData?.forEach(s => { if (s.plan in breakdown) breakdown[s.plan]++; });
      breakdown.starter = Math.max(0, (companiesCount || 0) - (breakdown.pro + breakdown.business + breakdown.enterprise));
      const mrr = Object.entries(breakdown).reduce((sum, [plan, count]) => sum + (PLAN_PRICES[plan] || 0) * count, 0);
      setStats({ totalCompanies: companiesCount || 0, totalInvoices: invoicesCount || 0, totalClients: clientsCount || 0, totalRevenue, mrr, planBreakdown: breakdown });
    } catch (e: any) { toast.error('Erreur stats: ' + e.message); }
    finally { setLoadingStats(false); }
  }

  async function fetchCompanies() {
    setLoadingCompanies(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*, subscriptions(plan, status, current_period_end)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCompanies(data || []);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoadingCompanies(false); }
  }

  async function fetchLeads() {
    setLoadingLeads(true);
    try {
      const { data, error } = await supabase.from('enterprise_leads').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setLeads(data || []);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoadingLeads(false); }
  }

  async function fetchActivity() {
    setLoadingActivity(true);
    try {
      const [{ data: invData }, { data: payData }] = await Promise.all([
        supabase.from('invoices').select('*, companies(name)').order('created_at', { ascending: false }).limit(20),
        supabase.from('payments').select('*, invoices(number, companies(name))').order('payment_date', { ascending: false }).limit(20),
      ]);
      setRecentInvoices(invData || []);
      setRecentPayments(payData || []);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoadingActivity(false); }
  }

  async function fetchAiConfig() {
    try {
      const { data } = await supabase.from('platform_settings').select('key, value, updated_at');
      const cfg: Record<string, string> = {};
      const upd: Record<string, string> = {};
      for (const r of data || []) { cfg[r.key] = r.value ?? ''; upd[r.key] = r.updated_at ?? ''; }
      setAiConfig({
        provider:         cfg['ai_provider']         || 'deepseek',
        api_key:          '',
        api_key_name:     cfg['ai_api_key_name']     || 'Clé API',
        api_key_set:      !!(cfg['ai_api_key']),
        api_key_suffix:   cfg['ai_api_key_suffix']   || '',
        key_updated_at:   upd['ai_api_key']          || '',
        model_pro:        cfg['ai_model_pro']        || 'deepseek-chat',
        model_business:   cfg['ai_model_business']   || 'deepseek-chat',
        model_enterprise: cfg['ai_model_enterprise'] || 'deepseek-reasoner',
        tokens_total:     parseInt(cfg['ai_tokens_total'] || '0') || 0,
        calls_total:      parseInt(cfg['ai_calls_total']  || '0') || 0,
      });
    } catch (e: any) { toast.error(e.message); }
  }

  async function saveAiConfig() {
    setSavingAi(true);
    try {
      const now = new Date().toISOString();
      const trimmedKey = aiConfig.api_key.trim();
      const rows = [
        { key: 'ai_provider',         value: aiConfig.provider,       updated_at: now },
        { key: 'ai_api_key_name',     value: aiConfig.api_key_name,   updated_at: now },
        { key: 'ai_model_pro',        value: aiConfig.model_pro,      updated_at: now },
        { key: 'ai_model_business',   value: aiConfig.model_business, updated_at: now },
        { key: 'ai_model_enterprise', value: aiConfig.model_enterprise, updated_at: now },
      ];
      if (trimmedKey) {
        rows.push({ key: 'ai_api_key',        value: trimmedKey,             updated_at: now });
        rows.push({ key: 'ai_api_key_suffix', value: trimmedKey.slice(-4),   updated_at: now });
      }
      for (const row of rows) {
        const { error } = await supabase.from('platform_settings').upsert(row, { onConflict: 'key' });
        if (error) throw error;
      }
      toast.success('Configuration IA sauvegardée !');
      setAiConfig(prev => ({
        ...prev,
        api_key:        '',
        api_key_set:    true,
        api_key_suffix: trimmedKey ? trimmedKey.slice(-4) : prev.api_key_suffix,
        key_updated_at: trimmedKey ? now : prev.key_updated_at,
      }));
      setEditingKey(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingAi(false); }
  }

  async function testAiConfig() {
    setTestingAi(true);
    setTestResult(null);
    const start = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { messages: [{ role: 'user', content: 'Test de connexion. Réponds uniquement: OK' }] },
      });
      const latency = Date.now() - start;
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTestResult({
        success: true, latency,
        tokens: data.usage?.total_tokens || 0,
        model: data.model || '',
        response: data.content?.slice(0, 80) || '',
        timestamp: new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      });
      fetchAiConfig();
    } catch (e: any) {
      setTestResult({
        success: false, latency: Date.now() - start,
        tokens: 0, model: '', response: e.message,
        timestamp: new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      });
    } finally { setTestingAi(false); }
  }

  async function deleteApiKey() {
    const now = new Date().toISOString();
    try {
      await Promise.all([
        supabase.from('platform_settings').upsert({ key: 'ai_api_key',        value: '', updated_at: now }, { onConflict: 'key' }),
        supabase.from('platform_settings').upsert({ key: 'ai_api_key_suffix', value: '', updated_at: now }, { onConflict: 'key' }),
      ]);
      setAiConfig(prev => ({ ...prev, api_key_set: false, api_key_suffix: '', key_updated_at: '' }));
      setEditingKey(false);
      setConfirmDeleteKey(false);
      setTestResult(null);
      toast.success('Clé API supprimée. L\'assistant IA est désactivé.');
    } catch (e: any) { toast.error(e.message); }
  }

  async function fetchAdmins() {
    setLoadingAdmins(true);
    try {
      const { data: adminList, error } = await supabase.from('admins').select('*');
      if (error) throw error;
      const userIds = (adminList || []).map((a: any) => a.user_id);
      if (userIds.length === 0) { setAdmins([]); return; }
      const { data: companiesList } = await supabase.from('companies').select('user_id, name, email').in('user_id', userIds);
      const companyMap = Object.fromEntries((companiesList || []).map((c: any) => [c.user_id, c]));
      setAdmins((adminList || []).map((a: any) => ({ ...a, company: companyMap[a.user_id] || null })));
    } catch (e: any) { toast.error(e.message); }
    finally { setLoadingAdmins(false); }
  }

  async function addAdmin() {
    const input = newAdminInput.trim();
    if (!input) return;
    setAddingAdmin(true);
    try {
      let userId = input;
      if (input.includes('@')) {
        const { data: co } = await supabase.from('companies').select('user_id').eq('email', input).maybeSingle();
        if (!co) throw new Error("Aucun compte trouvé avec cet email d'entreprise. Utilisez l'UUID directement.");
        userId = co.user_id;
      }
      const { error } = await supabase.from('admins').insert({ user_id: userId });
      if (error) throw error;
      toast.success('Admin ajouté.');
      setNewAdminInput('');
      fetchAdmins();
    } catch (e: any) { toast.error(e.message); }
    finally { setAddingAdmin(false); }
  }

  async function removeAdmin(userId: string) {
    if (userId === user?.id) { toast.error('Impossible de vous retirer vous-même.'); return; }
    try {
      const { error } = await supabase.from('admins').delete().eq('user_id', userId);
      if (error) throw error;
      toast.success('Admin retiré.');
      setAdmins(prev => prev.filter(a => a.user_id !== userId));
    } catch (e: any) { toast.error(e.message); }
  }

  async function fetchKeys() {
    setLoadingKeys(true);
    try {
      const { data, error } = await supabase
        .from('activation_keys')
        .select('*, used_company:companies!activation_keys_used_by_fkey(name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setKeys(data || []);
    } catch (e: any) { toast.error('Clés: ' + e.message); }
    finally { setLoadingKeys(false); }
  }

  async function fetchEnforced() {
    try {
      const { data } = await supabase.from('platform_settings').select('value').eq('key', 'activation_enforced').maybeSingle();
      setActivationEnforced((data?.value || 'false') === 'true');
    } catch { /* noop */ }
  }

  async function toggleEnforced() {
    const next = !activationEnforced;
    try {
      const { error } = await supabase.from('platform_settings').upsert(
        { key: 'activation_enforced', value: next ? 'true' : 'false', updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (error) throw error;
      setActivationEnforced(next);
      toast.success(next ? 'Activation OBLIGATOIRE pour tous.' : 'Activation désactivée (kill switch OFF).');
    } catch (e: any) { toast.error(e.message); }
  }

  async function generateKey() {
    setGeneratingKey(true);
    try {
      const { data, error } = await supabase.rpc('admin_generate_key', {
        p_plan: keyForm.plan,
        p_duration_minutes: keyForm.duration_minutes,
        p_notes: keyForm.notes || null,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setJustGenerated({ code: row.code, plan: keyForm.plan, duration_minutes: keyForm.duration_minutes });
      setKeyForm(f => ({ ...f, notes: '' }));
      fetchKeys();
    } catch (e: any) { toast.error(e.message); }
    finally { setGeneratingKey(false); }
  }

  function formatDuration(minutes: number): string {
    if (minutes < 60)         return `${minutes} min`;
    if (minutes < 1440)       return `${Math.round(minutes / 60)} h`;
    return `${Math.round(minutes / 1440)} j`;
  }

  async function revokeKey(id: string) {
    try {
      const { error } = await supabase.rpc('admin_revoke_key', { p_key_id: id });
      if (error) throw error;
      toast.success('Clé révoquée.');
      fetchKeys();
    } catch (e: any) { toast.error(e.message); }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Code copié dans le presse-papier.');
    } catch { toast.error('Copie impossible.'); }
  }

  async function updateLeadStatus(id: string, status: string) {
    try {
      const { error } = await supabase.from('enterprise_leads').update({ status }).eq('id', id);
      if (error) throw error;
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    } catch (e: any) { toast.error(e.message); }
  }

  async function updateLeadNotes(id: string, notes: string) {
    try {
      const { error } = await supabase.from('enterprise_leads').update({ notes }).eq('id', id);
      if (error) throw error;
      toast.success('Note sauvegardée.');
      setLeads(prev => prev.map(l => l.id === id ? { ...l, notes } : l));
    } catch (e: any) { toast.error(e.message); }
  }

  // ── Guards ────────────────────────────────────────────────────────────────
  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0A] gap-4 text-center">
        <div className="w-14 h-14 bg-red-900/30 rounded-2xl flex items-center justify-center">
          <AlertTriangle size={24} className="text-red-400" />
        </div>
        <p className="text-[16px] font-bold text-white">Accès refusé</p>
        <p className="text-[13px] text-[#6B7280]">Vous n'êtes pas administrateur.</p>
        <button onClick={handleLogout} className="text-[13px] text-[#6B7280] hover:text-white underline mt-2">
          Se déconnecter
        </button>
      </div>
    );
  }

  const TABS = [
    { id: 'overview',  label: 'Vue globale',  icon: TrendingUp },
    { id: 'users',     label: 'Utilisateurs', icon: Users },
    { id: 'leads',     label: 'Leads',        icon: MessageSquare },
    { id: 'activity',  label: 'Activité',     icon: Activity },
    { id: 'keys',      label: 'Clés',         icon: Key },
    { id: 'settings',  label: 'Paramètres',   icon: Settings },
  ] as const;

  const kpis = [
    { label: 'Entreprises',     value: stats.totalCompanies,                                          icon: Building2,   color: 'text-blue-600',    bg: 'bg-blue-50' },
    { label: 'Factures émises', value: stats.totalInvoices,                                           icon: ReceiptText, color: 'text-purple-600',  bg: 'bg-purple-50' },
    { label: 'Clients totaux',  value: stats.totalClients,                                            icon: Users,       color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'CA plateforme',   value: stats.totalRevenue.toLocaleString('fr-FR') + ' FCFA', raw: true, icon: CreditCard, color: 'text-amber-600',   bg: 'bg-amber-50' },
    { label: 'MRR estimé',      value: stats.mrr.toLocaleString('fr-FR') + ' FCFA/mois',   raw: true, icon: TrendingUp,  color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  ];

  const filteredCompanies = companies.filter(co =>
    !userSearch ||
    co.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    co.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    co.ncc?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const sidebarWidth = collapsed ? '52px' : '240px';

  return (
    <div className="bg-[#F8F9FA] flex overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        style={{ width: sidebarWidth }}
        className={`fixed left-0 top-0 h-screen bg-white border-r border-[#E5E7EB] flex flex-col transition-all duration-200 ease-in-out z-50 overflow-hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-3 shrink-0">
          {collapsed ? (
            <span className="font-black text-base mx-auto text-[#111827]">F</span>
          ) : (
            <div className="flex items-center gap-2 px-1">
              <span className="font-black text-lg tracking-tighter text-[#111827]">FACTURA</span>
              <span className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-widest border border-[#E5E7EB] px-1.5 py-0.5 rounded-full">Admin</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 flex flex-col gap-0.5">
          {TABS.map(t => (
            <div
              key={t.id}
              onClick={() => { setTab(t.id); setSidebarOpen(false); }}
              className={`flex items-center rounded-lg h-9 cursor-pointer transition-all duration-200 group relative
                ${tab === t.id
                  ? 'bg-[#F3F4F6] text-[#111827] font-semibold'
                  : 'text-[#6B7280] font-medium hover:bg-[#F3F4F6] hover:text-[#111827]'}
                ${collapsed ? 'w-9 justify-center mx-auto' : 'px-2 gap-2.5'}
              `}
            >
              <t.icon size={16} className="flex-shrink-0" />
              {!collapsed && <span className="text-[13px]">{t.label}</span>}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-[#111827] text-white text-[12px] font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none hidden lg:block">
                  {t.label}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-2 pb-3 flex flex-col gap-0.5 shrink-0">
          <button
            onClick={handleLogout}
            className={`flex items-center rounded-lg h-9 cursor-pointer transition-all duration-200 group relative text-[#EF4444] font-medium hover:bg-red-50 hover:text-[#DC2626] ${collapsed ? 'w-9 justify-center mx-auto' : 'px-2 gap-2.5 w-full justify-start'}`}
          >
            <LogOut size={16} className="flex-shrink-0" />
            {!collapsed && <span className="text-[13px]">Déconnexion</span>}
            {collapsed && (
              <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-[#111827] text-white text-[12px] font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none hidden lg:block">
                Déconnexion
              </div>
            )}
          </button>

          <div className="border-t border-[#F3F4F6] my-1" />

          {/* User */}
          <div className={`flex items-center h-9 ${collapsed ? 'justify-center w-full' : 'gap-2 px-1'}`}>
            <div className="w-7 h-7 rounded-full bg-[#111827] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              FA
            </div>
            {!collapsed && (
              <div className="overflow-hidden flex flex-col justify-center">
                <p className="text-[13px] leading-tight font-medium text-[#111827] truncate">FACTURA</p>
                <p className="text-[11px] leading-tight mt-0.5 text-[#9CA3AF] truncate">{user?.email}</p>
              </div>
            )}
          </div>

          {/* Collapse button */}
          <button
            onClick={() => {
              const next = !collapsed;
              setCollapsed(next);
              localStorage.setItem('sidebar-collapsed', next.toString());
            }}
            className={`hidden lg:flex items-center h-9 mt-1 rounded-lg text-[#9CA3AF] hover:text-[#111827] hover:bg-[#F3F4F6] transition-all ${collapsed ? 'w-9 justify-center mx-auto' : 'px-2 gap-2 w-full'}`}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!collapsed && <span className="text-[13px] font-medium">Réduire</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main
        style={{ marginLeft: sidebarWidth }}
        className="min-h-screen transition-all duration-200 ease-in-out bg-[#F8F9FA] w-full max-lg:!ml-0"
      >
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-[#E5E7EB] h-14 flex items-center justify-between px-4 shrink-0 fixed top-0 w-full z-30">
          <span className="text-lg font-black tracking-tighter text-[#111827]">FACTURA <span className="text-[11px] font-bold text-[#9CA3AF]">Admin</span></span>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="text-[#111827]">
            <Menu size={16} />
          </Button>
        </header>

        <div className="lg:pt-0 pt-14 h-screen overflow-y-auto">
          <div className="p-4 lg:p-8 max-w-[1400px] mx-auto space-y-6">

          {/* ── VUE GLOBALE ── */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {kpis.map((k, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-[#F3F4F6] p-5 shadow-sm">
                    <div className={`w-10 h-10 ${k.bg} ${k.color} rounded-xl flex items-center justify-center mb-3`}>
                      <k.icon size={18} />
                    </div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-1">{k.label}</p>
                    <p className={`font-black text-[#0A0A0A] leading-tight ${(k as any).raw ? 'text-[14px]' : 'text-[28px]'}`}>
                      {loadingStats
                        ? <span className="inline-block w-12 h-5 bg-[#F3F4F6] rounded animate-pulse" />
                        : k.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Plan breakdown */}
              <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm p-6">
                <h2 className="text-[14px] font-bold text-[#0A0A0A] mb-6">Répartition par plan</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(stats.planBreakdown).map(([plan, count]) => (
                    <div key={plan} className="p-5 bg-[#F9FAFB] rounded-xl">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${PLAN_COLORS[plan]}`}>
                        {PLAN_LABEL[plan as keyof typeof PLAN_LABEL] || plan}
                      </span>
                      <p className="text-[36px] font-black text-[#0A0A0A] mt-3 leading-none">{count}</p>
                      <p className="text-[11px] text-[#9CA3AF] mt-1.5">
                        {PLAN_PRICES[plan] > 0
                          ? `${(PLAN_PRICES[plan] * count).toLocaleString('fr-FR')} FCFA/mois`
                          : 'Gratuit'}
                      </p>
                      {/* Mini progress bar */}
                      <div className="mt-3 h-1 bg-[#E5E7EB] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#111827] rounded-full transition-all"
                          style={{ width: stats.totalCompanies > 0 ? `${(count / stats.totalCompanies) * 100}%` : '0%' }}
                        />
                      </div>
                      <p className="text-[10px] text-[#9CA3AF] mt-1">
                        {stats.totalCompanies > 0 ? Math.round((count / stats.totalCompanies) * 100) : 0}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── UTILISATEURS ── */}
          {tab === 'users' && (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative w-full max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="text"
                  placeholder="Rechercher une entreprise..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 text-[13px] border border-[#E5E7EB] rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#111827]"
                />
              </div>

              <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-[#F3F4F6]">
                  <h2 className="text-[14px] font-bold text-[#0A0A0A]">
                    {filteredCompanies.length} / {companies.length} entreprises
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
                      <tr>
                        {['Entreprise', 'NCC / RCCM', 'Contact', 'Plan', 'Inscription'].map(h => (
                          <th key={h} className="text-left py-3 px-4 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loadingCompanies
                        ? [1, 2, 3, 4, 5].map(i => (
                            <tr key={i}><td colSpan={5} className="py-3 px-4">
                              <div className="h-8 bg-[#F9FAFB] rounded animate-pulse" />
                            </td></tr>
                          ))
                        : filteredCompanies.length === 0
                        ? <tr><td colSpan={5} className="py-16 text-center text-[#9CA3AF] text-[13px]">Aucun résultat</td></tr>
                        : filteredCompanies.map(co => {
                            const subs = Array.isArray(co.subscriptions) ? co.subscriptions : [];
                            const activeSub = subs.find((s: any) => s.status === 'active') || subs[0];
                            const plan = activeSub?.plan || 'starter';
                            return (
                              <tr key={co.id} className="border-b border-[#F9FAFB] hover:bg-[#F9FAFB] transition-colors">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-[#111827] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                      {co.name?.substring(0, 2).toUpperCase() || 'FA'}
                                    </div>
                                    <div>
                                      <p className="font-semibold text-[#0A0A0A]">{co.name}</p>
                                      <p className="text-[11px] text-[#9CA3AF]">{co.email || '—'}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-[#6B7280]">
                                  <p>{co.ncc || '—'}</p>
                                  <p className="text-[11px] text-[#9CA3AF]">{co.registration_number || '—'}</p>
                                </td>
                                <td className="py-3 px-4 text-[#6B7280]">
                                  <p>{co.phone || '—'}</p>
                                  <p className="text-[11px] text-[#9CA3AF]">{co.address || '—'}</p>
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${PLAN_COLORS[plan] || 'bg-gray-100 text-gray-600'}`}>
                                    {PLAN_LABEL[plan as keyof typeof PLAN_LABEL] || plan}
                                  </span>
                                  {activeSub?.current_period_end && (
                                    <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                                      exp. {new Date(activeSub.current_period_end).toLocaleDateString('fr-FR')}
                                    </p>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-[#9CA3AF] text-[12px] whitespace-nowrap">
                                  {new Date(co.created_at).toLocaleDateString('fr-FR')}
                                </td>
                              </tr>
                            );
                          })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── LEADS ── */}
          {tab === 'leads' && (
            <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm overflow-hidden">
              <div className="p-5 border-b border-[#F3F4F6]">
                <h2 className="text-[14px] font-bold text-[#0A0A0A]">{leads.length} demandes Enterprise</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
                    <tr>
                      {['Contact', 'Entreprise', 'Taille', 'Message', 'Note interne', 'Statut', 'Date', 'Action'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loadingLeads
                      ? [1, 2].map(i => (
                          <tr key={i}><td colSpan={8} className="py-3 px-4">
                            <div className="h-8 bg-[#F9FAFB] rounded animate-pulse" />
                          </td></tr>
                        ))
                      : leads.length === 0
                      ? <tr><td colSpan={8} className="py-16 text-center text-[#9CA3AF] text-[13px]">Aucun lead pour le moment</td></tr>
                      : leads.map(lead => {
                          const statusInfo = LEAD_STATUS.find(s => s.value === lead.status) || LEAD_STATUS[0];
                          return (
                            <tr key={lead.id} className="border-b border-[#F9FAFB] hover:bg-[#F9FAFB] transition-colors align-top">
                              <td className="py-3 px-4">
                                <p className="font-semibold text-[#0A0A0A]">{lead.full_name}</p>
                                <p className="text-[11px] text-[#9CA3AF]">{lead.email}</p>
                                <p className="text-[11px] text-[#9CA3AF]">{lead.phone}</p>
                              </td>
                              <td className="py-3 px-4 text-[#6B7280] whitespace-nowrap">{lead.company_name}</td>
                              <td className="py-3 px-4 text-[#9CA3AF] text-[12px] whitespace-nowrap">{lead.company_size}</td>
                              <td className="py-3 px-4 text-[#6B7280] max-w-[180px]">
                                <p className="text-[12px] line-clamp-2">{lead.message || '—'}</p>
                              </td>
                              <td className="py-3 px-4 max-w-[180px]">
                                <textarea
                                  defaultValue={lead.notes || ''}
                                  rows={2}
                                  placeholder="Ajouter une note..."
                                  className="w-full text-[11px] border border-[#E5E7EB] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#111827] resize-none bg-white min-w-[140px]"
                                  onBlur={e => { if (e.target.value !== (lead.notes || '')) updateLeadNotes(lead.id, e.target.value); }}
                                />
                              </td>
                              <td className="py-3 px-4">
                                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${statusInfo.color}`}>
                                  {statusInfo.label}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-[#9CA3AF] text-[12px] whitespace-nowrap">
                                {lead.created_at ? new Date(lead.created_at).toLocaleDateString('fr-FR') : '—'}
                              </td>
                              <td className="py-3 px-4">
                                <CustomSelect
                                  size="sm"
                                  value={lead.status || 'new'}
                                  onChange={v => updateLeadStatus(lead.id, v)}
                                  options={LEAD_STATUS.map(s => ({
                                    value: s.value,
                                    label: s.label,
                                    badge: { label: s.label, color: s.color },
                                  }))}
                                />
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── ACTIVITÉ ── */}
          {tab === 'activity' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm overflow-hidden">
                <div className="p-5 border-b border-[#F3F4F6]">
                  <h2 className="text-[14px] font-bold text-[#0A0A0A]">Dernières factures</h2>
                </div>
                <div className="divide-y divide-[#F9FAFB]">
                  {loadingActivity
                    ? [1, 2, 3, 4].map(i => <div key={i} className="p-4"><div className="h-10 bg-[#F9FAFB] rounded animate-pulse" /></div>)
                    : recentInvoices.length === 0
                    ? <p className="p-8 text-center text-[#9CA3AF] text-[13px]">Aucune facture</p>
                    : recentInvoices.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-[#F9FAFB] transition-colors">
                          <div>
                            <p className="font-semibold text-[#0A0A0A] text-[13px]">{inv.number}</p>
                            <p className="text-[11px] text-[#9CA3AF]">{inv.companies?.name || '—'}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold text-[13px] text-[#0A0A0A]">
                              {Number(inv.total_ttc || 0).toLocaleString('fr-FR')} FCFA
                            </p>
                            <p className="text-[11px] text-[#9CA3AF]">{new Date(inv.created_at).toLocaleDateString('fr-FR')}</p>
                          </div>
                        </div>
                      ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm overflow-hidden">
                <div className="p-5 border-b border-[#F3F4F6]">
                  <h2 className="text-[14px] font-bold text-[#0A0A0A]">Derniers paiements</h2>
                </div>
                <div className="divide-y divide-[#F9FAFB]">
                  {loadingActivity
                    ? [1, 2, 3, 4].map(i => <div key={i} className="p-4"><div className="h-10 bg-[#F9FAFB] rounded animate-pulse" /></div>)
                    : recentPayments.length === 0
                    ? <p className="p-8 text-center text-[#9CA3AF] text-[13px]">Aucun paiement</p>
                    : recentPayments.map(pay => (
                        <div key={pay.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-[#F9FAFB] transition-colors">
                          <div>
                            <p className="font-semibold text-[#0A0A0A] text-[13px]">{pay.invoices?.number || '—'}</p>
                            <p className="text-[11px] text-[#9CA3AF]">
                              {pay.invoices?.companies?.name || '—'} · {(pay.method || '').toUpperCase()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold text-[13px] text-emerald-600">
                              +{Number(pay.amount || 0).toLocaleString('fr-FR')} FCFA
                            </p>
                            <p className="text-[11px] text-[#9CA3AF]">{new Date(pay.payment_date).toLocaleDateString('fr-FR')}</p>
                          </div>
                        </div>
                      ))}
                </div>
              </div>
            </div>
          )}

          {/* ── CLÉS D'ACTIVATION ── */}
          {tab === 'keys' && (
            <div className="space-y-6">
              {/* Kill switch */}
              <div className={`rounded-2xl border p-5 flex items-center justify-between ${activationEnforced ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                <div>
                  <p className={`text-[13px] font-bold ${activationEnforced ? 'text-red-700' : 'text-amber-700'}`}>
                    {activationEnforced ? 'Activation OBLIGATOIRE (kill switch ON)' : 'Activation désactivée (kill switch OFF)'}
                  </p>
                  <p className={`text-[12px] mt-0.5 ${activationEnforced ? 'text-red-600' : 'text-amber-600'}`}>
                    {activationEnforced
                      ? 'Les utilisateurs sans abonnement valide voient la page d\'activation.'
                      : 'Les utilisateurs ont accès libre. Active ce switch pour bloquer.'}
                  </p>
                </div>
                <button
                  onClick={toggleEnforced}
                  className={`h-10 px-4 rounded-xl text-[13px] font-semibold transition-colors ${activationEnforced ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-[#111827] text-white hover:bg-[#1F2937]'}`}
                >
                  {activationEnforced ? 'Désactiver le blocage' : 'Activer le blocage'}
                </button>
              </div>

              {/* Generator */}
              <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm overflow-hidden">
                <div className="p-5 border-b border-[#F3F4F6]">
                  <h2 className="text-[14px] font-bold text-[#0A0A0A]">Générer une nouvelle clé</h2>
                  <p className="text-[12px] text-[#9CA3AF] mt-0.5">Choisis le plan + la durée. La clé est unique et utilisable une seule fois.</p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-[#374151] uppercase tracking-widest">Plan</label>
                      <CustomSelect
                        size="sm"
                        value={keyForm.plan}
                        onChange={v => setKeyForm(f => ({ ...f, plan: v }))}
                        options={[
                          { value: 'starter',    label: 'Starter (gratuit)' },
                          { value: 'pro',        label: 'Pro' },
                          { value: 'business',   label: 'Business' },
                          { value: 'enterprise', label: 'Enterprise' },
                        ]}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#374151] uppercase tracking-widest">Durée</label>
                      <CustomSelect
                        size="sm"
                        value={String(keyForm.duration_minutes)}
                        onChange={v => setKeyForm(f => ({ ...f, duration_minutes: parseInt(v) || 43200 }))}
                        options={[
                          { value: '5',      label: '5 minutes (test)' },
                          { value: '30',     label: '30 minutes (test)' },
                          { value: '60',     label: '1 heure' },
                          { value: '1440',   label: '1 jour' },
                          { value: '10080',  label: '7 jours' },
                          { value: '43200',  label: '30 jours (1 mois)' },
                          { value: '129600', label: '90 jours (3 mois)' },
                          { value: '259200', label: '180 jours (6 mois)' },
                          { value: '525600', label: '365 jours (1 an)' },
                        ]}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#374151] uppercase tracking-widest">Note (optionnel)</label>
                      <input
                        type="text"
                        value={keyForm.notes}
                        onChange={e => setKeyForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Ex: client Boutique Aïcha"
                        className="w-full h-9 mt-1.5 px-3 text-[13px] border border-[#E5E7EB] rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#111827]"
                      />
                    </div>
                  </div>
                  <button
                    onClick={generateKey}
                    disabled={generatingKey}
                    className="flex items-center gap-2 h-10 px-5 bg-[#111827] text-white text-[13px] font-semibold rounded-xl hover:bg-[#1F2937] disabled:opacity-50 transition-all"
                  >
                    {generatingKey
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Plus size={14} />}
                    Générer la clé
                  </button>

                  {justGenerated && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Clé générée — {justGenerated.plan} · {formatDuration(justGenerated.duration_minutes)}</p>
                        <p className="text-[18px] font-mono font-bold text-emerald-800 mt-1 tracking-wider break-all">{justGenerated.code}</p>
                      </div>
                      <button onClick={() => copyCode(justGenerated.code)}
                        className="shrink-0 h-9 px-4 bg-white border border-emerald-300 rounded-lg text-[12px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors">
                        Copier
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Keys list */}
              <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm overflow-hidden">
                <div className="p-5 border-b border-[#F3F4F6]">
                  <h2 className="text-[14px] font-bold text-[#0A0A0A]">{keys.length} clé{keys.length > 1 ? 's' : ''} générée{keys.length > 1 ? 's' : ''}</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
                      <tr>
                        {['Code', 'Plan', 'Durée', 'Statut', 'Utilisée par', 'Note', 'Action'].map(h => (
                          <th key={h} className="text-left py-3 px-4 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loadingKeys
                        ? [1,2,3].map(i => (
                            <tr key={i}><td colSpan={7} className="py-3 px-4">
                              <div className="h-8 bg-[#F9FAFB] rounded animate-pulse" />
                            </td></tr>
                          ))
                        : keys.length === 0
                        ? <tr><td colSpan={7} className="py-16 text-center text-[#9CA3AF] text-[13px]">Aucune clé générée pour le moment.</td></tr>
                        : keys.map((k: any) => {
                            const used    = !!k.used_at;
                            const revoked = !!k.revoked_at;
                            const statusLabel = revoked ? 'Révoquée' : used ? 'Utilisée' : 'Disponible';
                            const statusColor = revoked ? 'bg-red-100 text-red-700'
                                              : used    ? 'bg-gray-200 text-gray-600'
                                                        : 'bg-emerald-100 text-emerald-700';
                            return (
                              <tr key={k.id} className="border-b border-[#F9FAFB] hover:bg-[#F9FAFB] transition-colors">
                                <td className="py-3 px-4 font-mono text-[12px] font-bold text-[#0A0A0A]">{k.code}</td>
                                <td className="py-3 px-4">
                                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${PLAN_COLORS[k.plan] || 'bg-gray-100 text-gray-600'}`}>
                                    {PLAN_LABEL[k.plan as keyof typeof PLAN_LABEL] || k.plan}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-[#6B7280] whitespace-nowrap">{formatDuration(k.duration_minutes || (k.duration_days * 1440))}</td>
                                <td className="py-3 px-4">
                                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusColor}`}>{statusLabel}</span>
                                </td>
                                <td className="py-3 px-4 text-[#6B7280]">{k.used_company?.name || (used ? '—' : '')}</td>
                                <td className="py-3 px-4 text-[#9CA3AF] text-[12px] max-w-[200px] truncate">{k.notes || '—'}</td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  {!used && !revoked && (
                                    <div className="flex gap-1.5">
                                      <button onClick={() => copyCode(k.code)}
                                        className="h-8 px-3 text-[12px] font-medium border border-[#E5E7EB] rounded-lg hover:border-[#111827] hover:bg-white transition-colors text-[#374151]">
                                        Copier
                                      </button>
                                      <button onClick={() => revokeKey(k.id)}
                                        className="h-8 px-3 text-[12px] font-medium border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                                        Révoquer
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── PARAMÈTRES ── */}
          {tab === 'settings' && (
            <div className="space-y-6">

              {/* Configuration IA */}
              {(() => {
                const PROVIDERS = [
                  { id: 'deepseek',  label: 'DeepSeek',  hint: 'api.deepseek.com' },
                  { id: 'openai',    label: 'OpenAI',    hint: 'api.openai.com' },
                  { id: 'anthropic', label: 'Anthropic', hint: 'api.anthropic.com' },
                ];
                const DEFAULTS: Record<string, { pro: string; biz: string; ent: string }> = {
                  deepseek:  { pro: 'deepseek-chat',           biz: 'deepseek-chat',      ent: 'deepseek-reasoner' },
                  openai:    { pro: 'gpt-4o-mini',             biz: 'gpt-4o',             ent: 'gpt-4-turbo' },
                  anthropic: { pro: 'claude-haiku-4-5-20251001', biz: 'claude-sonnet-4-6', ent: 'claude-opus-4-7' },
                };
                const MODEL_OPTIONS: Record<string, { value: string; label: string }[]> = {
                  deepseek:  [{ value: 'deepseek-chat', label: 'DeepSeek Chat (rapide)' }, { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (avancé)' }],
                  openai:    [{ value: 'gpt-4o-mini', label: 'GPT-4o Mini (économique)' }, { value: 'gpt-4o', label: 'GPT-4o (performant)' }, { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' }],
                  anthropic: [{ value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku (rapide)' }, { value: 'claude-sonnet-4-6', label: 'Claude Sonnet (équilibré)' }, { value: 'claude-opus-4-7', label: 'Claude Opus (puissant)' }],
                };
                const models = MODEL_OPTIONS[aiConfig.provider] || MODEL_OPTIONS.deepseek;
                const planModels: { key: keyof typeof aiConfig; badge: string; color: string }[] = [
                  { key: 'model_pro',        badge: 'Pro',        color: 'bg-blue-100 text-blue-700' },
                  { key: 'model_business',   badge: 'Business',   color: 'bg-purple-100 text-purple-700' },
                  { key: 'model_enterprise', badge: 'Enterprise', color: 'bg-amber-100 text-amber-700' },
                ];
                return (
                  <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-[#F3F4F6]">
                      <h2 className="text-[14px] font-bold text-[#0A0A0A]">Configuration de l'assistant IA</h2>
                      <p className="text-[12px] text-[#9CA3AF] mt-0.5">Fournisseur, clé API et modèle par plan tarifaire.</p>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Provider */}
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-[#374151] uppercase tracking-wider">Fournisseur IA</p>
                        <div className="flex gap-2 flex-wrap">
                          {PROVIDERS.map(p => (
                            <button key={p.id} onClick={() => {
                              const d = DEFAULTS[p.id];
                              setAiConfig(c => ({ ...c, provider: p.id, model_pro: d.pro, model_business: d.biz, model_enterprise: d.ent }));
                            }}
                              className={`px-4 py-2 rounded-xl border text-[13px] font-medium transition-all ${aiConfig.provider === p.id ? 'bg-[#111827] text-white border-[#111827]' : 'border-[#E5E7EB] text-[#6B7280] hover:border-[#111827] hover:text-[#111827]'}`}>
                              {p.label}
                              <span className={`ml-2 text-[10px] ${aiConfig.provider === p.id ? 'text-white/60' : 'text-[#9CA3AF]'}`}>{p.hint}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* API Key */}
                      <div className="space-y-3">
                        <p className="text-[11px] font-bold text-[#374151] uppercase tracking-wider flex items-center gap-2">
                          <Key size={12} />Clé API
                        </p>

                        {/* Key name */}
                        <div className="flex items-center gap-3">
                          <span className="text-[12px] text-[#6B7280] w-12 shrink-0">Nom</span>
                          <input
                            value={aiConfig.api_key_name}
                            onChange={e => setAiConfig(c => ({ ...c, api_key_name: e.target.value }))}
                            placeholder="Ex: Clé DeepSeek Production"
                            className="flex-1 h-9 px-3 text-[13px] border border-[#E5E7EB] rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#111827]"
                          />
                        </div>

                        {/* Masked display vs input */}
                        {aiConfig.api_key_set && !editingKey ? (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start gap-3">
                            <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[13px] font-semibold text-emerald-800">{aiConfig.api_key_name}</span>
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold tracking-wide">CONFIGURÉE</span>
                              </div>
                              <p className="text-[13px] font-mono text-emerald-600 mt-1 tracking-widest">
                                ••••••••••••••••••••••<span className="font-bold">{aiConfig.api_key_suffix}</span>
                              </p>
                              {aiConfig.key_updated_at && (
                                <p className="text-[11px] text-emerald-500 mt-1.5">
                                  Sauvegardée le {new Date(aiConfig.key_updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à {new Date(aiConfig.key_updated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              {confirmDeleteKey ? (
                                <>
                                  <button onClick={() => setConfirmDeleteKey(false)}
                                    className="h-8 px-3 text-[12px] font-medium border border-[#E5E7EB] rounded-lg hover:bg-white transition-colors text-[#6B7280]">
                                    Annuler
                                  </button>
                                  <button onClick={deleteApiKey}
                                    className="h-8 px-3 text-[12px] font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                                    Confirmer
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => setEditingKey(true)}
                                    className="h-8 px-3 text-[12px] font-medium border border-[#E5E7EB] bg-white rounded-lg hover:border-[#111827] transition-colors text-[#374151]">
                                    Modifier
                                  </button>
                                  <button onClick={() => setConfirmDeleteKey(true)}
                                    className="h-8 px-3 text-[12px] font-medium border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                                    Supprimer
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex gap-2">
                              <input
                                type="password"
                                value={aiConfig.api_key}
                                onChange={e => setAiConfig(c => ({ ...c, api_key: e.target.value }))}
                                placeholder="sk-... (nouvelle clé)"
                                autoFocus
                                className="flex-1 h-11 px-4 text-[13px] border border-[#E5E7EB] rounded-xl bg-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:bg-white font-mono"
                              />
                              {aiConfig.api_key_set && editingKey && (
                                <button onClick={() => { setEditingKey(false); setAiConfig(c => ({ ...c, api_key: '' })); }}
                                  className="h-11 px-4 text-[13px] border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors text-[#374151]">
                                  Annuler
                                </button>
                              )}
                            </div>
                            <p className="text-[11px] text-[#9CA3AF]">Les 4 derniers caractères seront affichés pour vérification. Clé stockée de façon sécurisée côté serveur.</p>
                          </div>
                        )}
                      </div>

                      {/* Model per plan */}
                      <div className="space-y-3">
                        <p className="text-[11px] font-bold text-[#374151] uppercase tracking-wider">Modèle par plan</p>
                        <div className="space-y-2">
                          {planModels.map(pm => (
                            <div key={pm.key} className="flex items-center gap-3">
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full w-24 text-center shrink-0 ${pm.color}`}>{pm.badge}</span>
                              <CustomSelect
                                size="sm"
                                value={aiConfig[pm.key] as string}
                                onChange={v => setAiConfig(c => ({ ...c, [pm.key]: v }))}
                                options={models}
                                className="flex-1"
                              />
                            </div>
                          ))}
                          <p className="text-[11px] text-[#9CA3AF] pt-1">Plan Starter : accès IA désactivé.</p>
                        </div>
                      </div>

                      {/* Test result panel */}
                      {testResult && (
                        <div className={`rounded-xl border p-4 ${testResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            {testResult.success
                              ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                              : <XCircle size={15} className="text-red-500 shrink-0" />}
                            <span className={`text-[13px] font-bold ${testResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
                              {testResult.success ? 'Connexion réussie' : 'Connexion échouée'}
                            </span>
                            <span className="text-[11px] text-[#9CA3AF] ml-auto">{testResult.timestamp}</span>
                          </div>
                          {testResult.success ? (
                            <div className="flex flex-wrap gap-4 text-[12px] text-emerald-700">
                              <span className="font-mono">⏱ {testResult.latency}ms</span>
                              {testResult.model && <span>🤖 {testResult.model}</span>}
                              {testResult.tokens > 0 && <span>🪙 {testResult.tokens.toLocaleString('fr-FR')} tokens</span>}
                            </div>
                          ) : (
                            <p className="text-[12px] text-red-600 font-mono">{testResult.response}</p>
                          )}
                        </div>
                      )}

                      {/* Usage stats */}
                      {(aiConfig.tokens_total > 0 || aiConfig.calls_total > 0) && (
                        <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Zap size={13} className="text-[#6B7280]" />
                            <p className="text-[11px] font-bold text-[#374151] uppercase tracking-wider">Statistiques d'utilisation</p>
                          </div>
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <p className="text-[24px] font-bold text-[#0A0A0A] leading-none">{aiConfig.tokens_total.toLocaleString('fr-FR')}</p>
                              <p className="text-[12px] text-[#9CA3AF] mt-1">Tokens consommés</p>
                            </div>
                            <div>
                              <p className="text-[24px] font-bold text-[#0A0A0A] leading-none">{aiConfig.calls_total.toLocaleString('fr-FR')}</p>
                              <p className="text-[12px] text-[#9CA3AF] mt-1">Appels IA</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <button onClick={saveAiConfig} disabled={savingAi}
                          className="flex items-center gap-2 h-10 px-5 bg-[#111827] text-white text-[13px] font-semibold rounded-xl hover:bg-[#1F2937] disabled:opacity-50 transition-all">
                          {savingAi ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Shield size={14} />}
                          Sauvegarder
                        </button>
                        <button onClick={testAiConfig} disabled={testingAi || !aiConfig.api_key_set}
                          className="flex items-center gap-2 h-10 px-5 border border-[#E5E7EB] text-[13px] font-semibold rounded-xl hover:bg-[#F9FAFB] disabled:opacity-40 transition-all text-[#374151]">
                          {testingAi
                            ? <span className="w-4 h-4 border-2 border-[#111827]/20 border-t-[#111827] rounded-full animate-spin" />
                            : <Zap size={14} />}
                          Tester la connexion
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Gestion des admins */}
              <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm overflow-hidden">
                <div className="p-5 border-b border-[#F3F4F6]">
                  <h2 className="text-[14px] font-bold text-[#0A0A0A]">Administrateurs de la plateforme</h2>
                  <p className="text-[12px] text-[#9CA3AF] mt-0.5">Les admins ont accès à ce dashboard et aux données de toutes les entreprises.</p>
                </div>

                {/* Add admin */}
                <div className="p-5 border-b border-[#F3F4F6] bg-[#F9FAFB]">
                  <p className="text-[12px] font-semibold text-[#374151] mb-2">Ajouter un admin</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Email d'entreprise ou UUID utilisateur"
                      value={newAdminInput}
                      onChange={e => setNewAdminInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addAdmin()}
                      className="flex-1 h-10 px-3 text-[13px] border border-[#E5E7EB] rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#111827]"
                    />
                    <button
                      onClick={addAdmin}
                      disabled={addingAdmin || !newAdminInput.trim()}
                      className="flex items-center gap-1.5 h-10 px-4 bg-[#111827] text-white text-[13px] font-semibold rounded-xl hover:bg-[#1F2937] disabled:opacity-50 transition-all"
                    >
                      {addingAdmin
                        ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <Plus size={14} />}
                      Ajouter
                    </button>
                  </div>
                  <p className="text-[11px] text-[#9CA3AF] mt-2">
                    Si l'email ne fonctionne pas, utilisez l'UUID visible dans Supabase → Authentication → Users.
                  </p>
                </div>

                {/* Admin list */}
                <div className="divide-y divide-[#F9FAFB]">
                  {loadingAdmins
                    ? [1, 2].map(i => <div key={i} className="p-4"><div className="h-10 bg-[#F9FAFB] rounded animate-pulse" /></div>)
                    : admins.length === 0
                    ? <p className="p-8 text-center text-[#9CA3AF] text-[13px]">Aucun admin trouvé</p>
                    : admins.map(a => (
                        <div key={a.user_id} className="flex items-center justify-between px-5 py-3.5 hover:bg-[#F9FAFB] transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#111827] text-white flex items-center justify-center flex-shrink-0">
                              <Shield size={14} />
                            </div>
                            <div>
                              <p className="font-semibold text-[#0A0A0A] text-[13px]">
                                {a.company?.name || 'FACTURA'}
                                {a.user_id === user?.id && (
                                  <span className="ml-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Vous</span>
                                )}
                              </p>
                              <p className="text-[11px] text-[#9CA3AF] font-mono">{a.user_id}</p>
                            </div>
                          </div>
                          {a.user_id !== user?.id && (
                            <button
                              onClick={() => removeAdmin(a.user_id)}
                              className="flex items-center gap-1.5 text-[12px] text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Trash2 size={13} />
                              Retirer
                            </button>
                          )}
                        </div>
                      ))}
                </div>
              </div>

              {/* Info plateforme */}
              <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm p-6">
                <h2 className="text-[14px] font-bold text-[#0A0A0A] mb-5">Informations plateforme</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Entreprises actives',    value: stats.totalCompanies },
                    { label: 'Factures générées',      value: stats.totalInvoices },
                    { label: 'Administrateurs',         value: admins.length },
                  ].map((item, i) => (
                    <div key={i} className="bg-[#F9FAFB] rounded-xl p-4">
                      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">{item.label}</p>
                      <p className="text-[28px] font-black text-[#0A0A0A] mt-1">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Danger zone */}
              <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
                <h2 className="text-[14px] font-bold text-red-600 mb-1">Zone critique</h2>
                <p className="text-[12px] text-[#9CA3AF] mb-4">Actions irréversibles sur votre session admin.</p>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 text-[13px] font-semibold rounded-xl hover:bg-red-100 transition-colors"
                >
                  <LogOut size={14} />
                  Se déconnecter du mode admin
                </button>
              </div>
            </div>
          )}

          </div>
        </div>
      </main>
    </div>
  );
}
