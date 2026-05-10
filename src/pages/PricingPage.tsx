import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Check, Sparkles, Crown } from 'lucide-react';
import { CheckoutModal } from '@/components/CheckoutModal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { usePlan } from '@/hooks/usePlan';
import { toast } from 'sonner';
import { PLAN_LABEL } from '@/lib/plans';
import { CustomSelect } from '@/components/ui/CustomSelect';

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
      'Historique 30 jours',
    ],
    cta: 'Plan actuel',
  },
  {
    id: 'pro', name: 'Pro', price: '5 000 FCFA', priceNote: '/ mois',
    features: [
      'Factures & devis illimités',
      'Clients & produits illimités',
      'PDF sans marque + logo perso',
      'Export DGI mensuel',
      'Historique illimité',
      'Support email 48h',
    ],
    cta: 'Passer à Pro', highlight: true,
  },
  {
    id: 'business', name: 'Business', price: '15 000 FCFA', priceNote: '/ mois',
    features: [
      'Tout Pro inclus',
      "5 utilisateurs",
      'Agent IA WhatsApp (relances + réponses clients 24/7)',
      'Analyses IA prédictives (impayés, opportunités)',
      'Relances WhatsApp auto',
      'API + webhooks',
      'Support prioritaire 24h',
    ],
    cta: 'Passer à Business',
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 'Sur devis',
    features: [
      'Tout Business inclus',
      'Agent IA WhatsApp personnalisé (entraîné sur vos données)',
      'Analyses IA avancées + tableaux de bord sur mesure',
      'Multi-entreprises',
      'Utilisateurs illimités + rôles',
      'SSO Google / Microsoft',
      'Intégrations Sage / SAP / Odoo',
      'SLA 99.9% + support dédié 24/7',
      'Account manager nommé',
      'Onboarding & formation sur site',
    ],
    cta: 'Contacter le commercial', enterprise: true,
  },
];

export function PricingPage({ onNavigate, onStartCheckout }: Props) {
  const { user, company } = useAuth();
  const { plan: currentPlan } = usePlan();
  const [checkoutPlan, setCheckoutPlan] = useState<TierCard | null>(null);
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [lead, setLead] = useState({
    full_name: '', email: user?.email || '', phone: '',
    company_name: company?.name || '', company_size: '50-200', message: '',
  });

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

  function handleCta(tier: TierCard) {
    if (tier.id === currentPlan) return;
    if (tier.enterprise) { setLeadOpen(true); return; }
    if (tier.id === 'starter') { toast.info('Vous êtes déjà sur le plan Gratuit.'); return; }
    setCheckoutPlan(tier);
  }

  const labelCls = "text-[11px] font-bold text-[#374151] uppercase tracking-widest";

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="text-center space-y-2">
        <h1 className="text-[28px] font-bold text-[#0A0A0A] tracking-tight">Tarifs</h1>
        <p className="text-[14px] text-[#6B7280] max-w-xl mx-auto">
          Démarrez gratuitement. Évoluez quand votre activité grandit. Plan Enterprise sur mesure pour les grandes structures.
        </p>
        <p className="text-[12px] text-[#9CA3AF]">
          Plan actuel: <span className="font-semibold text-[#111827]">{PLAN_LABEL[currentPlan]}</span>
        </p>
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
                className={`w-full h-11 rounded-xl text-[13px] font-semibold transition-all ${
                  isCurrent
                    ? 'bg-[#F3F4F6] text-[#9CA3AF] hover:bg-[#F3F4F6] cursor-not-allowed'
                    : t.enterprise
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : t.highlight
                        ? 'bg-[#111827] hover:bg-[#1F2937] text-white'
                        : 'bg-[#F9FAFB] hover:bg-[#F3F4F6] text-[#111827] border border-[#E5E7EB]'
                }`}
              >
                {isCurrent ? 'Plan actuel' : t.cta}
              </Button>
            </div>
          );
        })}
      </div>

      {checkoutPlan && checkoutPlan.id !== 'starter' && checkoutPlan.id !== 'enterprise' && (
        <CheckoutModal
          plan={{
            id: checkoutPlan.id as 'pro' | 'business',
            name: checkoutPlan.name,
            price: checkoutPlan.price,
            priceNote: checkoutPlan.priceNote || '',
            features: checkoutPlan.features,
          }}
          onClose={() => setCheckoutPlan(null)}
          onStartCheckout={(data) => {
            setCheckoutPlan(null);
            onStartCheckout?.(data);
          }}
        />
      )}

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
