import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, LogOut } from 'lucide-react';

export function OnboardingPage() {
  const { user, refreshCompany } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', ncc: '', phone: '', email: '', address: '',
  });

  // Permet au bouton « back » du navigateur de sortir de l'étape onboarding
  // (déconnecte → retour landing). Sans ça, le user est bloqué tant qu'il
  // n'a pas créé son entreprise.
  useEffect(() => {
    if (window.location.hash !== '#onboarding') {
      window.history.pushState({ step: 'onboarding' }, '', '#onboarding');
    }
    const handlePopState = () => {
      supabase.auth.signOut();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { toast.error('Session expirée. Reconnectez-vous.'); return; }
    if (form.name.trim().length < 2) { toast.error('Raison sociale requise (2 caractères min).'); return; }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) { toast.error('Email invalide.'); return; }

    setSubmitting(true);
    try {
      const payload = {
        user_id: user.id,
        name: form.name.trim(),
        ncc: form.ncc.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('companies')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        if (error.message?.includes('row-level security')) throw new Error("Permission refusée. Reconnectez-vous puis réessayez.");
        if (error.message?.includes('duplicate key')) throw new Error("Vous avez déjà une entreprise. Rechargez la page.");
        throw error;
      }
      toast.success('Profil entreprise créé.');
      await refreshCompany();
    } catch (err: any) {
      toast.error('Erreur : ' + (err.message || 'inconnue'));
    } finally { setSubmitting(false); }
  }

  const labelCls = "text-[11px] font-bold text-[#374151] uppercase tracking-widest";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
      <div className="w-full max-w-[520px] bg-white rounded-2xl shadow-xl shadow-black/5 p-10">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#111827] text-white flex items-center justify-center">
            <Building2 size={22} />
          </div>
          <h1 className="text-[22px] font-bold text-[#0A0A0A] tracking-tight">Configurez votre entreprise</h1>
          <p className="text-[13px] text-[#6B7280] text-center max-w-sm">
            Ces informations figureront sur vos factures et devis.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label className={labelCls}>Raison sociale *</Label>
            <Input autoFocus required value={form.name} onChange={update('name')} placeholder="Ex: Ivoire Tech SARL" />
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>N° Compte Contribuable (NCC)</Label>
            <Input value={form.ncc} onChange={update('ncc')} placeholder="Ex: 1234567 A (optionnel)" />
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Téléphone</Label>
            <Input value={form.phone} onChange={update('phone')} placeholder="+225 07 00 00 00 00" />
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Email professionnel</Label>
            <Input type="email" value={form.email} onChange={update('email')} placeholder="contact@entreprise.ci" />
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Adresse complète</Label>
            <Input value={form.address} onChange={update('address')} placeholder="Plateau, Rue des Banques, Abidjan" />
          </div>

          <Button
            type="submit" disabled={submitting}
            className="w-full h-12 rounded-xl bg-[#111827] hover:bg-[#1F2937] text-white text-[13px] font-semibold transition-all"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Enregistrement...
              </span>
            ) : 'Commencer'}
          </Button>

          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="w-full flex items-center justify-center gap-2 text-[12px] text-[#9CA3AF] hover:text-[#111827] transition-colors py-2"
          >
            <LogOut size={13} />
            Annuler et changer de compte
          </button>
        </form>
      </div>
    </div>
  );
}
