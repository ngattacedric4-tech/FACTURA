import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ReceiptText, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props { token: string; onDone: () => void; }

export function InviteAcceptPage({ token, onDone }: Props) {
  const { user } = useAuth();
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [signingUp, setSigningUp] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('team_members')
        .select('id, invited_email, role, accepted_at, companies(name)')
        .eq('invite_token', token)
        .maybeSingle();
      if (!data) setError('Invitation invalide ou expirée.');
      else if (data.accepted_at) setError('Invitation déjà acceptée.');
      else setInvite(data);
      setLoading(false);
    })();
  }, [token]);

  async function accept() {
    if (!user || !invite) return;
    if (user.email?.toLowerCase() !== invite.invited_email?.toLowerCase()) {
      setError(`Cette invitation est pour ${invite.invited_email}. Veuillez vous connecter avec ce compte.`);
      return;
    }
    setAccepting(true);
    const { error } = await supabase
      .from('team_members')
      .update({ user_id: user.id, accepted_at: new Date().toISOString(), invite_token: null })
      .eq('id', invite.id);
    setAccepting(false);
    if (error) { setError(error.message); return; }
    toast.success(`Bienvenue dans l'équipe ${invite.companies?.name} !`);
    onDone();
  }

  async function signupAndAccept() {
    if (!invite || !password || password.length < 8) {
      toast.error('Mot de passe : 8 caractères minimum'); return;
    }
    setSigningUp(true);
    const { data, error: signErr } = await supabase.auth.signUp({
      email: invite.invited_email,
      password,
    });
    if (signErr || !data.user) {
      setSigningUp(false);
      setError(signErr?.message ?? 'Erreur d\'inscription');
      return;
    }
    const { error: updErr } = await supabase
      .from('team_members')
      .update({ user_id: data.user.id, accepted_at: new Date().toISOString(), invite_token: null })
      .eq('id', invite.id);
    setSigningUp(false);
    if (updErr) { setError(updErr.message); return; }
    toast.success(`Compte créé et invitation acceptée !`);
    onDone();
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-[#111827] rounded-xl flex items-center justify-center">
            <ReceiptText size={18} className="text-white" />
          </div>
          <span className="text-[20px] font-black tracking-tight text-[#111827]">FACTURA</span>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={28} className="animate-spin text-[#9CA3AF]" />
              <p className="text-[13px] text-[#6B7280]">Vérification de l'invitation...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <XCircle size={32} className="text-red-500" />
              <p className="text-[14px] text-[#111827] font-semibold">Impossible d'accepter</p>
              <p className="text-[13px] text-[#6B7280]">{error}</p>
              <Button onClick={onDone} variant="outline" className="mt-2">Retour</Button>
            </div>
          ) : invite ? (
            <>
              <div className="text-center space-y-2">
                <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
                <h2 className="text-[18px] font-bold text-[#0A0A0A]">
                  Invitation à rejoindre <span className="text-[#111827]">{invite.companies?.name}</span>
                </h2>
                <p className="text-[13px] text-[#6B7280]">
                  En tant que <strong>{invite.role}</strong> · {invite.invited_email}
                </p>
              </div>

              {user ? (
                <Button
                  onClick={accept}
                  disabled={accepting}
                  className="w-full h-11 bg-[#111827] hover:bg-[#1F2937] text-white"
                >
                  {accepting ? 'Acceptation...' : 'Accepter l\'invitation'}
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-[12px] text-[#6B7280] text-center">Créez votre mot de passe pour rejoindre :</p>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-widest text-[#374151]">Mot de passe</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 8 caractères"
                    />
                  </div>
                  <Button
                    onClick={signupAndAccept}
                    disabled={signingUp || password.length < 8}
                    className="w-full h-11 bg-[#111827] hover:bg-[#1F2937] text-white"
                  >
                    {signingUp ? 'Création...' : 'Créer mon compte et rejoindre'}
                  </Button>
                  <p className="text-[11px] text-center text-[#9CA3AF]">
                    Déjà un compte ? <button onClick={() => { window.location.hash = `login`; setTimeout(() => { window.location.hash = `invite=${token}`; }, 100); }} className="underline">Se connecter</button>
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
