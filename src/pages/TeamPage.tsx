import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { useTeam } from '@/hooks/useTeam';
import { useRole } from '@/hooks/useRole';
import { usePlan } from '@/hooks/usePlan';
import { TeamRole } from '@/types/database';
import { Users, Mail, Trash2, Shield, Crown, Eye, Plus, Lock, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Props { onNavigate: (page: string) => void; }

const ROLE_LABELS: Record<TeamRole, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  member: 'Membre',
  viewer: 'Lecteur',
};

const ROLE_DESC: Record<TeamRole, string> = {
  owner: 'Accès total + facturation',
  admin: 'Tout sauf facturation et suppression d\'entreprise',
  member: 'Création/édition factures, clients, produits',
  viewer: 'Lecture seule',
};

const ROLE_ICON: Record<TeamRole, React.ComponentType<{ size?: number; className?: string }>> = {
  owner: Crown,
  admin: Shield,
  member: Users,
  viewer: Eye,
};

export function TeamPage({ onNavigate }: Props) {
  const { plan, limits } = usePlan();
  const { members, loading, inviteMember, updateRole, removeMember } = useTeam();
  const { isAdmin, role: myRole } = useRole();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<TeamRole, 'owner'>>('member');
  const [submitting, setSubmitting] = useState(false);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (plan === 'starter' || plan === 'pro') {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-amber-50 rounded-2xl flex items-center justify-center">
          <Lock size={28} className="text-amber-600" />
        </div>
        <h2 className="text-[22px] font-bold text-[#0A0A0A]">Réservé au plan Business</h2>
        <p className="text-[14px] text-[#6B7280] max-w-md mx-auto">
          La gestion multi-utilisateurs est disponible à partir du plan Business (5 utilisateurs)
          et illimitée sur Enterprise.
        </p>
        <Button onClick={() => onNavigate('pricing')} className="bg-[#111827] hover:bg-[#1F2937] text-white">
          Découvrir les plans
        </Button>
      </div>
    );
  }

  const acceptedCount = members.filter(m => m.accepted_at).length;
  const remaining = isFinite(limits.multiUser) ? limits.multiUser - acceptedCount : Infinity;

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      const token = await inviteMember(email, role);
      setLastToken(token);
      setEmail('');
      toast.success('Invitation créée. Partagez le lien à votre collègue.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/#invite=${token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Lien copié !');
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-[#0A0A0A]">Équipe</h1>
          <p className="text-[13px] text-[#6B7280] mt-1">
            {acceptedCount} / {isFinite(limits.multiUser) ? limits.multiUser : '∞'} utilisateurs actifs
          </p>
        </div>
        {isAdmin && remaining > 0 && (
          <Button
            onClick={() => setInviteOpen(true)}
            className="bg-[#111827] hover:bg-[#1F2937] text-white"
          >
            <Plus size={16} className="mr-1.5" />
            Inviter un collègue
          </Button>
        )}
      </div>

      {inviteOpen && (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 space-y-4">
          <h3 className="text-[16px] font-semibold text-[#111827]">Nouvelle invitation</h3>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-[#374151]">Email</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="collegue@entreprise.ci"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-[#374151]">Rôle</Label>
                <CustomSelect
                  size="lg"
                  value={role}
                  onChange={v => setRole(v as Exclude<TeamRole, 'owner'>)}
                  options={[
                    { value: 'admin', label: 'Administrateur' },
                    { value: 'member', label: 'Membre' },
                    { value: 'viewer', label: 'Lecteur' },
                  ]}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => { setInviteOpen(false); setLastToken(null); }}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting} className="bg-[#111827] hover:bg-[#1F2937] text-white">
                {submitting ? 'Création...' : 'Créer l\'invitation'}
              </Button>
            </div>
          </form>
          {lastToken && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-2">
              <p className="text-[13px] font-semibold text-emerald-900">Invitation créée — partagez ce lien :</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white px-3 py-2 rounded-lg text-[12px] text-[#111827] truncate border border-emerald-200">
                  {window.location.origin}/#invite={lastToken}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copyInviteLink(lastToken)}
                  className="flex-shrink-0"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[13px] text-[#9CA3AF]">Chargement...</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-[#9CA3AF]">Aucun membre</div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
              <tr>
                <th className="text-left text-[11px] font-bold text-[#6B7280] uppercase tracking-widest px-6 py-3">Email</th>
                <th className="text-left text-[11px] font-bold text-[#6B7280] uppercase tracking-widest px-6 py-3">Rôle</th>
                <th className="text-left text-[11px] font-bold text-[#6B7280] uppercase tracking-widest px-6 py-3">Statut</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const Icon = ROLE_ICON[m.role];
                const isMe = false;
                const canEdit = isAdmin && m.role !== 'owner' && !isMe;
                return (
                  <tr key={m.id} className="border-b border-[#F3F4F6] last:border-0">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-[#9CA3AF]" />
                        <span className="text-[13px] text-[#111827]">{m.invited_email ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {canEdit ? (
                        <CustomSelect
                          size="sm"
                          value={m.role}
                          onChange={v => updateRole(m.id, v as TeamRole).catch(e => toast.error(e.message))}
                          options={[
                            { value: 'admin', label: 'Administrateur' },
                            { value: 'member', label: 'Membre' },
                            { value: 'viewer', label: 'Lecteur' },
                          ]}
                        />
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#374151]">
                          <Icon size={12} />
                          {ROLE_LABELS[m.role]}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {m.accepted_at ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                          En attente
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            if (confirm(`Retirer ${m.invited_email} de l'équipe ?`)) {
                              removeMember(m.id).catch(e => toast.error(e.message));
                            }
                          }}
                          className="text-[#EF4444] hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB] p-5">
        <p className="text-[12px] font-bold uppercase tracking-widest text-[#374151] mb-3">Rôles disponibles</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(['owner', 'admin', 'member', 'viewer'] as TeamRole[]).map(r => {
            const Icon = ROLE_ICON[r];
            return (
              <div key={r} className="flex items-start gap-3 bg-white rounded-xl p-3 border border-[#F3F4F6]">
                <div className="w-8 h-8 bg-[#F3F4F6] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon size={14} className="text-[#374151]" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#111827]">{ROLE_LABELS[r]}</p>
                  <p className="text-[12px] text-[#6B7280] leading-relaxed">{ROLE_DESC[r]}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
