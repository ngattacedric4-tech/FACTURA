import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useActivation } from '@/hooks/useActivation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Key, MessageCircle, LogOut, Clock, ShieldCheck } from 'lucide-react';
import { PLAN_LABEL, PlanId } from '@/lib/plans';

// TODO: remplacer par le vrai numéro de support WhatsApp (format international sans +)
const WHATSAPP_NUMBER = '2250104617601';

interface ActivationPageProps {
  onActivated: () => void | Promise<void>;
}

export function ActivationPage({ onActivated }: ActivationPageProps) {
  const { user, company } = useAuth();
  const { activation, expiresAt, daysLeft } = useActivation();
  const [code, setCode] = useState('FACT-');
  const [submitting, setSubmitting] = useState(false);

  const expired = !!activation && daysLeft < 0;

  // Auto-format input vers FACT-XXXX-XXXX-XXXX-XXXX
  const formatInput = (raw: string) => {
    const hex = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^FACT/, '').slice(0, 16);
    const parts = hex.match(/.{1,4}/g) || [];
    return 'FACT' + (parts.length ? '-' + parts.join('-') : '-');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const normalized = code.trim().toUpperCase();
    const hexCount = normalized.replace(/[^A-F0-9]/g, '').length;
    if (hexCount < 16) {
      toast.error('Clé incomplète. Format : FACT-XXXX-XXXX-XXXX-XXXX');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('activate_company', { p_code: normalized });
      if (error) throw error;
      if (data?.success) {
        const planLabel = PLAN_LABEL[data.plan as PlanId] || data.plan;
        toast.success(
          `Compte activé — Plan ${planLabel} valable ${data.duration_days} jours.`,
          { duration: 6000 }
        );
        await onActivated();
      } else {
        throw new Error('Activation échouée');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur activation');
    } finally {
      setSubmitting(false);
    }
  };

  const waMessage = encodeURIComponent(
    `Bonjour, je souhaite ${expired ? 'renouveler' : 'activer'} mon compte FACTURA.\n`
    + `Société : ${company?.name || '—'}\n`
    + `Email : ${user?.email || '—'}`
  );

  const handleLogout = () => supabase.auth.signOut();

  const labelCls = "text-[11px] font-bold text-[#374151] uppercase tracking-widest";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
      <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-xl shadow-black/5 p-8 sm:p-10">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
            expired ? 'bg-red-50 text-red-600' : 'bg-[#111827] text-white'
          }`}>
            {expired ? <Clock size={24} /> : <ShieldCheck size={24} />}
          </div>
          <h1 className="text-[22px] font-bold text-[#0A0A0A] tracking-tight text-center">
            {expired ? 'Votre accès a expiré' : 'Activer votre compte'}
          </h1>
          <p className="text-[13px] text-[#6B7280] text-center max-w-sm leading-relaxed">
            {expired
              ? `Renouvelez votre clé d'activation pour reprendre l'utilisation de FACTURA.`
              : `Entrez la clé reçue par WhatsApp ou email pour débloquer votre espace.`}
          </p>
        </div>

        {expired && expiresAt && (
          <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[12px] text-red-700">
            Expiré le {expiresAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            {' '}({Math.abs(daysLeft)} jour{Math.abs(daysLeft) > 1 ? 's' : ''}).
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label className={labelCls}>Clé d'activation</Label>
            <div className="relative">
              <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
              <Input
                value={code}
                onChange={(e) => setCode(formatInput(e.target.value))}
                placeholder="FACT-XXXX-XXXX-XXXX-XXXX"
                autoFocus
                required
                spellCheck={false}
                autoComplete="off"
                className="pl-9 h-12 font-mono tracking-wider text-[14px]"
              />
            </div>
            <p className="text-[11px] text-[#9CA3AF]">
              Format : FACT-XXXX-XXXX-XXXX-XXXX (16 caractères hexadécimaux)
            </p>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-xl bg-[#111827] hover:bg-[#1F2937] text-white text-[13px] font-semibold transition-all"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Activation en cours...
              </span>
            ) : (expired ? 'Renouveler mon accès' : 'Activer mon compte')}
          </Button>
        </form>

        <div className="border-t border-[#F3F4F6] my-6" />

        <div className="space-y-2">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${waMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[13px] font-semibold transition-colors"
          >
            <MessageCircle size={16} />
            {expired ? 'Demander un renouvellement' : 'Demander une clé sur WhatsApp'}
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl text-[#6B7280] hover:bg-[#F9FAFB] text-[13px] font-medium transition-colors"
          >
            <LogOut size={14} />
            Me déconnecter
          </button>
        </div>

        <p className="text-[11px] text-center text-[#9CA3AF] mt-6 leading-relaxed">
          Connecté en tant que <span className="font-mono">{user?.email}</span>
        </p>
      </div>
    </div>
  );
}
