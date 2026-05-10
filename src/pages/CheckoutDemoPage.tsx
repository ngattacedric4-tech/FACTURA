import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Loader2, ShieldCheck, ReceiptText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  plan: 'pro' | 'business';
  planName: string;
  price: string;
  onCancel: () => void;
  onSuccess: () => void;
}

const METHODS = [
  { id: 'wave',  label: 'Wave',         prefix: '+225', placeholder: '07 XX XX XX XX', color: '#1B9ADF', bg: '#EFF9FF', border: '#BAE3F9' },
  { id: 'om',   label: 'Orange Money',  prefix: '+225', placeholder: '07 XX XX XX XX', color: '#FF6600', bg: '#FFF3EB', border: '#FFD0AE' },
  { id: 'mtn',  label: 'MTN Money',     prefix: '+225', placeholder: '05 XX XX XX XX', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
];

const PLAN_AMOUNT: Record<string, string> = { pro: '5 000', business: '15 000' };

type Step = 'phone' | 'otp' | 'processing';

export function CheckoutDemoPage({ plan, planName, price, onCancel, onSuccess }: Props) {
  const [method, setMethod] = useState('wave');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [step, setStep] = useState<Step>('phone');
  const [error, setError] = useState('');
  const otpRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const amount = PLAN_AMOUNT[plan] || price;
  const m = METHODS.find(x => x.id === method)!;

  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[i] = val.slice(-1);
    setOtp(next);
    if (val && i < 3) otpRefs[i + 1].current?.focus();
    if (!val && i > 0) otpRefs[i - 1].current?.focus();
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs[i - 1].current?.focus();
  };

  const handleSendCode = () => {
    const digits = phone.replace(/\s/g, '');
    if (digits.length < 8) { setError('Numéro de téléphone invalide'); return; }
    setError('');
    setStep('otp');
    setTimeout(() => otpRefs[0].current?.focus(), 120);
  };

  const handleConfirm = async () => {
    const code = otp.join('');
    if (code.length < 4) { setError('Entrez le code à 4 chiffres'); return; }
    setError('');
    setStep('processing');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('simulate-payment', {
        body: { plan },
      });
      if (fnError || data?.error) throw new Error(data?.error || fnError?.message);
      setTimeout(() => onSuccess(), 1400);
    } catch (e: any) {
      setStep('otp');
      setError(e.message);
    }
  };

  const handleCancel = () => onCancel();

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      {/* Top bar */}
      <div className="h-14 bg-white border-b border-[#F3F4F6] flex items-center px-4 gap-3">
        {step !== 'processing' && (
          <button onClick={handleCancel} className="text-[#6B7280] hover:text-[#111827] transition-colors p-1">
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="flex items-center gap-2 flex-1 justify-center">
          <div className="w-6 h-6 bg-[#111827] rounded-md flex items-center justify-center">
            <ReceiptText size={12} className="text-white" />
          </div>
          <span className="text-[14px] font-black tracking-tight text-[#111827]">FACTURA</span>
        </div>
        <div className="w-8" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">

            {/* ── STEP: PHONE ── */}
            {step === 'phone' && (
              <motion.div key="phone" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.18 }}
                className="bg-white rounded-2xl shadow-sm border border-[#F3F4F6] overflow-hidden">

                {/* Order summary */}
                <div className="bg-[#111827] px-5 py-4">
                  <p className="text-white/50 text-[11px] font-semibold uppercase tracking-widest mb-0.5">Récapitulatif</p>
                  <div className="flex items-baseline justify-between">
                    <p className="text-white text-[16px] font-bold">Plan {planName}</p>
                    <p className="text-white text-[20px] font-bold">{amount} <span className="text-[13px] text-white/60">FCFA</span></p>
                  </div>
                  <p className="text-white/40 text-[11px] mt-0.5">Abonnement mensuel · renouvellement automatique</p>
                </div>

                <div className="p-5 space-y-5">
                  {/* Payment method tabs */}
                  <div>
                    <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2.5">Mode de paiement</p>
                    <div className="grid grid-cols-3 gap-2">
                      {METHODS.map(mx => (
                        <button key={mx.id} onClick={() => setMethod(mx.id)}
                          className="py-2.5 px-2 rounded-xl text-[11px] font-bold transition-all border"
                          style={method === mx.id
                            ? { background: mx.bg, color: mx.color, borderColor: mx.border }
                            : { background: '#F9FAFB', color: '#9CA3AF', borderColor: '#F3F4F6' }}>
                          {mx.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Phone input */}
                  <div>
                    <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2">Numéro {m.label}</p>
                    <div className="flex gap-2">
                      <div className="h-12 px-3.5 bg-[#F3F4F6] rounded-xl flex items-center text-[13px] font-semibold text-[#374151] shrink-0">
                        {m.prefix}
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSendCode(); }}
                        placeholder={m.placeholder}
                        className="flex-1 h-12 px-3.5 text-[14px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#111827] focus:bg-white transition-colors"
                      />
                    </div>
                  </div>

                  {error && <p className="text-[12px] text-red-500">{error}</p>}

                  <button onClick={handleSendCode}
                    className="w-full h-12 bg-[#111827] hover:bg-[#1F2937] text-white rounded-xl font-semibold text-[14px] transition-colors">
                    Recevoir le code
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP: OTP ── */}
            {step === 'otp' && (
              <motion.div key="otp" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.18 }}
                className="bg-white rounded-2xl shadow-sm border border-[#F3F4F6] overflow-hidden">

                <div className="bg-[#111827] px-5 py-4">
                  <p className="text-white/50 text-[11px] font-semibold uppercase tracking-widest mb-0.5">Récapitulatif</p>
                  <div className="flex items-baseline justify-between">
                    <p className="text-white text-[16px] font-bold">Plan {planName}</p>
                    <p className="text-white text-[20px] font-bold">{amount} <span className="text-[13px] text-white/60">FCFA</span></p>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  <div className="text-center">
                    <p className="text-[14px] font-semibold text-[#111827]">Code de confirmation</p>
                    <p className="text-[12px] text-[#6B7280] mt-1">
                      Code envoyé au <span className="font-semibold text-[#374151]">{m.prefix} {phone}</span>
                    </p>
                  </div>

                  {/* OTP boxes */}
                  <div className="flex gap-3 justify-center">
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={otpRefs[i]}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        className="w-14 h-14 text-center text-[22px] font-bold bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827] focus:bg-white transition-all"
                      />
                    ))}
                  </div>

                  <p className="text-center text-[11px] text-[#9CA3AF]">
                    Pour la démo, utilisez le code <span className="font-bold text-[#6B7280]">1234</span>
                  </p>

                  {error && <p className="text-[12px] text-red-500 text-center">{error}</p>}

                  <button onClick={handleConfirm}
                    className="w-full h-12 font-semibold text-[14px] rounded-xl text-white transition-colors"
                    style={{ background: m.color }}>
                    Confirmer le paiement · {amount} FCFA
                  </button>

                  <button onClick={() => { setStep('phone'); setOtp(['','','','']); setError(''); }}
                    className="w-full text-[12px] text-[#9CA3AF] hover:text-[#6B7280] transition-colors">
                    ← Modifier le numéro
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP: PROCESSING ── */}
            {step === 'processing' && (
              <motion.div key="processing" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl shadow-sm border border-[#F3F4F6] p-10 text-center space-y-5">
                <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
                  style={{ background: m.bg }}>
                  <Loader2 size={28} className="animate-spin" style={{ color: m.color }} />
                </div>
                <div>
                  <p className="text-[16px] font-bold text-[#111827]">Traitement en cours…</p>
                  <p className="text-[13px] text-[#6B7280] mt-1">Validation du paiement {m.label}</p>
                </div>
                <div className="flex gap-1.5 justify-center">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: m.color, animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>

          {/* Security + demo badge */}
          {step !== 'processing' && (
            <div className="mt-5 flex flex-col items-center gap-2">
              <div className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                <ShieldCheck size={12} />
                <span>Paiement sécurisé · Données chiffrées</span>
              </div>
              <span className="text-[10px] font-semibold px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                MODE DÉMONSTRATION — aucun débit réel
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
