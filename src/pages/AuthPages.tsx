import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ReceiptText, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'motion/react';

function translateError(message: string): string {
  if (!message) return "Erreur d'authentification.";
  if (message.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (message.includes('Email not confirmed')) return 'Veuillez confirmer votre email avant de vous connecter.';
  if (message.includes('User already registered')) return 'Un compte existe déjà avec cet email.';
  if (message.includes('Password should be at least')) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (message.toLowerCase().includes('rate limit')) return 'Trop de tentatives. Réessayez dans quelques minutes.';
  return message;
}

export function AuthPages({ initialMode = 'login' }: { initialMode?: 'login' | 'signup' }) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-[#E5E7EB]' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^a-zA-Z0-9]/.test(pass)) score++;

    if (score <= 1) return { score: 1, label: 'Faible', color: 'bg-red-400' };
    if (score === 2) return { score: 2, label: 'Moyen', color: 'bg-amber-400' };
    if (score === 3) return { score: 3, label: 'Bon', color: 'bg-blue-400' };
    return { score: 4, label: 'Excellent', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(password);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin && password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas.');
      return;
    }
    if (!isLogin && strength.score < 2) {
      toast.error('Votre mot de passe est trop faible.');
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success('Inscription réussie ! Vérifiez votre email.');
      }
    } catch (error: any) {
      toast.error(translateError(error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) { toast.error("Saisissez d'abord votre email."); return; }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) throw error;
      toast.success('Email de réinitialisation envoyé.');
    } catch (e: any) { toast.error(translateError(e.message)); }
  };

  const labelCls = "text-[11px] font-bold text-[#374151] uppercase tracking-widest";
  const inputCls = "h-11 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-[14px] text-[#0A0A0A] placeholder:text-[#D1D5DB] focus:bg-white focus:border-[#111827] focus:ring-1 focus:ring-[#111827] transition-all";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-xl shadow-black/5 p-10">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-[#111827] rounded-lg flex items-center justify-center">
            <ReceiptText size={18} className="text-white" />
          </div>
          <span className="text-[20px] font-black tracking-tight text-[#111827]">FACTURA</span>
        </div>

        <h1 className="text-[24px] font-bold text-[#0A0A0A] tracking-tight">
          {isLogin ? 'Connexion' : 'Créer un compte'}
        </h1>
        <p className="text-[14px] text-[#6B7280] mt-1 mb-8">
          {isLogin ? 'Saisissez vos identifiants pour continuer.' : 'Créez votre compte entreprise en moins de 2 minutes.'}
        </p>

        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className={labelCls}>Email</Label>
            <Input
              id="email" type="email" autoFocus required
              placeholder="votre.nom@entreprise.ci"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className={labelCls}>Mot de passe</Label>
              {isLogin && (
                <button type="button" onClick={handleForgotPassword}
                  className="text-[11px] font-semibold text-[#111827] hover:underline">
                  Oublié ?
                </button>
              )}
            </div>
            <div className="relative">
              <Input
                id="password" type={showPassword ? 'text' : 'password'} required
                placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                className={`${inputCls} pr-11`}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#9CA3AF] hover:text-[#0A0A0A] transition-colors">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {!isLogin && password.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between pt-2"
              >
                <span className="text-[10px] font-bold uppercase text-[#9CA3AF] tracking-widest">
                  Sécurité : {strength.label}
                </span>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4].map((step) => (
                    <div key={step}
                      className={`h-1 w-5 rounded-full transition-colors duration-300 ${
                        step <= strength.score ? strength.color : 'bg-[#F3F4F6]'
                      }`}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {!isLogin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="space-y-1.5 overflow-hidden"
            >
              <Label htmlFor="confirm-password" className={labelCls}>Confirmer le mot de passe</Label>
              <div className="relative">
                <Input
                  id="confirm-password" type={showPassword ? 'text' : 'password'} required
                  placeholder="••••••••"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${inputCls} pr-11`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {confirmPassword && (password === confirmPassword
                    ? <CheckCircle2 className="text-emerald-500" size={16} />
                    : <XCircle className="text-red-400" size={16} />
                  )}
                </div>
              </div>
            </motion.div>
          )}

          <Button
            type="submit" disabled={loading}
            className="w-full h-12 rounded-xl bg-[#111827] hover:bg-[#1F2937] text-white text-[13px] font-semibold transition-all"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Traitement...
              </span>
            ) : (isLogin ? 'Se connecter' : 'Créer mon compte')}
          </Button>

          <div className="text-center pt-2">
            <button type="button" onClick={() => setIsLogin(!isLogin)}
              className="text-[13px] text-[#6B7280] hover:text-[#111827] transition-colors">
              {isLogin ? "Nouveau ici ? " : 'Déjà membre ? '}
              <span className="font-semibold text-[#111827]">
                {isLogin ? 'Créer un compte' : 'Se connecter'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
