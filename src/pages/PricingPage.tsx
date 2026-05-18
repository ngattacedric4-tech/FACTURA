import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Check, Sparkles, Crown, MessageCircle, KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { usePlan } from '@/hooks/usePlan';
import { useActivation } from '@/hooks/useActivation';
import { toast } from 'sonner';
import { PLAN_LABEL } from '@/lib/plans';
import { CustomSelect } from '@/components/ui/CustomSelect';

const WHATSAPP_NUMBER = '2250104617601';

interface CheckoutData { plan: 'pro' | 'business'; planName: string; price: string; }
interface Props { onNavigate: (page: string) => void; onStartCheckout?: (data: CheckoutData) => void; }

interface TierCard {
  id: 'starter' | 'pro' | 'business' | 'enterprise';
  name: string;
  price: string;
  priceNote?: string;
  features: string[];
  cta: string;
  highlight?: boolean;
  enterprise?: boolean;
}

const TIERS: TierCard[] = [
  {
    id: 'starter', name: 'Gratuit', price: '0 FCFA', priceNote: 'à vie',
    features: [
      '5 factures / mois',
      '3 devis / mois',
      "Jusqu'à 10 clients",
      "Jusqu'à 20 produits",
      'PDF avec marque FACTURA',
      'Envoi WhatsApp inclus',
      'Essai 30 jours sans restriction',
    ],
    cta: 'Plan actuel',
  },
  {
    id: 'pro', name: 'Pro', price: '5 000 FCFA', priceNote: '/ mois',
    features: [
      'Factures & devis illimités',
      'Clients & produits illimités',
      'PDF sans marque + logo perso',
      'Envoi WhatsApp 1-clic',
      'Export DGI mensuel',
      'Support email 48h',
    ],
    cta: 'Demander une clé', highlight: true,
  },
  {
    id: 'business', name: 'Business', price: '15 000 FCFA', priceNote: '/ mois',
    features: [
      'Tout Pro inclus',
      '5 utilisateurs',
      'Assistant IA intégré',
      'Relances WhatsApp auto',
      'Support prioritaire 24h',
    ],
    cta: 'Demander une clé',
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 'Sur devis',
    features: [
      'Tout Business inclus',
      'Multi-entreprises',
      'Utilisateurs illimités + rôles',
      'Account manager dédié',
      'SLA 99.9% + support 24/7',
    ],
    cta: 'Contacter le commercial', enterprise: true,
  },
];

const ERROR_MESSAGES: Record<string, string> = {
  key_not_found: 'Code introuvable. Vérifiez la saisie.',
  key_revoked: 'Ce code a été révoqué. Contactez le support.',
  key_already_used: 'Ce code a déjà été utilisé.',
  invalid_code_format: 'Format invalide. 16 caractères hexadécimaux requis.',
  no_company: "Aucune entreprise associée.",
  not_authenticated: 'Session expirée. Reconnectez-vous.',
};

function translateError(raw: string): string {
  const m = raw.match(/[a-z_]+$/i);
  const key = m ? m[0] : raw;
  return ERROR_MESSAGES[key] || raw;
}

