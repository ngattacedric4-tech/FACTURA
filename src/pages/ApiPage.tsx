import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { usePlan } from '@/hooks/usePlan';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/lib/supabase';
import { ApiKey, Webhook } from '@/types/database';
import { Code2, Trash2, Copy, Lock, Plus, Webhook as WebhookIcon, Key, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Props { onNavigate: (page: string) => void; }

const WEBHOOK_EVENTS = [
  { value: 'invoice.created', label: 'Facture créée' },
  { value: 'invoice.sent', label: 'Facture envoyée' },
  { value: 'invoice.paid', label: 'Facture payée' },
  { value: 'invoice.overdue', label: 'Facture en retard' },
  { value: 'estimate.accepted', label: 'Devis accepté' },
  { value: 'payment.received', label: 'Paiement reçu' },
];

async function hashKey(raw: string): Promise<string> {
  const buf = new TextEncoder().encode(raw);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateKey(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return 'fac_' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function ApiPage({ onNavigate }: Props) {
  const { company } = useAuth();
  const { plan } = usePlan();
  const { isAdmin } = useRole();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [tab, setTab] = useState<'keys' | 'webhooks'>('keys');
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [newHookUrl, setNewHookUrl] = useState('');
  const [newHookEvents, setNewHookEvents] = useState<string[]>(['invoice.created', 'invoice.paid']);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => { if (company) load(); }, [company]);

  async function load() {
    if (!company) return;
    const [{ data: k }, { data: w }] = await Promise.all([
      supabase.from('api_keys').select('*').eq('company_id', company.id).order('created_at', { ascending: false }),
      supabase.from('webhooks').select('*').eq('company_id', company.id).order('created_at', { ascending: false }),
    ]);
    setKeys((k ?? []) as ApiKey[]);
    setWebhooks((w ?? []) as Webhook[]);
  }

  async function createKey() {
    if (!company || !newKeyName.trim()) return;
    const raw = generateKey();
    const hash = await hashKey(raw);
    const prefix = raw.slice(0, 12);
    const { error } = await supabase.from('api_keys').insert({
      company_id: company.id,
      name: newKeyName,
      key_hash: hash,
      key_prefix: prefix,
    });
    if (error) { toast.error(error.message); return; }
    setCreatedKey(raw);
    setNewKeyName('');
    load();
  }

  async function revokeKey(id: string) {
    if (!confirm('Révoquer cette clé ? Toutes les requêtes l\'utilisant échoueront.')) return;
    await supabase.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id);
    load();
  }

  async function deleteKey(id: string) {
    await supabase.from('api_keys').delete().eq('id', id);
    load();
  }

  async function createWebhook() {
    if (!company || !newHookUrl.trim()) return;
    if (!newHookUrl.startsWith('https://')) { toast.error('URL doit commencer par https://'); return; }
    const secret = generateKey();
    const { error } = await supabase.from('webhooks').insert({
      company_id: company.id,
      url: newHookUrl,
      events: newHookEvents,
      secret,
    });
    if (error) { toast.error(error.message); return; }
    setNewHookUrl('');
    toast.success('Webhook créé !');
    load();
  }

  async function toggleWebhook(id: string, active: boolean) {
    await supabase.from('webhooks').update({ active }).eq('id', id);
    load();
  }

  async function deleteWebhook(id: string) {
    await supabase.from('webhooks').delete().eq('id', id);
    load();
  }

  if (plan === 'starter' || plan === 'pro') {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-amber-50 rounded-2xl flex items-center justify-center">
          <Lock size={28} className="text-amber-600" />
        </div>
        <h2 className="text-[22px] font-bold text-[#0A0A0A]">Réservé au plan Business</h2>
        <p className="text-[14px] text-[#6B7280] max-w-md mx-auto">
          API REST et webhooks disponibles à partir du plan Business. Intégrez FACTURA à vos outils existants.
        </p>
        <Button onClick={() => onNavigate('pricing')} className="bg-[#111827] hover:bg-[#1F2937] text-white">
          Découvrir les plans
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
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-[24px] font-bold text-[#0A0A0A]">API & Webhooks</h1>
        <p className="text-[13px] text-[#6B7280] mt-1">Intégrez FACTURA à vos systèmes</p>
      </div>

      <div className="flex gap-2 border-b border-[#E5E7EB]">
        {[{id:'keys',label:'Clés API',icon:Key},{id:'webhooks',label:'Webhooks',icon:WebhookIcon}].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-[#111827] text-[#111827]' : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'keys' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 space-y-4">
            <h3 className="text-[15px] font-semibold text-[#111827]">Nouvelle clé API</h3>
            <div className="flex gap-2">
              <Input
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="Nom (ex: production, intégration Sage)"
                className="flex-1"
              />
              <Button onClick={createKey} disabled={!newKeyName.trim()} className="bg-[#111827] hover:bg-[#1F2937] text-white">
                <Plus size={14} className="mr-1.5" /> Créer
              </Button>
            </div>
            {createdKey && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                <p className="text-[13px] font-semibold text-amber-900">⚠️ Clé créée — copiez-la, elle ne sera plus visible !</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white px-3 py-2 rounded-lg text-[12px] font-mono text-[#111827] break-all border border-amber-200">
                    {createdKey}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(createdKey);
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                    }}
                  >
                    {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                  </Button>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setCreatedKey(null)}>J'ai copié la clé</Button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
            {keys.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-[#9CA3AF]">Aucune clé API</div>
            ) : (
              <table className="w-full">
                <thead className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
                  <tr>
                    <th className="text-left text-[11px] font-bold text-[#6B7280] uppercase tracking-widest px-6 py-3">Nom</th>
                    <th className="text-left text-[11px] font-bold text-[#6B7280] uppercase tracking-widest px-6 py-3">Préfixe</th>
                    <th className="text-left text-[11px] font-bold text-[#6B7280] uppercase tracking-widest px-6 py-3">Statut</th>
                    <th className="text-left text-[11px] font-bold text-[#6B7280] uppercase tracking-widest px-6 py-3">Dernière utilisation</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map(k => (
                    <tr key={k.id} className="border-b border-[#F3F4F6] last:border-0">
                      <td className="px-6 py-4 text-[13px] text-[#111827]">{k.name}</td>
                      <td className="px-6 py-4 text-[12px] font-mono text-[#6B7280]">{k.key_prefix}…</td>
                      <td className="px-6 py-4">
                        {k.revoked_at ? (
                          <span className="text-[11px] font-bold uppercase text-red-700 bg-red-50 px-2 py-1 rounded-full">Révoquée</span>
                        ) : (
                          <span className="text-[11px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">Active</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-[12px] text-[#6B7280]">
                        {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString('fr-FR') : 'Jamais'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!k.revoked_at ? (
                          <Button variant="ghost" size="sm" onClick={() => revokeKey(k.id)} className="text-amber-600">
                            Révoquer
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon-sm" onClick={() => deleteKey(k.id)} className="text-[#EF4444]">
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-[#0A0A0A] rounded-2xl p-6 text-white">
            <p className="text-[12px] font-bold uppercase tracking-widest text-white/40 mb-3">Documentation API</p>
            <pre className="text-[12px] font-mono text-emerald-300 overflow-x-auto"># Lister les factures
curl https://api.factura.ci/v1/invoices \
  -H "Authorization: Bearer fac_..."

# Créer une facture
curl https://api.factura.ci/v1/invoices \
  -H "Authorization: Bearer fac_..." \
  -H "Content-Type: application/json" \
  -d '&#123;"client_id":"...", "items":[...]&#125;'</pre>
          </div>
        </div>
      )}

      {tab === 'webhooks' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 space-y-4">
            <h3 className="text-[15px] font-semibold text-[#111827]">Nouveau webhook</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-[#374151]">URL endpoint</Label>
                <Input
                  value={newHookUrl}
                  onChange={e => setNewHookUrl(e.target.value)}
                  placeholder="https://votre-app.com/webhooks/factura"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-[#374151]">Événements</Label>
                <div className="grid grid-cols-2 gap-2">
                  {WEBHOOK_EVENTS.map(ev => (
                    <label key={ev.value} className="flex items-center gap-2 text-[13px] text-[#374151] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newHookEvents.includes(ev.value)}
                        onChange={e => {
                          setNewHookEvents(prev => e.target.checked
                            ? [...prev, ev.value]
                            : prev.filter(v => v !== ev.value));
                        }}
                      />
                      {ev.label}
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={createWebhook} disabled={!newHookUrl.trim() || newHookEvents.length === 0} className="bg-[#111827] hover:bg-[#1F2937] text-white">
                <Plus size={14} className="mr-1.5" /> Créer le webhook
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
            {webhooks.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-[#9CA3AF]">Aucun webhook</div>
            ) : (
              <div className="divide-y divide-[#F3F4F6]">
                {webhooks.map(h => (
                  <div key={h.id} className="p-5 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-mono text-[#111827] truncate">{h.url}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {h.events.map(e => (
                          <span key={e} className="text-[10px] font-bold uppercase bg-[#F3F4F6] text-[#374151] px-2 py-0.5 rounded">
                            {e}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleWebhook(h.id, !h.active)}
                        className={`text-[11px] font-bold uppercase px-3 py-1.5 rounded-full ${
                          h.active ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F3F4F6] text-[#9CA3AF]'
                        }`}
                      >
                        {h.active ? 'Actif' : 'Pausé'}
                      </button>
                      <Button variant="ghost" size="icon-sm" onClick={() => deleteWebhook(h.id)} className="text-[#EF4444]">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
