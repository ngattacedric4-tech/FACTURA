import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, User, Bell, Shield, Save, CheckCircle2, Upload, Zap, Plus, Trash2, RefreshCw, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePlan } from '@/hooks/usePlan';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { CustomSelect } from '@/components/ui/CustomSelect';

interface SettingsPageProps { onNavigate: (page: string) => void; }

const NOTIF_KEY = 'factura_notif_prefs';
const DEFAULT_NOTIFS: Record<string, boolean> = {
  invoice_paid: true,
  invoice_overdue: true,
  estimate_expired: true,
  monthly_report: true,
};
const NOTIF_ITEMS = [
  { key: 'invoice_paid',     label: 'Facture payée',     desc: 'Notifier quand un client marque sa facture comme payée' },
  { key: 'invoice_overdue',  label: 'Facture en retard', desc: 'Rappel automatique quand une facture dépasse son échéance' },
  { key: 'estimate_expired', label: 'Devis expiré',      desc: "Alerte quand un devis n'a pas reçu de réponse après 30 jours" },
  { key: 'monthly_report',   label: 'Rapport mensuel',   desc: "Résumé automatique de votre activité chaque 1er du mois" },
];

export function SettingsPage({ onNavigate }: SettingsPageProps) {
  const { company, user, refreshCompany } = useAuth();
  const { plan } = usePlan();
  const [tab, setTab] = useState<'company'|'account'|'notifications'|'automation'>('company');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [form, setForm] = useState({
    name: '', address: '', phone: '', email: '', website: '', ncc: '', registration_number: ''
  });
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(NOTIF_KEY);
      return saved ? { ...DEFAULT_NOTIFS, ...JSON.parse(saved) } : DEFAULT_NOTIFS;
    } catch {
      return DEFAULT_NOTIFS;
    }
  });
  const [savingNotifs, setSavingNotifs] = useState(false);

  // Automation
  const [autoSettings, setAutoSettings] = useState({
    reminders_enabled: false,
    reminder_days_after_due: 7,
    reminder_message: '',
  });
  const [savingAuto, setSavingAuto] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTpl, setNewTpl] = useState({
    name: '', client_id: '', frequency: 'monthly', next_date: '',
    description: '', unit_price: 0, quantity: 1,
  });

  useEffect(() => {
    if (tab === 'automation' && company) {
      fetchAutoSettings();
      fetchTemplates();
      fetchClients();
    }
  }, [tab, company?.id]);

  async function fetchAutoSettings() {
    if (!company) return;
    const { data } = await supabase.from('automation_settings').select('*').eq('company_id', company.id).maybeSingle();
    if (data) setAutoSettings({ reminders_enabled: data.reminders_enabled, reminder_days_after_due: data.reminder_days_after_due, reminder_message: data.reminder_message || '' });
  }

  async function saveAutoSettings() {
    if (!company) return;
    setSavingAuto(true);
    try {
      const { error } = await supabase.from('automation_settings').upsert(
        { company_id: company.id, ...autoSettings, updated_at: new Date().toISOString() },
        { onConflict: 'company_id' }
      );
      if (error) throw error;
      toast.success('Paramètres d\'automatisation sauvegardés !');
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingAuto(false); }
  }

  async function fetchTemplates() {
    if (!company) return;
    const { data } = await supabase.from('recurring_templates').select('*, clients(name)').eq('company_id', company.id).order('created_at', { ascending: false });
    setTemplates(data || []);
  }

  async function fetchClients() {
    if (!company) return;
    const { data } = await supabase.from('clients').select('id, name').eq('company_id', company.id).order('name');
    setClients(data || []);
  }

  async function addTemplate() {
    if (!company || !newTpl.name || !newTpl.next_date) { toast.error('Remplissez le nom et la date.'); return; }
    const items = newTpl.description ? [{ description: newTpl.description, quantity: newTpl.quantity, unit_price: newTpl.unit_price }] : [];
    const clientName = clients.find(c => c.id === newTpl.client_id)?.name || '';
    const { error } = await supabase.from('recurring_templates').insert({
      company_id: company.id,
      client_id: newTpl.client_id || null,
      client_name: clientName,
      name: newTpl.name,
      frequency: newTpl.frequency,
      next_date: newTpl.next_date,
      items,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Modèle ajouté !');
    setShowAddTemplate(false);
    setNewTpl({ name: '', client_id: '', frequency: 'monthly', next_date: '', description: '', unit_price: 0, quantity: 1 });
    fetchTemplates();
  }

  async function deleteTemplate(id: string) {
    const { error } = await supabase.from('recurring_templates').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  async function toggleTemplate(id: string, active: boolean) {
    await supabase.from('recurring_templates').update({ active }).eq('id', id);
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, active } : t));
  }

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name || '',
        address: company.address || '',
        phone: company.phone || '',
        email: company.email || '',
        website: company.website || '',
        ncc: company.ncc || '',
        registration_number: company.registration_number || '',
      });
      setLogoUrl(company.logo_url || '');
    }
  }, [company]);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !company) return;
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${company.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('logos').getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: dbErr } = await supabase.from('companies').update({ logo_url: url }).eq('id', company.id);
      if (dbErr) throw dbErr;
      setLogoUrl(url);
      await refreshCompany();
      toast.success('Logo téléversé !');
    } catch(err:any) { toast.error('Erreur upload : ' + err.message); }
    finally { setUploadingLogo(false); }
  }

  async function saveCompany() {
    if (!company) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('companies').update(form).eq('id', company.id);
      if (error) throw error;
      await refreshCompany();
      toast.success('Profil entreprise mis à jour !');
    } catch(e:any) { toast.error('Erreur : ' + e.message); }
    finally { setSaving(false); }
  }

  function saveNotifPrefs() {
    setSavingNotifs(true);
    try {
      localStorage.setItem(NOTIF_KEY, JSON.stringify(notifPrefs));
      toast.success('Préférences de notifications sauvegardées !');
    } catch {
      toast.error('Impossible de sauvegarder les préférences.');
    } finally {
      setSavingNotifs(false);
    }
  }

  const tabs = [
    { id: 'company',       label: "Entreprise",     icon: Building2 },
    { id: 'account',       label: "Compte",         icon: User },
    { id: 'notifications', label: "Notifications",  icon: Bell },
    { id: 'automation',    label: "Automatisation", icon: Zap },
  ] as const;

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
      <div className="w-10 h-5 bg-[#E5E7EB] rounded-full peer peer-checked:after:translate-x-5 peer-checked:bg-[#111827] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
    </label>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0A0A0A]">Paramètres</h1>
        <p className="text-[14px] text-[#6B7280] mt-0.5">Gérez les informations de votre entreprise et votre compte.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F3F4F6] p-1 rounded-xl w-fit">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${tab===t.id?'bg-white text-[#111827] shadow-sm':'text-[#6B7280] hover:text-[#111827]'}`}>
            <t.icon size={14}/>{t.label}
          </button>
        ))}
      </div>

      {/* Company tab */}
      {tab === 'company' && (
        <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm p-8 space-y-6">
          <div className="flex items-center gap-4 pb-4 border-b border-[#F3F4F6]">
            <div className="w-16 h-16 rounded-xl bg-[#F3F4F6] overflow-hidden flex items-center justify-center font-bold text-lg text-[#111827]">
              {logoUrl ? <img src={logoUrl} alt="logo" className="w-full h-full object-cover"/> : (form.name.substring(0,2).toUpperCase() || 'FA')}
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-[#0A0A0A]">{form.name || 'Mon Entreprise'}</p>
              <p className="text-[12px] text-[#9CA3AF]">Logo affiché sur vos factures (PNG/JPG, max 2 Mo)</p>
            </div>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo}/>
              <span className="inline-flex items-center gap-1.5 px-4 h-9 rounded-xl border border-[#E5E7EB] text-[13px] font-medium hover:bg-[#F9FAFB]">
                <Upload size={14}/> {uploadingLogo ? 'Upload...' : 'Changer le logo'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {key:'name',                label:"Raison sociale *",           placeholder:"Ex: Ivoire Tech SARL"},
              {key:'ncc',                 label:"Numéro Contribuable (NCC)",  placeholder:"Ex: 1234567 A"},
              {key:'registration_number', label:"N° RCCM",                    placeholder:"Ex: CI-ABJ-2024-B-12345"},
              {key:'phone',               label:"Téléphone",                  placeholder:"+225 07 00 00 00"},
              {key:'email',               label:"Email professionnel",        placeholder:"contact@monstartup.ci"},
              {key:'website',             label:"Site web",                   placeholder:"www.monstartup.ci"},
            ].map(f=>(
              <div key={f.key} className="space-y-1.5">
                <Label className="text-[11px] font-bold text-[#374151] uppercase tracking-wider">{f.label}</Label>
                <Input value={(form as any)[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})}
                  placeholder={f.placeholder} className="h-11 rounded-xl border-[#E5E7EB] text-[13px]"/>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold text-[#374151] uppercase tracking-wider">Adresse complète</Label>
            <Input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}
              placeholder="Ex: Abidjan, Cocody, Rue des Jardins" className="h-11 rounded-xl border-[#E5E7EB] text-[13px]"/>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={saveCompany} disabled={saving} className="bg-[#111827] text-white rounded-xl h-10 px-6 text-[13px] font-medium hover:bg-[#1F2937]">
              <Save size={15} className="mr-1.5"/> {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </div>
        </div>
      )}

      {/* Account tab */}
      {tab === 'account' && (
        <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm p-8 space-y-6">
          <div>
            <h2 className="text-[15px] font-semibold text-[#0A0A0A] mb-4">Informations du compte</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-[#F9FAFB] rounded-xl">
                <div className="w-10 h-10 rounded-full bg-[#111827] text-white flex items-center justify-center text-[12px] font-bold">
                  {user?.email?.substring(0,2).toUpperCase()}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#0A0A0A]">{user?.email}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <CheckCircle2 size={11} className="text-emerald-600"/>
                    <p className="text-[11px] text-emerald-600">Email vérifié</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-[13px] font-semibold text-amber-800 mb-1">Changer le mot de passe</p>
                <p className="text-[12px] text-amber-700 mb-3">Un email de réinitialisation sera envoyé à votre adresse.</p>
                <Button variant="outline" className="rounded-xl h-9 px-4 text-[13px] border-amber-200 text-amber-800 hover:bg-amber-100"
                  onClick={async()=>{
                    if (!user?.email) return;
                    await supabase.auth.resetPasswordForEmail(user.email);
                    toast.success('Email de réinitialisation envoyé !');
                  }}>
                  Envoyer le lien de réinitialisation
                </Button>
              </div>
            </div>
          </div>

          <div className="border-t border-[#F3F4F6] pt-6">
            <h2 className="text-[15px] font-semibold text-red-600 mb-2">Zone de danger</h2>
            <p className="text-[13px] text-[#6B7280] mb-4">La suppression du compte est irréversible. Toutes vos données seront effacées.</p>
            <Button variant="outline" className="border-red-200 text-red-600 rounded-xl h-9 px-4 text-[13px] hover:bg-red-50"
              onClick={()=>toast.error('Contactez le support pour supprimer votre compte.')}>
              <Shield size={14} className="mr-1.5"/> Supprimer mon compte
            </Button>
          </div>
        </div>
      )}

      {/* Automation tab */}
      {tab === 'automation' && (
        <div className="space-y-6">
          {/* Relances automatiques */}
          <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-[#F3F4F6]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                    <RefreshCw size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-[#0A0A0A]">Relances automatiques</p>
                    <p className="text-[12px] text-[#9CA3AF]">Envoyer un email de rappel aux clients avec factures impayées</p>
                  </div>
                </div>
                {plan === 'starter'
                  ? <span className="flex items-center gap-1 text-[11px] text-[#9CA3AF] bg-[#F3F4F6] px-2.5 py-1 rounded-full font-medium"><Lock size={11} /> Pro requis</span>
                  : <Toggle checked={autoSettings.reminders_enabled} onChange={v => setAutoSettings(s => ({ ...s, reminders_enabled: v }))} />
                }
              </div>
            </div>
            {plan !== 'starter' && autoSettings.reminders_enabled && (
              <div className="p-6 space-y-4 bg-[#F9FAFB]">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-[#374151] uppercase tracking-wider">Délai après échéance (jours)</Label>
                  <input
                    type="number" min={1} max={90}
                    value={autoSettings.reminder_days_after_due}
                    onChange={e => setAutoSettings(s => ({ ...s, reminder_days_after_due: Number(e.target.value) }))}
                    className="h-11 w-32 rounded-xl border border-[#E5E7EB] px-4 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#111827] bg-white"
                  />
                  <p className="text-[11px] text-[#9CA3AF]">La relance sera envoyée X jours après la date d'échéance.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-[#374151] uppercase tracking-wider">Message personnalisé (optionnel)</Label>
                  <textarea
                    rows={4}
                    value={autoSettings.reminder_message}
                    onChange={e => setAutoSettings(s => ({ ...s, reminder_message: e.target.value }))}
                    placeholder="Laissez vide pour utiliser le message par défaut."
                    className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#111827] bg-white resize-none"
                  />
                </div>
              </div>
            )}
            {plan !== 'starter' && (
              <div className="px-6 py-4 flex justify-end border-t border-[#F3F4F6]">
                <Button onClick={saveAutoSettings} disabled={savingAuto} className="bg-[#111827] text-white rounded-xl h-10 px-5 text-[13px]">
                  <Save size={14} className="mr-1.5" /> {savingAuto ? 'Enregistrement...' : 'Sauvegarder'}
                </Button>
              </div>
            )}
          </div>

          {/* Factures récurrentes */}
          <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-[#F3F4F6]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center">
                    <Zap size={16} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-[#0A0A0A]">Factures récurrentes</p>
                    <p className="text-[12px] text-[#9CA3AF]">Générer automatiquement des factures périodiques</p>
                  </div>
                </div>
                {(plan === 'starter' || plan === 'pro')
                  ? <span className="flex items-center gap-1 text-[11px] text-[#9CA3AF] bg-[#F3F4F6] px-2.5 py-1 rounded-full font-medium"><Lock size={11} /> Business requis</span>
                  : <button onClick={() => setShowAddTemplate(t => !t)}
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-[#111827] bg-[#F3F4F6] hover:bg-[#E5E7EB] px-3 py-1.5 rounded-lg transition-colors">
                      <Plus size={13} /> Ajouter un modèle
                    </button>
                }
              </div>
            </div>

            {(plan === 'business' || plan === 'enterprise') && (
              <>
                {/* Add template form */}
                {showAddTemplate && (
                  <div className="p-6 bg-[#F9FAFB] border-b border-[#F3F4F6] space-y-4">
                    <p className="text-[13px] font-bold text-[#0A0A0A]">Nouveau modèle de facture récurrente</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-[#374151] uppercase tracking-wider">Nom du modèle *</Label>
                        <Input value={newTpl.name} onChange={e => setNewTpl(t => ({ ...t, name: e.target.value }))}
                          placeholder="Ex: Abonnement mensuel" className="h-10 rounded-xl text-[13px]" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-[#374151] uppercase tracking-wider">Client</Label>
                        <CustomSelect
                          value={newTpl.client_id}
                          onChange={v => setNewTpl(t => ({ ...t, client_id: v }))}
                          placeholder="Aucun client"
                          options={[
                            { value: '', label: 'Aucun client' },
                            ...clients.map(c => ({ value: c.id, label: c.name })),
                          ]}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-[#374151] uppercase tracking-wider">Fréquence</Label>
                        <CustomSelect
                          value={newTpl.frequency}
                          onChange={v => setNewTpl(t => ({ ...t, frequency: v }))}
                          options={[
                            { value: 'monthly',   label: 'Mensuelle' },
                            { value: 'quarterly', label: 'Trimestrielle' },
                            { value: 'yearly',    label: 'Annuelle' },
                          ]}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-[#374151] uppercase tracking-wider">Prochaine génération *</Label>
                        <Input type="date" value={newTpl.next_date} onChange={e => setNewTpl(t => ({ ...t, next_date: e.target.value }))}
                          className="h-10 rounded-xl text-[13px]" />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label className="text-[11px] font-bold text-[#374151] uppercase tracking-wider">Prestation (description)</Label>
                        <Input value={newTpl.description} onChange={e => setNewTpl(t => ({ ...t, description: e.target.value }))}
                          placeholder="Ex: Maintenance logicielle mensuelle" className="h-10 rounded-xl text-[13px]" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-[#374151] uppercase tracking-wider">Prix unitaire (FCFA)</Label>
                        <Input type="number" value={newTpl.unit_price} onChange={e => setNewTpl(t => ({ ...t, unit_price: Number(e.target.value) }))}
                          placeholder="0" className="h-10 rounded-xl text-[13px]" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-[#374151] uppercase tracking-wider">Quantité</Label>
                        <Input type="number" value={newTpl.quantity} onChange={e => setNewTpl(t => ({ ...t, quantity: Number(e.target.value) }))}
                          className="h-10 rounded-xl text-[13px]" />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setShowAddTemplate(false)} className="h-9 px-4 rounded-xl text-[13px]">Annuler</Button>
                      <Button onClick={addTemplate} className="bg-[#111827] text-white h-9 px-4 rounded-xl text-[13px]">Créer le modèle</Button>
                    </div>
                  </div>
                )}

                {/* Templates list */}
                {templates.length === 0 && !showAddTemplate ? (
                  <div className="p-10 text-center">
                    <p className="text-[13px] text-[#9CA3AF]">Aucun modèle récurrent. Cliquez sur "Ajouter un modèle" pour commencer.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#F9FAFB]">
                    {templates.map(tpl => (
                      <div key={tpl.id} className="flex items-center justify-between px-6 py-4 hover:bg-[#F9FAFB] transition-colors">
                        <div className="flex items-center gap-3">
                          <Toggle checked={tpl.active} onChange={v => toggleTemplate(tpl.id, v)} />
                          <div>
                            <p className="text-[13px] font-semibold text-[#0A0A0A]">{tpl.name}</p>
                            <p className="text-[11px] text-[#9CA3AF]">
                              {tpl.clients?.name || tpl.client_name || 'Sans client'} ·{' '}
                              {{ monthly: 'Mensuelle', quarterly: 'Trimestrielle', yearly: 'Annuelle' }[tpl.frequency as string]} ·{' '}
                              prochaine : {new Date(tpl.next_date).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => deleteTemplate(tpl.id)}
                          className="text-[#9CA3AF] hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Assistant IA — info */}
          <div className="bg-gradient-to-br from-[#111827] to-[#1F2937] rounded-2xl p-6 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
                <Zap size={16} className="text-white" />
              </div>
              <div>
                <p className="text-[14px] font-bold">Assistant IA FACTURAI</p>
                <p className="text-[12px] text-white/60">Disponible dès le plan Pro</p>
              </div>
            </div>
            <p className="text-[13px] text-white/70 leading-relaxed">
              L'assistant IA est accessible via le bouton <span className="font-semibold text-white">✦</span> en bas à droite de toutes les pages. Il connaît vos données en temps réel et vous aide avec la comptabilité, la fiscalité ivoirienne, la rédaction d'emails clients et l'analyse financière.
            </p>
            {plan === 'starter' && (
              <button onClick={() => onNavigate('pricing')}
                className="mt-4 px-4 py-2 bg-white text-[#111827] text-[12px] font-bold rounded-xl hover:bg-white/90 transition-colors">
                Passer au plan Pro
              </button>
            )}
          </div>
        </div>
      )}

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm p-8 space-y-4">
          <h2 className="text-[15px] font-semibold text-[#0A0A0A] mb-4">Préférences de notifications</h2>
          {NOTIF_ITEMS.map(n=>(
            <div key={n.key} className="flex items-center justify-between p-4 border border-[#F3F4F6] rounded-xl">
              <div>
                <p className="text-[13px] font-semibold text-[#0A0A0A]">{n.label}</p>
                <p className="text-[12px] text-[#9CA3AF] mt-0.5">{n.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs[n.key] ?? true}
                  onChange={e => setNotifPrefs(prev => ({ ...prev, [n.key]: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-[#E5E7EB] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:bg-[#111827] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"/>
              </label>
            </div>
          ))}
          <div className="pt-2 flex justify-end">
            <Button
              className="bg-[#111827] text-white rounded-xl h-10 px-6 text-[13px]"
              onClick={saveNotifPrefs}
              disabled={savingNotifs}
            >
              <Save size={15} className="mr-1.5"/> Sauvegarder
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