export function PricingPage(_props: Props) {
  const { user, company } = useAuth();
  const { plan: currentPlan, refresh: refreshPlan } = usePlan();
  const { expiresAt, refresh: refreshActivation } = useActivation();

  const [leadOpen, setLeadOpen] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [lead, setLead] = useState({
    full_name: '', email: user?.email || '', phone: '',
    company_name: company?.name || '', company_size: '50-200', message: '',
  });

  const [activateOpen, setActivateOpen] = useState(false);
  const [code, setCode] = useState('');
  const [submittingCode, setSubmittingCode] = useState(false);

  function formatCodeInput(raw: string): string {
    const clean = raw.replace(/[^0-9A-Fa-f]/g, '').toUpperCase().slice(0, 16);
    return clean.replace(/(.{4})(?=.)/g, '$1-');
  }

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    setLeadSubmitting(true);
    try {
      const { error } = await supabase.from('enterprise_leads').insert(lead);
      if (error) throw error;
      toast.success('Demande envoyée. Notre équipe vous contactera sous 24h.');
      setLeadOpen(false);
    } catch (err: any) { toast.error(err.message); }
    finally { setLeadSubmitting(false); }
  }

  function whatsappKey(tier: TierCard) {
    const msg = encodeURIComponent(
      `Bonjour, je souhaite une clé d'activation FACTURA — plan ${tier.name} (${tier.price}${tier.priceNote || ''}). Entreprise : ${company?.name || '—'}.`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank', 'noopener,noreferrer');
  }

  function handleCta(tier: TierCard) {
    if (tier.id === currentPlan) return;
    if (tier.enterprise) { setLeadOpen(true); return; }
    if (tier.id === 'starter') { toast.info('Vous êtes déjà sur le plan Gratuit ou un plan supérieur.'); return; }
    whatsappKey(tier);
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (submittingCode) return;
    setSubmittingCode(true);
    try {
      const { data, error } = await supabase.rpc('activate_company', { p_code: code });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      toast.success(`Plan ${row?.plan || ''} activé jusqu'au ${new Date(row?.expires_at).toLocaleDateString('fr-FR')}.`);
      setCode('');
      setActivateOpen(false);
      await Promise.all([refreshPlan(), refreshActivation()]);
    } catch (err: any) {
      toast.error(translateError(err.message || ''));
    } finally { setSubmittingCode(false); }
  }

  const labelCls = "text-[11px] font-bold text-[#374151] uppercase tracking-widest";

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="text-center space-y-2">
        <h1 className="text-[28px] font-bold text-[#0A0A0A] tracking-tight">Tarifs</h1>
        <p className="text-[14px] text-[#6B7280] max-w-xl mx-auto">
          Activation par clé. Demandez votre code sur WhatsApp, payez par Wave / Orange Money / MTN, activez instantanément.
        </p>
        <p className="text-[12px] text-[#9CA3AF]">
          Plan actuel : <span className="font-semibold text-[#111827]">{PLAN_LABEL[currentPlan]}</span>
          {expiresAt && (
            <> · expire le <span className="font-semibold text-[#111827]">{new Date(expiresAt).toLocaleDateString('fr-FR')}</span></>
          )}
        </p>
      </div>

      {/* Bandeau : "J'ai déjà une clé" */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <KeyRound size={18} className="text-emerald-700" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-emerald-800">Vous avez déjà une clé d'activation ?</p>
            <p className="text-[12px] text-emerald-700 mt-0.5">Activez-la directement ici pour débloquer votre plan.</p>
          </div>
        </div>
        <Button
          onClick={() => setActivateOpen(true)}
          className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold rounded-xl shrink-0"
        >
          Activer ma clé
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {TIERS.map((t) => {
          const isCurrent = t.id === currentPlan;
          return (
            <div key={t.id}
              className={`relative bg-white rounded-2xl border p-6 flex flex-col ${
                t.enterprise
                  ? 'border-transparent bg-gradient-to-br from-[#0A0A0A] to-[#1F2937] text-white'
                  : t.highlight
                    ? 'border-[#111827] shadow-xl shadow-black/5'
                    : 'border-[#F3F4F6] shadow-sm'
              }`}>
              {t.highlight && !t.enterprise && (
                <span className="absolute -top-3 left-6 bg-[#111827] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  Recommandé
                </span>
              )}
              {t.enterprise && (
                <span className="absolute -top-3 left-6 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1">
                  <Crown size={10}/> Sur mesure
                </span>
              )}

              <div className="flex items-center gap-2 mb-2">
                {t.enterprise && <Sparkles size={16} className="text-amber-400"/>}
                <h3 className={`text-[18px] font-bold ${t.enterprise ? 'text-white' : 'text-[#0A0A0A]'}`}>{t.name}</h3>
              </div>

              <div className="mb-6">
                <span className={`text-[26px] font-bold ${t.enterprise ? 'text-white' : 'text-[#0A0A0A]'}`}>{t.price}</span>
                {t.priceNote && (
                  <span className={`text-[12px] ml-1 ${t.enterprise ? 'text-white/60' : 'text-[#9CA3AF]'}`}>{t.priceNote}</span>
                )}
                {t.enterprise && (
                  <p className="text-[11px] text-white/50 mt-1">à partir de 75 000 FCFA / mois</p>
                )}
              </div>

              <ul className="space-y-2.5 flex-1 mb-6">
                {t.features.map((f, i) => (
                  <li key={i} className={`flex items-start gap-2 text-[13px] ${t.enterprise ? 'text-white/90' : 'text-[#374151]'}`}>
                    <Check size={14} className={`flex-shrink-0 mt-0.5 ${t.enterprise ? 'text-amber-400' : 'text-emerald-500'}`}/>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleCta(t)}
                disabled={isCurrent}
                className={`w-full h-11 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-2 ${
                  isCurrent
                    ? 'bg-[#F3F4F6] text-[#9CA3AF] hover:bg-[#F3F4F6] cursor-not-allowed'
                    : t.enterprise
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : t.highlight
                        ? 'bg-[#25D366] hover:bg-[#1FAD54] text-white'
                        : 'bg-[#F9FAFB] hover:bg-[#F3F4F6] text-[#111827] border border-[#E5E7EB]'
                }`}
              >
                {!isCurrent && !t.enterprise && t.id !== 'starter' && <MessageCircle size={14} />}
                {isCurrent ? 'Plan actuel' : t.cta}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Activation Dialog */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound size={18} /> Activer une clé
            </DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-[#6B7280]">
            Collez le code à 16 caractères reçu par WhatsApp. Les tirets sont ajoutés automatiquement.
          </p>
          <form onSubmit={submitCode} className="space-y-4">
            <div className="space-y-2">
              <Label className={labelCls}>Clé d'activation</Label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(formatCodeInput(e.target.value))}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                autoFocus
                autoComplete="off"
                className="w-full h-12 px-4 text-[15px] font-mono tracking-widest text-center border border-[#E5E7EB] rounded-xl bg-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:bg-white uppercase"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setActivateOpen(false)}>Annuler</Button>
              <Button
                type="submit"
                disabled={submittingCode || code.replace(/-/g, '').length !== 16}
                className="bg-[#111827] hover:bg-[#1F2937] text-white disabled:opacity-50"
              >
                {submittingCode ? 'Activation...' : 'Activer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Enterprise lead form */}
      <Dialog open={leadOpen} onOpenChange={setLeadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Demande Enterprise</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-[#6B7280]">
            Notre équipe commerciale vous recontactera sous 24h pour étudier vos besoins.
          </p>
          <form onSubmit={submitLead} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={labelCls}>Nom complet *</Label>
                <Input required value={lead.full_name} onChange={e=>setLead({...lead, full_name:e.target.value})}/>
              </div>
              <div className="space-y-1.5">
                <Label className={labelCls}>Email *</Label>
                <Input type="email" required value={lead.email} onChange={e=>setLead({...lead, email:e.target.value})}/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={labelCls}>Téléphone</Label>
                <Input value={lead.phone} onChange={e=>setLead({...lead, phone:e.target.value})}/>
              </div>
              <div className="space-y-1.5">
                <Label className={labelCls}>Taille</Label>
                <CustomSelect
                  size="lg"
                  value={lead.company_size}
                  onChange={v => setLead({ ...lead, company_size: v })}
                  options={[
                    { value: '10-50',    label: '10–50 employés' },
                    { value: '50-200',   label: '50–200 employés' },
                    { value: '200-1000', label: '200–1000 employés' },
                    { value: '1000+',    label: '1000+ employés' },
                  ]}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className={labelCls}>Entreprise *</Label>
              <Input required value={lead.company_name} onChange={e=>setLead({...lead, company_name:e.target.value})}/>
            </div>
            <div className="space-y-1.5">
              <Label className={labelCls}>Message</Label>
              <textarea rows={3} className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[14px] focus:bg-white focus:border-[#111827] focus:ring-1 focus:ring-[#111827] outline-none transition-all"
                value={lead.message} onChange={e=>setLead({...lead, message:e.target.value})}
                placeholder="Décrivez vos besoins..."/>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={()=>setLeadOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={leadSubmitting} className="bg-[#111827] hover:bg-[#1F2937] text-white">
                {leadSubmitting ? 'Envoi...' : 'Envoyer la demande'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
