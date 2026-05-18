import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useActivation } from '@/hooks/useActivation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { KeyRound, ShieldCheck, MessageCircle, Clock, LogOut } from 'lucide-react';

const WHATSAPP_NUMBER = '2250104617601';

const ERROR_MESSAGES: Record<string, string> = {
  key_not_found: 'Code introuvable. Vérifiez la saisie.',
  key_revoked: 'Ce code a été révoqué. Contactez le support.',
  key_already_used: 'Ce code a déjà été utilisé.',
  invalid_code_format: 'Format invalide. 16 caractères hexadécimaux requis.',
  no_company: "Aucune entreprise associée. Terminez d'abord l'inscription.",
  not_authenticated: 'Session expirée. Reconnectez-vous.',
};

function translateError(raw: string): string {
  const m = raw.match(/[a-z_]+$/i);
  const key = m ? m[0] : raw;
  return ERROR_MESSAGES[key] || raw;
}

export function ActivationPage() {
  const { company } = useAuth();
  const { expiresAt, plan, daysLeft, minutesLeft, active, refresh } = useActivation();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogout = () => supabase.auth.signOut();

  function formatCodeInput(raw: string): string {
    const clean = raw.replace(/[^0-9A-Fa-f]/g, '').toUpperCase().slice(0, 16);
    return clean.replace(/(.{4})(?=.)/g, '$1-');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('activate_company', { p_code: code });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      toast.success(`Plan ${row?.plan || ''} activé jusqu'au ${new Date(row?.expires_at).toLocaleDateString('fr-FR')}.`);
      setCode('');
      await refresh();
    } catch (e: any) {
      toast.error(translateError(e.message || ''));
    } finally {
      setSubmitting(false);
    }
  }

  const whatsappMsg = encodeURIComponent(
    `Bonjour, je souhaite ${active ? 'renouveler' : 'activer'} mon abonnement FACTURA pour ${company?.name || 'mon entreprise'}.`
  );
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
      <div className="w-full max-w-[520px] bg-white rounded-2xl shadow-xl shadow-black/5 p-10">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#111827] text-white flex items-center justify-center">
            <KeyRound size={20} />
          </div>
          <h1 className="text-[22px] font-black tracking-tight text-[#0A0A0A]">Activation requise</h1>
          <p className="text-[13px] text-[#6B7280] text-center max-w-[380px]">
            {active
              ? "Votre abonnement est actif. Saisissez un code pour le prolonger."
              : "Votre période d'essai est terminée. Entrez votre clé d'activation pour continuer."}
          </p>
        </div>

        {expiresAt && (
          <div className={`rounded-xl px-4 py-3 mb-6 flex items-start gap-3 border ${
            active ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
          }`}>
            {active ? (
              <ShieldCheck size={16} className="text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <Clock size={16} className="text-red-500 mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-[12px] font-bold ${active ? 'text-emerald-700' : 'text-red-700'}`}>
                {active ? `Plan ${plan} actif` : 'Abonnement expiré'}
              </p>
              <p className={`text-[12px] mt-0.5 ${active ? 'text-emerald-600' : 'text-red-600'}`}>
                {active
                  ? (minutesLeft < 1440
                      ? `Expire dans ${minutesLeft < 60 ? `${minutesLeft} min` : `${Math.ceil(minutesLeft / 60)} h`}`
                      : `Expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''} (${new Date(expiresAt).toLocaleDateString('fr-FR')})`)
                  : `Expiré depuis le ${new Date(expiresAt).toLocaleDateString('fr-FR')}`}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#374151] uppercase tracking-widest">
              Clé d'activation
            </label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(formatCodeInput(e.target.value))}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              autoFocus
              autoComplete="off"
              className="w-full h-12 px-4 text-[15px] font-mono tracking-widest text-center border border-[#E5E7EB] rounded-xl bg-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:bg-white uppercase"
            />
            <p className="text-[11px] text-[#9CA3AF]">
              16 caractères hexadécimaux. Les tirets sont ajoutés automatiquement.
            </p>
          </div>

          <Button
            type="submit"
            disabled={submitting || code.replace(/-/g, '').length !== 16}
            className="w-full h-12 bg-[#111827] hover:bg-[#1F2937] text-white text-[14px] font-semibold rounded-xl disabled:opacity-50"
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              active ? 'Prolonger' : 'Activer'
            )}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-[#F3F4F6] space-y-3">
          <p className="text-[12px] text-[#6B7280] text-center">
            Pas encore de clé ? Contactez-nous sur WhatsApp.
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full h-11 bg-[#25D366] hover:bg-[#1FAD54] text-white text-[13px] font-semibold rounded-xl transition-colors"
          >
            <MessageCircle size={16} />
            Demander une clé
          </a>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full h-10 text-[12px] text-[#9CA3AF] hover:text-[#111827] transition-colors"
          >
            <LogOut size={13} />
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
